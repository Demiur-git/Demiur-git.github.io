import assert from "node:assert/strict";
import { test } from "node:test";
import {
	advanceEchoHold,
	clampEchoOffset,
	draggedEchoResidue,
	echoAligned,
	echoCloseness,
	echoResidueAvailable,
	echoResiduePath,
	ECHO_DRAG_THRESHOLD_PX,
	ECHO_HOLD_MS,
	ECHO_PATH,
	ECHO_RESIDUE_REVEAL_MS,
	ECHO_START,
	pickEchoResidue,
} from "../src/utils/pulse-echo";
import { emptyProgress, parseProgress } from "../src/utils/pulse-puzzle";

test("the second signal starts displaced and requires a sustained overlap", () => {
	assert.equal(echoAligned(ECHO_START.x, ECHO_START.y), false);
	assert.equal(echoAligned(0, 0), true);
	assert.equal(echoAligned(13, 0), false);
	assert.equal(echoAligned(0, -13), false);
	assert.equal(ECHO_HOLD_MS, 1200);
	assert.ok(echoCloseness(0, 0) > echoCloseness(ECHO_START.x, ECHO_START.y));
	assert.ok(ECHO_PATH.includes("H1200"));
	assert.equal(advanceEchoHold(0, 1199, true), 1199);
	assert.equal(advanceEchoHold(1199, 1, true), ECHO_HOLD_MS);
	assert.equal(advanceEchoHold(100, 60, false), 0);
});

test("signal offsets remain finite and on the page", () => {
	assert.deepEqual(clampEchoOffset(999, -999), { x: 180, y: -90 });
	assert.deepEqual(clampEchoOffset(-999, 999), { x: -180, y: 90 });
});

test("the residue needs three scans and a real drag, not a tap", () => {
	assert.equal(ECHO_RESIDUE_REVEAL_MS, 13000);
	assert.equal(echoResidueAvailable(false, 30000, false, false), false);
	assert.equal(echoResidueAvailable(true, 12999, false, false), false);
	assert.equal(echoResidueAvailable(true, 13000, false, false), true);
	assert.equal(echoResidueAvailable(true, 0, true, false), true);
	assert.equal(echoResidueAvailable(true, 0, false, true), true);
	// A clue collected in another tab starts a fresh wait in this scene.
	assert.equal(echoResidueAvailable(true, 20000 - 18000, false, false), false);
	assert.equal(ECHO_DRAG_THRESHOLD_PX, 20);
	assert.equal(draggedEchoResidue(100, 100, 119, 100), false);
	assert.equal(draggedEchoResidue(100, 100, 120, 100), true);
	assert.equal(draggedEchoResidue(100, 100, 112, 116), true);
});

test("the copied trace remains a short visible mark at desktop and phone widths", () => {
	const residue = pickEchoResidue([
		{ x1: 710, x2: 714, y1: 200, y2: 201, born: 10000 },
		{ x1: 900, x2: 904, y1: 200, y2: 201, born: 10000 },
	]);
	assert.equal(residue.x, 712);
	assert.equal(residue.y, 202.5);
	for (const width of [390, 768, 1440]) {
		const path = echoResiduePath(residue, width);
		const match = /^M([\d.]+) [\d.]+ L([\d.]+) [\d.]+$/.exec(path);
		assert.ok(match);
		const renderedWidth =
			((Number(match[2]) - Number(match[1])) / 1200) * width;
		assert.ok(renderedWidth >= 25 && renderedWidth <= 27);
	}
});

test("v3 unlocks migrate without granting the new branch", () => {
	const previous = {
		...emptyProgress(),
		version: 3,
		started: true,
		collected: ["home", "archive", "categories", "tags", "posts"],
		scraps: ["scrap-af", "scrap-fine"],
		unlocked: true,
		worldUnlocked: true,
		starfieldUnlocked: true,
		echoUnlocked: true,
	};
	const migrated = parseProgress(JSON.stringify(previous));
	assert.equal(migrated.version, 5);
	assert.equal(migrated.worldUnlocked, true);
	assert.equal(migrated.starfieldUnlocked, true);
	assert.equal(migrated.echoUnlocked, false);
	assert.equal(migrated.echoClueSeen, false);
});

test("v4 echo unlock carries the project clue into v5", () => {
	const legacy = {
		...emptyProgress(),
		version: 4,
		started: true,
		collected: ["home", "archive", "categories", "tags", "posts"],
		unlocked: true,
		echoUnlocked: true,
	};
	const migrated = parseProgress(JSON.stringify(legacy));
	assert.equal(migrated.echoClueSeen, true);
	assert.equal(migrated.echoUnlocked, true);
	assert.equal(
		parseProgress(JSON.stringify({ ...legacy, unlocked: false })).echoClueSeen,
		false,
	);
});

test("project clue can persist before the first puzzle starts", () => {
	const progress = parseProgress(
		JSON.stringify({ ...emptyProgress(), echoClueSeen: true }),
	);
	assert.equal(progress.started, false);
	assert.equal(progress.echoClueSeen, true);
	assert.equal(progress.echoUnlocked, false);
});
