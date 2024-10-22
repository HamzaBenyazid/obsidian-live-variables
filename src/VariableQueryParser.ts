import { App, TFile } from 'obsidian';
import {
	assertListHasExactlyOneElement,
	assertNoUndefinedElems,
} from './assertions';
import { checkArrayTypes, getValueByPath, stringifyIfObj } from './utils';

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
		return value;
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

export const parseQuery = (
	query: string,
	context: LiveVariablesContext
): VarQuery => {
	const re = new RegExp(
		String.raw`(${getSupportedFunctions().join('|')})\((.*)\)`,
		'g'
	);
	const match = re.exec(query);
	if (match) {
		const func = match[1] as Functions;
		// jsFunc((x, y) => x+y+1, x, y)
		const args = parseArgs(func, match[2]);
		return {
			func,
			args,
		};
	} else {
		throw Error(`error paring ref: ${query}.`);
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
	const lambdaFuncRegex = /(.*),\s*func\s*=\s*(.+)/gm;
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
	const re = /(.*),\s*code\s*=\s*(.+)/gm;
	const match = re.exec(argsStr);
	if (match) {
		const args = [];
		const codeBlock = match[2];
		args.push(codeBlock);
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
	const varQuery = parseQuery(query, context);
	return computeValue(varQuery, context)
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

enum Functions {
	SUM = 'sum',
	GET = 'get',
	CONCAT = 'concat',
	JS_FUNC = 'jsFunc',
	CODE_BLOCK = 'codeBlock',
}

export const getFunc = (args: string[], context: LiveVariablesContext) => {
	const values = args.map((id) => getVariableValue(id, context));
	assertNoUndefinedElems(
		values,
		"Can't compute an undefined value, please make sure that all variable refrences are correctly set"
	);
	assertListHasExactlyOneElement(
		values,
		"can't get multiple values, please specify only one value"
	);
	return values[0];
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
		const values = args.slice(1).map((id) => getVariableValue(id, context));
		values.forEach((value) => {
			codeBlock = codeBlock.replace(/\{\{(.*?)\}\}/g, value);
		});
		console.log("codeBlockFunc");
		console.log(codeBlock);
		const computedValue = `\n\`\`\`\n${codeBlock}\n\`\`\`\n`;
		console.log(computedValue);
		return computedValue;
	} catch {
		return undefined;
	}
};
