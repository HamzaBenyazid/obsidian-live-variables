import { useCallback, useEffect, useState } from 'react';
import Setting from './obsidian-components/Setting';
import CodeEditor from './CodeEditor';
import {
	copyToClipboard,
	firstNElement,
	getAllVaultProperties,
	getArgNames,
	getFileProperties,
	minifyCode,
	stringifyIfObj,
	trancateString,
} from 'src/utils';
import { CloseOutlined, SaveFilled } from '@ant-design/icons';
import { computeValueFromQuery, parseQuery } from 'src/VariableQueryParser';
import QueryModal from 'src/QueryModal';
import { LiveVariablesSettings } from 'src/LiveVariablesSettings';
import { TFile } from 'obsidian';
import { escape, unescape } from 'he';

interface QueryModalFormProperties {
	modal: QueryModal;
	initQuery: string;
	file: TFile;
}

interface FuncOption {
	displayValue: string;
	desc: string;
	exactArgsSize?: number;
	minArgsSize?: number;
	maxArgsSize?: number;
	code?: string;
}

const defaultQueryFuncOptions: Record<string, FuncOption> = {
	get: {
		displayValue: 'get',
		desc: 'Gets single variable value',
		exactArgsSize: 1,
	},
	sum: {
		displayValue: 'sum',
		desc: 'Sums multiple values, if the values are numbers the function sums them, concatenates their string representations otherwise',
		minArgsSize: 2,
	},
	jsFunc: {
		displayValue: 'Custom JS Function',
		desc: 'Custom function to be executed with the given arguments.',
	},
	codeBlock: {
		displayValue: 'Code Block',
		desc: 'Insert a code block containing variables enclosed with {{var_name}}',
	},
};

const QueryModalForm: React.FC<QueryModalFormProperties> = ({
	modal,
	initQuery,
	file,
}) => {
	const app = modal.app;
	const variables: Record<string, never> = {
		...getFileProperties(modal.file, app),
		...getAllVaultProperties(app),
	};
	const defaultQueryFunction = 'get';
	const [queryFunc, setQueryFunc] = useState<string>(defaultQueryFunction);
	const [vars, setVars] = useState<[string, string][]>([]);
	const [value, setValue] = useState<string | undefined>(undefined);
	const [previewValue, setPreviewValue] = useState<string>('No valid value');
	const [functionArgs, setFunctionArgs] = useState<string[]>([]);
	const [codeBlockArgs, setCodeBlockArgs] = useState<string[]>([]);
	const [codeBlockLang, setCodeBlockLang] = useState<string>('');
	const [queryFuncOptions, setQueryFuncOptions] = useState<
		Record<string, FuncOption>
	>(defaultQueryFuncOptions);
	const [functionCode, setFunctionCode] = useState<string>(
		'(a, b) => {\n  return a + b;\n}'
	);
	const [codeBlockText, setCodeBlockText] = useState<string>('');
	const [codeError, setCodeError] = useState<string | undefined>(undefined);
	const [argsError, setArgsError] = useState<string | undefined>(undefined);
	const [visibleArgsError, setVisibleArgsError] = useState<boolean>(false);
	const gptPrompt = `Please write me a lambda function in javascript that {{what should the function do}}, the format should be like : 
	\`\`\`
		(a, b) => {
		return a + b;
		}
	\`\`\``;
	const [saveFunctionChecked, setSaveFunctionChecked] =
		useState<boolean>(false);
	const [functionName, setFunctionName] = useState<string>('');
	const [query, setQuery] = useState<string>('');

	const saveFunction = () => {
		const settings: LiveVariablesSettings = modal.plugin.settings;
		if (
			settings.customFunctions
				.map((customFunctiom) => customFunctiom.name)
				.contains(functionName)
		) {
			return;
		}
		settings.customFunctions.push({
			key: functionName,
			name: functionName,
			code: functionCode,
		});
		modal.plugin.saveData(settings);
	};

	const valideFunctionCode = useCallback(() => {
		try {
			Function('return' + functionCode);
			setCodeError(undefined);
		} catch (error) {
			if (error instanceof Error) {
				setCodeError('Code error: ' + error.message);
			} else {
				setCodeError('An unknown error occurred');
			}
			return false;
		}
		return true;
	}, [functionCode]);

	const isCustomFunction = useCallback(() => {
		return queryFunc === 'jsFunc' || isSavedCustomFunction();
	}, [queryFunc, queryFuncOptions]);

	const isSavedCustomFunction = useCallback(() => {
		return queryFuncOptions[queryFunc].code ?? false;
	}, [queryFunc, queryFuncOptions]);

	const valideArg = ([name, val]: [string, string]): boolean => {
		if (variables[val] === undefined) {
			setArgsError(`variable ${val} not found`);
			return false;
		}
		return true;
	};

	const valideArgs = useCallback(() => {
		const exactSize = isCustomFunction()
			? functionArgs.length
			: queryFunc === 'codeBlock'
			? Array.from(new Set(codeBlockArgs)).length
			: queryFuncOptions[queryFunc].exactArgsSize;
		const minSize = queryFuncOptions[queryFunc].minArgsSize;
		const maxSize = queryFuncOptions[queryFunc].maxArgsSize;
		if (vars.some((v) => v[1].length === 0)) return false;
		if (exactSize && vars.length === exactSize) {
			return vars.every(valideArg);
		}
		if (
			minSize &&
			maxSize &&
			vars.length < maxSize &&
			vars.length >= minSize
		) {
			return vars.every(valideArg);
		}
		if (minSize && vars.length >= minSize) {
			return vars.every(valideArg);
		}
		if (!maxSize && !minSize && !exactSize) {
			return vars.every(valideArg);
		}
		return false;
	}, [queryFuncOptions, functionArgs, queryFunc, vars]);

	const addableArg = useCallback(() => {
		const exactSize = isCustomFunction()
			? functionArgs.length
			: queryFunc === 'codeBlock'
			? Array.from(new Set(codeBlockArgs)).length
			: queryFuncOptions[queryFunc].exactArgsSize;
		const maxSize = queryFuncOptions[queryFunc].maxArgsSize;
		return (
			((exactSize || exactSize === 0) && exactSize > vars.length) ||
			((maxSize || maxSize === 0) && vars.length < maxSize) ||
			(!(exactSize || exactSize === 0) && !(maxSize || maxSize === 0))
		);
	}, [queryFunc, functionArgs, codeBlockArgs, vars]);

	const removableArg = useCallback(() => {
		const exactSize = isCustomFunction()
			? functionArgs.length
			: queryFunc === 'codeBlock'
			? codeBlockArgs.length
			: queryFuncOptions[queryFunc].exactArgsSize;
		const minSize = queryFuncOptions[queryFunc].minArgsSize;
		return (
			(exactSize && exactSize < vars.length) ||
			(minSize && vars.length > minSize) ||
			(!exactSize && !minSize)
		);
	}, [queryFunc, functionArgs, codeBlockArgs, vars]);

	const computeValue = useCallback(async () => {
		if (!valideArgs()) {
			setValue(undefined);
			return;
		}
		const file = modal.file;
		if (isCustomFunction() && valideFunctionCode()) {
			const minimalFunctionCode = await minifyCode(functionCode);
			const query = `jsFunc(${vars.map(
				(it) => it[1]
			)}, func = ${minimalFunctionCode})`;
			setQuery(query);
			const context = { currentFile: file, app };
			setValue(computeValueFromQuery(query, context));
		} else if (queryFunc === 'codeBlock') {
			const query = `codeBlock(${codeBlockArgs.map(
				(arg) => Object.fromEntries(vars)[arg]
			)}, code = ${escape(codeBlockText)}, lang = ${codeBlockLang})`;
			setQuery(query);
			const context = { currentFile: file, app };
			setValue(unescape(computeValueFromQuery(query, context)));
		} else if (!isCustomFunction()) {
			const query = `${queryFunc}(${vars.map((it) => it[1])})`;
			setQuery(query);
			const context = { currentFile: file, app };
			setValue(computeValueFromQuery(query, context));
		} else {
			setValue(undefined);
		}
	}, [queryFunc, vars, functionCode, codeBlockText]);

	const updateCodeBlockVarsSize = () => {
		if (queryFunc === 'codeBlock') {
			const newVars = vars.filter(([name, val]) =>
				codeBlockArgs.contains(name)
			); // delete vars that are not in args
			codeBlockArgs.forEach((arg) => {
				if (!newVars.map((it) => it[0]).contains(arg)) {
					newVars.push([arg, '']);
				}
			}); // add new args
			setVars(newVars);
		}
	};

	const updateVarsSize = () => {
		if (isSavedCustomFunction() && queryFuncOptions[queryFunc].code) {
			setFunctionCode(queryFuncOptions[queryFunc].code);
		}
		const exactSize = isCustomFunction()
			? functionArgs.length
			: queryFuncOptions[queryFunc].exactArgsSize;
		const minSize = queryFuncOptions[queryFunc].minArgsSize;
		const maxSize = queryFuncOptions[queryFunc].maxArgsSize;
		const defaultValue = ['', ''];
		if (exactSize || exactSize === 0) {
			setVars(firstNElement(vars, exactSize, defaultValue));
		} else if ((minSize || minSize === 0) && vars.length < minSize) {
			setVars(firstNElement(vars, minSize, defaultValue));
		} else if ((maxSize || maxSize === 0) && vars.length > maxSize) {
			setVars(firstNElement(vars, maxSize, defaultValue));
		}
	};

	const parseCodeBlockArgs = () => {
		const codeBlockArgsPattern = /\{\{(.+?)\}\}/g;
		const matches = [...codeBlockText.matchAll(codeBlockArgsPattern)].map(
			(match) => match[1]
		);
		setCodeBlockArgs(matches);
	};

	const initializeQuery = () => {
		const context = { currentFile: file, app };
		const parsedQuery = parseQuery(initQuery, context);
		setQueryFunc(parsedQuery.func);
		if (parsedQuery.func === 'codeBlock') {
			setCodeBlockText(parsedQuery.args[0]);
			setCodeBlockLang(parsedQuery.args[1]);
			setVars(
				vars.map(([name, val], index) => [
					name,
					parsedQuery.args[2 + index],
				])
			);
		}
	};

	useEffect(() => {
		setVisibleArgsError(false);
		computeValue();
	}, [queryFunc, vars, functionCode]);

	useEffect(() => {
		setFunctionArgs(getArgNames(functionCode));
		valideFunctionCode();
	}, [functionCode]);

	useEffect(() => {
		if (queryFunc === 'codeBlock') {
			parseCodeBlockArgs();
		}
	}, [codeBlockText, queryFunc]);

	useEffect(() => {
		updateVarsSize();
	}, [queryFunc, functionArgs]);

	useEffect(() => {
		updateCodeBlockVarsSize();
	}, [codeBlockArgs, codeBlockText]);

	useEffect(() => {
		if (initQuery != '') {
			initializeQuery();
		}
	}, [initQuery]);

	useEffect(() => {
		modal.plugin.loadSettings();
		const customFunctions = Object.fromEntries(
			modal.plugin.settings.customFunctions.map((customFunction) => {
				return [
					customFunction.name,
					{
						displayValue: customFunction.name,
						desc: '',
						code: customFunction.code,
					},
				];
			})
		);
		setQueryFuncOptions({
			...queryFuncOptions,
			...customFunctions,
		});
	}, []);

	useEffect(() => {
		setPreviewValue(
			value
				? trancateString(stringifyIfObj(value), 100)
				: 'No valid value'
		);
	}, [value]);

	return (
		<div style={{ display: 'flex', flexDirection: 'column' }}>
			<Setting
				className="query-modal-setting-item"
				name={'Query Function'}
				desc={queryFuncOptions[queryFunc].desc}
			>
				<Setting.Dropdown
					options={queryFuncOptions}
					onChange={(e) => {
						const value = e.target.value;
						setQueryFunc(value);
					}}
					defaultValue={defaultQueryFunction}
				/>
			</Setting>
			{queryFunc === 'codeBlock' && (
				<div>
					<div className="query-modal-sub-setting-item">
						<div className="setting-item-name query-modal-sub-setting-item-name">
							Code Block
						</div>
						<Setting
							className="query-modal-sub-setting-item"
							name="Code language"
						>
							<Setting.Text
								placeHolder="code language"
								onChange={(e) => {
									setCodeBlockLang(e.target.value);
								}}
							/>
						</Setting>
						<div className="code-editor-container">
							<CodeEditor
								value={codeBlockText}
								onChange={(val) => {
									setCodeBlockText(val);
								}}
							/>
						</div>
					</div>
				</div>
			)}
			{queryFunc === 'jsFunc' && (
				<div>
					<div className="query-modal-sub-setting-item">
						<div className="setting-item-name query-modal-sub-setting-item-name">
							Custom JS Function
						</div>
						<div className="code-editor-container">
							<CodeEditor
								value={functionCode}
								onChange={(val) => {
									setFunctionCode(val);
								}}
							/>
						</div>
						{codeError && (
							<div className="setting-item-description query-modal-error">
								{codeError}
							</div>
						)}

						<div className="setting-item-description">
							Don't know how to code ? Here is a GPT prompt
							template for you{' '}
							<a
								onClick={() => {
									copyToClipboard(gptPrompt);
								}}
							>
								(click to copy)
							</a>
						</div>
					</div>
					<Setting
						className="query-modal-sub-setting-item"
						name="Save Function"
						desc="Save function for re-use ?"
					>
						<Setting.Toggle
							onChange={() => {
								setSaveFunctionChecked(!saveFunctionChecked);
							}}
						/>
					</Setting>
					{saveFunctionChecked && (
						<Setting
							className="query-modal-sub-setting-item"
							name="Function name"
							desc="Give it a name"
						>
							<Setting.Text
								placeHolder="Function name"
								onChange={(e) => {
									setFunctionName(e.target.value);
								}}
							/>
							<Setting.ExtraButton
								icon={<SaveFilled />}
								onClick={saveFunction}
							/>
						</Setting>
					)}
				</div>
			)}
			{((!addableArg() && vars.length !== 0) || addableArg()) && (
				<Setting
					className="query-modal-setting-item"
					name={'Arguments'}
					desc={'Variable arguments to be passed to the function.'}
				>
					{addableArg() && (
						<Setting.Button
							onClick={(e) => {
								setVars([...vars, ['', '']]);
							}}
						>
							Add Argument
						</Setting.Button>
					)}
				</Setting>
			)}
			{vars.map(([name, val], index) => {
				return (
					<Setting
						className="query-modal-sub-setting-item"
						key={index + 1}
						name={
							isCustomFunction()
								? `Variable ${functionArgs[index]}`
								: queryFunc === 'codeBlock'
								? `Variable: ${name}`
								: `Variable: ${index + 1}`
						}
						desc={`preview value: ${
							variables[val]
								? trancateString(
										stringifyIfObj(variables[val]),
										50
								  )
								: 'no value'
						}`}
					>
						<Setting.Search
							suggestions={Object.keys(variables)}
							placeHolder={`Enter argument ${index + 1}`}
							onChange={(value) => {
								const newVars = [...vars];
								newVars[index][0] = name;
								newVars[index][1] = value;
								setVars(newVars);
							}}
						/>
						{removableArg() && (
							<Setting.ExtraButton
								icon={<CloseOutlined />}
								ariaLabel="Remove Argument"
								onClick={() => {
									const newVars = [...vars];
									newVars.splice(index, 1);
									setVars(newVars);
								}}
							/>
						)}
					</Setting>
				);
			})}
			{argsError && visibleArgsError && (
				<div className="setting-item-description query-modal-error">
					{argsError}
				</div>
			)}
			<Setting
				className="query-modal-setting-item"
				name={'Preview Value'}
				desc={previewValue}
			></Setting>
			<Setting className="query-modal-setting-item">
				<Setting.Button
					cta
					onClick={(e) => {
						if (!valideFunctionCode()) {
							setCodeError('code error');
							return;
						}
						if (!valideArgs()) {
							setVisibleArgsError(true);
							return;
						}
						modal.close();
						modal.onSubmit(query, stringifyIfObj(value));
						if (saveFunctionChecked) saveFunction();
					}}
				>
					Insert
				</Setting.Button>
			</Setting>
		</div>
	);
};

export default QueryModalForm;
