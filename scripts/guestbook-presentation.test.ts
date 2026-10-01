import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) =>
	readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("navbar mark is local, inline and shares the favicon paths", () => {
	const mark = read("src/icons/palib.svg");
	const favicon = read("public/favicon.svg");
	const paths = (source: string) =>
		[...source.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);
	assert.deepEqual(paths(mark), paths(favicon));
	assert.ok(paths(mark).length);
	assert.doesNotMatch(mark, /<(?:symbol|use|image)\b/);
	const navbar = read("src/components/layout/Navbar.astro");
	assert.match(navbar, /name=\{logoConfig\.value \|\| "palib"\} is:inline/);
	assert.match(navbar, /name="palib" is:inline/);
});

test("guestbook variant preserves comment identity and avoids other page variants", () => {
	const guestbook = read("src/pages/guestbook.astro");
	assert.match(guestbook, /customPath="\/guestbook\/" variant="guestbook"/);
	assert.match(
		read("src/components/comment/index.astro"),
		/variant = "standard"/,
	);
	assert.match(
		read("src/components/comment/Waline.astro"),
		/requiredMeta: \["nick"\]/,
	);
	assert.match(
		read("src/components/comment/Waline.astro"),
		/meta: \["nick", "mail"\]/,
	);
});

test("friend tags remain searchable but are not rendered as filters or badges", () => {
	const friends = read("src/pages/friends.astro");
	assert.doesNotMatch(friends, /selectedTag|data-tag=|category-pill|allTags/);
	assert.match(friends, /data-tags=\{item.tags\?\.join/);
	assert.match(friends, /tags\.some/);
	assert.match(friends, /if \(searchMatch\)/);
});

test("successful initialization hides retry and guestbook layout uses ordered rows", () => {
	assert.match(
		read("src/utils/waline-comments.ts"),
		/this\.pending = false;\s*this\.setStatus\(""\);/,
	);
	const css = read("src/styles/pages/guestbook.css");
	assert.match(css, /\.guestbook-waline \.wl-cards \{ display: grid;/);
	assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
	assert.doesNotMatch(
		css,
		/grid-auto-flow:\s*(?:column|dense)|column-count|\.library-waline/,
	);
});
