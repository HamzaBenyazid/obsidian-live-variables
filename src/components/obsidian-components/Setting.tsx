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
	value?: string | number | readonly string[];
}

Setting.Text = ({
	type = 'text',
	spellCheck = false,
	placeHolder = '',
	onChange = () => {},
	value,
}) => {
	return (
		<input
			value={value}
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
	value?: string | number | readonly string[];
	disabled?: boolean;
}

Setting.Dropdown = ({ options = {}, onChange, value, disabled = false }) => {
	return (
		<select
			disabled={disabled}
			className="dropdown"
			onChange={onChange}
			value={value}
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
	value?: string;
	placeHolder?: string;
}

Setting.Search = ({
	placeHolder = '',
	suggestions = [],
	value: initValue = '',
	onChange = () => {},
}) => {
	const [items, setItems] = useState<MenuProps['items']>([]);

	const [value, setValue] = useState(initValue);
	const [selectedKey, setSelectedKey] = useState<string>('');

	useEffect(() => {
		onChange(value);
	}, [value]);

	useEffect(() => {
		setItems(
			suggestions.map((suggestion, index) => {
				return {
					key: index + 1,
					label: suggestion,
					onClick: (_) => {
						setValue(suggestion);
					},
				};
			})
		);
	}, [suggestions]);

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
						maxWidth: '500px',
						overflowY: 'auto', // Enable vertical scrolling
						overflowX: 'auto', // Enable horizontal scrolling
						whiteSpace: 'nowrap', // Prevent text from wrapping
						display: 'block', // Ensure block display for proper scrolling
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
