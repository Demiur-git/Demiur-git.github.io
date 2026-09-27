import assert from "node:assert/strict";
import { test } from "node:test";
import {
	MORSE_ALPHABET,
	MorseInput,
	decodeMorse,
} from "../src/utils/pulse-morse";
import { PulseScanner } from "../src/utils/pulse-wave";
import {
	THRONE_STRUCTURE,
	buildThroneThreads,
	projectedThroneBounds,
	projectThrone,
	throneView,
} from "../src/utils/throne-geometry";

test("all letters round-trip; invalid patterns do not become letters", () => {
	for (const [letter, symbols] of Object.entries(MORSE_ALPHABET))
		assert.equal(decodeMorse(symbols), letter);
	assert.equal(decodeMorse(""), undefined);
	assert.equal(decodeMorse("....."), undefined);
});
test("explicit letters, fast input, undo, invalid input and full target word", () => {
	const input = new MorseInput();
	assert.equal(input.confirm(), false);
	for (const letter of "NEWWORLD") {
		for (const symbol of MORSE_ALPHABET[letter])
			assert.equal(input.append(symbol as "." | "-"), true);
		assert.equal(input.confirm(), true);
	}
	assert.equal(input.letters, "NEWWORLD");
	input.undo();
	assert.equal(input.letters, "NEWWORL");
	assert.equal(input.symbols, "");
	input.append(".");
	input.append("-");
	input.undo();
	assert.equal(input.symbols, ".");
	input.clear();
	assert.equal(input.letters, "");
	for (let i = 0; i < 4; i++) input.append(".");
	assert.equal(input.append("."), false);
});
test("scanner has bounded fading history, varied waves, and no line across wraparound", () => {
	let seed = 17;
	const random = () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};
	const scanner = new PulseScanner(random);
	const peaks: number[] = [];
	for (let time = 1; time < 16000; time += 16) {
		scanner.step(time);
		assert.ok(scanner.segments.length <= 95);
		for (const segment of scanner.segments) {
			assert.ok(time - segment.born < 1100);
			assert.ok(segment.x2 >= segment.x1);
			assert.ok(segment.x2 - segment.x1 < 4);
			assert.ok(segment.y2 >= 30 && segment.y2 <= 306);
		}
		if (time % 1000 < 16 && scanner.segments.length)
			peaks.push(Math.min(...scanner.segments.map((s) => s.y2)));
	}
	assert.ok(new Set(peaks.map((n) => Math.round(n))).size > 4);
});
test("throne projection remains symmetric and finite at all camera distances and sizes", () => {
	for (const width of [390, 768, 1440])
		for (const distance of [22, 18, 14, 10, 6]) {
			const view = { width, height: 844, distance };
			const left = projectThrone({ x: -1.35, y: 4, z: 0 }, view),
				right = projectThrone({ x: 1.35, y: 4, z: 0 }, view);
			assert.ok(Math.abs(left[0] + right[0] - width) < 1e-6);
			assert.equal(left[1], right[1]);
			for (const face of THRONE_STRUCTURE)
				for (const point of face.points)
					assert.ok(projectThrone(point, view).every(Number.isFinite));
			assert.ok(buildThroneThreads().length > 100);
		}
});

test("plain throne remains distant, framed, and within phone width", () => {
	for (const [width, height] of [
		[1440, 1000],
		[768, 844],
		[390, 844],
	])
		for (const progress of [0, 0.5, 1]) {
			const bounds = projectedThroneBounds(throneView(width, height, progress));
			assert.ok(bounds.top > 0 && bounds.bottom < height * 0.75);
			if (progress === 0)
				assert.ok(
					bounds.height / height >= 0.1 && bounds.height / height <= 0.15,
				);
			if (progress === 1)
				assert.ok(
					bounds.height / height >= 0.23 && bounds.height / height <= 0.32,
				);
			if (width === 390) assert.ok(bounds.width <= width * 0.55);
		}
});
test("tendrils move between fixed sockets and fixed outer anchors", () => {
	const first = buildThroneThreads(0),
		later = buildThroneThreads(4000);
	for (let i = 0; i < 44; i++) {
		const head = first.find((mark) => mark.id === `thread-${i}-0`)!,
			tail = first.find((mark) => mark.id === `thread-${i}-35`)!;
		const otherHead = later.find((mark) => mark.id === head.id)!,
			otherTail = later.find((mark) => mark.id === tail.id)!;
		assert.deepEqual(head.points[0], otherHead.points[0]);
		assert.deepEqual(tail.points.at(-1), otherTail.points.at(-1));
		assert.notDeepEqual(head.points.at(-1), otherHead.points.at(-1));
	}
});

test("white throne has eight stronger tendrils without changing their spans", () => {
	assert.ok(THRONE_STRUCTURE.some((mark) => mark.material === "side"));
	assert.ok(THRONE_STRUCTURE.some((mark) => mark.material === "detail"));
	const threads = buildThroneThreads();
	const heads = threads.filter((mark) => /^thread-\d+-0$/.test(mark.id));
	assert.equal(heads.length, 44);
	const extra = heads.filter((mark) => Number(mark.id.split("-")[1]) >= 28);
	assert.equal(extra.length, 16);
	assert.ok(extra.every((mark) => mark.width! <= 0.65));
	assert.equal(heads.filter((mark) => mark.width! >= 1.2).length, 8);
	for (let i = 0; i < 44; i++) {
		const spans = threads.filter((mark) => mark.id.startsWith(`thread-${i}-`));
		assert.equal(new Set(spans.map((mark) => mark.width)).size, 1);
		assert.equal(new Set(spans.map((mark) => mark.opacity)).size, 1);
	}
});

test("pedestal is closed with no legs or ground roots", () => {
	assert.equal(
		THRONE_STRUCTURE.filter((mark) => mark.id.startsWith("base-") && mark.face)
			.length,
		6,
	);
	assert.equal(
		THRONE_STRUCTURE.some((mark) =>
			/^(root-|leg-|crown-|back-rib-|back-spine|inner-bevel)/.test(mark.id),
		),
		false,
	);
	const faces = THRONE_STRUCTURE.filter(
		(mark) => mark.id.startsWith("base-") && mark.face,
	);
	const edges = new Map<string, number>();
	for (const face of faces)
		for (let i = 0; i < face.points.length; i++) {
			const key = [
				JSON.stringify(face.points[i]),
				JSON.stringify(face.points[(i + 1) % face.points.length]),
			]
				.sort()
				.join("|");
			edges.set(key, (edges.get(key) || 0) + 1);
		}
	assert.ok([...edges.values()].every((count) => count === 2));
});
