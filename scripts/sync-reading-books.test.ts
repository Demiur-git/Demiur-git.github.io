import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { syncReadingBooks } from "./sync-reading-books";

test("syncs a book cover and score, then keeps the cache when the service fails", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "demiur-reading-test-"));
	try {
		const book = {
			title: "测试书目",
			status: "finished" as const,
			bangumiSubjectId: 42,
			personalRating: 8.5,
		};
		const fetcher: typeof fetch = async (input) => {
			const url = String(input);
			if (url.endsWith("/42"))
				return new Response(
					JSON.stringify({
						type: 1,
						summary: "原始简介",
						rating: { score: 7.8 },
					}),
					{ status: 200 },
				);
			const image = new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
				status: 200,
				headers: { "content-type": "image/jpeg" },
			});
			Object.defineProperty(image, "url", {
				value: "https://lain.bgm.tv/pic/cover/example.jpg",
			});
			return image;
		};
		const first = await syncReadingBooks(root, [book], fetcher);
		assert.deepEqual(first.items, [
			{
				subjectId: 42,
				summary: "原始简介",
				score: 7.8,
				cover: "/assets/reading/covers/42.jpg",
			},
		]);
		assert.deepEqual(
			[
				...(await readFile(
					path.join(root, "public/assets/reading/covers/42.jpg"),
				)),
			],
			[0xff, 0xd8, 0xff],
		);
		const offline = await syncReadingBooks(root, [book], async () => {
			throw new Error("offline");
		});
		assert.deepEqual(offline, first);
		const noCover = await syncReadingBooks(
			root,
			[{ title: "无封面", status: "planned", bangumiSubjectId: 43 }],
			async (input) => {
				if (String(input).endsWith("/43"))
					return new Response(
						JSON.stringify({ type: 1, summary: "", rating: { score: 0 } }),
						{ status: 200 },
					);
				return new Response("", { status: 404 });
			},
		);
		assert.deepEqual(noCover.items, [{ subjectId: 43, summary: "" }]);
		assert.equal(
			(
				await syncReadingBooks(root, [], async () => {
					throw new Error("must not fetch");
				})
			).items.length,
			0,
		);
		await assert.rejects(
			syncReadingBooks(root, [
				{ title: "无效", status: "reading", personalRating: 11 },
			]),
			/personalRating/,
		);
		await assert.rejects(
			syncReadingBooks(root, [
				{ title: "无效", status: "reading", bangumiSubjectId: -1 },
			]),
			/Invalid Bangumi/,
		);
	} finally {
		const safeRoot = path.resolve(os.tmpdir());
		if (
			path.resolve(root).startsWith(`${safeRoot}${path.sep}`) &&
			path.basename(root).startsWith("demiur-reading-test-")
		)
			await rm(root, { recursive: true, force: true });
	}
});
