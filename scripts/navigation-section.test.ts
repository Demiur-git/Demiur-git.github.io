import assert from "node:assert/strict";
import { test } from "node:test";
import { crossesSections } from "../src/utils/navigation-section";

test("article routes, album details and about pages share their navigation section", () => {
	for (const path of [
		"/archive/",
		"/posts/guide/",
		"/tags/",
		"/series/",
		"/library/posts/2/",
		"/2/",
	])
		assert.equal(crossesSections("/library/", path), false);
	assert.equal(crossesSections("/about/me/", "/about/site/"), false);
	assert.equal(crossesSections("/gallery/", "/gallery/album/"), false);
	assert.equal(crossesSections("/library/", "/music/"), true);
	assert.equal(crossesSections("/rss/", "/music/"), false);
});
