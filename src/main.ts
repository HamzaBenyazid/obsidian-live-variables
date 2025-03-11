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
import { tryComputeValueFromQuery } from './VariableQueryParser';
import {
	trancateString,
	stringifyIfObj,
	htmlEscapeNewLine,
	getNewLinesFromHtmlEscaping,
} from './utils';
import QueryModal from './QueryModal';
import {
	DEFAULT_SETTINGS,
	LiveVariablesSettings,
	LiveVariablesSettingTab,
} from './LiveVariablesSettings';
import { unescape } from 'he';
import VaultProperties from './VaultProperties';

export default class LiveVariable extends Plugin {
	public settings: LiveVariablesSettings;
	public vaultProperties: VaultProperties;

	propertyChanged = (
		currentProperties: FrontMatterCache | undefined,
		newProperties: FrontMatterCache | undefined
	) => {
		if (
			Object.entries(currentProperties ?? {}).length !==
			Object.entries(newProperties ?? {}).length
		) {
			return true;
		}
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

		this.vaultProperties = new VaultProperties(this.app);

		// initialize properties
		this.app.workspace.on('active-leaf-change', (leaf) => {
			const file = this.app.workspace.getActiveFile();
			if (file) {
				this.vaultProperties.updateProperties(file);
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
							`<span query="get(${property.key})"></span>${property.value}<span type="end"></span>\n`
						);
						new Notice(`Variable ${property.key} inserted`);
					},
					this.vaultProperties
				).open();
			},
		});

		this.addCommand({
			id: 'insert-global-variable',
			name: 'Insert variable from another note',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new PropertySelectionModal(
					this.app,
					view,
					true,
					(property) => {
						editor.replaceSelection(
							`<span query="get(${property.key})"></span>${property.value}<span type="end"></span>\n`
						);
						new Notice(`Variable ${property.key} inserted`);
					},
					this.vaultProperties
				).open();
			},
		});

		this.addCommand({
			id: 'query-variables',
			name: 'Query variables',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const re = new RegExp(
					String.raw`<span query="([\s\S]+?)"><\/span>`,
					'g'
				);
				const editorPosition = editor.getCursor();
				const lines = editor.getValue().split('\n');
				let query = '';
				let refStartLine = 0;
				let refEndLine = 0;
				let refStartCh = 0;
				let refEndCh = 0;

				// Traverse lines above the cursor to find the opening backticks
				for (let i = editorPosition.line; i >= 0; i--) {
					if (
						i !== editorPosition.line &&
						lines[i].contains('<span type="end"></span>')
					) {
						break;
					}
					const match = re.exec(lines[i]);
					if (match) {
						query = getNewLinesFromHtmlEscaping(match[1]);
						refStartLine = i;
						// Get start position of match[1]
						refStartCh = match.index;
						break;
					}
				}

				const refEndRE = new RegExp(
					String.raw`<span type="end"><\/span>`,
					'g'
				);
				// Traverse lines bellow to search for the end of the reference
				for (let i = editorPosition.line; i < editor.lineCount(); i++) {
					const match = refEndRE.exec(lines[i]);
					if (match) {
						refEndLine = i;
						refEndCh = match.index + match[0].length;
						break;
					}
				}

				new QueryModal(
					this.app,
					view,
					this,
					this.vaultProperties,
					query,
					(query, value, edit) => {
						if (edit) {
							editor.setSelection(
								{ line: refStartLine, ch: refStartCh },
								{ line: refEndLine, ch: refEndCh }
							);
						}
						editor.replaceSelection(
							`<span query="${htmlEscapeNewLine(
								query
							)}"></span>${unescape(
								value
							)}<span type="end"></span>\n`
						);
						new Notice(`Query ${edit ? 'Updated' : 'Inserted'}`);
					}
				).open();
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
						this.vaultProperties.updateProperties(file);
					}
					fileProperties = frontmatterProperties;
				}
			})
		);

		this.addSettingTab(new LiveVariablesSettingTab(this.app, this));
	}

	renderVariables(file: TFile) {
		this.renderVariablesV1(file);
		this.renderVariablesV2(file);
		this.renderVariablesV3(file);
	}

	/**
	 * @deprecated use the {@link renderVariablesV2} method
	 */
	renderVariablesV1(file: TFile) {
		const re = new RegExp(
			String.raw`<span id="([^"]+)"\/>.*?<span type="end"\/>`,
			'g'
		);
		this.app.vault.process(file, (data) => {
			[...data.matchAll(re)].forEach((match) => {
				const key = match[1];
				const value = this.vaultProperties.getProperty(key);
				if (value) {
					data = data.replace(
						match[0],
						`<span query="get(${key})"></span>${stringifyIfObj(
							value
						)}<span type="end"></span>`
					);
				} else {
					data = data.replace(
						match[0],
						`<span query="get(${key})"></span><span style="color: red">Live Variable Error</span><span type="end"></span>`
					);
					new Notice(`Failed to get value of variable ${key}`);
				}
			});
			return data;
		});
	}

	renderVariablesV2(file: TFile) {
		const re = new RegExp(
			String.raw`<span query="([^"]+)"\/>[\s\S]*?<span type="end"\/>`,
			'g'
		);
		this.app.vault.process(file, (data) => {
			[...data.matchAll(re)].forEach((match) => {
				const escapedQuery = match[1];
				const query = getNewLinesFromHtmlEscaping(escapedQuery);
				const value = tryComputeValueFromQuery(
					query,
					this.vaultProperties
				);
				if (value !== undefined) {
					data = data.replace(
						match[0],
						`<span query="${escapedQuery}"></span>${stringifyIfObj(
							value
						)}<span type="end"></span>`
					);
				} else {
					data = data.replace(
						match[0],
						`<span query="${escapedQuery}"></span>${this.errorSpan(
							'Invalid Query'
						)}<span type="end"></span>`
					);
					new Notice(
						`Failed to get value of query "${escapedQuery}"`
					);
				}
			});
			return data;
		});
	}

	renderVariablesV3(file: TFile) {
		const re = new RegExp(
			String.raw`<span query="([^"]+?)"><\/span>[\s\S]*?<span type="end"><\/span>`,
			'g'
		);
		this.app.vault.process(file, (data) => {
			[...data.matchAll(re)].forEach((match) => {
				const escapedQuery = match[1];
				const query = getNewLinesFromHtmlEscaping(escapedQuery);
				const value = tryComputeValueFromQuery(
					query,
					this.vaultProperties
				);
				if (value !== undefined) {
					data = data.replace(
						match[0],
						`<span query="${escapedQuery}"></span>${stringifyIfObj(
							value
						)}<span type="end"></span>`
					);
				} else {
					data = data.replace(
						match[0],
						`<span query="${escapedQuery}"></span>${this.errorSpan(
							'Invalid Query'
						)}<span type="end"></span>`
					);
					new Notice(
						`Failed to get value of query "${escapedQuery}"`
					);
				}
			});
			return data;
		});
	}

	errorSpan = (message: string) => {
		return `<span style="color: red">Error: ${message}</span>`;
	};

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

export interface Property {
	key: string;
	value: string;
}

export class PropertySelectionModal extends SuggestModal<Property> {
	onSelect: (property: Property) => void;
	view: MarkdownView;
	global: boolean;
	vaultProperties: VaultProperties;

	constructor(
		app: App,
		view: MarkdownView,
		global: boolean,
		onSelect: (property: Property) => void,
		vaultProperties: VaultProperties
	) {
		super(app);
		this.view = view;
		this.global = global;
		this.onSelect = onSelect;
		this.vaultProperties = vaultProperties;
	}

	getSuggestions(query: string): Property[] {
		if (this.global) {
			return this.getGlobalSuggestions(query);
		}
		return this.getLocalSuggestions(query);
	}

	getLocalSuggestions(query: string): Property[] {
		if (this.view.file) {
			return this.vaultProperties.findLocalPropertiesWithPathContaining(
				this.view.file,
				query
			);
		}
		return [];
	}

	getGlobalSuggestions(query: string): Property[] {
		return this.vaultProperties.findPropertiesWithPathContaining(query);
	}

	renderSuggestion(property: Property, el: HTMLElement) {
		el.createEl('div', { text: property.key });
		el.createEl('small', {
			text: trancateString(property.value, 100),
		});
	}

	onChooseSuggestion(property: Property, evt: MouseEvent | KeyboardEvent) {
		this.onSelect(property);
	}
}
