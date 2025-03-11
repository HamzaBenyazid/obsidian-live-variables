import { FC, useEffect, useState } from 'react';
import { VarQuery } from 'src/VariableQueryParser';
import { QueryError } from './QueryModalReactForm';
import Setting from './obsidian-components/Setting';
import VaultProperties from 'src/VaultProperties';

interface QueryGetProps {
	vaultProperties: VaultProperties;
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
	vaultProperties,
}) => {
	const [arg, setArg] = useState<string>(initQuery?.args?.[0] ?? '');

	const valideArg = () => {
		if (arg.length === 0) {
			queryError.onErrorUpdate({
				...queryError.error,
				argsError: {
					message: `Arguments cannot be empty`,
					visible: queryError.error.argsError?.visible,
				},
			});
			return false;
		}
		if (vaultProperties.getProperty(arg) === undefined) {
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
				name={`Variable:`}
				desc={`preview value: ${vaultProperties.getPropertyPreview(
					arg
				)}`}
			>
				<Setting.Search
					suggestions={vaultProperties.findPathsContaining(arg)}
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
