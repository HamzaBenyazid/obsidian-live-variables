import { LiveVariablesSettings } from 'src/LiveVariablesSettings';
import LiveVariable from 'src/main';

export const saveFunction = (
	plugin: LiveVariable,
	functionName: string,
	functionCode: string
) => {
	const settings: LiveVariablesSettings = plugin.settings;
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
	plugin.saveData(settings);
};
