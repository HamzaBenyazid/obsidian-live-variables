import { App, Modal, MarkdownView, TFile } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { getAllVaultProperties } from './utils';
import { createRoot, Root } from 'react-dom/client';
import QueryModalForm from './components/QueryModalReactForm';
import { createContext } from 'react';
import LiveVariable from './main';

export const AppContext = createContext<App | undefined>(undefined);

export default class QueryModal extends Modal {
	root: Root | null = null;
	customJsFuncSelected = false;
	args: string[] = [];
	variables: Record<string, never> = {};
	codeMirrorEditor: EditorView | null = null;
	funcOption = '';
	view: MarkdownView;
	file: TFile;
	query = '';
	value = '';
	plugin: LiveVariable;
	onSubmit: (query: string, value: string, edit: boolean) => void;

	constructor(
		app: App,
		view: MarkdownView,
		plugin: LiveVariable,
		query: string,
		onSubmit: (query: string, value: string, edit: boolean) => void
	) {
		super(app);
		this.view = view;
		if (view.file) {
			this.file = view.file;
			this.root = createRoot(this.contentEl);
			this.variables = getAllVaultProperties(this.app);
			this.plugin = plugin;
			this.query = query;
			this.onSubmit = onSubmit;
			this.setTitle('Query Variables');
			this.renderReactForm();
		}
	}

	renderReactForm() {
		this.root?.render(<QueryModalForm modal={this} initQuery={this.query} file={this.file}/>);
	}
}
