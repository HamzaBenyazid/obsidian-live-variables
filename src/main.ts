import {
	App,
	Editor,
	FrontMatterCache,
	MarkdownView,
	Notice,
	Plugin,
	SuggestModal,
	TFile,
} from 'obsidian';
import {
	VarQuery,
	computeValue,
	getVariableValue,
	parseQuery,
} from './VariableQueryParser';
import { getAllNestedKeyValuePairs, stringifyIfObj } from './utils';

export default class LiveVariable extends Plugin {
	propertyChanged = (
		currentProperties: FrontMatterCache | undefined,
		newProperties: FrontMatterCache | undefined
	) => {
		for (const [newPropKey, newPropVal] of Object.entries(
			newProperties ?? {}
		)) {
			const currentPropVal = currentProperties?.[newPropKey];
			if (JSON.stringify(currentPropVal) !== JSON.stringify(newPropVal)) {
				return true;
			}
		}
		return false;
	};

	async onload() {
		let fileProperties: FrontMatterCache | undefined;
		await this.loadSettings();

		// initialize properties
		this.app.workspace.on('active-leaf-change', (leaf) => {
			const file = this.app.workspace.getActiveFile();
			if (file) {
				fileProperties =
					this.app.metadataCache.getFileCache(file)?.frontmatter;
				this.renderVariables(file);
			}
		});

		this.addCommand({
			id: 'insert-local-variable',
			name: 'Insert local variable',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new PropertySelectionModal(
					this.app,
					view,
					false,
					(property) => {
						editor.replaceSelection(
							`<span id="${property.key}"/>${property.value}<span type="end"/>`
						);
						new Notice(`Variable ${property.key} inserted`);
					}
				).open();
			},
		});

		this.addCommand({
			id: 'insert-global-variable',
			name: 'Insert variable from another note',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new PropertySelectionModal(this.app, view, true, (property) => {
					editor.replaceSelection(
						`<span id="${property.key}"/>${property.value}<span type="end"/>`
					);
					new Notice(`Variable ${property.key} inserted`);
				}).open();
			},
		});

		this.registerEvent(
			this.app.metadataCache.on('changed', (path, _, cache) => {
				const frontmatterProperties = cache.frontmatter;
				if (!fileProperties) {
					fileProperties = frontmatterProperties;
					return;
				}
				const propertyChanged = this.propertyChanged(
					fileProperties,
					frontmatterProperties
				);
				if (propertyChanged) {
					const file = this.app.vault.getFileByPath(path.path);
					if (file) {
						this.renderVariables(file);
					}
					fileProperties = frontmatterProperties;
				}
			})
		);
	}

	renderVariables(file: TFile) {
		this.renderVariablesV1(file);
		this.renderVariablesV2(file);
	}

	/**
	 * @deprecated use the {@link renderVariablesV2} method
	 */
	renderVariablesV1(file: TFile) {
		const re = new RegExp(
			String.raw`<span id="(.+?)"\/>.*?<span type="end"\/>`,
			'g'
		);
		this.app.vault.process(file, (data) => {
			[...data.matchAll(re)].forEach((match) => {
				const key = match[1];
				const value = getVariableValue(key, {
					currentFile: file,
					app: this.app,
				});
				if (value) {
					data = data.replace(
						match[0],
						`<span query="get(${key})"/>${stringifyIfObj(
							value
						)}<span type="end"/>`
					);
				} else {
					throw Error(`Couldn't get value of variable ${key}`)
				}
			});
			return data;
		});
	}

	renderVariablesV2(file: TFile) {
		const re = new RegExp(
			String.raw`<span query="(.+?)"/>.*?<span type="end"/>`,
			'g'
		);
		this.app.vault.process(file, (data) => {
			[...data.matchAll(re)].forEach((match) => {
				const query = match[1];
				const context = { currentFile: file, app: this.app };
				const varQuery: VarQuery = parseQuery(query, context);
				const value = computeValue(varQuery, context);
				if (value) {
					data = data.replace(
						match[0],
						`<span query="${query}"/>${stringifyIfObj(value)}<span type="end"/>`
					);
				}
			});
			return data;
		});
	}

	onunload() {}

	async loadSettings() {}

	async saveSettings() {}
}

interface Property {
	key: string;
	value: string;
}

export class PropertySelectionModal extends SuggestModal<Property> {
	onSelect: (property: Property) => void;
	view: MarkdownView;
	global: boolean;

	constructor(
		app: App,
		view: MarkdownView,
		global: boolean,
		onSelect: (property: Property) => void
	) {
		super(app);
		this.view = view;
		this.global = global;
		this.onSelect = onSelect;
	}

	getSuggestions(query: string): Property[] {
		if (this.global) {
			return this.getGlobalSuggestions(query);
		}
		return this.getLocalSuggestions(query);
	}

	getLocalSuggestions(query: string): Property[] {
		if (this.view.file) {
			const properties =
				this.app.metadataCache.getFileCache(this.view.file)
					?.frontmatter ?? {};
			return getAllNestedKeyValuePairs(properties)
				.filter((property) =>
					property[0].toLowerCase().includes(query.toLowerCase())
				)
				.map((entry) => ({
					key: entry[0],
					value: stringifyIfObj(entry[1]),
				}));
		}
		return [];
	}

	getGlobalSuggestions(query: string): Property[] {
		const properties = Object.assign(
			{},

			...this.app.vault.getFiles().flatMap((file) => {
				let props =
					this.app.metadataCache.getFileCache(file)?.frontmatter;
				if (props) {
					props = Object.fromEntries(
						getAllNestedKeyValuePairs(props).map(([k, v]) => [
							file.path + '/' + k,
							v,
						])
					);
				}
				return props;
			})
		);
		return Object.entries(properties)
			.filter((property) =>
				property[0].toLowerCase().includes(query.toLowerCase())
			)
			.map((entry) => ({
				key: entry[0],
				value: stringifyIfObj(entry[1]),
			}));
	}

	renderSuggestion(property: Property, el: HTMLElement) {
		el.createEl('div', { text: property.key });
		el.createEl('small', {
			text:
				property.value.substring(0, 100) +
				(property.value.length > 100 ? '...' : ''),
		});
	}

	onChooseSuggestion(property: Property, evt: MouseEvent | KeyboardEvent) {
		this.onSelect(property);
	}
}
