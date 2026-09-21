export type ImportantDateCategory =
	| "holiday"
	| "festival"
	| "anniversary"
	| "important";

export type CalendarScheduleStatus = "planned" | "in-progress" | "done";

export type CalendarImportantDate = {
	date: string;
	title: string;
	category: ImportantDateCategory;
	description?: string;
	repeat?: "yearly";
};

export type CalendarScheduleItem = {
	date: string;
	title: string;
	time?: string;
	status: CalendarScheduleStatus;
	description?: string;
};

export type CalendarPageConfig = {
	importantDates: CalendarImportantDate[];
	schedules: CalendarScheduleItem[];
};
