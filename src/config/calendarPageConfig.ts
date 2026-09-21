import type { CalendarPageConfig } from "@/types/calendarPageConfig";

export const calendarPageConfig: CalendarPageConfig = {
	importantDates: [
		// 只标记节日当天，不展示连续放假范围和调休日期。
		{ date: "2026-01-01", title: "元旦", category: "holiday" },
		{ date: "2026-02-17", title: "春节", category: "holiday" },
		{ date: "2026-04-05", title: "清明节", category: "holiday" },
		{ date: "2026-05-01", title: "劳动节", category: "holiday" },
		{ date: "2026-06-19", title: "端午节", category: "holiday" },
		{ date: "2026-09-25", title: "中秋节", category: "holiday" },
		{ date: "2026-10-01", title: "国庆节", category: "holiday" },

		// 常见节日与纪念日
		{ date: "2026-01-26", title: "腊八节", category: "festival" },
		{ date: "2026-02-14", title: "情人节", category: "festival", repeat: "yearly" },
		{ date: "2026-03-03", title: "元宵节", category: "festival" },
		{ date: "2026-03-08", title: "妇女节", category: "festival", repeat: "yearly" },
		{ date: "2026-03-12", title: "植树节", category: "festival", repeat: "yearly" },
		{ date: "2026-05-04", title: "青年节", category: "festival", repeat: "yearly" },
		{ date: "2026-05-10", title: "母亲节", category: "festival" },
		{ date: "2026-06-01", title: "儿童节", category: "festival", repeat: "yearly" },
		{ date: "2026-06-21", title: "父亲节", category: "festival" },
		{ date: "2026-07-01", title: "建党节", category: "festival", repeat: "yearly" },
		{ date: "2026-08-01", title: "建军节", category: "festival", repeat: "yearly" },
		{ date: "2026-08-19", title: "七夕节", category: "festival" },
		{ date: "2026-09-10", title: "教师节", category: "festival", repeat: "yearly" },
		{ date: "2026-10-18", title: "重阳节", category: "festival" },
		{ date: "2026-12-13", title: "国家公祭日", category: "important", repeat: "yearly" },
		{ date: "2026-12-24", title: "平安夜", category: "festival", repeat: "yearly" },
		{ date: "2026-12-25", title: "圣诞节", category: "festival", repeat: "yearly" },

		// 个人日期
		{
			date: "2026-09-20",
			title: "建站日",
			category: "anniversary",
			description: "个人网站开始搭建的日子。",
			repeat: "yearly",
		},
	],
	schedules: [
		{
			date: "2026-09-21",
			title: "完善日历页面",
			status: "done",
			description: "加入重要日期、日程与月历联动标记。",
		},
	],
};
