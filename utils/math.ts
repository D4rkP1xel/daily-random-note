// Example: Random integer between 10 (inclusive) and 20 (exclusive)
export function randomInt(min: number, max: number) {
	if (min >= max) throw new Error("The min value must be less than the max value");

	return Math.floor(Math.random() * (max - min)) + min;
}
