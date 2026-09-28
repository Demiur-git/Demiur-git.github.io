import type { ReadingPlanConfig } from "@/types/readingPlanConfig";

export const readingPlanConfig: ReadingPlanConfig = {
	title: "读书计划",
	description: "记录计划阅读、正在阅读与已经读完的书。",
	books: [
		{
			title: "三日间的幸福",
			author: "三秋縋",
			status: "finished",
			bangumiSubjectId: 118913,
			personalRating: 9,
			personalReview:
				"夯，节奏舒服，文笔也不错，标题诈骗（误），我个人是觉得三日间的幸福整本书本身的质量就已经有8分以上，从头到尾的事件没有特别突兀的感觉，这就比大部分轻小说强了不少，让它真正上9分的是结尾，这个结尾是我阅读的所有轻小说里面最顶的那一批，很多轻小说的结尾都会使用留白，但是都没有这本书的感觉，很大胆的留白，但是恰到好处，不会让人感觉这个故事没有讲完抑或是感觉讲的太多。非常推荐看的一本书，留白部分我觉得不剧透效果会很好。",
		},
	],
};
