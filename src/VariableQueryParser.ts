import { App, TFile } from 'obsidian';
import {
	assertListHasExactlyOneElement,
	assertNoUndefinedElems,
} from './assertions';
import { checkArrayTypes, getValueByPath } from './utils';

export const getVariableValue = (id: string, context: LiveVariablesContext) => {
	const lastSlashIndex = id.lastIndexOf('/');
	let variableId;
	let variableFile;
	if (lastSlashIndex === -1) {
		variableFile = context.currentFile;
		variableId = id;
	} else {
		const filePath = id.substring(0, lastSlashIndex);
		variableId = id.substring(lastSlashIndex + 1);
		variableFile = context.app.vault.getFileByPath(filePath);
	}
	if (variableFile) {
		const value = getValueByPath(
			context.app.metadataCache.getFileCache(variableFile)?.frontmatter,
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
	app: App;
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

export const parseArgs = (
	func: string,
	argsStr: string,
): string[] => {
	if(func !== Functions.JS_FUNC){
		return argsStr.split(",").map((v) => v.trim());
	}
	const lambdaFuncRegex = /(.+),\s*func\s*=\s*(.+)/gm
	const match = lambdaFuncRegex.exec(argsStr)
	if(match){
		const args = [] 
		const lambdaFunc = match[2];
		args.push(lambdaFunc, ...match[1].split(",").map((v) => v.trim()));
		return args;
	} else {
		throw Error("parseArgs error")
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
	}
};

enum Functions {
	SUM = 'sum',
	GET = 'get',
	CONCAT = 'concat',
	JS_FUNC = 'jsFunc',
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
	return values[1];
};

export const sumFunc = (args: string[], context: LiveVariablesContext) => {
	const values = args.map((id) => getVariableValue(id, context));
	const valueType = checkArrayTypes(values);
	const neutralValues = {
		string: '',
		number: 0,
	} as any;
	if(neutralValues[valueType] === undefined){
		throw Error(`cannot sum variables of type ${valueType}`)
	}
	return values.reduce((a, b) => a + b, neutralValues[valueType]);
};

export const customJsFunc = (args: string[], context: LiveVariablesContext) => {
	const lambdaStr = args[0];
	const lambdaFunc = new Function('return ' + lambdaStr)();
	const values = args.slice(1).map((id) => getVariableValue(id, context));
	assertNoUndefinedElems(
		values,
		"Can't compute an undefined value, please make sure that all variable refrences are correctly set"
	);
	return lambdaFunc(...values);
};


