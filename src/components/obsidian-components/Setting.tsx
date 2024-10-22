import { Dropdown, MenuProps } from 'antd';

import {
	ChangeEventHandler,
	FC,
	MouseEventHandler,
	ReactNode,
	useEffect,
	useState,
} from 'react';

interface SettingProps {
	name?: string;
	desc?: string;
	children?: ReactNode;
	className?: string;
	heading?: boolean;
	style?: React.CSSProperties | undefined;
}

interface SettingComponent extends FC<SettingProps> {
	Text: FC<SettingTextProps>;
	Button: FC<SettingButtonProps>;
	Dropdown: FC<SettingDropdownProps>;
	Search: FC<SettingSearchProps>;
	ExtraButton: FC<SettingExtraButtonProps>;
	Toggle: FC<SettingToggleProps>;
}

const Setting: SettingComponent = ({
	name = '',
	desc = '',
	children = '',
	className = '',
	heading = false,
	style,
}) => {
	return (
		<div
			style={style}
			className={`setting-item ${className} ${
				heading ? 'setting-item-heading' : ''
			}`}
		>
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
				<div className="setting-item-description">{desc}</div>
			</div>
			<div className="setting-item-control">{children}</div>
		</div>
	);
};

interface SettingTextProps {
	type?: string;
	spellCheck?: boolean;
	placeHolder?: string;
	onChange?: ChangeEventHandler<HTMLInputElement>;
}

Setting.Text = ({
	type = 'text',
	spellCheck = false,
	placeHolder = '',
	onChange = () => {},
}) => {
	return (
		<input
			type={type}
			spellCheck={spellCheck}
			placeholder={placeHolder}
			onChange={onChange}
		/>
	);
};

interface SettingButtonProps {
	onClick?: MouseEventHandler<HTMLButtonElement>;
	children?: ReactNode;
	cta?: boolean;
}

Setting.Button = ({ onClick, children, cta = false }) => {
	return (
		<button className={cta ? 'mod-cta' : ''} onClick={onClick}>
			{children}
		</button>
	);
};

interface SettingDropdownProps {
	options: Record<string, { displayValue: string; desc?: string }>;
	onChange?: ChangeEventHandler<HTMLSelectElement>;
	defaultValue: string;
}

Setting.Dropdown = ({
	options = {},
	onChange,
	defaultValue = Object.isEmpty(options) ? '' : Object.entries(options)[0][0],
}) => {
	return (
		<select
			className="dropdown"
			onChange={onChange}
			defaultValue={defaultValue}
		>
			{Object.entries(options).map(([value, { displayValue }], index) => {
				return (
					<option key={index} value={value}>
						{displayValue}
					</option>
				);
			})}
		</select>
	);
};

interface SettingSearchProps {
	suggestions?: string[];
	onChange?: (value: string) => void;
	defaultValue?: string;
	placeHolder?: string;
}

Setting.Search = ({
	placeHolder = '',
	suggestions = [],
	defaultValue = '',
	onChange = () => {},
}) => {
	const [items, setItems] = useState<MenuProps['items']>([]);
	const [value, setValue] = useState(defaultValue);
	const [selectedKey, setSelectedKey] = useState<string>('');
	useEffect(() => {
		setItems(
			suggestions
				.filter((suggestion) => suggestion.contains(value))
				.map((suggestion, index) => {
					return {
						key: index + 1,
						label: suggestion,
						onClick: (_) => {
							setValue(suggestion);
						},
					};
				})
		);
		onChange(value);
	}, [value]);
	return (
		<div className="search-input-container">
			<Dropdown
				menu={{
					items,
					selectable: true,
					selectedKeys: [selectedKey],
					style: {
						backgroundColor: 'var(--background-primary)',
						maxHeight: '250px',
						overflow: 'auto',
					},
					onSelect: (info) => {
						setSelectedKey(info.key);
					},
				}}
				trigger={['click']}
			>
				<input
					enterKeyHint="search"
					type="search"
					spellCheck="false"
					placeholder={placeHolder}
					value={value}
					onChange={(e) => {
						setValue(e.target.value);
					}}
				/>
			</Dropdown>
			<div
				className="search-input-clear-button"
				onClick={() => {
					setValue('');
					setSelectedKey('');
				}}
			></div>
		</div>
	);
};

interface SettingExtraButtonProps {
	icon: ReactNode;
	ariaLabel?: string;
	onClick?: MouseEventHandler<HTMLDivElement>;
}

Setting.ExtraButton = ({ onClick = () => {}, icon, ariaLabel = '' }) => {
	return (
		<div
			className="clickable-icon extra-setting-button"
			aria-label={ariaLabel}
			onClick={onClick}
		>
			{icon}
		</div>
	);
};

interface SettingToggleProps {
	disabled?: boolean;
	defaultChecked?: boolean;
	onChange?: MouseEventHandler<HTMLDivElement>;
}

Setting.Toggle = ({
	disabled = false,
	defaultChecked = false,
	onChange = () => {},
}) => {
	const [checked, setChecked] = useState(defaultChecked);
	return (
		<div
			className={`checkbox-container ${
				checked ? 'is-enabled' : 'is-disabled'
			}`}
			onClick={(e) => {
				setChecked(!checked);
				onChange(e);
			}}
		>
			<input disabled={disabled} type="checkbox" tabIndex={0} />
		</div>
	);
};

export default Setting;
