import libraryReadingDesk from "@/assets/images/library-reading-desk.png";
import libraryReadingDeskNight from "@/assets/images/library-reading-desk-night.png";
import type { HomeIntroConfig } from "@/types/homeIntroConfig";

export const homeIntroConfig: HomeIntroConfig = {
	eyebrow: "PALING-LIBRARY",
	title: "这里是‘世界’的旁注",
	description:
		"在此，站长和馆员竭诚欢迎您的到来，祝您在这里有一段愉快的时光",
	heroArtwork: {
		src: libraryReadingDesk,
		darkSrc: libraryReadingDeskNight,
		alt: "",
		position: "64% center",
	},
	links: [
		{
			name: "QQ",
			url: "https://qm.qq.com/q/eF48RrbgDm",
			icon: "fa7-brands:qq",
			external: true,
		},
		{
			name: "哔哩哔哩",
			url: "https://space.bilibili.com/445940889",
			icon: "fa7-brands:bilibili",
			external: true,
		},
		{
			name: "GitHub",
			url: "https://github.com/Demiur-git",
			icon: "fa7-brands:github",
			external: true,
		},
	],
	catalogEyebrow: "LIBRARY CATALOG",
	catalogTitle: "馆藏目录",
	catalogDescription: "从这里进入不同的书架，每一格都保存着一种生活切片",
	catalogEntries: [
		{
			code: "NOTE",
			name: "便签",
			description: "站长随手记录的想法、线索与学习片段",
			url: "/dynamic/",
			icon: "material-symbols:edit-note-outline",
			tone: "moss",
		},
		{
			code: "READ",
			name: "书库",
			description: "经过站长整理的长篇文字",
			url: "/library/",
			icon: "material-symbols:article-outline",
			tone: "burgundy",
		},
		{
			code: "PLAN",
			name: "日历",
			description: "重要日期、今日安排与未来计划",
			url: "/calendar/",
			icon: "material-symbols:calendar-month-outline-rounded",
			tone: "brass",
		},
		{
			code: "VIEW",
			name: "相册",
			description: "站长收藏的相册",
			url: "/gallery/",
			icon: "material-symbols:photo-library-outline-rounded",
			tone: "burgundy",
		},
		{
			code: "WORK",
			name: "项目",
			description: "站长捣鼓过的小东西",
			url: "/projects/",
			icon: "material-symbols:rocket-launch-outline",
			tone: "moss",
		},
		{
			code: "BOOK",
			name: "读书计划",
			description: "待读书目、阅读进度与读后记录",
			url: "/reading/",
			icon: "material-symbols:menu-book-outline-rounded",
			tone: "brass",
		},
	],
};
