import type { RootContent } from "hast";
import { fromHtml } from "hast-util-from-html";
import sanitizeHtml from "sanitize-html";

export type SubscriptionEntry = {
	kind: "post" | "memo";
	title: string;
	link: string;
	published: Date;
	updated: Date;
	description: string;
	content: string;
};

export function sortSubscriptionEntries<T extends { published: Date }>(
	entries: T[],
): T[] {
	return [...entries].sort(
		(a, b) => b.published.getTime() - a.published.getTime(),
	);
}

export function publishedFeedPosts<
	T extends { data: { draft?: boolean; published: Date } },
>(posts: T[]): T[] {
	return [...posts]
		.filter((post) => !post.data.draft)
		.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
}

export function stripInvalidXmlChars(text: string): string {
	return text.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 character restrictions
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
		"",
	);
}

export function escapeXml(text: string): string {
	return stripInvalidXmlChars(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/** Feed HTML is self-contained: no scripts, unsafe URLs or relative resources. */
export function sanitizeFeedHtml(html: string, base: URL): string {
	return sanitizeHtml(stripInvalidXmlChars(html), {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
		transformTags: {
			"*": (tagName, attributes) => {
				const attribs = { ...attributes };
				// Feed readers need one dependable image URL, not browser-only source sets.
				delete attribs.srcset;
				for (const name of ["href", "src"]) {
					if (!(name in attribs)) continue;
					try {
						const resolved = new URL(attribs[name], base);
						const allowed = ["https:", "http:"];
						if (name === "href") allowed.push("mailto:", "tel:");
						if (allowed.includes(resolved.protocol))
							attribs[name] = resolved.href;
						else delete attribs[name];
					} catch {
						delete attribs[name];
					}
				}
				return { tagName, attribs };
			},
		},
	});
}

function nodeText(node: RootContent): string {
	if (node.type === "text") return node.value;
	if (node.type !== "element") return "";
	const text = node.children.map(nodeText).join("");
	return ["p", "div", "li", "br", "h1", "h2", "h3", "blockquote"].includes(
		node.tagName,
	)
		? `${text} `
		: text;
}

function excerpt(text: string, limit: number): string {
	const chars = Array.from(text.replace(/\s+/g, " ").trim());
	return chars.length > limit
		? `${chars.slice(0, limit).join("")}…`
		: chars.join("");
}

export function makeMemoFeedEntry(options: {
	html: string;
	link: string;
	published: Date;
	site: URL;
	includeContent: boolean;
}): SubscriptionEntry {
	const { link, published, site, includeContent } = options;
	const content = sanitizeFeedHtml(options.html, new URL(link, site));
	const nodes = fromHtml(content, { fragment: true }).children;
	const firstParagraph = nodes.find(
		(node) =>
			node.type === "element" && node.tagName === "p" && nodeText(node).trim(),
	);
	const allText = nodes.map(nodeText).join("");
	return {
		kind: "memo",
		title:
			excerpt(firstParagraph ? nodeText(firstParagraph) : allText, 44) ||
			"图片便签",
		link,
		published,
		updated: published,
		description: excerpt(allText, 160) || "一张馆长的便签。",
		content: includeContent ? content : "",
	};
}
