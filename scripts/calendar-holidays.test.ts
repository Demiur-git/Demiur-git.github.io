import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarPageConfig } from "../src/config/calendarPageConfig";
import type { CalendarImportantDate } from "../src/types/calendarPageConfig";
import { getUpcomingHolidays } from "../src/utils/calendar-holidays";

function holiday(date: string, title = date): CalendarImportantDate {
	return { date, title, category: "holiday" };
}

test("exclude past and today; sort future holidays and take only two", () => {
	const items = [
		holiday("2026-12-01"),
		holiday("2026-10-10"),
		holiday("2026-10-11"),
		holiday("2026-10-20"),
		holiday("2026-10-12"),
	];
	const snapshot = structuredClone(items);
	assert.deepEqual(
		getUpcomingHolidays(items, "2026-10-11").map((item) => item.resolvedDate),
		["2026-10-12", "2026-10-20"],
	);
	assert.deepEqual(items, snapshot, "selection must not mutate the config");
});

test("ordinary festivals, anniversaries and important dates are excluded", () => {
	const items: CalendarImportantDate[] = [
		...(["festival", "anniversary", "important"] as const).map((category) => ({
			date: "2026-10-12",
			title: category,
			category,
		})),
		holiday("2026-10-20"),
	];
	assert.deepEqual(getUpcomingHolidays(items, "2026-10-11"), [
		{ ...items[3], resolvedDate: "2026-10-20" },
	]);
});

test("fixed dates preserve their year, including cross-year selection", () => {
	assert.deepEqual(
		getUpcomingHolidays(
			[holiday("2027-02-06"), holiday("2026-01-01"), holiday("2027-01-01")],
			"2026-12-31",
		).map((item) => item.resolvedDate),
		["2027-01-01", "2027-02-06"],
	);
	assert.deepEqual(
		getUpcomingHolidays([holiday("2026-01-01")], "2026-12-31"),
		[],
	);
});

test("explicit yearly repetition supplies two future occurrences, even on the holiday", () => {
	const newYear: CalendarImportantDate = {
		...holiday("2020-01-01", "元旦"),
		repeat: "yearly",
	};
	for (const today of ["2026-01-01", "2026-10-11", "2026-12-31"]) {
		assert.deepEqual(
			getUpcomingHolidays([newYear], today).map((item) => item.resolvedDate),
			["2027-01-01", "2028-01-01"],
		);
	}
});

test("yearly and fixed holidays share a single chronological order", () => {
	const items: CalendarImportantDate[] = [
		{ ...holiday("2020-12-25"), repeat: "yearly" },
		holiday("2027-01-01"),
	];
	assert.deepEqual(
		getUpcomingHolidays(items, "2026-10-11").map((item) => item.resolvedDate),
		["2026-12-25", "2027-01-01"],
	);
});

test("one future record remains one; empty and exhausted lists remain empty", () => {
	assert.equal(
		getUpcomingHolidays([holiday("2026-10-20")], "2026-10-11").length,
		1,
	);
	assert.deepEqual(getUpcomingHolidays([], "2026-10-11"), []);
	assert.deepEqual(
		getUpcomingHolidays(calendarPageConfig.importantDates, "2026-10-11"),
		[],
	);
});
