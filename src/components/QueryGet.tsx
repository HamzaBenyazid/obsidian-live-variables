import { FC, useEffect, useState } from 'react';
import { VarQuery } from 'src/VariableQueryParser';
import { QueryError } from './QueryModalReactForm';
import Setting from './obsidian-components/Setting';
import { stringifyIfObj, trancateString } from 'src/utils';

interface QueryGetProps {
	variables: Record<string, never>;
	onQueryUpdate: (query: string) => void;
	initQuery?: VarQuery;
	queryError: {
		error: QueryError;
		onErrorUpdate: (argsError: QueryError) => void;
	};
}

export const QueryGet: FC<QueryGetProps> = ({
	queryError,
	onQueryUpdate,
	initQuery,
	variables,
}) => {
	const [arg, setArg] = useState<string>('');
	const editMode = initQuery !== undefined;

	const valideArg = () => {
		if (variables[arg] === undefined) {
			queryError.onErrorUpdate({
				...queryError.error,
				argsError: {
					message: `variable ${arg} not found`,
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
		if (!valideArg()) {
			return;
		}
		const query = `get(${arg})`;
		onQueryUpdate(query);
	};

	useEffect(() => {
		if (editMode) {
			setArg(initQuery.args[0] ?? '');
		}
	}, [initQuery]);

	useEffect(() => {
		queryError.onErrorUpdate({
			...queryError,
			argsError: { ...queryError.error.argsError, visible: false },
		});
		updateQuery();
	}, [arg]);

	return (
		<>
			<Setting
				className="query-modal-sub-setting-item"
				name={`Variable: ${name}`}
				desc={`preview value: ${
					variables[arg]
						? trancateString(stringifyIfObj(variables[arg]), 50)
						: 'no value'
				}`}
			>
				<Setting.Search
					suggestions={Object.keys(variables)}
					placeHolder={`Enter argument`}
					onChange={(value) => {
						setArg(value);
					}}
					value={arg}
				/>
			</Setting>

			{queryError.error.argsError &&
				queryError.error.argsError.visible && (
					<div className="setting-item-description query-modal-error">
						{queryError.error.argsError.message}
					</div>
				)}
		</>
	);
};
