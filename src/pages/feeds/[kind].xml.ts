import type { APIContext } from "astro";
import { siteConfig } from "@/config";
import {
	getSubscriptionEntries,
	subscriptionRss,
} from "@/utils/subscription-content";

export const prerender = true;

export function getStaticPaths(): { params: { kind: string } }[] {
	return ["memos", "all"].map((kind) => ({ params: { kind } }));
}

export async function GET(context: APIContext): Promise<Response> {
	const kind = context.params.kind === "memos" ? "memos" : "all";
	const site = context.site ?? new URL(siteConfig.site_url);
	const includeContent = (siteConfig.feed?.contentMode ?? "full") === "full";
	const entries = await getSubscriptionEntries({ site, kind, includeContent });
	return subscriptionRss({
		site,
		path: `/feeds/${kind}.xml`,
		title: `${siteConfig.title} · ${kind === "memos" ? "便签" : "文章与便签"}`,
		description:
			kind === "memos"
				? "馆长的短想法与过程记录。"
				: "书库文章与馆长便签的合并订阅。",
		entries,
		includeContent,
	});
}
