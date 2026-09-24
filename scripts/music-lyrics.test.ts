import assert from "node:assert/strict";
import test from "node:test";
import { splitBilingualLrc } from "./music-lyrics.ts";

const bilingual = [
	"[ar:Example]",
	...Array.from(
		{ length: 6 },
		(_, index) =>
			`[00:${String(index + 1).padStart(2, "0")}.00]ここに原文${index}\n[00:${String(index + 1).padStart(2, "0")}.00]这里是译文${index}`,
	),
].join("\n");

test("splits paired lyrics and keeps timestamps aligned", () => {
	const result = splitBilingualLrc(bilingual);
	assert.equal(result.status, "split");
	if (result.status !== "split") return;
	assert.equal(result.pairs, 6);
	assert.match(result.original, /^\[ar:Example\]/);
	assert.equal((result.original.match(/\[00:/g) ?? []).length, 6);
	assert.equal((result.translation.match(/\[00:/g) ?? []).length, 6);
	assert.doesNotMatch(result.original, /这里是译文/);
	assert.doesNotMatch(result.translation, /ここに原文/);
	assert.equal(splitBilingualLrc(result.original).status, "unchanged");
});

test("also recognizes English originals with Chinese translations", () => {
	const source = Array.from(
		{ length: 6 },
		(_, index) =>
			`[00:${String(index + 1).padStart(2, "0")}.00]English line ${index}\n[00:${String(index + 1).padStart(2, "0")}.00]中文翻译${index}`,
	).join("\n");
	assert.equal(splitBilingualLrc(source).status, "split");
});

test("does not change plain or uncertain lyrics", () => {
	const plain = Array.from(
		{ length: 6 },
		(_, index) => `[00:${String(index + 1).padStart(2, "0")}.00]普通歌词${index}`,
	).join("\n");
	assert.equal(splitBilingualLrc(plain).status, "unchanged");
	const uncertain = bilingual.replaceAll("这里是译文", "English translation");
	assert.equal(splitBilingualLrc(uncertain).status, "ambiguous");
});

test("keeps multi-line intro credits without duplicate timestamps", () => {
	const result = splitBilingualLrc(
		`[00:00.000]制作\n[00:00.000]制作\n[00:00.000]演唱\n${bilingual}`,
	);
	assert.equal(result.status, "split");
	if (result.status !== "split") return;
	assert.equal((result.original.match(/\[00:00\.000\]/g) ?? []).length, 1);
	assert.match(result.original, /制作 \/ 演唱/);
});

test("rejects three simultaneous song lines outside the intro", () => {
	const result = splitBilingualLrc(
		`${bilingual}\n[00:07.00]ここに原文\n[00:07.00]这里是译文\n[00:07.00]第三行`,
	);
	assert.equal(result.status, "ambiguous");
});
