const normalizePostId = (id: string) =>
	id.trim().replace(/\.(md|mdx|markdown)$/i, "");

export interface LibraryPost {
	id: string;
	data: {
		title: string;
		published: Date;
		updated?: Date;
		draft?: boolean;
		category?: string | null;
		tags?: string[];
	};
}

export function dateParts(
	date: Date,
	timezone: string,
): {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
} {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: timezone || "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const part = (name: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((p) => p.type === name)?.value || 0);
	return {
		year: part("year"),
		month: part("month"),
		day: part("day"),
		hour: part("hour"),
		minute: part("minute"),
		second: part("second"),
	};
}

export function yearStatistics(
	dates: string[],
	timezone: string,
	now: Date = new Date(),
): { year: number; count: number; progress: number } {
	const p = dateParts(now, timezone);
	const start = Date.UTC(p.year, 0, 1);
	const end = Date.UTC(p.year + 1, 0, 1);
	const wallTime = Date.UTC(
		p.year,
		p.month - 1,
		p.day,
		p.hour,
		p.minute,
		p.second,
	);
	return {
		year: p.year,
		count: dates.filter(
			(date) => dateParts(new Date(date), timezone).year === p.year,
		).length,
		progress: Math.max(
			0,
			Math.min(100, ((wallTime - start) / (end - start)) * 100),
		),
	};
}

export function selectRecommendations<T extends LibraryPost>(
	posts: T[],
	ids: string[],
): { selected: T[]; diagnostics: string[] } {
	const selected: T[] = [];
	const diagnostics: string[] = [];
	const seen = new Set<string>();
	for (const value of ids) {
		const id = normalizePostId(value);
		if (seen.has(id)) {
			diagnostics.push(`重复文章标识：${value}`);
			continue;
		}
		seen.add(id);
		const post = posts.find(
			(entry) => normalizePostId(entry.id) === id && !entry.data.draft,
		);
		if (!post) {
			diagnostics.push(`文章不存在或为草稿：${value}`);
			continue;
		}
		if (selected.length >= 3) {
			diagnostics.push(`推荐阅读最多三篇，忽略：${value}`);
			continue;
		}
		selected.push(post);
	}
	return { selected, diagnostics };
}

export interface TagGraphData {
	groups: {
		name: string;
		count: number;
		tags: { name: string; count: number }[];
	}[];
	secondaryCount: number;
}

export function buildTagGraph(posts: LibraryPost[]): TagGraphData {
	const groups = new Map<
		string,
		{ count: number; tags: Map<string, number> }
	>();
	const secondary = new Set<string>();
	for (const post of posts.filter((p) => !p.data.draft)) {
		const name = post.data.category?.trim() || "未分类";
		const group = groups.get(name) || {
			count: 0,
			tags: new Map<string, number>(),
		};
		group.count++;
		for (const tag of new Set(
			(post.data.tags || [])
				.map((t) => t.trim())
				.filter((t) => t && t !== name),
		)) {
			group.tags.set(tag, (group.tags.get(tag) || 0) + 1);
			secondary.add(tag);
		}
		groups.set(name, group);
	}
	return {
		groups: [...groups]
			.sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
			.map(([name, group]) => ({
				name,
				count: group.count,
				tags: [...group.tags]
					.sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
					.map(([name, count]) => ({ name, count })),
			})),
		secondaryCount: secondary.size,
	};
}

export interface TagGraphLayout {
	nodes: {
		id: string;
		name: string;
		category: string;
		primary: boolean;
		count: number;
		x: number;
		y: number;
		radius: number;
	}[];
	edges: { source: string; target: string; count: number }[];
	width: number;
	height: number;
}

// Each ring reserves a 180 × 86 label footprint. Layout is deterministic and
// independent of the viewport: smaller screens can pan/zoom without relayout.
export function layoutTagGraph(
	data: TagGraphData,
	expanded?: string,
): TagGraphLayout {
	const active = data.groups.find((g) => g.name === expanded);
	const rings: { radius: number; count: number; start: number }[] = [];
	let remaining = active?.tags.length || 0,
		start = 0,
		radius = 240;
	while (remaining > 0) {
		const count = Math.min(
			remaining,
			Math.max(6, Math.floor((2 * Math.PI * radius) / 290)),
		);
		rings.push({ radius, count, start });
		start += count;
		remaining -= count;
		radius += 300;
	}
	const extent = rings.at(-1)?.radius || 120;
	const width = Math.max(820, 2 * extent + 240);
	const primaryRows = active
		? Math.ceil((data.groups.length - 1) / Math.max(1, Math.floor(width / 210)))
		: 0;
	const top = primaryRows * 150;
	const height = Math.max(460, extent + 220 + top);
	const cx = width / 2,
		cy = top + (height - top) / 2;
	const nodes: TagGraphLayout["nodes"] = [];
	const edges: TagGraphLayout["edges"] = [];
	const addPrimary = (
		group: TagGraphData["groups"][number],
		x: number,
		y: number,
	) =>
		nodes.push({
			id: JSON.stringify([group.name]),
			category: group.name,
			name: group.name,
			primary: true,
			count: group.count,
			x,
			y,
			radius: 32 + Math.min(16, Math.sqrt(group.count) * 3),
		});
	if (!active) {
		// Category-only overview uses concentric rings as well.
		if (data.groups.length === 1) addPrimary(data.groups[0], cx, cy);
		else {
			let index = 0,
				r = 165;
			while (index < data.groups.length) {
				const count = Math.min(
					data.groups.length - index,
					Math.max(4, Math.floor((2 * Math.PI * r) / 230)),
				);
				for (let j = 0; j < count; j++) {
					const a = -Math.PI / 2 + (2 * Math.PI * j) / count;
					addPrimary(data.groups[index + j], r * Math.cos(a), r * Math.sin(a));
				}
				index += count;
				r += 230;
			}
			const reach = r;
			for (const node of nodes) {
				node.x += reach;
				node.y += reach;
			}
			return {
				nodes,
				edges,
				width: Math.max(820, reach * 2),
				height: reach * 2,
			};
		}
	} else {
		const others = data.groups.filter((g) => g !== active);
		const columns = Math.max(1, Math.floor(width / 210));
		others.forEach((g, i) =>
			addPrimary(
				g,
				(((i % columns) + 0.5) * width) / columns,
				65 + Math.floor(i / columns) * 150,
			),
		);
		addPrimary(active, cx, cy);
		for (const ring of rings)
			for (let j = 0; j < ring.count; j++) {
				const tag = active.tags[ring.start + j];
				const a = -Math.PI / 2 + (2 * Math.PI * j) / ring.count;
				const id = JSON.stringify([active.name, tag.name]);
				nodes.push({
					id,
					name: tag.name,
					category: active.name,
					primary: false,
					count: tag.count,
					x: cx + ring.radius * Math.cos(a),
					y: cy + ring.radius * Math.sin(a) * 0.5,
					radius: 18 + Math.min(9, Math.sqrt(tag.count) * 2),
				});
				edges.push({
					source: JSON.stringify([active.name]),
					target: id,
					count: tag.count,
				});
			}
	}
	return { nodes, edges, width, height };
}
