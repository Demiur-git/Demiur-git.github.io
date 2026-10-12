import type { CalendarImportantDate } from "../types/calendarPageConfig";

export type UpcomingHoliday = CalendarImportantDate & { resolvedDate: string };

/** Dates use the calendar's local YYYY-MM-DD keys, not UTC timestamps. */
export function getUpcomingHolidays(
	items: readonly CalendarImportantDate[],
	todayKey: string,
): UpcomingHoliday[] {
	const year = Number(todayKey.slice(0, 4));
	return items
		.filter((item) => item.category === "holiday")
		.flatMap((item): UpcomingHoliday[] => {
			if (item.repeat !== "yearly") {
				return [{ ...item, resolvedDate: item.date }];
			}
			// Two subsequent years also cover an annual holiday that passed today.
			return [year, year + 1, year + 2].map((candidateYear) => ({
				...item,
				resolvedDate: `${candidateYear}-${item.date.slice(5)}`,
			}));
		})
		.filter((item) => item.resolvedDate > todayKey)
		.sort((a, b) => a.resolvedDate.localeCompare(b.resolvedDate))
		.slice(0, 2);
}
