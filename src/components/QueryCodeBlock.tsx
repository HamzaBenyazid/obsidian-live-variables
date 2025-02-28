import { FC, useEffect, useState } from 'react';
import CodeEditor from './CodeEditor';
import Setting from './obsidian-components/Setting';
import { stringifyIfObj, trancateString } from 'src/utils';
import { VarQuery } from 'src/VariableQueryParser';
import { QueryError } from './QueryModalReactForm';
import { escape } from 'he';

interface QueryCodeBlockProps {
	variables: Record<string, never>;
	onQueryUpdate: (query: string) => void;
	initQuery?: VarQuery;
	queryError: {
		error: QueryError;
		onErrorUpdate: (argsError: QueryError) => void;
	};
}

export const QueryCodeBlock: FC<QueryCodeBlockProps> = ({
	variables,
	onQueryUpdate,
	initQuery,
	queryError,
}) => {
	const [codeBlockArgs, setCodeBlockArgs] = useState<string[]>([]);
	const [codeBlockLang, setCodeBlockLang] = useState<string>('');
	const [codeBlockText, setCodeBlockText] = useState<string>('');
	const [vars, setVars] = useState<[string, string][]>([]);
	const editMode = initQuery !== undefined;

	const valideArgs = () => {
		const exactSize = Array.from(new Set(codeBlockArgs)).length;
		if (vars.some((v) => v[1].length === 0)) return false;
		if (exactSize && vars.length === exactSize) {
			return vars.every(valideArg);
		}
		return false;
	};

	const valideArg = ([name, val]: [string, string]): boolean => {
		if (variables[val] === undefined) {
			queryError.onErrorUpdate({
				...queryError.error,
				argsError: {
					message: `variable ${val} not found`,
					visible: queryError.error.argsError?.visible,
				},
			});
			return false;
		}
		queryError.onErrorUpdate({
			...queryError.error,
			argsError: undefined,
		});
		return true;
	};

	const updateQuery = async () => {
		if (!valideArgs()) {
			return;
		}
		const query = `codeBlock(${codeBlockArgs.map(
			(arg) => Object.fromEntries(vars)[arg]
		)}, code = ${escape(codeBlockText)}, lang = ${codeBlockLang})`;
		onQueryUpdate(query);
	};

	const parseCodeBlockArgs = () => {
		setCodeBlockArgs(getCodeBlockArgs(codeBlockText));
	};

	const getCodeBlockArgs = (codeBlockText: string): string[] => {
		const codeBlockArgsPattern = /\{\{(.+?)\}\}/g;
		const matches = [...codeBlockText.matchAll(codeBlockArgsPattern)].map(
			(match) => match[1]
		);
		return matches;
	};

	const updateCodeBlockVarsSize = () => {
		const newVars = vars.filter(([name, val]) =>
			codeBlockArgs.contains(name)
		); // delete vars that are not in args
		codeBlockArgs.forEach((arg) => {
			if (!newVars.map((it) => it[0]).contains(arg)) {
				newVars.push([arg, '']);
			}
		}); // add new args
		setVars(newVars);
	};

	const loadCurrentQuery = () => {
		if (!initQuery) return;
		setCodeBlockText(initQuery.args[0]);
		setCodeBlockLang(initQuery.args[1]);
		const codeBlockArgs = getCodeBlockArgs(initQuery.args[0]);
		setCodeBlockArgs(codeBlockArgs);
		setVars(
			codeBlockArgs.map((arg, index) => [arg, initQuery.args[2 + index]])
		);
	};

	useEffect(() => {
		queryError.onErrorUpdate({
			...queryError,
			argsError: { ...queryError.error.argsError, visible: false },
		});
		updateQuery();
	}, [codeBlockText, codeBlockLang, vars]);

	useEffect(() => {
		parseCodeBlockArgs();
	}, [codeBlockText]);

	useEffect(() => {
		updateCodeBlockVarsSize();
	}, [codeBlockArgs, codeBlockText]);

	useEffect(() => {
		if (editMode) {
			loadCurrentQuery();
		}
	}, [initQuery]);
	return (
		<>
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
							value={codeBlockLang}
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
			{vars.map(([name, val], index) => {
				return (
					<Setting
						className="query-modal-sub-setting-item"
						key={index + 1}
						name={`Variable: ${name}`}
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
							value={vars[index][1]}
						/>
					</Setting>
				);
			})}
			{queryError.error.argsError &&
				queryError.error.argsError.visible && (
					<div className="setting-item-description query-modal-error">
						{queryError.error.argsError.message}
					</div>
				)}
		</>
	);
};
