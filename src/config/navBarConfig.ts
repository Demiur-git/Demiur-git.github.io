import {
	type NavBarConfig,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/navBarConfig";

export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

export const navBarConfig: NavBarConfig = {
	// 有子页面的栏目统一放在 children 中：桌面端悬停下拉，移动端折叠展开。
	links: [
		{
			name: "主页",
			url: "/",
			icon: "material-symbols:home-outline",
		},
		{
			name: "工具导航",
			url: "/booknav/",
			icon: "material-symbols:handyman-outline-rounded",
			pageKey: "booknav",
		},
		{
			name: "文章",
			url: "/archive/",
			icon: "material-symbols:article-outline",
		},
		{
			name: "我的",
			url: "#",
			icon: "material-symbols:person-outline-rounded",
			children: [
				{
					name: "便签",
					url: "/dynamic/",
					icon: "material-symbols:edit-note-outline",
					pageKey: "dynamic",
				},
				{
					name: "日历",
					url: "/calendar/",
					icon: "material-symbols:calendar-month-outline-rounded",
				},
				{
					name: "相册",
					url: "/gallery/",
					icon: "material-symbols:photo-library-outline-rounded",
					pageKey: "gallery",
				},
				{
					name: "音乐",
					url: "/music/",
					icon: "material-symbols:library-music-outline-rounded",
				},
				{
					name: "项目",
					url: "/projects/",
					icon: "material-symbols:rocket-launch-outline",
					pageKey: "projects",
				},
				{
					name: "读书计划",
					url: "/reading/",
					icon: "material-symbols:menu-book-outline-rounded",
				},
			],
		},
		{
			name: "交流",
			url: "#",
			icon: "material-symbols:forum-outline-rounded",
			children: [
				{
					name: "友链",
					url: "/friends/",
					icon: "material-symbols:group-outline-rounded",
					pageKey: "friends",
				},
				{
					name: "留言",
					url: "/guestbook/",
					icon: "material-symbols:chat-bubble-outline-rounded",
					pageKey: "guestbook",
				},
				{
					name: "赞助",
					url: "/sponsor/",
					icon: "material-symbols:favorite-outline-rounded",
					pageKey: "sponsor",
				},
			],
		},
		{
			name: "关于",
			url: "#",
			icon: "material-symbols:info-outline-rounded",
			children: [
				{
					name: "本人",
					url: "/about/me/",
					icon: "material-symbols:person-outline-rounded",
				},
				{
					name: "网站",
					url: "/about/site/",
					icon: "material-symbols:language-rounded",
				},
				{
					name: "绫",
					url: "/about/ling/",
					icon: "material-symbols:menu-book-outline-rounded",
				},
			],
		},
	],
};
