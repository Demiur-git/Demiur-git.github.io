export type ReadingStatus = "planned" | "reading" | "finished";

export type ReadingPlanItem = {
	title: string;
	author?: string;
	status: ReadingStatus;
	progress?: number;
	note?: string;
};

export type ReadingPlanConfig = {
	title: string;
	description: string;
	books: ReadingPlanItem[];
};
