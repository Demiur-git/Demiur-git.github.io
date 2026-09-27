import assert from "node:assert/strict";
import test from "node:test";
import {
	buildTagGraph,
	layoutTagGraph,
	dateParts,
	selectRecommendations,
	yearStatistics,
	type LibraryPost,
} from "../src/utils/library-data";

const post = (id: string, tags: string[] = [], draft = false): LibraryPost => ({
	id,
	data: { title: id, tags, draft, published: new Date("2025-12-31T16:00:00Z") },
});

test("分类是唯一主节点；小标签去重、排除同名，跨分类分别计数", () => {
	const categorized = (
		id: string,
		category: string | undefined,
		tags: string[],
		draft = false,
	): LibraryPost => ({
		...post(id, tags, draft),
		data: { ...post(id, tags, draft).data, category },
	});
	const posts = [
		categorized("a", " AI ", [" AI ", "代码", "代码"]),
		categorized("b", "AI", ["代码"]),
		categorized("c", "随笔", ["代码", "生活"]),
		categorized("d", undefined, []),
		categorized("e", "无标签", []),
		categorized("hidden", "草稿", ["隐藏"], true),
	];
	const data = buildTagGraph(posts);
	assert.equal(data.groups.length, 4);
	assert.equal(data.groups.find((g) => g.name === "AI")?.count, 2);
	assert.deepEqual(data.groups.find((g) => g.name === "AI")?.tags, [
		{ name: "代码", count: 2 },
	]);
	assert.equal(
		data.groups
			.find((g) => g.name === "随笔")
			?.tags.find((t) => t.name === "代码")?.count,
		1,
	);
	assert.equal(data.secondaryCount, 2);
	assert.equal(data.groups.find((g) => g.name === "未分类")?.count, 1);
	assert.deepEqual(buildTagGraph([]), { groups: [], secondaryCount: 0 });
	assert.deepEqual(data, buildTagGraph([...posts].reverse()));
	const collapsed = layoutTagGraph(data);
	assert.equal(collapsed.nodes.length, 4);
	assert.equal(collapsed.edges.length, 0);
	const expanded = layoutTagGraph(data, "随笔");
	assert.equal(expanded.nodes.filter((n) => !n.primary).length, 2);
	assert.ok(
		expanded.edges.every(
			(edge) =>
				expanded.nodes.find((n) => n.id === edge.source)?.category === "随笔",
		),
	);
	assert.ok(
		expanded.nodes
			.filter((n) => !n.primary)
			.every((n) => n.category === "随笔"),
	);
	assert.deepEqual(layoutTagGraph(data, "不存在"), collapsed);
});

test("多圈固定布局支持大量主次标签，文本足迹不重叠且不越界", () => {
	const data = buildTagGraph([
		{
			...post(
				"many",
				Array.from({ length: 45 }, (_, i) => `小标签 ${i} / 很长的标签名称`),
			),
			data: {
				...post("many").data,
				category: "测试分类",
				tags: Array.from(
					{ length: 45 },
					(_, i) => `小标签 ${i} / 很长的标签名称`,
				),
			},
		},
		...Array.from({ length: 18 }, (_, i) => ({
			...post(`category${i}`),
			data: { ...post(`category${i}`).data, category: `其他分类 ${i}` },
		})),
	]);
	for (const layout of [
		layoutTagGraph(data),
		layoutTagGraph(data, "测试分类"),
	]) {
		for (const node of layout.nodes) {
			assert.ok(
				node.x >= 90 &&
					node.x + 90 <= layout.width &&
					node.y >= node.radius &&
					node.y + node.radius + 48 < layout.height,
			);
			for (const other of layout.nodes)
				if (node !== other)
					assert.ok(
						Math.abs(node.x - other.x) >= 180 ||
							Math.abs(node.y - other.y) >= 110,
						`label overlap: ${node.name} / ${other.name}`,
					);
		}
		assert.deepEqual(
			layout,
			layoutTagGraph(data, layout.edges.length ? "测试分类" : undefined),
		);
	}
});

test("推荐按指定顺序，扩展名兼容，诊断重复、草稿、无效及超额", () => {
	const posts = [
		post("a"),
		post("b"),
		post("c"),
		post("d"),
		post("hidden", [], true),
	];
	const result = selectRecommendations(posts, [
		"b.md",
		"a",
		"b",
		"hidden",
		"missing",
		"c",
		"d",
	]);
	assert.deepEqual(
		result.selected.map((p) => p.id),
		["b", "a", "c"],
	);
	assert.equal(result.diagnostics.length, 4);
	assert.deepEqual(selectRecommendations(posts, []).selected, []);
});

test("按网站时区处理跨年、月份与闰年进度，而不是设备时区", () => {
	const dates = ["2025-12-31T16:00:00Z", "2025-12-31T15:59:59Z"];
	assert.deepEqual(dateParts(new Date(dates[0]), "Asia/Shanghai"), {
		year: 2026,
		month: 1,
		day: 1,
		hour: 0,
		minute: 0,
		second: 0,
	});
	const first = yearStatistics(
		dates,
		"Asia/Shanghai",
		new Date("2025-12-31T16:00:00Z"),
	);
	assert.equal(first.count, 1);
	assert.equal(first.progress, 0);
	const leap = yearStatistics(
		[],
		"Asia/Shanghai",
		new Date("2024-07-01T16:00:00Z"),
	);
	assert.equal(leap.progress, 50);
	assert.equal(
		yearStatistics(
			[],
			"Asia/Shanghai",
			new Date("2026-12-31T15:59:59Z"),
		).progress.toFixed(1),
		"100.0",
	);
});
