import { DeleteFilled } from '@ant-design/icons';
import { ConfigProvider, Table, TableProps } from 'antd';
import { FC, useCallback, useEffect, useState } from 'react';
import { CustomFunction } from 'src/LiveVariablesSettings';
import LiveVariable from 'src/main';
import CodeEditor from './CodeEditor';
import Setting from './obsidian-components/Setting';

interface LiveVariableReactSettingTabProps {
	plugin: LiveVariable;
}

const LiveVariablesReactSettingTab: FC<LiveVariableReactSettingTabProps> = ({
	plugin,
}) => {
	const [customFunctions, setCustomFunctions] = useState<CustomFunction[]>(
		[]
	);

	const columns: TableProps<CustomFunction>['columns'] = [
		{
			title: 'Function Name',
			dataIndex: 'name',
			key: 'name',
		},
		{
			title: 'Function Code',
			dataIndex: 'code',
			key: 'code',
			render: (code, record) => (
				<CodeEditor
					value={code}
					onChange={(val) => {
						const previousValue = record;
						const newValue = { ...record, code: val };
						updateFunction(previousValue, newValue);
					}}
				/>
			),
		},
		{
			title: 'Action',
			dataIndex: '',
			key: 'x',
			render: (_, record) => (
				<DeleteFilled onClick={() => deleteFunction(record)} />
			),
		},
	];

	const deleteFunction = (customFunction: CustomFunction) => {
		plugin.settings.customFunctions.remove(customFunction);
		plugin.saveSettings();
	};

	const updateFunction = (
		previousValue: CustomFunction,
		newValue: CustomFunction
	) => {
		const index = plugin.settings.customFunctions.indexOf(previousValue);
		plugin.settings.customFunctions[index] = newValue;
		plugin.saveSettings();
	};

	const loadDataSource = useCallback(async () => {
		await plugin.loadSettings();
		setCustomFunctions(plugin.settings.customFunctions);
	}, [deleteFunction, updateFunction]);

	useEffect(() => {
		loadDataSource();
	}, [deleteFunction, updateFunction]);

	return (
		<ConfigProvider>
			<div>
				<Setting
					heading
					name="Live Variables"
					style={{
						borderBottom:
							'1px solid var(--background-modifier-border)',
					}}
				/>
				<div className="setting-item-info" style={{ marginTop: 10 }}>
					<div className="setting-item-name">Custom JS Functions</div>
					<div className="setting-item-description">
						Saved custom JS functions
					</div>
				</div>
				<Table
					pagination={false}
					style={{ margin: 10 }}
					columns={columns}
					dataSource={customFunctions}
				></Table>
			</div>
		</ConfigProvider>
	);
};

export default LiveVariablesReactSettingTab;
