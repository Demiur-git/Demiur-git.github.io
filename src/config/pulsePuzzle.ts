// Internal puzzle data. Answers are not rendered as visitor-facing hints.
export const pulsePuzzle = {
	storageKey: "demiur-pulse-puzzle-v2",
	legacyStorageKey: "demiur-pulse-puzzle-v1",
	version: 2,
	multiplier: 5,
	offset: 8,
	alphabetSize: 26,
	clues: [
		{
			id: "home",
			order: "01",
			cipher: "05",
			style: "fold",
			hint: "折角的铅笔字：这张纸，好像从一份旧借阅凭条上落下。",
		},
		{
			id: "archive",
			order: "03",
			cipher: "11",
			style: "ticket",
			hint: "凭条背面：剩下的日期，被收进了按年月排列的册子。",
		},
		{
			id: "categories",
			order: "05",
			cipher: "02",
			style: "pencil",
			hint: "页边的字迹：有一枚印记，留在记录每一天的地方。",
		},
		{
			id: "tags",
			order: "02",
			cipher: "04",
			style: "stamp",
			hint: "褪色的印章旁：下一份索引，夹在那些通向工具的地址之间。",
		},
		{
			id: "posts",
			order: "04",
			cipher: "20",
			style: "index",
			hint: "索引背面：把记录带到唱针沉默的地方。",
		},
	],
	scraps: [
		{ id: "scrap-af", fragment: "AF", number: "5", side: "left" },
		{ id: "scrap-fine", fragment: "FINE", number: "8", side: "right" },
	],
	scrapDescription:
		"被撕掉一块的便签，上面留着数字与半个单词。撕口似乎还可以对上。",
	worldAnswer: "NEWWORLD",
	worldDialogue: [
		{ speaker: "？？？", text: "【王座对话占位】第一句对白。" },
		{ speaker: "？？？", text: "【王座对话占位】第二句对白。" },
		{ speaker: "？？？", text: "【王座对话占位】第三句对白。" },
	],
} as const;
