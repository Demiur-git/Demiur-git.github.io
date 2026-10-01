import rss, { type RSSFeedItem } from "@astrojs/rss";
import { getSortedPosts } from "@utils/content-utils";
import { renderFeedEntries } from "@utils/feed-utils";
import type { APIContext } from "astro";
import { siteConfig } from "@/config";
import pkg from "../../package.json";
import { stripInvalidXmlChars } from "@/utils/subscription-utils";

export const prerender = true;

export async function GET(context: APIContext): Promise<Response> {
	const includeContent = (siteConfig.feed?.contentMode ?? "full") === "full";
	const blog = await getSortedPosts();
	const site = context.site ?? new URL(siteConfig.site_url);
	const entries = await renderFeedEntries(blog, { includeContent, site });
	const feedItems: RSSFeedItem[] = entries.map((entry) => ({
		title: stripInvalidXmlChars(entry.title),
		pubDate: entry.published,
		description: stripInvalidXmlChars(entry.description),
		link: new URL(entry.link, site).href,
		...(includeContent ? { content: entry.content } : {}),
	}));
	return rss({
		title: siteConfig.title,
		description: siteConfig.subtitle || "No description",
		site,
		customData: `<templateTheme>Firefly</templateTheme>
		<templateThemeVersion>${pkg.version}</templateThemeVersion>
		<templateThemeUrl>https://github.com/CuteLeaf/Firefly</templateThemeUrl>
		<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
		items: feedItems,
	});
}
