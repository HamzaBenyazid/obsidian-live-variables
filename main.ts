import { App, Editor, FrontMatterCache, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, SuggestModal } from 'obsidian';

interface LiveVariableSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: LiveVariableSettings = {
	mySetting: 'default'
}

export default class LiveVariable extends Plugin {
	properties: FrontMatterCache | undefined;

	changedProperty = (newProperties: FrontMatterCache | undefined) => {
		for (let [newPropKey, newPropVal] of Object.entries(newProperties ?? {})) {
			let currentPropVal = this.properties?.[newPropKey];
			if (currentPropVal !== newPropVal) {
				return [newPropKey, newPropVal];
			}
		}
		return undefined;
	}

	async onload() {
		await this.loadSettings();

		// initialize properties
		this.app.workspace.on("file-open", (file)=>{
			if(file){
				this.properties = this.app.metadataCache.getFileCache(file)?.frontmatter;
			}
		})

		this.addCommand({
			id: 'insert-live-variable',
			name: 'Insert Live Variable',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (view.file) {
					this.properties = this.app.metadataCache.getFileCache(view.file)?.frontmatter;
				}
				let file = view.file;
				if (file) {
					new PropertySelectionModal(
						this.app,
						this.properties ?? {},
						(property) => {
							editor.replaceSelection(`<span id="${property.key}">${property.value}</span>`);
							new Notice(`Variable ${property.key} inserted`);
						}).open();
				}
			}
		});

		this.registerEvent(
			this.app.metadataCache.on("changed", (path, data, cache) => {
				let frontmatterProperties = cache.frontmatter
				if (!this.properties) {
					this.properties = frontmatterProperties;
					return
				}
				let changedProperty = this.changedProperty(frontmatterProperties)
				if (changedProperty) {
					let key = changedProperty[0]
					let newValue = changedProperty[1]
					new Notice(`property ${key} changed to ${newValue}. Resolving all references...`);
					let file = this.app.vault.getFileByPath(path.path);
					if (file) {
						let re = new RegExp(String.raw`<span id="${key}">.+?<\/span>`, "g")
						console.log(re.exec(data))
						data = data.replace(re, `<span id="${key}">${newValue}</span>`)
						const view = this.app.workspace.getActiveViewOfType(MarkdownView);
						if (view) {
							view.editor.setValue(data);
						}
					}
					this.properties = frontmatterProperties;
				}
			}),
		);
	}

	onunload() {

	}

	async loadSettings() {
	}

	async saveSettings() {
	}
}

interface Property {
	key: string;
	value: string;
}

export class PropertySelectionModal extends SuggestModal<Property> {
	onSelect: (property: Property) => any
	properties: FrontMatterCache

	constructor(app: App, properties: FrontMatterCache, onSelect: (property: Property) => any) {
		super(app);
		this.properties = properties;
		this.onSelect = onSelect;
	}

	getSuggestions(query: string): Property[] {
		return Object.entries(this.properties).filter((property) =>
			property[0].toLowerCase().includes(query.toLowerCase())
		).map(entry => ({ key: entry[0], value: entry[1] }));
	}

	renderSuggestion(property: Property, el: HTMLElement) {
		el.createEl("div", { text: property.key });
		el.createEl("small", { text: property.value });
	}

	onChooseSuggestion(property: Property, evt: MouseEvent | KeyboardEvent) {
		this.onSelect(property);
	}
}