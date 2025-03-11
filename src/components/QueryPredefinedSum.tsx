import { FC, useEffect, useState } from 'react';
import { VarQuery } from 'src/VariableQueryParser';
import { QueryError } from './QueryModalReactForm';
import Setting from './obsidian-components/Setting';
import { CloseOutlined } from '@ant-design/icons';
import VaultProperties from 'src/VaultProperties';

interface QueryPredefinedSumProps {
	vaultProperties: VaultProperties;
	onQueryUpdate: (query: string) => void;
	initQuery?: VarQuery;
	queryError: {
		error: QueryError;
		onErrorUpdate: (argsError: QueryError) => void;
	};
}

export const QueryPredefinedSum: FC<QueryPredefinedSumProps> = ({
	queryError,
	onQueryUpdate,
	initQuery,
	vaultProperties,
}) => {
	const [args, setArgs] = useState<string[]>([]);
	const editMode = initQuery !== undefined;

	const addableArg = () => {
		return true;
	};

	const removableArg = () => {
		return args.length > 2;
	};

	const valideArgs = () => {
		const exactSize = args.length;
		if (args.some((arg) => arg.length === 0)) {
			queryError.onErrorUpdate({
				...queryError.error,
				argsError: {
					message: `Arguments cannot be empty`,
					visible: queryError.error.argsError?.visible,
				},
			});
			return false;
		}
		if (exactSize && args.length === exactSize) {
			return args.every(valideArg);
		}
		return false;
	};

	const valideArg = (arg: string): boolean => {
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
		if (!valideArgs()) {
			return;
		}
		const query = `sum(${args.join(', ')})`;
		onQueryUpdate(query);
	};

	useEffect(() => {
		if (editMode) {
			setArgs(initQuery.args);
		} else {
			setArgs(['', '']);
		}
	}, [initQuery]);

	useEffect(() => {
		queryError.onErrorUpdate({
			...queryError,
			argsError: { ...queryError.error.argsError, visible: false },
		});
		updateQuery();
	}, [args]);

	return (
		<>
			{((!addableArg() && args.length !== 0) || addableArg()) && (
				<Setting
					className="query-modal-setting-item"
					name={'Arguments'}
					desc={'Variable arguments to be passed to the function.'}
				>
					{addableArg() && (
						<Setting.Button
							onClick={(e) => {
								setArgs([...args, '']);
							}}
						>
							Add Argument
						</Setting.Button>
					)}
				</Setting>
			)}
			{args.map((arg, index) => {
				return (
					<Setting
						className="query-modal-sub-setting-item"
						key={index + 1}
						name={`Variable ${index + 1}`}
						desc={`preview value: ${vaultProperties.getPropertyPreview(
							arg
						)}`}
					>
						<Setting.Search
							suggestions={vaultProperties.findPathsContaining(
								arg
							)}
							placeHolder={`Enter argument ${index + 1}`}
							onChange={(value) => {
								const newArgs = [...args];
								newArgs[index] = value;
								setArgs(newArgs);
							}}
							value={args[index]}
						/>
						{removableArg() && (
							<Setting.ExtraButton
								icon={<CloseOutlined />}
								ariaLabel="Remove Argument"
								onClick={() => {
									const newArgs = [...args];
									newArgs.splice(index, 1);
									setArgs(newArgs);
								}}
							/>
						)}
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
