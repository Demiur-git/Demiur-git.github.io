import type { FriendLink, FriendsPageConfig } from "../types/friendsConfig";

export const friendsPageConfig: FriendsPageConfig = {
	showCustomContent: false,
	showComment: false,
	randomizeSort: false,
};

export const friendsConfig: FriendLink[] = [
	{
		title: "Firefly 文档",
		imgurl: "/images/friends/firefly.png",
		desc: "本站所用 Firefly Astro 主题模板的中文文档，提供搭建与配置指南。",
		siteurl: "https://docs-firefly.cuteleaf.cn/zh/",
		tags: ["框架来源", "Astro", "文档"],
		weight: 10,
		enabled: true,
	},
];

export const getEnabledFriends = (): FriendLink[] => {
	const items = friendsConfig
		.filter((item) => item.enabled)
		.sort((a, b) => b.weight - a.weight);
	if (friendsPageConfig.randomizeSort) {
		for (let i = items.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[items[i], items[j]] = [items[j], items[i]];
		}
	}
	return items;
};
