import assert from "node:assert/strict";
import { test } from "node:test";
import { pulsePuzzle } from "../src/config/pulsePuzzle";
import { pulseSceneRoute } from "../src/utils/pulse-route";
import {
	collectEchoClue,
	collectClue,
	decodeCipher,
	emptyProgress,
	encodeLetter,
	getPuzzleProgress,
	isPuzzleReady,
	matchesPuzzleAnswer,
	parseProgress,
	resetEchoBranch,
	savePuzzleProgress,
	tryUnlockStarfield,
	tryUnlockPuzzle,
	tryUnlockWorld,
	unlockEcho,
} from "../src/utils/pulse-puzzle";

test("the pulse URL suffix decodes to HOLDING and stays in sync with the route", () => {
	const { word, base64url } = pulsePuzzle.holdHint;
	assert.equal(Buffer.from(word, "utf8").toString("base64url"), base64url);
	assert.equal(Buffer.from(base64url, "base64url").toString("utf8"), word);
	assert.equal(pulseSceneRoute(), `/pulse/${base64url}/`);
});

test("the throne dialogue pauses for its explicit question", () => {
	assert.equal(pulsePuzzle.worldDialogue.length, 17);
	assert.equal(pulsePuzzle.worldQuestion.afterLine, 3);
	assert.equal(pulsePuzzle.worldQuestion.label, "你是谁？");
	assert.equal(
		pulsePuzzle.worldDialogue[3].text,
		"等等，我明白了，你和那家伙来自同一个世界",
	);
	assert.equal(
		pulsePuzzle.worldDialogue[4].text,
		"用那家伙的话来说，应该是开启新“世界”的人、“世界”的支柱之类的吧",
	);
	assert.equal(pulsePuzzle.worldDialogue.at(-1)?.text, "再会了……");
	assert.ok(
		pulsePuzzle.worldDialogue.every(({ text }) => !text.includes("占位")),
	);
});

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
test("the persisted v2 record is copied into v5 without losing the throne unlock", () => {
	const values = new Map<string, string>();
	values.set(
		pulsePuzzle.oldestStorageKey,
		JSON.stringify({
			...emptyProgress(),
			version: 2,
			started: true,
			collected: pulsePuzzle.clues.map((clue) => clue.id),
			scraps: pulsePuzzle.scraps.map((scrap) => scrap.id),
			unlocked: true,
			worldUnlocked: true,
		}),
	);
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			localStorage: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => values.set(key, value),
			},
			dispatchEvent: () => true,
		},
	});
	try {
		assert.equal(getPuzzleProgress().worldUnlocked, true);
		assert.equal(getPuzzleProgress().starfieldUnlocked, false);
		assert.equal(parseProgress(values.get(pulsePuzzle.storageKey)!).version, 5);
		savePuzzleProgress(emptyProgress());
	} finally {
		Reflect.deleteProperty(globalThis, "window");
	}
});
test("stored v4 echo access migrates with its clue and remains usable", () => {
	const values = new Map<string, string>();
	values.set(
		pulsePuzzle.legacyStorageKey,
		JSON.stringify({
			...emptyProgress(),
			version: 4,
			started: true,
			collected: pulsePuzzle.clues.map((clue) => clue.id),
			unlocked: true,
			echoUnlocked: true,
		}),
	);
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			localStorage: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => values.set(key, value),
			},
			dispatchEvent: () => true,
		},
	});
	try {
		const progress = getPuzzleProgress();
		assert.equal(progress.echoClueSeen, true);
		assert.equal(progress.echoUnlocked, true);
		assert.equal(parseProgress(values.get(pulsePuzzle.storageKey)!).version, 5);
		savePuzzleProgress(emptyProgress());
	} finally {
		Reflect.deleteProperty(globalThis, "window");
	}
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
		collectEchoClue();
		assert.equal(getPuzzleProgress().started, false);
		assert.equal(getPuzzleProgress().echoClueSeen, true);
		resetEchoBranch();
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
		assert.equal(tryUnlockStarfield("WRONG"), false);
		assert.equal(tryUnlockStarfield("PALINGENESIS"), true);
		assert.equal(getPuzzleProgress().starfieldUnlocked, true);
		assert.equal(getPuzzleProgress().worldUnlocked, false);
		assert.equal(tryUnlockWorld("WRONG"), false);
		assert.equal(tryUnlockWorld("NEWWORLD"), true);
		assert.equal(getPuzzleProgress().worldUnlocked, true);
		assert.equal(unlockEcho(), false);
		collectEchoClue();
		assert.equal(unlockEcho(), true);
		assert.equal(getPuzzleProgress().echoUnlocked, true);
		const beforeReset = getPuzzleProgress();
		const afterReset = resetEchoBranch();
		assert.deepEqual(afterReset, {
			...beforeReset,
			echoClueSeen: false,
			echoUnlocked: false,
		});
		assert.equal(unlockEcho(), false);
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
	assert.equal(progress.version, 5);
	assert.equal(progress.unlocked, true);
	assert.equal(progress.worldUnlocked, false);
	assert.equal(progress.starfieldUnlocked, false);
	assert.equal(progress.echoUnlocked, false);
	assert.deepEqual(progress.scraps, []);
	assert.equal(
		parseProgress(JSON.stringify({ ...old, unlocked: false })).unlocked,
		false,
	);
});

test("v2 migration preserves the throne unlock without inventing a starfield unlock", () => {
	const old = {
		...emptyProgress(),
		version: 2,
		started: true,
		collected: pulsePuzzle.clues.map((clue) => clue.id),
		scraps: pulsePuzzle.scraps.map((scrap) => scrap.id),
		unlocked: true,
		worldUnlocked: true,
		starfieldUnlocked: true,
	};
	const progress = parseProgress(JSON.stringify(old));
	assert.equal(progress.version, 5);
	assert.equal(progress.unlocked, true);
	assert.equal(progress.worldUnlocked, true);
	assert.equal(progress.starfieldUnlocked, false);
	assert.equal(progress.echoUnlocked, false);
	assert.deepEqual(progress.collected, old.collected);
	assert.deepEqual(progress.scraps, old.scraps);
});
