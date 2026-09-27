import assert from "node:assert/strict";
import { test } from "node:test";
import { pulsePuzzle } from "../src/config/pulsePuzzle";
import {
	collectClue,
	decodeCipher,
	emptyProgress,
	encodeLetter,
	getPuzzleProgress,
	isPuzzleReady,
	matchesPuzzleAnswer,
	parseProgress,
	savePuzzleProgress,
	tryUnlockPuzzle,
	tryUnlockWorld,
} from "../src/utils/pulse-puzzle";

test("all 26 letters round-trip and both example mappings hold", () => {
	for (let i = 0; i < 26; i++)
		assert.equal(decodeCipher(encodeLetter(i)), String.fromCharCode(65 + i));
	assert.equal(encodeLetter(0), 8);
	assert.equal(encodeLetter(1), 13);
});
test("scrambled discovery order restores the answer without altering clue data", () => {
	assert.deepEqual(
		pulsePuzzle.clues.map((clue) => clue.order),
		["01", "03", "05", "02", "04"],
	);
	assert.equal(matchesPuzzleAnswer("  pUlSe  "), true);
	assert.equal(matchesPuzzleAnswer("PULSES"), false);
	assert.equal(matchesPuzzleAnswer(""), false);
});
test("all numbers, both torn scraps and start are required; duplicates do not bypass the gate", () => {
	const progress = emptyProgress();
	progress.collected = pulsePuzzle.clues.map((clue) => clue.id);
	assert.equal(isPuzzleReady(progress), false);
	progress.started = true;
	assert.equal(isPuzzleReady(progress), false);
	progress.scraps = ["scrap-af", "scrap-fine"];
	assert.equal(isPuzzleReady(progress), true);
	progress.collected = ["home", "home", "home", "home", "home"];
	assert.equal(isPuzzleReady(progress), false);
});
test("invalid, old, partial and fabricated persisted progress is normalized", () => {
	for (const raw of [null, "{", "null", '{"version":0,"unlocked":true}'])
		assert.deepEqual(parseProgress(raw), emptyProgress());
	assert.equal(
		parseProgress(
			JSON.stringify({ ...emptyProgress(), started: true, unlocked: true }),
		).unlocked,
		false,
	);
	const ready = {
		...emptyProgress(),
		started: true,
		scraps: ["scrap-af", "scrap-fine"],
		unlocked: true,
		collected: [
			"posts",
			"home",
			"tags",
			"categories",
			"archive",
			"home",
			"unknown",
		],
	};
	const result = parseProgress(JSON.stringify(ready));
	assert.deepEqual(result.collected, [
		"posts",
		"home",
		"tags",
		"categories",
		"archive",
	]);
	assert.equal(result.unlocked, true);
	assert.equal(
		parseProgress(JSON.stringify({ ...ready, started: false })).unlocked,
		false,
	);
});
test("blocked storage falls back to memory across collection, unlock and reset", () => {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			localStorage: {
				getItem() {
					throw new Error("blocked");
				},
				setItem() {
					throw new Error("blocked");
				},
			},
			dispatchEvent() {
				return true;
			},
		},
	});
	try {
		assert.deepEqual(getPuzzleProgress(), emptyProgress());
		collectClue("posts");
		assert.equal(getPuzzleProgress().started, false);
		for (const id of ["home", "tags", "posts", "archive", "categories", "home"])
			collectClue(id);
		assert.equal(getPuzzleProgress().collected.length, 5);
		assert.equal(tryUnlockPuzzle("PULSE"), false);
		collectClue("scrap-af");
		collectClue("scrap-fine");
		assert.equal(tryUnlockPuzzle(" PULSE "), true);
		assert.equal(getPuzzleProgress().unlocked, true);
		assert.equal(tryUnlockWorld("WRONG"), false);
		assert.equal(tryUnlockWorld("NEWWORLD"), true);
		assert.equal(getPuzzleProgress().worldUnlocked, true);
		savePuzzleProgress(emptyProgress());
		assert.deepEqual(getPuzzleProgress(), emptyProgress());
	} finally {
		Reflect.deleteProperty(globalThis, "window");
	}
});
test("v1 migration retains numbers and completed first stage but not scraps or world unlock", () => {
	const old = {
		version: 1,
		started: true,
		collected: pulsePuzzle.clues.map((clue) => clue.id),
		rulesSeen: true,
		unlocked: true,
		worldUnlocked: true,
	};
	const progress = parseProgress(JSON.stringify(old));
	assert.equal(progress.version, 2);
	assert.equal(progress.unlocked, true);
	assert.equal(progress.worldUnlocked, false);
	assert.deepEqual(progress.scraps, []);
	assert.equal(
		parseProgress(JSON.stringify({ ...old, unlocked: false })).unlocked,
		false,
	);
});
