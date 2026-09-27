import assert from "node:assert/strict";
import test from "node:test";
import {
	hasSeenHomeEntrance,
	HOME_INTRO_SEEN_KEY,
	markHomeEntranceSeen,
} from "./home-entrance-session.ts";

test("checking a new tab does not mark the prologue as played", () => {
	const data = new Map<string, string>();
	const session = {
		sessionStorage: {
			getItem: (key: string) => data.get(key) ?? null,
			setItem: (key: string, value: string) => {
				data.set(key, value);
			},
		},
	};
	assert.equal(hasSeenHomeEntrance(session), false);
	assert.equal(data.size, 0);
	markHomeEntranceSeen(session);
	assert.equal(data.get(HOME_INTRO_SEEN_KEY), "1");
	assert.equal(hasSeenHomeEntrance(session), true);
	assert.equal(
		hasSeenHomeEntrance({ sessionStorage: session.sessionStorage }),
		true,
	);
	assert.equal(
		hasSeenHomeEntrance({
			sessionStorage: { getItem: () => null, setItem: () => {} },
		}),
		false,
	);
});

test("blocked storage falls back to memory across in-page visits", () => {
	const session = {
		get sessionStorage(): Storage {
			throw new Error("Storage blocked");
		},
	};
	assert.equal(hasSeenHomeEntrance(session), false);
	markHomeEntranceSeen(session);
	assert.equal(hasSeenHomeEntrance(session), true);
});

test("failed storage writes retain the memory flag", () => {
	const session = {
		sessionStorage: {
			getItem: () => null,
			setItem: () => {
				throw new Error("Quota exceeded");
			},
		},
	};
	markHomeEntranceSeen(session);
	assert.equal(hasSeenHomeEntrance(session), true);
});
