import { FC } from 'react';
import CodeMirror from '@uiw/react-codemirror';

interface CodeEditorProps {
	value?: string;
	onChange?: (val: string, viewUpdate: string) => void;
}

const CodeEditor: FC<CodeEditorProps> = ({ value, onChange }) => {
	return (
		<CodeMirror theme="dark" value={value} basicSetup onChange={onChange} />
	);
};

export default CodeEditor;
