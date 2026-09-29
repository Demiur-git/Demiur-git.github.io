import assert from "node:assert/strict";
import { test } from "node:test";
import { PulseScanner, pulseWaveGeometry } from "../src/utils/pulse-wave";
import {
	coolStillnessRhythm,
	emptyStillnessRhythm,
	stillnessIntensity,
	strikeStillnessRhythm,
	type RhythmKey,
} from "../src/utils/stillness-rhythm";

test("twenty sustained alternating strikes and six rapid strikes take about thirteen seconds", () => {
	let state = emptyStillnessRhythm();
	for (let index = 0; index < 20; index++) {
		const time = index * 580;
		const result = strikeStillnessRhythm(state, index % 2 ? "K" : "J", time);
		state = result.state;
		assert.equal(result.zeroed, false);
	}
	assert.equal(state.beats, 20);
	assert.equal(state.armed, true);
	for (let index = 0; index < 6; index++) {
		const result = strikeStillnessRhythm(state, index % 2 ? "K" : "J", 11320 + index * 300);
		state = result.state;
		assert.equal(result.zeroed, index === 5);
	}
	assert.equal(state.burst, 6);
});

test("fast alternating spam cannot skip the eleven-second buildup", () => {
	let state = emptyStillnessRhythm();
	for (let index = 0; index < 26; index++) {
		const result = strikeStillnessRhythm(state, index % 2 ? "K" : "J", index * 100);
		state = result.state;
		assert.equal(result.zeroed, false);
	}
	assert.equal(state.beats, 20);
	assert.equal(state.armed, false);
	assert.ok(stillnessIntensity(state, 2500) < 0.25);
	state = strikeStillnessRhythm(state, "J", 11000).state;
	assert.equal(state.armed, false, "an extended pause loses the buildup instead of arming it");
});

test("same key, long pause and slow final burst cannot bypass the gate", () => {
	let state = emptyStillnessRhythm();
	state = strikeStillnessRhythm(state, "J", 0).state;
	state = strikeStillnessRhythm(state, "J", 100).state;
	assert.equal(state.beats, 0);
	state = strikeStillnessRhythm(state, "K", 1000).state;
	assert.equal(state.beats, 1);
	state = coolStillnessRhythm(state, 3300);
	assert.equal(state.beats, 0);
	for (let index = 0; index < 20; index++)
		state = strikeStillnessRhythm(state, (index % 2 ? "K" : "J") as RhythmKey, 4000 + index * 580).state;
	assert.equal(state.armed, true);
	state = strikeStillnessRhythm(state, "J", 15320).state;
	assert.equal(state.burst, 1);
	const slow = strikeStillnessRhythm(state, "K", 15700);
	assert.equal(slow.zeroed, false);
	assert.equal(slow.state.armed, false);
	assert.equal(slow.state.beats, 18);
});

test("wave buildup grows visibly without clipping at desktop and phone heights", () => {
	const sample = (intensity: number) => {
		const scanner = new PulseScanner(() => 1);
		scanner.step(12, 1200, intensity);
		scanner.step(4012, 1200, intensity);
		return scanner.segments.flatMap((segment) => [segment.y1, segment.y2]);
	};
	for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
		const positions = sample(intensity);
		const geometry = pulseWaveGeometry(intensity);
		assert.ok(Math.min(...positions) > geometry.top, `upper peak is visible at ${intensity}`);
		assert.ok(Math.max(...positions) < geometry.top + geometry.height, `lower peak is visible at ${intensity}`);
	}
	const normal = sample(0);
	const heightened = sample(1);
	const normalGeometry = pulseWaveGeometry(0);
	const heightenedGeometry = pulseWaveGeometry(1);
	for (const viewportHeight of [900, 1024, 844]) {
		const normalPixels = Math.min(viewportHeight * normalGeometry.viewportHeight / 100, normalGeometry.maxHeight);
		const heightenedPixels = Math.min(viewportHeight * heightenedGeometry.viewportHeight / 100, heightenedGeometry.maxHeight);
		const normalPeak = (200 - Math.min(...normal)) * normalPixels / normalGeometry.height;
		const heightenedPeak = (200 - Math.min(...heightened)) * heightenedPixels / heightenedGeometry.height;
		assert.ok(heightenedPeak / normalPeak > 1.85, `peak should nearly double at ${viewportHeight}px height`);
	}
});
