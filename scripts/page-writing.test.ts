import assert from "node:assert/strict";
import { test } from "node:test";
import { pageTransitionConfig } from "../src/config/pageTransitionConfig";
import {
	createPageWritingLayout,
	writingGlyphProgress,
} from "../src/utils/page-writing-paths";

test("all titles keep their original characters and have one reveal interval per character", () => {
	for (const title of [
		...Object.values(pageTransitionConfig.destinationLabels),
		"New Page",
		"绫",
		"Café",
		"0123456789",
		"About & Me",
	]) {
		const layout = createPageWritingLayout(title, true, 5.2);
		assert.equal(
			layout.glyphs.map((g) => g.character).join(""),
			title.replace(/\s/gu, ""),
		);
		for (const line of layout.lines)
			for (const g of line.glyphs)
				assert.equal(Array.from(line.text)[g.charIndex], g.character);
	}
});

test("original font fitting proportions and two-line titles remain unchanged", () => {
	const music = createPageWritingLayout("Music", true, 5.2);
	assert.equal(music.lines[0].width, 326);
	assert.equal(music.viewWidth, 362);
	assert.equal(music.lines[0].baseline, 105);
	assert.equal(music.viewHeight, 124);
	for (const title of ["About This Site", "Reading List"]) {
		const layout = createPageWritingLayout(title, true, 5.2);
		assert.equal(layout.lines.length, 2);
		assert.equal(layout.lines[1].baseline, 229);
	}
	assert.equal(
		createPageWritingLayout("  About   Me  ", true).lines[0].text,
		"About Me",
	);
});

test("reveal progress is monotonic, with short optional lift intervals", () => {
	for (const penLift of [true, false]) {
		for (const title of [
			"Music",
			"Library",
			"About This Site",
			"Reading List",
			"i.j?!",
			"0",
		]) {
			const glyphs = createPageWritingLayout(title, penLift, 5.2).glyphs;
			assert.equal(glyphs[0].startRatio, 0);
			assert.ok(Math.abs(glyphs.at(-1)!.endRatio - 1) < 1e-12);
			let previousEnd = 0;
			for (const glyph of glyphs) {
				assert.ok(
					glyph.startRatio >= previousEnd && glyph.endRatio > glyph.startRatio,
				);
				if (!penLift) assert.equal(glyph.startRatio, previousEnd);
				assert.equal(writingGlyphProgress(glyph.startRatio, glyph), 0);
				assert.equal(writingGlyphProgress(glyph.endRatio, glyph), 1);
				let previous = 0;
				for (let step = 0; step <= 100; step++) {
					const value = writingGlyphProgress(step / 100, glyph);
					assert.ok(value >= previous && value <= 1);
					previous = value;
				}
				previousEnd = glyph.endRatio;
			}
		}
	}
});

test("empty titles have no glyphs or invalid timeline values", () => {
	for (const title of ["", "   "]) {
		const layout = createPageWritingLayout(title, true);
		assert.equal(layout.glyphs.length, 0);
		assert.ok(
			Number.isFinite(layout.viewWidth) && Number.isFinite(layout.viewHeight),
		);
	}
});
