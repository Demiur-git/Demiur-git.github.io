/** Metres, +Y up. Shared by ink, collision and object anchors. */
export const LIBRARY = {
	halfWidth: 10,
	halfDepth: 14,
	height: 8,
	eye: 1.65,
	radius: 0.28,
	speed: 2.6,
	runSpeed: 4.55,
} as const;
export interface FloorBox {
	x: number;
	z: number;
	width: number;
	depth: number;
	yaw?: number;
	base?: number;
	height?: number;
}
export interface Visitor {
	x: number;
	z: number;
	yaw: number;
	pitch: number;
	elevation?: number;
}
export const ENTRY: Visitor = {
	x: 0,
	z: -11.8,
	yaw: 0,
	pitch: 0,
	elevation: 0,
};
export const WALLPAPER_VIEW: Visitor = {
	x: -4.25,
	z: 8.5,
	yaw: Math.PI - 0.18,
	pitch: -0.08,
	elevation: 0,
};
export const UPPER = 4.4;
export const ANNEX = {
	halfWidth: 9.7,
	start: 13.75,
	end: 33.5,
	height: 4.4,
} as const;
export const STAIRS = {
	width: 1.8,
	centres: [1, -1],
	start: 35.1,
	end: 39.8,
	landingEnd: 41.3,
	rise: 2.2,
	steps: 13,
} as const;
export const TABLES: FloorBox[] = [-3, 5].map((z) => ({
	x: -4.3,
	z,
	width: 4.8,
	depth: 2.3,
	height: 1.1,
}));
export const AISLE_SHELVES: FloorBox[] = [2.6, 6.5].map((x) => ({
	x,
	z: 3,
	width: 0.8,
	depth: 12,
	height: 6.85,
}));
export const WALL_SHELVES: FloorBox[] = [
	{ x: 9.3, z: 0, width: 0.8, depth: 26, height: 6.85 },
	{ x: -5.6, z: 13.28, width: 7.8, depth: 0.8, height: 3.85 },
	{ x: 5.6, z: 13.28, width: 7.8, depth: 0.8, height: 3.85 },
];
export interface LibraryRoom extends FloorBox {
	id: "archive" | "music" | "exhibition" | "tools" | "staff";
	name: string;
	doorX: number;
}
export const ROOMS: LibraryRoom[] = [
	{
		id: "archive",
		name: "档案室",
		x: 5.55,
		z: 20,
		width: 7.8,
		depth: 8,
		doorX: 1.5,
	},
	{
		id: "music",
		name: "音乐室",
		x: -5.55,
		z: 20,
		width: 7.8,
		depth: 8,
		doorX: -1.5,
	},
	{
		id: "exhibition",
		name: "展览室",
		x: 5.55,
		z: 29.5,
		width: 7.8,
		depth: 8,
		doorX: 1.5,
	},
	{
		id: "tools",
		name: "工具室",
		x: -5.55,
		z: 29.5,
		width: 7.8,
		depth: 8,
		doorX: -1.5,
	},
	{
		id: "staff",
		name: "员工休息室",
		x: -5.55,
		z: 29.5,
		width: 7.8,
		depth: 8,
		doorX: -1.5,
		base: UPPER,
	},
];
/** Corridor 2.8m, open doors 1.5m; rear opening leads to the stairs. */
export const ANNEX_WALLS: FloorBox[] = [
	...[-5.7, 5.7].flatMap((x) =>
		[14, 33.5].map((z) => ({
			x,
			z,
			width: 8.6,
			depth: 0.24,
			height: ANNEX.height,
		})),
	),
	...[-9.7, 9.7].map((x) => ({
		x,
		z: 23.75,
		width: 0.24,
		depth: 19.5,
		height: ANNEX.height,
	})),
	...[-1.5, 1.5].flatMap((x) =>
		[
			[14, 19.25],
			[20.75, 28.75],
			[30.25, 33.5],
		].map(([a, b]) => ({
			x,
			z: (a + b) / 2,
			width: 0.2,
			depth: b - a,
			height: ANNEX.height,
		})),
	),
	...[-5.6, 5.6].flatMap((x) =>
		[16, 24, 25.5].map((z) => ({
			x,
			z,
			width: 8.2,
			depth: 0.2,
			height: ANNEX.height,
		})),
	),
];
export const UPPER_WALLS: FloorBox[] = [
	{ x: 1.5, z: 23.75, width: 0.2, depth: 19.5, base: UPPER, height: 3.4 },
	...[
		[14, 28.75],
		[30.25, 33.5],
	].map(([a, b]) => ({
		x: -1.5,
		z: (a + b) / 2,
		width: 0.2,
		depth: b - a,
		base: UPPER,
		height: 3.4,
	})),
	{ x: -9.7, z: 29.5, width: 0.24, depth: 8, base: UPPER, height: 3.4 },
	...[25.5, 33.5].map((z) => ({
		x: -5.6,
		z,
		width: 8.2,
		depth: 0.24,
		base: UPPER,
		height: 3.4,
	})),
];
export const GUARDS: FloorBox[] = [
	{ x: 0, z: 10.8, width: 17.6, depth: 0.12, base: UPPER, height: 1.1 },
	...[-8.75, 8.75].map((x) => ({
		x,
		z: 12.4,
		width: 0.12,
		depth: 3.2,
		base: UPPER,
		height: 1.1,
	})),
	...[-5.1, 5.1].map((x) => ({
		x,
		z: 14,
		width: 7.4,
		depth: 0.12,
		base: UPPER,
		height: 1.1,
	})),
	...[-2.3, 2.3].map((x) => ({
		x,
		z: 37.4,
		width: 0.14,
		depth: 8,
		height: 7.8,
	})),
	{ x: 0, z: 41.45, width: 4.7, depth: 0.14, height: 7.8 },
];
export type FixtureKind =
	| "cabinet"
	| "desk"
	| "catalogue"
	| "records"
	| "phonograph"
	| "bench"
	| "display"
	| "workbench"
	| "chair"
	| "sofa"
	| "coffee"
	| "folder"
	| "notice";
export interface RoomFixture extends FloorBox {
	id: string;
	kind: FixtureKind;
	height: number;
}
export const ROOM_FIXTURES: RoomFixture[] = [
	{
		id: "archive-cabinet",
		kind: "cabinet",
		x: 8.85,
		z: 20,
		width: 0.7,
		depth: 6.2,
		height: 3.2,
	},
	{
		id: "archive-desk",
		kind: "desk",
		x: 5.7,
		z: 17.2,
		width: 2.1,
		depth: 1.05,
		height: 1,
		yaw: 0.025,
	},
	{
		id: "archive-chair",
		kind: "chair",
		x: 5.55,
		z: 18.2,
		width: 0.62,
		depth: 0.7,
		height: 1.2,
		yaw: 0.12,
	},
	{
		id: "catalogue",
		kind: "catalogue",
		x: 6,
		z: 22.05,
		width: 3.5,
		depth: 1.05,
		height: 1.04,
		yaw: -0.035,
	},
	{
		id: "records",
		kind: "records",
		x: -8.85,
		z: 20,
		width: 0.7,
		depth: 6.2,
		height: 2.8,
	},
	{
		id: "phonograph",
		kind: "phonograph",
		x: -7.1,
		z: 18.1,
		width: 1.45,
		depth: 0.9,
		height: 1,
		yaw: 0.08,
	},
	{
		id: "music-bench",
		kind: "bench",
		x: -4.8,
		z: 21.5,
		width: 2.7,
		depth: 0.85,
		height: 1.1,
		yaw: 0.14,
	},
	{
		id: "music-chair",
		kind: "chair",
		x: -6.7,
		z: 21.1,
		width: 0.68,
		depth: 0.7,
		height: 1.2,
		yaw: 0.2,
	},
	{
		id: "music-table",
		kind: "coffee",
		x: -5.65,
		z: 20.2,
		width: 1.05,
		depth: 0.7,
		height: 0.58,
		yaw: -0.07,
	},
	{
		id: "gallery-display",
		kind: "display",
		x: 6.15,
		z: 28.8,
		width: 2.2,
		depth: 1.2,
		height: 1.15,
		yaw: 0.12,
	},
	{
		id: "project-desk",
		kind: "workbench",
		x: 5.2,
		z: 32.45,
		width: 2.7,
		depth: 0.95,
		height: 1,
		yaw: 0.045,
	},
	{
		id: "project-chair",
		kind: "chair",
		x: 5.45,
		z: 31.1,
		width: 0.65,
		depth: 0.7,
		height: 1.2,
		yaw: Math.PI,
	},
	{
		id: "tool-index",
		kind: "cabinet",
		x: -8.85,
		z: 29.5,
		width: 0.7,
		depth: 6.2,
		height: 2.9,
	},
	{
		id: "tool-desk",
		kind: "workbench",
		x: -5.55,
		z: 32.3,
		width: 3.4,
		depth: 1.05,
		height: 1,
		yaw: -0.04,
	},
	{
		id: "tool-chair",
		kind: "chair",
		x: -5.6,
		z: 31.1,
		width: 0.65,
		depth: 0.7,
		height: 1.2,
		yaw: Math.PI - 0.1,
	},
	{
		id: "staff-cabinet",
		kind: "cabinet",
		x: -8.9,
		z: 31.6,
		width: 0.65,
		depth: 2.3,
		height: 2.3,
		base: UPPER,
	},
	{
		id: "staff-sofa",
		kind: "sofa",
		x: -6.85,
		z: 27.1,
		width: 2.8,
		depth: 1,
		height: 1.1,
		base: UPPER,
		yaw: Math.PI,
	},
	{
		id: "staff-coffee",
		kind: "coffee",
		x: -6.7,
		z: 28.95,
		width: 1.6,
		depth: 0.85,
		height: 0.55,
		base: UPPER,
		yaw: 0.07,
	},
	{
		id: "staff-desk",
		kind: "folder",
		x: -5.05,
		z: 32.35,
		width: 2.65,
		depth: 1,
		height: 1,
		base: UPPER,
		yaw: -0.02,
	},
	{
		id: "staff-chair",
		kind: "chair",
		x: -5.4,
		z: 31.2,
		width: 0.65,
		depth: 0.7,
		height: 1.2,
		base: UPPER,
		yaw: Math.PI + 0.1,
	},
	{
		id: "notice",
		kind: "notice",
		x: 4.1,
		z: 13.62,
		width: 1.65,
		depth: 0.14,
		height: 2.25,
		base: UPPER,
	},
];
export function fixturePoint(
	f: FloorBox,
	x: number,
	y: number,
	z: number,
): { x: number; y: number; z: number } {
	const a = f.yaw || 0;
	return {
		x: f.x + x * Math.cos(a) + z * Math.sin(a),
		y: (f.base || 0) + y,
		z: f.z - x * Math.sin(a) + z * Math.cos(a),
	};
}
export interface LibraryTarget {
	id: string;
	name: string;
	object: string;
	description: string;
	path: string;
	pageKey?: "dynamic" | "gallery" | "projects" | "booknav";
	x: number;
	y: number;
	z: number;
	base: number;
}
const target = (
	id: string,
	fixture: string,
	point: [number, number, number],
	name: string,
	path: string,
	description: string,
	pageKey?: LibraryTarget["pageKey"],
): LibraryTarget => {
	const f = ROOM_FIXTURES.find((f) => f.id === fixture)!;
	return {
		id,
		name,
		object:
			(
				{
					catalogue: "目录桌",
					phonograph: "唱机",
					display: "展柜",
					workbench: "工作台",
					folder: "资料桌",
					notice: "公告栏",
				} as Partial<Record<FixtureKind, string>>
			)[f.kind] || "馆藏物件",
		path,
		description,
		pageKey,
		base: f.base || 0,
		...fixturePoint(f, ...point),
	};
};
export const LIBRARY_TARGETS: LibraryTarget[] = [
	target(
		"library",
		"catalogue",
		[-1.14, 1.1, -0.3],
		"查看书库",
		"/library/",
		"浏览馆藏文章、归档、分类与标签。",
	),
	target(
		"memos",
		"catalogue",
		[0, 1.1, -0.3],
		"查看便签",
		"/dynamic/",
		"阅读站长的简短记录与想法。",
		"dynamic",
	),
	target(
		"calendar",
		"catalogue",
		[1.14, 1.1, -0.3],
		"查看日历",
		"/calendar/",
		"沿着日历查看网站记录。",
	),
	target(
		"music",
		"phonograph",
		[0, 1.25, -0.47],
		"查看音乐",
		"/music/",
		"离开参观，打开现有曲库与播放器。",
	),
	target(
		"gallery",
		"gallery-display",
		[0, 1.3, -0.63],
		"查看相册",
		"/gallery/",
		"翻阅相册与照片。",
		"gallery",
	),
	target(
		"projects",
		"project-desk",
		[0, 1.25, -0.5],
		"查看项目",
		"/projects/",
		"查看项目介绍与相关链接。",
		"projects",
	),
	target(
		"tools",
		"tool-desk",
		[0, 1.15, -0.55],
		"查看工具导航",
		"/booknav/",
		"查找收录的工具与官方网站。",
		"booknav",
	),
	target(
		"about-me",
		"staff-desk",
		[-0.75, 1.08, -0.35],
		"认识站长",
		"/about/me/",
		"打开站长的个人档案与社交链接。",
	),
	target(
		"about-ling",
		"staff-desk",
		[0.75, 1.08, -0.35],
		"认识绫",
		"/about/ling/",
		"打开馆员绫的介绍与资料。",
	),
	target(
		"about-site",
		"notice",
		[0, 1.55, -0.09],
		"关于网站",
		"/about/site/",
		"阅读 Palib 的介绍通知。",
	),
];
export const CHAIRS: FloorBox[] = TABLES.flatMap((t, j) =>
	[-1.35, 0, 1.35].flatMap((dx, i) =>
		[-1, 1].map((side) => ({
			x: t.x + dx + ((i + j) % 2 ? 0.09 : -0.06),
			z: t.z + side * (1.8 + (i === 1 ? 0.12 : 0)),
			width: 0.62,
			depth: 0.7,
			height: 1.2,
			yaw: (i - 1) * 0.06 + side * 0.025,
		})),
	),
);
export const PLANTS: FloorBox[] = [
	{ x: -8.7, z: -10.2, width: 0.9, depth: 0.9, height: 1.85 },
	{ x: -8.6, z: 11.1, width: 0.9, depth: 0.9, height: 1.85 },
	{ x: 8.45, z: -10.7, width: 0.9, depth: 0.9, height: 1.85 },
];
interface Surface extends FloorBox {
	base: number;
	rise?: number;
}
/** Continuous step envelope: no gravity or teleport. */
export const SURFACES: Surface[] = [
	{ x: 0, z: 0, width: 18.94, depth: 26.94, base: 0 },
	{ x: 0, z: 23.45, width: 18.6, depth: 20.1, base: 0 },
	{ x: 0, z: 34.3, width: 4.5, depth: 1.6, base: 0 },
	{ x: 1, z: 37.45, width: STAIRS.width, depth: 4.7, base: 0, rise: 2.2 },
	{ x: 0, z: 40.55, width: 4.5, depth: 1.5, base: 2.2 },
	{ x: -1, z: 37.45, width: STAIRS.width, depth: 4.7, base: 4.4, rise: -2.2 },
	{ x: 0, z: 34.3, width: 4.5, depth: 1.6, base: UPPER },
	{ x: 0, z: 24, width: 2.8, depth: 20, base: UPPER },
	{ x: 0, z: 12.4, width: 17.5, depth: 3.2, base: UPPER },
	{ x: -5.55, z: 29.5, width: 7.8, depth: 8, base: UPPER },
	{ x: -1.5, z: 29.5, width: 1, depth: 1.5, base: UPPER },
];
export const FLOOR_SLABS: FloorBox[] = SURFACES.filter(
	(s) => !s.rise && s.base > 0,
).map((s) => ({ ...s, base: s.base - 0.16, height: 0.16 }));
/** Thin segmented guards follow both slopes, rather than blocking an entire stairwell. */
export const STAIR_RAILS: FloorBox[] = [0, 1].flatMap((flight) =>
	[-1, 1].flatMap((side) =>
		Array.from({ length: STAIRS.steps }, (_, i) => {
			const dz = (STAIRS.end - STAIRS.start) / STAIRS.steps;
			return {
				x: STAIRS.centres[flight] + (side * STAIRS.width) / 2,
				z:
					flight === 0
						? STAIRS.start + (i + 0.5) * dz
						: STAIRS.end - (i + 0.5) * dz,
				width: 0.055,
				depth: dz,
				base: flight * STAIRS.rise + (i * STAIRS.rise) / STAIRS.steps,
				height: 1.3,
			};
		}),
	),
);
export const COLLIDERS: FloorBox[] = [
	...STAIR_RAILS,
	...TABLES,
	...AISLE_SHELVES,
	...WALL_SHELVES,
	...CHAIRS,
	...PLANTS,
	...ANNEX_WALLS,
	...UPPER_WALLS,
	...GUARDS,
	...ROOM_FIXTURES,
	{ x: -8.2, z: 0, width: 1, depth: 1.8, height: 1.5 },
	{ x: -8.2, z: 8.7, width: 1, depth: 1.8, height: 1.5 },
];
const localXZ = (p: { x: number; z: number }, b: FloorBox) => {
	const a = b.yaw || 0,
		dx = p.x - b.x,
		dz = p.z - b.z;
	return {
		x: dx * Math.cos(a) - dz * Math.sin(a),
		z: dx * Math.sin(a) + dz * Math.cos(a),
	};
};
export function supportHeight(
	x: number,
	z: number,
	elevation = 0,
): number | undefined {
	if (![x, z, elevation].every(Number.isFinite)) return undefined;
	let best: number | undefined;
	for (const s of SURFACES) {
		if (
			Math.abs(x - s.x) > s.width / 2 + 1e-6 ||
			Math.abs(z - s.z) > s.depth / 2 + 1e-6
		)
			continue;
		const h = s.base + ((s.rise || 0) * (z - (s.z - s.depth / 2))) / s.depth;
		if (
			Math.abs(h - elevation) <= 0.13 &&
			(best === undefined ||
				Math.abs(h - elevation) < Math.abs(best - elevation))
		)
			best = h;
	}
	return best;
}
export function canStand(x: number, z: number, elevation = 0): boolean {
	const h = supportHeight(x, z, elevation);
	if (h === undefined) return false;
	return !COLLIDERS.some((b) => {
		const base = b.base || 0;
		if (base + (b.height || 4.4) <= h + 0.04 || base >= h + 1.8) return false;
		const p = localXZ({ x, z }, b);
		return (
			Math.abs(p.x) < b.width / 2 + LIBRARY.radius &&
			Math.abs(p.z) < b.depth / 2 + LIBRARY.radius
		);
	});
}
export function moveVisitor(
	v: Visitor,
	side: number,
	forward: number,
	seconds: number,
	speed: number = LIBRARY.speed,
): Visitor {
	const length = Math.max(1, Math.hypot(side, forward)),
		amount =
			Math.max(0, Math.min(speed, LIBRARY.runSpeed)) *
			Math.max(0, Math.min(seconds, 0.1));
	const dx =
			((-Math.cos(v.yaw) * side + Math.sin(v.yaw) * forward) / length) * amount,
		dz =
			((Math.sin(v.yaw) * side + Math.cos(v.yaw) * forward) / length) * amount;
	const result = { ...v, elevation: v.elevation || 0 },
		steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.06));
	for (let i = 0; i < steps; i++) {
		let sx = dx / steps,
			sz = dz / steps;
		const tentative = supportHeight(
			result.x + sx,
			result.z + sz,
			result.elevation,
		);
		if (tentative !== undefined && Math.hypot(sx, sz) > 0) {
			const ratio =
				Math.hypot(sx, sz) / Math.hypot(sx, sz, tentative - result.elevation);
			sx *= ratio;
			sz *= ratio;
		}
		for (const [ax, az] of [
			[sx, 0],
			[0, sz],
		]) {
			const x = result.x + ax,
				z = result.z + az,
				h = supportHeight(x, z, result.elevation);
			if (h !== undefined && canStand(x, z, h)) {
				result.x = x;
				result.z = z;
				result.elevation = h;
			}
		}
	}
	return result;
}
export function roomAt(x: number, z: number, elevation = 0): string {
	if (z > 33.5) return "楼梯与平台";
	const room = ROOMS.find(
		(r) =>
			Math.abs((r.base || 0) - elevation) < 0.2 &&
			Math.abs(x - r.x) < r.width / 2 &&
			Math.abs(z - r.z) < r.depth / 2,
	);
	return (
		room?.name ||
		(elevation > 4.2
			? z < 14
				? "观景栏廊"
				: "二楼回廊"
			: z > 14
				? "功能走廊"
				: "大厅")
	);
}
/** Oriented prisms; use eye/target height to prevent across-floor interaction. */
export function hasLibrarySight(
	a: { x: number; z: number; y?: number },
	b: { x: number; z: number; y?: number },
	blocks: FloorBox[] = [...COLLIDERS, ...FLOOR_SLABS],
): boolean {
	return !blocks.some((rect) => {
		const aa = localXZ(a, rect),
			bb = localXZ(b, rect);
		let lo = 0,
			hi = 1;
		const axes: [number, number, number, number][] = [
			[aa.x, bb.x, -rect.width / 2, rect.width / 2],
			[aa.z, bb.z, -rect.depth / 2, rect.depth / 2],
		];
		if (a.y !== undefined && b.y !== undefined)
			axes.push([
				a.y,
				b.y,
				rect.base || 0,
				(rect.base || 0) + (rect.height || 4.4),
			]);
		for (const [from, to, min, max] of axes) {
			const delta = to - from;
			if (Math.abs(delta) < 1e-9) {
				if (from < min || from > max) return false;
			} else {
				let t1 = (min - from) / delta,
					t2 = (max - from) / delta;
				if (t1 > t2) [t1, t2] = [t2, t1];
				lo = Math.max(lo, t1);
				hi = Math.min(hi, t2);
				if (lo > hi) return false;
			}
		}
		return hi > 1e-4 && lo < 0.9999;
	});
}
export function nearbyLibraryTarget(
	v: Visitor,
	enabled: Set<string>,
): LibraryTarget | undefined {
	let best: LibraryTarget | undefined,
		distance = 2;
	const elevation = v.elevation || 0;
	for (const target of LIBRARY_TARGETS) {
		if (!enabled.has(target.id) || Math.abs(target.base - elevation) > 0.3)
			continue;
		const dx = target.x - v.x,
			dy = target.y - (elevation + LIBRARY.eye),
			dz = target.z - v.z,
			d = Math.hypot(dx, dy, dz);
		const facing =
			(dx * Math.sin(v.yaw) * Math.cos(v.pitch) +
				dy * Math.sin(v.pitch) +
				dz * Math.cos(v.yaw) * Math.cos(v.pitch)) /
			Math.max(d, 0.001);
		if (
			d <= distance &&
			facing > 0.55 &&
			hasLibrarySight({ ...v, y: elevation + LIBRARY.eye }, target)
		) {
			best = target;
			distance = d;
		}
	}
	return best;
}
