import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import matter from "gray-matter";

const root = new URL("../", import.meta.url);
const source = readFileSync(
	new URL("src/content/projects/palib.md", root),
	"utf8",
);
const { data, content } = matter(source);

test("Palib is a published project with a collection date and the expected tags", () => {
	assert.equal(data.title, "Palib · 个人图书馆网站");
	assert.equal(data.status, "published");
	assert.equal(data.draft, false);
	assert.equal(
		new Date(data.published).toISOString().slice(0, 10),
		"2026-10-01",
	);
	assert.deepEqual(data.tags, ["Astro", "Svelte", "TypeScript", "个人网站"]);
	assert.match(content, /收录日期，不是网站的创建日期/);
});

test("project links use the real public site and repository", () => {
	assert.deepEqual(
		data.link.map((link: { value: string }) => link.value),
		[
			"https://demiur-git.github.io/",
			"https://github.com/Demiur-git/Demiur-git.github.io",
		],
	);
	assert.equal(data.link.length, 2);
});

test("cover is a local WebP and public prose contains no hidden-route disclosures", () => {
	assert.equal(data.image, "/images/projects/palib-home.webp");
	const bytes = readFileSync(new URL(`public${data.image}`, root));
	assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
	assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
	assert.doesNotMatch(
		source,
		/\/pulse\/|\/newworld\/|\/echo\/|\/starfield\/|\/stillness\/|NEWWORLD|PALINGENESIS|彩蛋/,
	);
});
