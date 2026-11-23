import assert from "node:assert/strict";
import { test } from "node:test";
import { entryDuration, entryFrame } from "../src/utils/pulse-entry";

test("first entries, revisits and reduced motion have bounded independent timing", () => {
	assert.equal(entryDuration(true, false), 2400);
	assert.equal(entryDuration(false, false), 350);
	assert.equal(entryDuration(true, true), 120);
	assert.equal(entryDuration(false, true), 120);
	assert.equal(
		entryDuration(true, false, true),
		0,
		"flatline adds no second wait",
	);
});
test("entry colours meet destination backgrounds without a final white flash", () => {
	for (const kind of ["newworld", "starfield", "echo", "stillness"] as const) {
		let previous = 255;
		for (let i = 0; i <= 100; i++) {
			const frame = entryFrame(kind, i / 100);
			assert.ok(Object.values(frame).every(Number.isFinite));
			assert.ok(frame.background <= previous);
			previous = frame.background;
			assert.ok(frame.opacity >= 0 && frame.opacity <= 1);
		}
		assert.equal(
			entryFrame(kind, 1).background,
			kind === "stillness" ? 229 : 0,
		);
		assert.equal(entryFrame(kind, 1).opacity, 0);
		assert.deepEqual(entryFrame(kind, 1.5), entryFrame(kind, 1));
	}
});

test("the flatline handoff starts and ends at the last scan's shade", () => {
	for (const progress of [0, 0.25, 0.5, 0.75, 1])
		assert.equal(entryFrame("stillness", progress, 229).background, 229);
	assert.equal(entryFrame("echo", 0, 248).background, 248);
	assert.equal(entryFrame("echo", 1, 248).background, 0);
});
