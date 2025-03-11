import { App, Modal, MarkdownView, TFile } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { createRoot, Root } from 'react-dom/client';
import QueryModalForm from './components/QueryModalReactForm';
import { createContext } from 'react';
import LiveVariable from './main';
import { tryParseQuery } from './VariableQueryParser';
import VaultProperties from './VaultProperties';

export const AppContext = createContext<App | undefined>(undefined);

export default class QueryModal extends Modal {
	root: Root | null = null;
	customJsFuncSelected = false;
	args: string[] = [];
	vaultProperties: VaultProperties;
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
		vaultProperties: VaultProperties,
		query: string,
		onSubmit: (query: string, value: string, edit: boolean) => void
	) {
		super(app);
		this.view = view;
		if (view.file) {
			this.file = view.file;
			this.root = createRoot(this.contentEl);
			this.vaultProperties = vaultProperties;
			this.plugin = plugin;
			this.query = query;
			this.onSubmit = onSubmit;
			this.setTitle('Query Variables');
			this.renderReactForm();
		}
	}

	renderReactForm() {
		const initQuery = tryParseQuery(this.query);
		this.root?.render(
			<QueryModalForm
				modal={this}
				initQuery={initQuery}
				file={this.file}
				vaultProperties={this.vaultProperties}
			/>
		);
	}
}
