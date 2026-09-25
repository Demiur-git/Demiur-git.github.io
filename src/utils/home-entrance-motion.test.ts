import assert from "node:assert/strict";
import test from "node:test";
import { sampleEyeReveal, sampleGateWalk } from "./home-entrance-motion.ts";

test("walk starts and ends at rest, with bounded steps and monotonic depth", () => {
	for (const [from, to] of [[980, 650], [650, 120]]) {
		assert.equal(sampleGateWalk(0, from, to, 2).distance, from);
		assert.equal(sampleGateWalk(1, from, to, 2).distance, to);
		let previous = from;
		for (let i = 0; i <= 100; i++) {
			const sample = sampleGateWalk(i / 100, from, to, 2);
			assert.ok(Math.abs(sample.offsetPx) <= 2);
			assert.ok(sample.distance <= previous);
			previous = sample.distance;
		}
		assert.ok(Math.abs(sampleGateWalk(1, from, to, 2).offsetPx) < 1e-8);
	}
});

test("eyes briefly open, close, then reveal a fully focused page at 1800ms", () => {
	assert.equal(sampleEyeReveal(0).openness, 0);
	assert.equal(sampleEyeReveal(300).openness, .1);
	assert.equal(sampleEyeReveal(450).openness, .1);
	assert.equal(sampleEyeReveal(630).openness, 0);
	assert.equal(sampleEyeReveal(750).openness, 0);
	assert.equal(sampleEyeReveal(1450).openness, 1);
	assert.deepEqual(sampleEyeReveal(1800), { openness: 1, blur: 0, shade: 0 });
	for (let t = 0; t <= 1800; t += 10) {
		const state = sampleEyeReveal(t);
		assert.ok(state.openness >= 0 && state.openness <= 1);
		assert.ok(state.blur >= 0 && state.blur <= 14);
	}
});
