import { useCallback, useEffect, useState } from 'react';
import Setting from './obsidian-components/Setting';
import CodeEditor from './CodeEditor';
import {
	copyToClipboard,
	firstNElement,
	getAllVaultProperties,
	getArgNames,
	minimizeJsFunction,
	stringifyIfObj,
	trancateString,
} from 'src/utils';
import { CloseOutlined, SaveFilled } from '@ant-design/icons';
import { computeValueFromQuery } from 'src/VariableQueryParser';
import QueryModal from 'src/QueryModal';
import { LiveVariablesSettings } from 'src/LiveVariablesSettings';

interface QueryModalFormProperties {
	modal: QueryModal;
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

const QueryModalForm: React.FC<QueryModalFormProperties> = ({ modal }) => {
	const app = modal.app;
	const variables = getAllVaultProperties(app);
	const defaultQueryFunction = 'get';
	const [queryFunc, setQueryFunc] = useState<string>(defaultQueryFunction);
	const [vars, setVars] = useState<string[]>([]);
	const [value, setValue] = useState<string | undefined>(undefined);
	const [previewValue, setPreviewValue] = useState<string>('No valid value');
	const [functionArgs, setFunctionArgs] = useState<string[]>([]);
	const [codeBlockArgs, setCodeBlockArgs] = useState<string[]>([]);
	const [queryFuncOptions, setQueryFuncOptions] = useState<
		Record<string, FuncOption>
	>(defaultQueryFuncOptions);
	const [functionCode, setFunctionCode] = useState<string>(
		'(a, b) => {\n  return a + b;\n}'
	);
	const [codeBlockText, setCodeBlockText] = useState<string>('');
	const [codeError, setCodeError] = useState<string | undefined>(undefined);
	const [argsError, setArgsError] = useState<string | undefined>(undefined);
	const gptPrompt = `Please write me a lambda function in javascript that {{what should the function do}}, the format should be like : 
	\`\`\`
		(a, b) => {
		return a + b;
		}
	\`\`\``;
	const [saveFunctionChecked, setSaveFunctionChecked] =
		useState<boolean>(false);

	const [functionName, setFunctionName] = useState<string>('');

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

	const [query, setQuery] = useState<string>('');

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

	const valideArgs = useCallback(() => {
		const exactSize = isCustomFunction()
			? functionArgs.length
			: queryFunc === 'codeBlock'
			? codeBlockArgs.length
			: queryFuncOptions[queryFunc].exactArgsSize;
		const minSize = queryFuncOptions[queryFunc].minArgsSize;
		const maxSize = queryFuncOptions[queryFunc].maxArgsSize;
		if (vars.some((v) => v.length === 0)) return false;
		if (exactSize && vars.length === exactSize) {
			return true;
		}
		if (
			minSize &&
			maxSize &&
			vars.length < maxSize &&
			vars.length >= minSize
		) {
			return true;
		}
		if (minSize && vars.length >= minSize) {
			return true;
		}
		if (!maxSize && !minSize && !exactSize) {
			return true;
		}
		return false;
	}, [queryFuncOptions, functionArgs, queryFunc, vars]);

	const addableArg = useCallback(() => {
		const exactSize = isCustomFunction()
			? functionArgs.length
			: queryFunc === 'codeBlock'
			? codeBlockArgs.length
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

	const computeValue = useCallback(() => {
		if (!valideArgs()) {
			setValue(undefined);
			return;
		}
		const file = modal.view.file;
		if (isCustomFunction() && valideFunctionCode()) {
			const query = `jsFunc(${vars}, func = ${minimizeJsFunction(
				functionCode
			)})`;
			setQuery(query);
			if (file) {
				const context = { currentFile: file, app };
				setValue(computeValueFromQuery(query, context));
			}
		} else if (queryFunc === 'codeBlock') {
			const query = `codeBlock(${vars}, code = ${codeBlockText})`;
			setQuery(query);
			if (file) {
				const context = { currentFile: file, app };
				setValue(computeValueFromQuery(query, context));
			}
		} else if (!isCustomFunction()) {
			const query = `${queryFunc}(${vars})`;
			setQuery(query);
			if (file) {
				const context = { currentFile: file, app };
				setValue(computeValueFromQuery(query, context));
			}
		} else {
			setValue(undefined);
		}
	}, [queryFunc, vars, functionCode, codeBlockText]);

	useEffect(() => {
		computeValue();
	}, [queryFunc, vars, functionCode]);

	useEffect(() => {
		setFunctionArgs(getArgNames(functionCode));
		valideFunctionCode();
	}, [functionCode]);

	useEffect(() => {
		if (queryFunc === 'codeBlock') {
			const codeBlockArgsPattern = /\{\{(.+?)\}\}/g;
			const matches = [
				...codeBlockText.matchAll(codeBlockArgsPattern),
			].map((match) => match[1]);
			setCodeBlockArgs(matches);
		}
	}, [codeBlockText, queryFunc]);

	useEffect(() => {
		if (isSavedCustomFunction() && queryFuncOptions[queryFunc].code) {
			setFunctionCode(queryFuncOptions[queryFunc].code);
		}
		console.log(queryFunc);
		const exactSize = isCustomFunction()
			? functionArgs.length
			: queryFunc === 'codeBlock'
			? codeBlockArgs.length
			: queryFuncOptions[queryFunc].exactArgsSize;
		const minSize = queryFuncOptions[queryFunc].minArgsSize;
		const maxSize = queryFuncOptions[queryFunc].maxArgsSize;
		const defaultValue = '';
		console.log(exactSize);
		if (exactSize || exactSize === 0) {
			console.log('here');
			setVars(firstNElement(vars, exactSize, defaultValue));
		} else if ((minSize || minSize === 0) && vars.length < minSize) {
			setVars(firstNElement(vars, minSize, defaultValue));
		} else if ((maxSize || maxSize === 0) && vars.length > maxSize) {
			setVars(firstNElement(vars, maxSize, defaultValue));
		}
	}, [queryFunc, functionArgs, codeBlockArgs, codeBlockText]);

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
								setVars([...vars, '']);
							}}
						>
							Add Argument
						</Setting.Button>
					)}
				</Setting>
			)}
			{vars.map((varName, index) => {
				return (
					<Setting
						className="query-modal-sub-setting-item"
						key={index + 1}
						name={
							isCustomFunction()
								? queryFunc === 'codeBlock'
									? `Variable: ${codeBlockArgs[index]}`
									: `Variable: ${functionArgs[index]}`
								: `Variable ${index + 1}`
						}
						desc={`preview value: ${
							variables[varName]
								? trancateString(
										stringifyIfObj(variables[varName]),
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
								newVars[index] = value;
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
			{argsError && (
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
						console.log(`valide code: ${valideFunctionCode()}`);
						if (!valideFunctionCode()) {
							setCodeError('code error');
							return;
						}
						if (!valideArgs()) {
							setArgsError('args error');
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
