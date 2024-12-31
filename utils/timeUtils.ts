import { time } from "console";

export function getDayString(date: Date): string {
	return date.getDate() + "/" + date.getMonth() + "/" + date.getFullYear()
}

export function getDayFromString(dateString: string): Date {
	let date = new Date()
	let dateStringSplit = dateString.split("/")
	date.setDate(parseInt(dateStringSplit[0]))
	date.setMonth(parseInt(dateStringSplit[1]))
	date.setFullYear(parseInt(dateStringSplit[2]))
	return date
}

export function getTomorrowDayString(): string {
	const today = new Date();
	const tomorrow = new Date(today);
	tomorrow.setDate(today.getDate() + 1)
	return getDayString(tomorrow)
}

export function compareDates(date1String: string, date2String: string) {
	// THIS ASSUMES THAT THE MONTHS COME INDEX BASED AND NOT 1-12 BASED
	let date1Split = date1String.split("/")
	let date2Split = date2String.split("/")


	// Create date objects
	let date1 = new Date(
		parseInt(date1Split[2]),  // Year
		parseInt(date1Split[1]), // Month (zero-based in JS)
		parseInt(date1Split[0])  // Day
	);
	let date2 = new Date(
		parseInt(date2Split[2]),  // Year
		parseInt(date2Split[1]), // Month (zero-based in JS)
		parseInt(date2Split[0])  // Day
	);

	// Compare the two dates
	if (date1 < date2) return -1;  // date1 is earlier
	if (date1 > date2) return 1;   // date1 is later
	return 0;                      // dates are equal
}

export function isTimeReadyToShowNote(currentTime: [number, number], timeToCompareWith: [number, number]) {
	//compare hours
	if (currentTime[0] > timeToCompareWith[0]) return true
	if (currentTime[0] < timeToCompareWith[0]) return false

	//same hour, compare minutes
	if (currentTime[1] >= timeToCompareWith[1]) return true
	return false
}

export function timeDif(currentTime: Date, timeToCheck: Date): [number, number, number] {
	// Calculate the difference in milliseconds
	const diffInMilliseconds = currentTime.getTime() - timeToCheck.getTime();
	// Calculate the total seconds from milliseconds
	const totalSeconds = Math.floor(diffInMilliseconds / 1000);

	// Calculate hours, minutes, and seconds
	const hours = Math.floor(Math.abs(totalSeconds) / 3600);
	const minutes = Math.floor((Math.abs(totalSeconds) % 3600) / 60);
	const seconds = Math.abs(totalSeconds) % 60;

	return [hours, minutes, seconds]
}

export function formatTime(hours: number, minutes: number, seconds: number): string {
	// Format to ensure two digits for each component
	const formattedTime = [
		String(hours).padStart(2, '0'),
		String(minutes).padStart(2, '0'),
		String(seconds).padStart(2, '0')
	].join(':');

	return formattedTime;

}
