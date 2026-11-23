import assert from "node:assert/strict";
import { test } from "node:test";
import {
	DEBUG_STORAGE_KEY,
	DebugProgressStore,
} from "../src/utils/pulse-debug-store";
import { emptyProgress } from "../src/utils/pulse-puzzle";

function session() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
		removeItem: (key: string) => {
			values.delete(key);
		},
	};
}

test("sandbox survives reload and does not alias input or returned progress", () => {
	const storage = session();
	const store = new DebugProgressStore(() => storage);
	assert.equal(store.read(), null);
	const progress = { ...emptyProgress(), started: true, collected: ["home"] };
	store.write(progress);
	progress.collected.push("archive");
	store.read()!.collected.push("tags");
	assert.deepEqual(store.read()!.collected, ["home"]);
	assert.deepEqual(new DebugProgressStore(() => storage).read(), store.read());
	// A different tab has a different session; no global shared fallback.
	assert.equal(new DebugProgressStore(() => session()).read(), null);
});

test("reset can retain an empty active sandbox; exit removes only its own record", () => {
	const storage = session();
	storage.setItem("unrelated", "untouched");
	const store = new DebugProgressStore(() => storage);
	store.write(emptyProgress());
	assert.deepEqual(store.read(), emptyProgress());
	store.clear();
	assert.equal(store.read(), null);
	assert.equal(storage.getItem(DEBUG_STORAGE_KEY), null);
	assert.equal(storage.getItem("unrelated"), "untouched");
});

test("blocked or corrupt session storage falls back to document memory", () => {
	const store = new DebugProgressStore(() => {
		throw new Error("denied");
	});
	assert.equal(store.read(), null);
	store.write({ ...emptyProgress(), started: true });
	assert.equal(store.read()!.started, true);
	store.clear();
	assert.equal(store.read(), null);
	const storage = session();
	storage.setItem(DEBUG_STORAGE_KEY, "broken");
	assert.equal(new DebugProgressStore(() => storage).read(), null);
	storage.setItem(
		DEBUG_STORAGE_KEY,
		JSON.stringify({ version: 999, progress: emptyProgress() }),
	);
	assert.equal(new DebugProgressStore(() => storage).read(), null);
});
