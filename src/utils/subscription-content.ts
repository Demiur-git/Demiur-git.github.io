import { getCollection } from "astro:content";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import rss from "@astrojs/rss";
import { siteConfig } from "@/config";
import { dynamicAnchor, dynamicSlug } from "@/utils/dynamic-utils";
import {
	makeMemoFeedEntry,
	escapeXml,
	publishedFeedPosts,
	sortSubscriptionEntries,
	stripInvalidXmlChars,
	type SubscriptionEntry,
} from "@/utils/subscription-utils";
import { url } from "@/utils/url-utils";

export async function getSubscriptionEntries(options: {
	site: URL;
	kind: "posts" | "memos" | "all";
	includeContent: boolean;
}): Promise<SubscriptionEntry[]> {
	const { site, kind, includeContent } = options;
	const entries: SubscriptionEntry[] = [];
	if (kind !== "memos") {
		const posts = publishedFeedPosts(await getCollection("posts"));
		if (includeContent) {
			const { renderFeedEntries } = await import("@/utils/feed-utils");
			entries.push(
				...(await renderFeedEntries(posts, { site, includeContent })),
			);
		} else {
			entries.push(
				...posts.map((post) => ({
					kind: "post" as const,
					title: post.data.title,
					link: url(`/posts/${post.id}/`),
					published: post.data.published,
					updated: post.data.updated ?? post.data.published,
					description: post.data.description || "",
					content: "",
				})),
			);
		}
	}
	if (kind !== "posts") {
		const memos = await getCollection("dynamic");
		if (memos.length) {
			const processor = await createMarkdownProcessor();
			for (const memo of memos) {
				const rendered = await processor.render(memo.body || "");
				entries.push(
					makeMemoFeedEntry({
						html: rendered.code,
						link: `${url("/dynamic/")}#${dynamicAnchor(dynamicSlug(memo.id))}`,
						published: memo.data.published,
						site,
						includeContent,
					}),
				);
			}
		}
	}
	return sortSubscriptionEntries(entries);
}

export async function subscriptionRss(options: {
	site: URL;
	path: string;
	title: string;
	description: string;
	entries: SubscriptionEntry[];
	includeContent: boolean;
}): Promise<Response> {
	const { site, path, title, description, entries, includeContent } = options;
	return rss({
		title: stripInvalidXmlChars(title),
		description: stripInvalidXmlChars(description),
		site,
		xmlns: { atom: "http://www.w3.org/2005/Atom" },
		customData: `<atom:link href="${escapeXml(new URL(url(path), site).href)}" rel="self" type="application/rss+xml"/><language>${escapeXml(siteConfig.lang)}</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
		items: sortSubscriptionEntries(entries).map((entry) => ({
			title: stripInvalidXmlChars(entry.title),
			pubDate: entry.published,
			description: stripInvalidXmlChars(entry.description),
			// Absolute links preserve the memo fragment and provide a stable GUID.
			link: new URL(entry.link, site).href,
			...(includeContent ? { content: entry.content } : {}),
		})),
	});
}
