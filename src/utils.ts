export const getValueByPath = (obj: any, path: string): any => {
	// Split the path by both dots and brackets, and filter out empty parts
	const keys = path.split(/\.|\[|\]/).filter(Boolean);

	return keys.reduce((acc, key) => {
		if (acc && typeof acc === 'object' && acc.hasOwnProperty(key)) {
			return acc[key];
		}
		return undefined; // Return undefined if the key doesn't exist
	}, obj);
};

export const getAllNestedKeyValuePairs = (obj: any): [string, any][] => {
	const result: [string, any][] = [];

	function recurse(currentObj: any, currentPath: string): void {
		// Exclude the root object and push nested objects, arrays, and leaves
		if (currentPath) {
			result.push([currentPath, currentObj]);
		}

		if (typeof currentObj === 'object' && currentObj !== null) {
			if (Array.isArray(currentObj)) {
				// If it's an array, iterate through the elements
				currentObj.forEach((item, index) => {
					recurse(item, `${currentPath}[${index}]`);
				});
			} else {
				// If it's an object, iterate through its properties
				for (const key in currentObj) {
					if (currentObj.hasOwnProperty(key)) {
						recurse(
							currentObj[key],
							currentPath ? `${currentPath}.${key}` : key
						);
					}
				}
			}
		}
	}

	recurse(obj, ''); // Start recursion with an empty string path for the root
	return result;
};

export const stringifyIfObj = (obj: any) => {
	if (typeof obj === 'object') {
		return JSON.stringify(obj);
	}
	return String(obj);
};

export const checkArrayTypes = (arr: any[]) => {
	if (!Array.isArray(arr)) return 'string'; // Ensure input is an array

	const firstType = typeof arr[0]; // Get the type of the first element

	// Check if all elements have the same type
	const allSameType = arr.every((item) => typeof item === firstType);

	return allSameType ? firstType : 'string';
};
