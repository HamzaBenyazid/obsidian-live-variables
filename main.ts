import { App, Editor, FrontMatterCache, MarkdownView, Notice, Plugin, SuggestModal } from 'obsidian';

export default class LiveVariable extends Plugin {

	escapeRegExp = (text: string): string => {
		return text?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	changedProperty = (currentProperties: FrontMatterCache | undefined, newProperties: FrontMatterCache | undefined) => {
		for (let [newPropKey, newPropVal] of Object.entries(newProperties ?? {})) {
			let currentPropVal = currentProperties?.[newPropKey];
			if (JSON.stringify(currentPropVal) !== JSON.stringify(newPropVal)) {
				return [newPropKey, newPropVal];
			}
		}
		return undefined;
	}

	async onload() {
		let properties: FrontMatterCache | undefined;
		await this.loadSettings();

		// initialize properties
		this.app.workspace.on("active-leaf-change", (leaf) => {
			const file = this.app.workspace.getActiveFile();
			if (file) {
				properties = this.app.metadataCache.getFileCache(file)?.frontmatter;
			}
		})

		this.addCommand({
			id: 'insert-live-variable',
			name: 'Insert live variable',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new PropertySelectionModal(
					this.app,
					view,
					(property) => {
						editor.replaceSelection(`<span id="${property.key}"/>${property.value}`);
						new Notice(`Variable ${property.key} inserted`);
					}).open();
			}
		});

		this.registerEvent(
			this.app.metadataCache.on("changed", (path, _, cache) => {
				let frontmatterProperties = cache.frontmatter
				if (!properties) {
					properties = frontmatterProperties;
					return
				}
				let changedProperty = this.changedProperty(properties ,frontmatterProperties)
				if (changedProperty) {
					let key = changedProperty[0]
					let newValue = changedProperty[1]
					let file = this.app.vault.getFileByPath(path.path);
					if (file) {
						let re = new RegExp(String.raw`<span id="${key}"/>${this.escapeRegExp(properties[key])}`, "g")
						this.app.vault.process(file, (data) => data.replace(re, `<span id="${key}"/>${newValue}`))
					}
					properties = frontmatterProperties;
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
	view: MarkdownView

	constructor(app: App, view: MarkdownView, onSelect: (property: Property) => any) {
		super(app);
		this.view = view;
		this.onSelect = onSelect;
	}

	getSuggestions(query: string): Property[] {
		if(this.view.file){
			const properties = this.app.metadataCache.getFileCache(this.view.file)?.frontmatter ?? {}
			return Object.entries(properties).filter((property) =>
				property[0].toLowerCase().includes(query.toLowerCase())
			).map(entry => ({ key: entry[0], value: entry[1] }));
		}
		return []
	}

	renderSuggestion(property: Property, el: HTMLElement) {
		el.createEl("div", { text: property.key });
		el.createEl("small", { text: property.value });
	}

	onChooseSuggestion(property: Property, evt: MouseEvent | KeyboardEvent) {
		this.onSelect(property);
	}
}