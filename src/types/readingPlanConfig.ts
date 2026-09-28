export type ReadingStatus = "planned" | "reading" | "finished";

export type ReadingPlanItem = {
	title: string;
	author?: string;
	status: ReadingStatus;
	progress?: number;
	note?: string;
	/** 对应具体版本的 Bangumi 书籍条目 ID；不按书名自动匹配。 */
	bangumiSubjectId?: number;
	/** 个人评分，0–10 分；未填写时显示“暂无评分”。 */
	personalRating?: number;
	/** 个人评价；旧的 note 字段仍会作为评价显示。 */
	personalReview?: string;
};

export type ReadingBookMetadata = {
	subjectId: number;
	summary: string;
	score?: number;
	cover?: string;
};

export type ReadingPlanConfig = {
	title: string;
	description: string;
	books: ReadingPlanItem[];
};
