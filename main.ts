import {
	App,
	Editor,
	FrontMatterCache,
	MarkdownView,
	Notice,
	Plugin,
	SuggestModal,
	TFile,
} from "obsidian";

export default class LiveVariable extends Plugin {
	escapeRegExp = (text: string): string => {
		return text?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	};

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
		this.app.workspace.on("active-leaf-change", (leaf) => {
			const file = this.app.workspace.getActiveFile();
			if (file) {
				fileProperties =
					this.app.metadataCache.getFileCache(file)?.frontmatter;
				this.renderVariables(file);
			}
		});

		this.addCommand({
			id: "insert-local-variable",
			name: "Insert local variable",
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
			id: "insert-global-variable",
			name: "Insert variable from another note",
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
			this.app.metadataCache.on("changed", (path, _, cache) => {
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
		const re = new RegExp(
			String.raw`<span id="(.+?)"/>.+?<span type="end"/>`,
			"g"
		);
		this.app.vault.process(file, (data) => {
			[...data.matchAll(re)].forEach((match) => {
				const key = match[1];
				const lastSlashIndex = key.lastIndexOf("/");
				let variableId;
				let variableFile;
				if (lastSlashIndex === -1) {
					variableFile = file;
					variableId = key;
				} else {
					const filePath = key.substring(0, lastSlashIndex);
					variableId = key.substring(lastSlashIndex + 1);
					variableFile = this.app.vault.getFileByPath(filePath);
				}
				if (variableFile) {
					const value =
						this.app.metadataCache.getFileCache(variableFile)
							?.frontmatter?.[variableId]; // fetch value
					data = data.replace(
						match[0],
						`<span id="${key}"/>${value}<span type="end"/>`
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
	onSelect: (property: Property) => any;
	view: MarkdownView;
	global: boolean;

	constructor(
		app: App,
		view: MarkdownView,
		global: boolean,
		onSelect: (property: Property) => any
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
			return Object.entries(properties)
				.filter((property) =>
					property[0].toLowerCase().includes(query.toLowerCase())
				)
				.map((entry) => ({ key: entry[0], value: entry[1] }));
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
						Object.entries(props).map(([key, value]) => {
							return [file.path + "/" + key, value];
						})
					);
				}
				return props;
			})
		);
		return Object.entries(properties)
			.filter((property) =>
				property[0].toLowerCase().includes(query.toLowerCase())
			)
			.map((entry) => ({ key: entry[0], value: entry[1] as string }));
	}

	renderSuggestion(property: Property, el: HTMLElement) {
		el.createEl("div", { text: property.key });
		el.createEl("small", { text: property.value });
	}

	onChooseSuggestion(property: Property, evt: MouseEvent | KeyboardEvent) {
		this.onSelect(property);
	}
}
