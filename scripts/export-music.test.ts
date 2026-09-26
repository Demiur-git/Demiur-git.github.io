import assert from "node:assert/strict";
import {
	mkdtemp,
	mkdir,
	readFile,
	readdir,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { selectMusicLibrary } from "../src/utils/music-library.ts";
import { exportPublicMusic } from "./export-music.ts";

const base = "https://music.example.com/media/";
const manifest = "src/config/musicLibrary.generated.json";
const output = "src/config/musicLibrary.public.json";
const selectedArgs = ["--ids", "second,first", "--base-url", base];

async function fixture() {
	const root = await mkdtemp(path.join(tmpdir(), "demiur-music-export-"));
	await mkdir(path.join(root, "src/config"), { recursive: true });
	const files = [
		"audio.mp3",
		"cover.webp",
		"lyrics.lrc",
		"lyrics.translation.lrc",
		"lyrics.romaji.lrc",
	];
	for (const id of ["日语 空格", "second"]) {
		await mkdir(path.join(root, "public/assets/music/library", id), {
			recursive: true,
		});
		for (const file of files)
			await writeFile(
				path.join(root, "public/assets/music/library", id, file),
				"fixture",
			);
	}
	const prefix = "assets/music/library/日语 空格/";
	const tracks = [
		{
			id: "first",
			name: "第一首",
			artist: "作者",
			album: "专辑",
			duration: 60,
			url: `${prefix}audio.mp3`,
			cover: `${prefix}cover.webp`,
			lrc: `${prefix}lyrics.lrc`,
			translationLrc: `${prefix}lyrics.translation.lrc`,
			romajiLrc: `${prefix}lyrics.romaji.lrc`,
			privatePath: "C:/private",
			secret: "must-not-export",
		},
		{
			id: "second",
			name: "Second",
			artist: "Artist",
			url: "assets/music/library/second/audio.mp3",
		},
	];
	await writeFile(
		path.join(root, manifest),
		JSON.stringify({ version: 1, generatedAt: null, tracks }),
	);
	await writeFile(
		path.join(root, output),
		JSON.stringify({ version: 1, generatedAt: null, tracks: [] }),
	);
	return {
		root,
		tracks,
		cleanup: () => rm(root, { recursive: true, force: true }),
	};
}

test("exports only chosen tracks in source order with encoded URLs and all lyric variants", async () => {
	const f = await fixture();
	try {
		const original = await readFile(path.join(f.root, manifest), "utf8");
		const result = await exportPublicMusic(selectedArgs, f.root, () => {});
		assert.deepEqual(
			result?.tracks.map((track) => track.id),
			["first", "second"],
		);
		assert.equal(
			result?.tracks[0].url,
			`${base}library/${encodeURIComponent("日语 空格")}/audio.mp3`,
		);
		assert.match(
			result?.tracks[0].translationLrc ?? "",
			/lyrics.translation.lrc$/,
		);
		assert.match(result?.tracks[0].romajiLrc ?? "", /lyrics.romaji.lrc$/);
		assert.equal(result?.tracks[0].duration, 60);
		assert.equal(result?.tracks[1].cover, undefined);
		const published = await readFile(path.join(f.root, output), "utf8");
		assert.doesNotMatch(published, /privatePath|must-not-export|C:\/private/);
		assert.equal(await readFile(path.join(f.root, manifest), "utf8"), original);
		assert.equal(
			await readFile(
				path.join(f.root, "public/assets/music/library/second/audio.mp3"),
				"utf8",
			),
			"fixture",
		);
		assert.deepEqual((await readdir(path.join(f.root, "src/config"))).sort(), [
			"musicLibrary.generated.json",
			"musicLibrary.public.json",
		]);
	} finally {
		await f.cleanup();
	}
});

test("list and dry run do not write; one-track export never includes unselected songs", async () => {
	const f = await fixture();
	try {
		const before = await readFile(path.join(f.root, output), "utf8");
		const logs: string[] = [];
		await exportPublicMusic(["--", "--list"], f.root, (line) =>
			logs.push(line),
		);
		assert.match(logs.join("\n"), /first.*第一首/);
		const result = await exportPublicMusic(
			["--ids", "second", "--base-url", base, "--dry-run"],
			f.root,
			() => {},
		);
		assert.equal(result?.tracks.length, 1);
		assert.equal(result?.tracks[0].id, "second");
		assert.equal(await readFile(path.join(f.root, output), "utf8"), before);
	} finally {
		await f.cleanup();
	}
});

test("nonempty manifest requires force, which replaces rather than merges", async () => {
	const f = await fixture();
	try {
		await exportPublicMusic(selectedArgs, f.root, () => {});
		const before = await readFile(path.join(f.root, output), "utf8");
		await assert.rejects(
			exportPublicMusic(selectedArgs, f.root, () => {}),
			/--force/,
		);
		assert.equal(await readFile(path.join(f.root, output), "utf8"), before);
		await exportPublicMusic(
			["--ids", "second", "--base-url", base, "--force"],
			f.root,
			() => {},
		);
		assert.equal(
			JSON.parse(await readFile(path.join(f.root, output), "utf8")).tracks
				.length,
			1,
		);
	} finally {
		await f.cleanup();
	}
});

test("rejects bad CLI arguments and addresses without changing output", async () => {
	const f = await fixture();
	try {
		const before = await readFile(path.join(f.root, output), "utf8");
		for (const args of [
			[],
			["--ids"],
			["--all"],
			["--list", "--force"],
			["--ids", "missing", "--base-url", base],
			["--ids", "first,first", "--base-url", base],
			["--ids", "first,", "--base-url", base],
		]) {
			await assert.rejects(exportPublicMusic(args, f.root, () => {}));
		}
		for (const url of [
			"http://music.example.com",
			"https://user:password@example.com",
			"https://example.com?key=secret",
			"https://example.com#x",
			"not-a-url",
		]) {
			await assert.rejects(
				exportPublicMusic(
					["--ids", "first", "--base-url", url],
					f.root,
					() => {},
				),
			);
		}
		assert.equal(await readFile(path.join(f.root, output), "utf8"), before);
	} finally {
		await f.cleanup();
	}
});

test("rejects duplicate source IDs, traversal, directories and missing referenced files", async () => {
	const f = await fixture();
	try {
		const before = await readFile(path.join(f.root, output), "utf8");
		await writeFile(
			path.join(f.root, manifest),
			JSON.stringify({ version: 1, tracks: [f.tracks[0], f.tracks[0]] }),
		);
		await assert.rejects(
			exportPublicMusic(selectedArgs, f.root, () => {}),
			/ID 重复/,
		);
		for (const url of [
			"assets/music/library/../audio.mp3",
			"assets/music/library/%2e%2e/audio.mp3",
			"C:\\private\\audio.mp3",
			"https://example.com/audio.mp3",
			"assets/music/library/second",
			"assets/music/library/second/missing.mp3",
		]) {
			await writeFile(
				path.join(f.root, manifest),
				JSON.stringify({ version: 1, tracks: [{ ...f.tracks[1], url }] }),
			);
			await assert.rejects(
				exportPublicMusic(
					["--ids", "second", "--base-url", base],
					f.root,
					() => {},
				),
			);
		}
		await writeFile(
			path.join(f.root, manifest),
			JSON.stringify({
				version: 1,
				tracks: [
					{ ...f.tracks[1], cover: "assets/music/library/second/missing.webp" },
				],
			}),
		);
		await assert.rejects(
			exportPublicMusic(
				["--ids", "second", "--base-url", base],
				f.root,
				() => {},
			),
			/文件缺失/,
		);
		assert.equal(await readFile(path.join(f.root, output), "utf8"), before);
	} finally {
		await f.cleanup();
	}
});

test("library selection preserves HTTPS addresses and lyric variants without fallback", () => {
	const local = { tracks: [{ url: "assets/music/library/local/audio.mp3" }] };
	const published = {
		tracks: [
			{
				url: "https://music.example.com/library/public/audio.mp3",
				translationLrc:
					"https://music.example.com/library/public/translation.lrc",
			},
		],
	};
	assert.equal(selectMusicLibrary(undefined, local, published), local);
	assert.equal(selectMusicLibrary("local", local, published), local);
	assert.equal(selectMusicLibrary("public", local, published), published);
	assert.deepEqual(selectMusicLibrary("public", local, { tracks: [] }), {
		tracks: [],
	});
	assert.throws(
		() => selectMusicLibrary("invalid", local, published),
		/PUBLIC_MUSIC_LIBRARY/,
	);
});
