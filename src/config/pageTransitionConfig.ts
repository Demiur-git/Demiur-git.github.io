import type { PageTransitionConfig } from "@/types/pageTransitionConfig";
import { siteConfig } from "./siteConfig";

export const pageTransitionConfig: PageTransitionConfig = {
	enable: true,
	// 默认与站点标题保持同步；也可以在这里填写独立的过渡页文字。
	text: siteConfig.title,
	timing: {
		cover: 300,
		write: 650,
		hold: 100,
		reveal: 350,
	},
};
