import { App, FileSystemAdapter, TFile } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import { stringifyIfObj, trancateString } from './utils';
import { Property } from './main';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Properties = Record<string, any> | undefined;

export default class VaultProperties {
	private app: App;
	private vaultBasePath: string;
	private properties: Properties;
	private localProperties: Properties;
	private localKeysAndAllVariableKeys: string[];
	private localKeys: string[];

	constructor(app: App) {
		this.app = app;
		this.vaultBasePath = (
			app.vault.adapter as FileSystemAdapter
		).getBasePath();
		this.updateVaultProperties();
	}

	private updateVaultProperties() {
		this.properties = this.getDirectoryTree(this.vaultBasePath);
	}

	updateProperties(file: TFile) {
		this.updateVaultProperties();
		this.localProperties = this.getValueByPath(this.properties, file.path);
		this.updateLocalKeysAndAllVariableKeys();
	}

	private getDirectoryTree(dirPath: string): Properties {
		const result: Properties = {};
		const items = fs.readdirSync(dirPath);

		for (const item of items) {
			if (item.startsWith('.obsidian')) continue; // Ignore Obsidian system folder

			const fullPath = path.join(dirPath, item);
			const stats = fs.statSync(fullPath);

			if (stats.isDirectory()) {
				result[item] = this.getDirectoryTree(fullPath); // Recurse into folders
			} else if (path.extname(item) === '.md') {
				result[item] = this.getMarkdownProperties(fullPath); // Only include Markdown files
			}
		}
		return result;
	}

	private getMarkdownProperties(
		markdownAbsoluteFilePath: string
	): Properties {
		const vaultPath = this.vaultBasePath + '/';
		const markdownFilePath = markdownAbsoluteFilePath.slice(
			vaultPath.length
		);
		const file = this.app.vault.getFileByPath(markdownFilePath);
		if (file) {
			return this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		}
		return {};
	}

	getLocalProperty(key: string) {
		return this.localProperties?.[key];
	}

	getProperty(path: string) {
		return (
			this.getLocalProperty(path) ??
			this.getValueByPath(this.properties, path)
		);
	}

	getLocalProperties() {
		return this.localProperties;
	}

	private getValueByPath(obj: Properties, path: string): Properties {
		const keys = path.split('/'); // Split path into keys
		let result = obj;

		for (const key of keys) {
			if (result && result[key] !== undefined) {
				result = result[key]; // Traverse into the next level
			} else {
				return undefined; // Return undefined if the path is not valid
			}
		}

		return result; // Return the value at the final path
	}

	getAllVariableKeys() {
		return this.getAllPaths(this.properties);
	}

	findPropertiesWithPathContaining(searchPath: string): Property[] {
		return this.findPathsContaining(searchPath).map((key) => ({
			key,
			value: stringifyIfObj(this.getProperty(key)),
		}));
	}


	findLocalPropertiesWithPathContaining(file: TFile, searchPath: string): Property[] {
		return this.findLocalPathsContaining(searchPath).map((key) => ({
			key,
			value: stringifyIfObj(this.getProperty(key)),
		}));
	}

	findLocalPathsContaining(searchPath: string): string[] {
		if (searchPath.length === 0) {
			return this.getLocalKeys();
		}
		return this.getLocalKeys().filter((path) =>
			path.contains(searchPath)
		);
	}

	findPathsContaining(searchPath: string): string[] {
		if (searchPath.length === 0) {
			return this.getLocalKeysAndAllVariableKeys();
		}
		return this.getLocalKeysAndAllVariableKeys().filter((path) =>
			path.contains(searchPath)
		);
	}

	findPathsStartingWith(searchPath: string): string[] {
		if (searchPath.length === 0) {
			return this.getLocalKeysAndAllVariableKeys();
		}
		return this.getLocalKeysAndAllVariableKeys().filter((path) =>
			path.startsWith(searchPath)
		);
	}

	updateLocalKeysAndAllVariableKeys() {
		this.localKeys = this.getAllPaths(this.getLocalProperties());
		this.localKeysAndAllVariableKeys = [
			...this.localKeys,
			...this.getAllPaths(this.properties),
		];
	}

	getLocalKeysAndAllVariableKeys() {
		return this.localKeysAndAllVariableKeys;
	}

	getLocalKeys() {
		return this.localKeys;
	}

	private getAllPaths(obj: Properties, parentPath = ''): string[] {
		let paths: string[] = [];

		for (const [key, value] of Object.entries(obj ?? {})) {
			// Create the full path for the current key
			const fullPath = parentPath ? `${parentPath}/${key}` : key;
			paths.push(fullPath);

			if (typeof value === 'object') {
				// If it's a folder, recurse deeper
				paths = [...paths, ...this.getAllPaths(value, fullPath)];
			}
		}

		return paths;
	}

	getPropertyPreview(path: string) {
		const value = this.getProperty(path);
		return value ? trancateString(stringifyIfObj(value), 50) : 'no value';
	}
}
