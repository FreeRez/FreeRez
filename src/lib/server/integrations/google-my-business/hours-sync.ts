import type {
	GoogleRegularHours,
	GoogleTimePeriod,
	FreerezOpeningTimes,
	HoursComparisonResult,
} from './types';

const DAYS_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export function compareHours(
	freerezHours: FreerezOpeningTimes | null,
	googleHours: GoogleRegularHours | null
): HoursComparisonResult {
	const diffs: HoursComparisonResult['diffs'] = [];
	let allMatch = true;

	for (const day of DAYS_ORDER) {
		const frKey = day.charAt(0) + day.slice(1).toLowerCase();
		const frSlots = freerezHours?.[frKey] ?? freerezHours?.[day] ?? null;
		const gSlots = extractGoogleSlotsForDay(googleHours, day);

		const frNorm = normalizeSlots(frSlots);
		const gNorm = normalizeSlots(gSlots);

		if (!slotsEqual(frNorm, gNorm)) {
			allMatch = false;
			diffs.push({ day: frKey, freerez: frNorm, google: gNorm });
		}
	}

	return { matches: allMatch, diffs };
}

export function convertToGoogleFormat(freerezHours: FreerezOpeningTimes): GoogleRegularHours {
	const periods: GoogleTimePeriod[] = [];

	for (const day of DAYS_ORDER) {
		const frKey = day.charAt(0) + day.slice(1).toLowerCase();
		const slots = freerezHours[frKey] ?? freerezHours[day] ?? [];

		for (const slot of slots) {
			periods.push({
				openDay: day,
				openTime: padTime(slot.start),
				closeDay: day,
				closeTime: padTime(slot.end),
			});
		}
	}

	return { periods };
}

export function convertToFreerezFormat(googleHours: GoogleRegularHours): FreerezOpeningTimes {
	const result: FreerezOpeningTimes = {};

	for (const period of googleHours.periods) {
		const dayKey = period.openDay.charAt(0) + period.openDay.slice(1).toLowerCase();

		if (!result[dayKey]) result[dayKey] = [];

		result[dayKey].push({
			start: padTime(period.openTime),
			end: padTime(period.closeTime),
		});
	}

	for (const day of DAYS_ORDER) {
		const key = day.charAt(0) + day.slice(1).toLowerCase();
		if (result[key]) {
			result[key].sort((a, b) => a.start.localeCompare(b.start));
		}
	}

	return result;
}

function extractGoogleSlotsForDay(
	hours: GoogleRegularHours | null,
	day: string
): Array<{ start: string; end: string }> | null {
	if (!hours?.periods) return null;

	const slots = hours.periods
		.filter((p) => p.openDay === day)
		.map((p) => ({ start: padTime(p.openTime), end: padTime(p.closeTime) }))
		.sort((a, b) => a.start.localeCompare(b.start));

	return slots.length > 0 ? slots : null;
}

function normalizeSlots(
	slots: Array<{ start: string; end: string }> | null
): Array<{ start: string; end: string }> | null {
	if (!slots || slots.length === 0) return null;
	return slots
		.map((s) => ({ start: padTime(s.start), end: padTime(s.end) }))
		.sort((a, b) => a.start.localeCompare(b.start));
}

function slotsEqual(
	a: Array<{ start: string; end: string }> | null,
	b: Array<{ start: string; end: string }> | null
): boolean {
	if (a === null && b === null) return true;
	if (a === null || b === null) return false;
	if (a.length !== b.length) return false;
	return a.every((slot, i) => slot.start === b[i].start && slot.end === b[i].end);
}

function padTime(time: string): string {
	if (!time) return '00:00';
	const parts = time.split(':');
	if (parts.length < 2) return time;
	return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}
