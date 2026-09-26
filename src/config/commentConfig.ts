import type { CommentConfig } from "../types/commentConfig";

export const commentConfig: CommentConfig = {
	type: "waline",
	waline: {
		serverURL: import.meta.env.PUBLIC_WALINE_SERVER_URL?.trim() || "",
		lang: "zh-CN",
		emoji: [],
		login: "disable",
		visitorCount: false,
	},
};
