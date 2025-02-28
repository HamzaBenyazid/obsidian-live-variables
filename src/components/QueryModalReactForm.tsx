import { useEffect, useRef, useState } from 'react';
import Setting from './obsidian-components/Setting';
import {
	getAllVaultProperties,
	getFileProperties,
	stringifyIfObj,
	trancateString,
} from 'src/utils';
import { tryComputeValueFromQuery, VarQuery } from 'src/VariableQueryParser';
import QueryModal from 'src/QueryModal';
import { TFile } from 'obsidian';
import { JsFuncRef, QueryJsFunc } from './QueryJsFunc';
import { QueryCodeBlock } from './QueryCodeBlock';
import { QueryGet } from './QueryGet';
import { QueryPredefinedSum } from './QueryPredefinedSum';

interface QueryModalFormProperties {
	modal: QueryModal;
	initQuery?: VarQuery;
	file: TFile;
}

export interface FuncOption {
	displayValue: string;
	desc: string;
	code?: string;
}

export interface QueryError {
	funcError?: { message?: string; visible?: boolean };
	argsError?: { message?: string; visible?: boolean };
}

const defaultQueryFuncOptions: Record<string, FuncOption> = {
	get: {
		displayValue: 'get',
		desc: 'Gets single variable value',
	},
	sum: {
		displayValue: 'sum',
		desc: 'Sums multiple values, if the values are numbers the function sums them, concatenates their string representations otherwise',
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
}) => {
	const app = modal.app;
	const variables: Record<string, never> = {
		...getFileProperties(modal.file, app),
		...getAllVaultProperties(app),
	};
	const DEFAULT_QUERY_FUNCTION = 'get';
	const editMode = initQuery !== undefined;
	const [queryFunc, setQueryFunc] = useState<string>(DEFAULT_QUERY_FUNCTION);
	const [value, setValue] = useState<string | undefined>(undefined);
	const [queryFuncOptions, setQueryFuncOptions] = useState<
		Record<string, FuncOption>
	>(defaultQueryFuncOptions);
	const [queryError, setQueryError] = useState<QueryError>({});

	const [query, setQuery] = useState<string>('');
	const jsFuncRef = useRef<JsFuncRef>(null);

	const computeValue = async () => {
		const file = modal.file;
		const context = { currentFile: file, app };
		setValue(tryComputeValueFromQuery(query, context));
	};

	const handleSubmit = () => {
		if (queryError.funcError?.message) {
			setQueryError({
				...queryError,
				funcError: { ...queryError.funcError, visible: true },
			});
			return;
		}
		if (queryError.argsError?.message) {
			setQueryError({
				...queryError,
				argsError: { ...queryError.argsError, visible: true },
			});
			return;
		}

		modal.close();
		modal.onSubmit(query, stringifyIfObj(value), editMode);
		jsFuncRef.current?.saveFunction();
	};

	const loadCurrentQuery = () => {
		if (initQuery) {
			setQueryFunc(initQuery.func);
		}
	};

	const isSavedCustomFunction = () => {
		return queryFuncOptions[queryFunc].code ?? false;
	};

	useEffect(() => {
		if (editMode) {
			loadCurrentQuery();
		}
	}, [initQuery]);
	useEffect(() => {
		computeValue();
	}, [query]);

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

	const getPreviewValue = () => {
		return value
			? trancateString(stringifyIfObj(value), 100)
			: 'No valid value';
	};

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
					value={queryFunc}
				/>
			</Setting>
			{queryFunc === 'get' && (
				<QueryGet
					variables={variables}
					onQueryUpdate={setQuery}
					initQuery={initQuery}
					queryError={{
						error: queryError,
						onErrorUpdate: setQueryError,
					}}
				/>
			)}
			{queryFunc === 'sum' && (
				<QueryPredefinedSum
					variables={variables}
					onQueryUpdate={setQuery}
					initQuery={initQuery}
					queryError={{
						error: queryError,
						onErrorUpdate: setQueryError,
					}}
				/>
			)}
			{queryFunc === 'codeBlock' && (
				<QueryCodeBlock
					variables={variables}
					onQueryUpdate={setQuery}
					initQuery={initQuery}
					queryError={{
						error: queryError,
						onErrorUpdate: setQueryError,
					}}
				/>
			)}
			{(queryFunc === 'jsFunc' || isSavedCustomFunction()) && (
				<QueryJsFunc
					ref={jsFuncRef}
					plugin={modal.plugin}
					variables={variables}
					onQueryUpdate={setQuery}
					queryFuncOptions={queryFuncOptions}
					queryFunc={queryFunc}
					initQuery={initQuery}
					queryError={{
						error: queryError,
						onErrorUpdate: setQueryError,
					}}
				/>
			)}
			<Setting
				className="query-modal-setting-item"
				name={'Preview Value'}
				desc={getPreviewValue()}
			></Setting>
			<Setting className="query-modal-setting-item">
				<Setting.Button cta onClick={handleSubmit}>
					{editMode ? 'Update' : 'Insert'}
				</Setting.Button>
			</Setting>
		</div>
	);
};

export default QueryModalForm;
