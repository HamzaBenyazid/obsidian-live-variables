import { App, TFile } from 'obsidian';
import { assertNoUndefinedElems } from './assertions';
import { checkArrayTypes, getValueByPath, stringifyIfObj } from './utils';
import { unescape } from 'he';

export const getVariableValue = (id: string, context: LiveVariablesContext) => {
	if (id === '') return undefined;
	const lastSlashIndex = id.lastIndexOf('/');
	let variableId;
	let variableFile;
	if (lastSlashIndex === -1) {
		variableFile = context.currentFile;
		variableId = id;
	} else {
		const filePath = id.substring(0, lastSlashIndex);
		variableId = id.substring(lastSlashIndex + 1);
		variableFile = context.app?.vault.getFileByPath(filePath);
	}
	if (variableFile) {
		const value = getValueByPath(
			context.app?.metadataCache.getFileCache(variableFile)?.frontmatter,
			variableId
		);
		return value !== null ? value : '';
	}
	return undefined;
};

const getSupportedFunctions = (): string[] => {
	return Object.values(Functions);
};

export interface VarQuery {
	func: Functions;
	args: string[];
}

export interface LiveVariablesContext {
	app: App | undefined;
	currentFile: TFile;
}

export const parseQuery = (query: string): VarQuery => {
	const re = new RegExp(
		String.raw`(${getSupportedFunctions().join('|')})\(([\s\S]*)\)`,
		'g'
	);
	const match = re.exec(query);
	if (match) {
		const func = match[1] as Functions;
		const args = parseArgs(func, match[2]);
		return {
			func,
			args,
		};
	} else {
		throw Error(`error parsing ref: ${query}.`);
	}
};

export const tryParseQuery = (query: string): VarQuery | undefined => {
	try {
		return parseQuery(query);
	} catch (e) {
		return undefined;
	}
};

export const parseArgs = (func: string, argsStr: string): string[] => {
	switch (func) {
		case Functions.JS_FUNC:
			return parseJsFuncArgs(argsStr);
		case Functions.CODE_BLOCK:
			return parseCodeBlockArgs(argsStr);
		default:
			return argsStr.split(',').map((v) => v.trim());
	}
};

const parseJsFuncArgs = (argsStr: string): string[] => {
	const lambdaFuncRegex = /(.*),\s*func\s*=\s*(.+)\s*/gm;
	const match = lambdaFuncRegex.exec(argsStr);
	if (match) {
		const args = [];
		const lambdaFunc = match[2];
		args.push(lambdaFunc);
		if (match[1].length !== 0) {
			args.push(...match[1].split(',').map((v) => v.trim()));
		}
		return args;
	} else {
		throw Error('parseArgs error');
	}
};

const parseCodeBlockArgs = (argsStr: string): string[] => {
	const re = /(.*),\s*code\s*=\s*([\s\S]*)\s*,\s*lang\s*=\s*(.+)\s*/gm;
	const match = re.exec(argsStr);
	if (match) {
		const args = [];
		const codeBlock = match[2];
		const lang = match[3];
		args.push(codeBlock, lang);
		if (match[1].length !== 0) {
			args.push(...match[1].split(',').map((v) => v.trim()));
		}
		return args;
	} else {
		throw Error('parseArgs error');
	}
};

export const computeValueFromQuery = (
	query: string,
	context: LiveVariablesContext
) => {
	const varQuery = parseQuery(query);
	return computeValue(varQuery, context);
};

export const tryComputeValueFromQuery = (
	query: string,
	context: LiveVariablesContext
) => {
	try {
		const varQuery = parseQuery(query);
		return computeValue(varQuery, context);
	} catch (e) {
		return undefined;
	}
};

export const computeValue = (
	varQuery: VarQuery,
	context: LiveVariablesContext
) => {
	switch (varQuery.func) {
		case Functions.SUM:
			return sumFunc(varQuery.args, context);
		case Functions.GET:
			return getFunc(varQuery.args, context);
		case Functions.JS_FUNC:
			return customJsFunc(varQuery.args, context);
		case Functions.CODE_BLOCK:
			return codeBlockFunc(varQuery.args, context);
	}
};

export enum Functions {
	SUM = 'sum',
	GET = 'get',
	CONCAT = 'concat',
	JS_FUNC = 'jsFunc',
	CODE_BLOCK = 'codeBlock',
}

export const getFunc = (args: string[], context: LiveVariablesContext) => {
	const values = args.map((id) => getVariableValue(id, context));
	return values[0] ?? '';
};

export const sumFunc = (args: string[], context: LiveVariablesContext) => {
	const values = args.map((id) => getVariableValue(id, context));
	const valueType = checkArrayTypes(values);
	const neutralValue = valueType === 'number' ? 0 : '';
	return values.reduce(
		(a, b) =>
			valueType === 'number'
				? a + b
				: stringifyIfObj(a) + stringifyIfObj(b),
		neutralValue
	);
};

export const customJsFunc = (args: string[], context: LiveVariablesContext) => {
	try {
		const lambdaStr = args[0];
		const lambdaFunc = new Function('return ' + lambdaStr)();
		const values = args.slice(1).map((id) => getVariableValue(id, context));
		assertNoUndefinedElems(
			values,
			"Can't compute an undefined value, please make sure that all variable refrences are correctly set"
		);
		const computedValue = lambdaFunc(...values);
		return computedValue;
	} catch {
		return undefined;
	}
};

export const codeBlockFunc = (
	args: string[],
	context: LiveVariablesContext
) => {
	try {
		let codeBlock = args[0];
		const lang = args[1];
		const values = args.slice(2).map((id) => getVariableValue(id, context));
		values.forEach((value) => {
			codeBlock = codeBlock.replace(/\{\{(.*?)\}\}/, value);
		});
		const computedValue = `\n\`\`\`${lang}\n${codeBlock}\n\`\`\`\n`;
		return unescape(computedValue);
	} catch {
		return undefined;
	}
};
