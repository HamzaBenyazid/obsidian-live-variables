export const assertNoUndefinedElems = (
	values: (any | undefined)[],
	error = "assertNoUndefinedValues error"
) => {
	values.map((val) => {
		if (val === undefined) {
			throw Error(error);
		}
		return val;
	});
};

export const assertListHasExactlyOneElement = (
	values: any[],
	error = "assertListHasExactlyOneElement error"
): any => {
	if (values.length !== 1) {
		throw Error(error);
	}
	return values[0]
}