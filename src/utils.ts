import { App, TFile } from 'obsidian';

export const getValueByPath = (obj: any, path: string): any => {
	const keys = path.split(/\.|\[|\]/).filter(Boolean);

	return keys.reduce((acc, key) => {
		if (acc && typeof acc === 'object' && acc.hasOwnProperty(key)) {
			return acc[key];
		}
		return undefined;
	}, obj);
};

export const getAllNestedKeyValuePairs = (obj: any): [string, any][] => {
	const result: [string, any][] = [];

	function recurse(currentObj: any, currentPath: string): void {
		if (currentPath) {
			result.push([currentPath, currentObj]);
		}

		if (typeof currentObj === 'object' && currentObj !== null) {
			if (Array.isArray(currentObj)) {
				currentObj.forEach((item, index) => {
					recurse(item, `${currentPath}[${index}]`);
				});
			} else {
				for (const key in currentObj) {
					if (currentObj.hasOwnProperty(key)) {
						recurse(
							currentObj[key],
							currentPath ? `${currentPath}.${key}` : key
						);
					}
				}
			}
		}
	}

	recurse(obj, '');
	return result;
};

export const stringifyIfObj = (obj: any) => {
	if (typeof obj === 'object') {
		return JSON.stringify(obj);
	}
	return String(obj);
};

export const checkArrayTypes = (arr: any[]) => {
	if (!Array.isArray(arr)) return 'string';
	const firstType = typeof arr[0];
	const allSameType = arr.every((item) => typeof item === firstType);
	return allSameType ? firstType : 'string';
};

export const getAllVaultProperties = (
	app: App | undefined
): Record<string, never> => {
	return (
		app?.vault.getFiles().reduce((acc, file) => {
			const props = app.metadataCache.getFileCache(file)?.frontmatter;
			if (props) {
				const nestedProps = getAllNestedKeyValuePairs(props).reduce(
					(nestedAcc: Record<string, never>, [key, value]:[string, never]) => {
						nestedAcc[`${file.path}/${key}`] = value;
						return nestedAcc;
					},
					{}
				);
				Object.assign(acc, nestedProps);
			}
			return acc;
		}, {}) ?? {}
	);
};

export const getFileProperties = (
	file: TFile | null,
	app: App | undefined
): Record<string, never> => {
	if (!app || !file) return {};
	const props = app.metadataCache.getFileCache(file)?.frontmatter;
	if (props) {
		const nestedProps = getAllNestedKeyValuePairs(props).reduce(
			(
				nestedAcc: Record<string, never>,
				[key, value]: [string, never]
			) => {
				nestedAcc[key] = value;
				return nestedAcc;
			},
			{}
		);
		return nestedProps;
	}
	return {};
};

export const findParentWithClass = (
	element: HTMLElement,
	className: string
) => {
	let parent = element.parentElement;
	while (parent !== null) {
		if (parent.classList.contains(className)) {
			return parent;
		}
		parent = parent.parentElement;
	}
	return null;
};

export const trancateString = (str: string, maxLength: number): string => {
	return str.length > 100 ? str.substring(0, maxLength) + '...' : str;
};

export const minimizeJsFunction = (multiLineFunction: string) => {
	return multiLineFunction
		.replace(/\s+/g, ' ')
		.replace(/\s*{\s*/g, ' { ')
		.replace(/\s*}\s*/g, ' } ')
		.replace(/;\s*/, '; ')
		.trim();
};

export const firstNElement = (arr: any[], n: number, defaultValue: any) => {
	return arr
		.slice(0, n)
		.concat(Array(Math.max(n - arr.length, 0)).fill(defaultValue));
};

export function copyToClipboard(text: string) {
	navigator.clipboard
		.writeText(text)
		.then(function () {
			console.log('Text copied to clipboard');
		})
		.catch(function (error) {
			console.error('Failed to copy text: ', error);
		});
}

export const getArgNames = (funcStr: string) => {
	const argsMatch = funcStr.match(/^\s*\(([^)]*)\)\s*=>/);

	if (argsMatch && argsMatch[1].trim()) {
		return argsMatch[1]
			.split(',')
			.map((arg) => arg.trim())
			.filter((arg) => arg.length != 0);
	}

	const singleArgMatch = funcStr.match(/^\s*([^()\s]+)\s*=>/);
	if (singleArgMatch) {
		return [singleArgMatch[1].trim()].filter((arg) => arg.length != 0);
	}

	return [];
};
