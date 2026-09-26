import libraryReadingDesk from "@/assets/images/library-reading-desk.png";
import libraryReadingDeskNight from "@/assets/images/library-reading-desk-night.png";
import type { HomeIntroConfig } from "@/types/homeIntroConfig";

export const homeIntroConfig: HomeIntroConfig = {
	eyebrow: "PRIVATE LIBRARY · COLLECTION 2026",
	title: "欢迎来到我的私人图书馆。",
	description:
		"这里收藏便签、文章、阅读与持续发生的实践。请随意翻阅，也许会在某一页遇见值得带走的线索。",
	heroArtwork: {
		src: libraryReadingDesk,
		darkSrc: libraryReadingDeskNight,
		alt: "",
		position: "64% center",
	},
	links: [
		{
			name: "QQ",
			url: "https://im.qq.com/",
			icon: "fa7-brands:qq",
			external: true,
		},
		{
			name: "哔哩哔哩",
			url: "https://space.bilibili.com/",
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
	catalogDescription: "从这里进入不同的书架，每一格都保存着一种生活切片。",
	catalogEntries: [
		{
			code: "NOTE · 01",
			name: "便签",
			description: "随手记录的想法、线索与学习片段。",
			url: "/dynamic/",
			icon: "material-symbols:edit-note-outline",
			tone: "moss",
		},
		{
			code: "READ · 02",
			name: "文章",
			description: "经过整理，值得慢慢阅读的长篇文字。",
			url: "/archive/",
			icon: "material-symbols:article-outline",
			tone: "burgundy",
		},
		{
			code: "PLAN · 03",
			name: "日历",
			description: "重要日期、今日安排与未来计划。",
			url: "/calendar/",
			icon: "material-symbols:calendar-month-outline-rounded",
			tone: "brass",
		},
		{
			code: "VIEW · 04",
			name: "相册",
			description: "照片、风景和想要保存的瞬间。",
			url: "/gallery/",
			icon: "material-symbols:photo-library-outline-rounded",
			tone: "burgundy",
		},
		{
			code: "WORK · 05",
			name: "项目",
			description: "正在进行与已经完成的个人实践。",
			url: "/projects/",
			icon: "material-symbols:rocket-launch-outline",
			tone: "moss",
		},
		{
			code: "BOOK · 06",
			name: "读书计划",
			description: "待读书目、阅读进度与读后记录。",
			url: "/reading/",
			icon: "material-symbols:menu-book-outline-rounded",
			tone: "brass",
		},
	],
};
