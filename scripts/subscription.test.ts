import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	makeMemoFeedEntry,
	publishedFeedPosts,
	sanitizeFeedHtml,
	sortSubscriptionEntries,
	stripInvalidXmlChars,
} from "../src/utils/subscription-utils";

const site = new URL("https://demiur-git.github.io/");
const published = new Date("2026-10-01T08:00:00+08:00");
const memo = (html: string, includeContent = true) =>
	makeMemoFeedEntry({
		html,
		includeContent,
		site,
		published,
		link: "/dynamic/#dynamic-test",
	});

test("feeds exclude drafts in all modes and order by publication, never pinned or updated", () => {
	const posts = [
		{
			id: "old",
			data: {
				published: new Date("2025-01-01"),
				pinned: true,
				updated: new Date("2030-01-01"),
			},
		},
		{ id: "draft", data: { published, draft: true } },
		{ id: "new", data: { published } },
	];
	assert.deepEqual(
		publishedFeedPosts(posts).map((post) => post.id),
		["new", "old"],
	);
	assert.equal(
		posts[0].id,
		"old",
		"sorting cannot mutate shared content order",
	);
	const mixed = sortSubscriptionEntries([
		{ kind: "memo", published: new Date("2026-09-30") },
		{ kind: "post", published },
	]);
	assert.equal(mixed[0].kind, "post");
	assert.deepEqual(sortSubscriptionEntries([]), []);
});

test("feed HTML resolves root, relative and fragment links and removes unsafe material", () => {
	const clean = sanitizeFeedHtml(
		'<p><a href="../chapter/?a=1&amp;b=2">A</a><a href="#part">B</a><a href="javascript:alert(1)">bad</a></p><img src="/images/cover.webp" srcset="relative.jpg 2x" onerror="alert(1)"><img src="./figure.png"><script>private()</script><iframe src="https://example.com"></iframe>',
		new URL("/posts/guide/entry/", site),
	);
	assert.match(
		clean,
		/https:\/\/demiur-git.github.io\/posts\/guide\/chapter\/\?a=1&amp;b=2/,
	);
	assert.match(
		clean,
		/https:\/\/demiur-git.github.io\/posts\/guide\/entry\/#part/,
	);
	assert.match(
		clean,
		/src="https:\/\/demiur-git.github.io\/images\/cover.webp"/,
	);
	assert.match(
		clean,
		/src="https:\/\/demiur-git.github.io\/posts\/guide\/entry\/figure.png"/,
	);
	assert.doesNotMatch(
		clean,
		/javascript:|onerror|srcset|<script|private\(\)|iframe/,
	);
});

test("memo title uses the first paragraph with decoded entities and Unicode-safe truncation", () => {
	const entry = memo(
		"<h2>小标题</h2><p>第一段 &amp; &lt;书&gt; 😀</p><p>第二段</p>",
	);
	assert.equal(entry.title, "第一段 & <书> 😀");
	assert.match(entry.description, /第二段/);
	const long = memo(`<p>${"😀".repeat(50)}</p>`);
	assert.equal(Array.from(long.title).length, 45);
	assert.ok(long.title.endsWith("…"));
	assert.equal(
		memo('<p><img src="/photo.webp" alt="照片"></p>').title,
		"图片便签",
	);
});

test("summary mode has no body and preserves stable memo identity", () => {
	const full = memo("<p>正文</p><img src='/photo.webp'>");
	const summary = memo("<p>正文</p><img src='/photo.webp'>", false);
	assert.equal(summary.content, "");
	assert.equal(full.link, summary.link);
	assert.equal(full.published, published);
	assert.equal(summary.title, full.title);
	assert.equal(summary.description, full.description);
	assert.match(full.content, /https:\/\/demiur-git.github.io\/photo.webp/);
});

test("XML-invalid controls are removed, normal punctuation and Unicode survive", () => {
	assert.equal(
		stripInvalidXmlChars("A\u0001B\u0000C & <中文>\n"),
		"ABC & <中文>\n",
	);
});

test("feed scope, protected rendering and old endpoints remain compatible", () => {
	const read = (path: string) =>
		readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
	const source = read("src/utils/subscription-content.ts");
	assert.match(source, /getCollection\("posts"\)/);
	assert.match(source, /getCollection\("dynamic"\)/);
	assert.doesNotMatch(source, /getCollection\("(?:projects|spec)"\)|fetch\(/);
	const feed = read("src/utils/feed-utils.ts");
	assert.ok(
		feed.indexOf("if (post.data.password)") <
			feed.indexOf("await render(post)"),
	);
	assert.match(feed, /passwordProtectedRss/);
	assert.match(read("src/pages/rss.xml.ts"), /renderFeedEntries/);
	assert.match(read("src/pages/atom.xml.ts"), /buildAtomFeed/);
	assert.match(
		read("src/components/layout/Footer.astro"),
		/href: url\("\/rss\/"\)/,
	);
	assert.match(read("src/utils/subscription-copy.ts"), /disconnectedCallback/);
});
