import * as T from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import {
	AISLE_SHELVES,
	ANNEX,
	ANNEX_WALLS,
	CHAIRS,
	PLANTS,
	ROOM_FIXTURES,
	ROOMS,
	TABLES,
	WALL_SHELVES,
	UPPER,
	UPPER_WALLS,
	GUARDS,
	FLOOR_SLABS,
	STAIRS,
	SURFACES,
	fixturePoint,
	type FloorBox,
} from "./library-3d-layout";

type Point = [number, number, number];
type Ink = 0 | 1 | 2;
export interface LibraryModel {
	root: T.Group;
	lineMaterials: LineMaterial[];
	segments: number[];
	resize(width: number, height: number, mobile: boolean): void;
	dispose(): void;
}

/** Only intentional contour/structure paths; never triangle edges or wireframes. */
export function createLibraryModel(): LibraryModel {
	const root = new T.Group();
	root.name = "library-ink-interior";
	const ink: number[][] = [[], [], []];
	let frame: FloorBox | undefined;
	const world = (p: Point): Point => {
		if (!frame) return p;
		const q = fixturePoint(frame, p[0] - frame.x, p[1], p[2] - frame.z);
		return [q.x, q.y, q.z];
	};
	const geometries = new Set<T.BufferGeometry>();
	const mask = new T.MeshBasicMaterial({
		color: 0x000000,
		side: T.DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1,
	});
	const cube = new T.BoxGeometry(1, 1, 1);
	geometries.add(cube);
	const batches = new Map<T.BufferGeometry, T.Matrix4[]>();
	const position = new T.Vector3(),
		scale = new T.Vector3(),
		rotation = new T.Quaternion();
	function solid(
		g: T.BufferGeometry,
		x: number,
		y: number,
		z: number,
		w = 1,
		h = 1,
		d = 1,
		yaw = 0,
	): void {
		geometries.add(g);
		rotation.setFromAxisAngle(new T.Vector3(0, 1, 0), yaw + (frame?.yaw || 0));
		const p = world([x, y, z]);
		const matrix = new T.Matrix4().compose(
			position.set(...p),
			rotation,
			scale.set(w, h, d),
		);
		const list = batches.get(g);
		if (list) list.push(matrix);
		else batches.set(g, [matrix]);
	}
	const add = (a: Point, b: Point, level: Ink = 1) => {
		if (a.every((n, i) => n === b[i])) return;
		ink[level].push(...world(a), ...world(b));
	};
	function path(points: Point[], level: Ink = 1, close = false): void {
		for (let i = 1; i < points.length; i++)
			add(points[i - 1], points[i], level);
		if (close) add(points[points.length - 1], points[0], level);
	}
	function local(p: Point, x: number, y: number, z: number, yaw = 0): Point {
		return [
			x + p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw),
			y + p[1],
			z - p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw),
		];
	}
	function box(
		w: number,
		h: number,
		d: number,
		x: number,
		y: number,
		z: number,
		level: Ink | null = 0,
		yaw = 0,
	): void {
		solid(cube, x, y, z, w, h, d, yaw);
		if (level === null) return;
		const corners: Point[] = [];
		for (const a of [-1, 1])
			for (const b of [-1, 1])
				for (const c of [-1, 1])
					corners.push(
						local([(a * w) / 2, (b * h) / 2, (c * d) / 2], x, y, z, yaw),
					);
		for (let i = 0; i < 8; i++)
			for (const bit of [1, 2, 4])
				if ((i & bit) === 0) add(corners[i], corners[i | bit], level);
	}
	function ring(
		x: number,
		y: number,
		z: number,
		radius: number,
		level: Ink = 1,
		count = 48,
	): void {
		path(
			Array.from(
				{ length: count },
				(_, i): Point => [
					x + Math.cos((i * Math.PI * 2) / count) * radius,
					y,
					z + Math.sin((i * Math.PI * 2) / count) * radius,
				],
			),
			level,
			true,
		);
	}
	const turns = new Map<string, T.LatheGeometry>();
	function turned(
		profile: [number, number][],
		x: number,
		y: number,
		z: number,
		level: Ink = 0,
		meridians = 4,
	): void {
		const key = JSON.stringify(profile);
		let g = turns.get(key);
		if (!g) {
			g = new T.LatheGeometry(
				profile.map(([r, h]) => new T.Vector2(r, h)),
				48,
			);
			turns.set(key, g);
		}
		solid(g, x, y, z);
		for (const index of [0, profile.length - 1])
			ring(x, y + profile[index][1], z, profile[index][0], level);
		for (let i = 0; i < meridians; i++) {
			const a = (i * Math.PI * 2) / meridians;
			path(
				profile.map(
					([r, h]): Point => [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r],
				),
				level,
			);
		}
	}
	function arc(
		x: number,
		spring: number,
		z: number,
		radius: number,
		level: Ink,
	): Point[] {
		const p: Point[] = Array.from({ length: 65 }, (_, i): Point => {
			const a = (Math.PI * i) / 64;
			return [x + Math.cos(a) * radius, spring + Math.sin(a) * radius, z];
		});
		path(p, level);
		return p;
	}
	const random = (() => {
		let seed = 61703;
		return () => {
			seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
			return (seed >>> 0) / 4294967296;
		};
	})();

	// Black closed surfaces are only depth masks. No exterior, roof or painted finish.
	box(20.6, 0.3, 28.6, 0, -0.17, 0, null);
	box(0.5, 8, 28, 10, 4, 0, null);
	box(0.5, 8, 28, -10, 4, 0, null);
	// The rear opening connects to real rooms; masks and collisions share walls.
	for (const wall of ANNEX_WALLS) {
		const h = wall.height || ANNEX.height;
		box(wall.width, h, wall.depth, wall.x, h / 2, wall.z, 0);
	}
	box(2.8, 0.5, 0.24, 0, 7.55, 14, 0);
	box(19.5, 0.3, 19.5, 0, -0.17, 23.75, null);
	// First-floor ceiling, with real openings at the hall and stair landings.
	for (const x of [-5.6, 5.6])
		box(8.2, 0.16, 19.5, x, UPPER - 0.08, 23.75, null);
	for (const s of FLOOR_SLABS)
		box(s.width, s.height!, s.depth, s.x, s.base! + s.height! / 2, s.z, null);
	for (const wall of UPPER_WALLS)
		box(
			wall.width,
			wall.height!,
			wall.depth,
			wall.x,
			wall.base! + wall.height! / 2,
			wall.z,
			0,
		);
	box(19.5, 0.16, 19.5, 0, 7.88, 23.75, null);
	for (const x of [-2.3, 2.3]) box(0.14, 7.8, 8, x, 3.9, 37.4, null);
	box(4.7, 7.8, 0.14, 0, 3.9, 41.45, null);
	box(20, 8, 0.5, 0, 4, -14, null);
	box(20.5, 0.25, 28.5, 0, 8.1, 0, null);
	for (const y of [0.12, 0.32, 7.4, 7.65]) {
		for (const sign of [-1, 1])
			path(
				[
					[sign * 1.45, y, 13.72],
					[sign * 9.72, y, 13.72],
					[sign * 9.72, y, -13.72],
					[0, y, -13.72],
				],
				y < 1 ? 1 : 0,
			);
	}
	for (const z of [-9, -2, 5, 12]) {
		box(19.6, 0.24, 0.24, 0, 7.72, z, 0);
		for (const x of [-9.58, 9.58]) box(0.24, 0.75, 0.3, x, 7.23, z, 1);
	}
	// Sparse plank joints, not a full floor grid or hatching texture.
	for (const x of [-8.8, -6.4, -4, -1.6, 0.8, 3.2, 5.6, 8])
		add([x, 0.002, -13.7], [x, 0.002, 13.7], 2);
	for (let i = 0; i < 22; i++) {
		const x = -8.8 + (i % 8) * 2.4,
			z = -12 + ((i * 7.13) % 25);
		add([x, 0.003, z], [x + 2.4, 0.003, z], 2);
	}
	// Tall window joinery on the left. Near-side fillets remain clear against black.
	for (const z of [-10.75, -5.25, 0.25, 5.75, 11]) {
		for (const dz of [-2.28, 0, 2.28])
			box(0.2, 5.5, 0.12, -9.66, 4.03, z + dz, 0);
		for (const y of [1.3, 3.15, 4.95, 6.8])
			box(0.23, 0.13, 4.68, -9.65, y, z, 0);
		box(0.68, 0.18, 4.94, -9.45, 1.22, z, 0);
		for (const dz of [-2.4, 2.4])
			add([-9.42, 1.22, z + dz], [-9.42, 6.9, z + dz], 1);
		for (const paneZ of [-1.14, 1.14]) {
			add([-9.53, 1.46, z + paneZ], [-9.53, 6.64, z + paneZ], 1);
			for (const paneY of [2.1, 3.95, 5.85])
				path(
					[
						[-9.5, paneY + 0.18, z + paneZ - 0.65],
						[-9.5, paneY - 0.12, z + paneZ - 0.36],
					],
					2,
				);
		}
	}
	// Double door and a smooth fanlight, drawn from the room side only.
	for (const r of [2.62, 2.46, 2.3]) {
		arc(0, 3.4, -13.65, r, r === 2.62 ? 0 : 1);
		for (const sign of [-1, 1])
			add([sign * r, 0.04, -13.65], [sign * r, 3.4, -13.65], 0);
	}
	for (const x of [-1.09, 1.09]) {
		box(2.12, 3.32, 0.16, x, 1.7, -13.57, 0);
		for (const y of [0.86, 2.42]) {
			box(1.78, 1.21, 0.035, x, y, -13.46, 1);
			path(
				[
					[x - 0.81, y - 0.52, -13.43],
					[x - 0.81, y + 0.52, -13.43],
					[x + 0.81, y + 0.52, -13.43],
					[x + 0.81, y - 0.52, -13.43],
				],
				2,
				true,
			);
		}
		turned(
			[
				[0.045, 0],
				[0.045, 0.28],
			],
			Math.sign(x) * 0.21,
			1.45,
			-13.35,
			1,
			2,
		);
	}
	for (let i = 1; i < 8; i++) {
		const a = (i * Math.PI) / 8;
		add(
			[0, 3.4, -13.6],
			[2.28 * Math.cos(a), 3.4 + 2.28 * Math.sin(a), -13.6],
			1,
		);
	}
	arc(0, 3.4, -13.58, 1.18, 2);

	function bookshelf(
		x: number,
		z: number,
		width: number,
		height: number,
		depth: number,
		yaw: number,
		bays: number,
		rows: number,
	): void {
		const point = (p: Point) => local(p, x, 0, z, yaw);
		const b = (
			w: number,
			h: number,
			d: number,
			px: number,
			py: number,
			pz: number,
			level: Ink = 0,
		) => {
			const p = point([px, py, pz]);
			box(w, h, d, ...p, level, yaw);
		};
		b(width, height, 0.05, 0, height / 2, -depth / 2);
		b(width + 0.18, 0.2, depth + 0.16, 0, 0.12, 0);
		b(width + 0.2, 0.18, depth + 0.12, 0, height - 0.08, 0);
		b(width + 0.24, 0.06, depth + 0.18, 0, height + 0.04, 0, 1);
		const bay = width / bays;
		for (let i = 0; i <= bays; i++) {
			const u = -width / 2 + i * bay;
			b(0.1, height - 0.26, depth, u, height / 2, 0);
			b(0.04, height - 0.4, 0.025, u, height / 2, depth / 2 + 0.02, 1);
		}
		const shelfHeight = (height - 0.42) / rows;
		for (let row = 0; row < rows; row++) {
			const bottom = 0.22 + row * shelfHeight;
			b(width, 0.09, depth, 0, bottom, 0, 1);
			for (let index = 0; index < bays; index++) {
				let u = -width / 2 + index * bay + 0.14;
				while (u < -width / 2 + (index + 1) * bay - 0.21) {
					const w = 0.085 + random() * 0.105,
						h = shelfHeight * (0.5 + random() * 0.3),
						d = depth * 0.67;
					const center = u + w / 2,
						face = depth / 2 + 0.009;
					b(w, h, d, center, bottom + 0.045 + h / 2, depth / 2 - d / 2, 1);
					// A spine seam, two binding rules and a small inset label: no invented lettering.
					add(
						point([center - w * 0.28, bottom + 0.1, face]),
						point([center - w * 0.28, bottom + h - 0.035, face]),
						2,
					);
					for (const fraction of [0.17, 0.8])
						add(
							point([u + 0.013, bottom + h * fraction, face]),
							point([u + w - 0.013, bottom + h * fraction, face]),
							2,
						);
					if (w > 0.14)
						path(
							[
								[u + 0.028, bottom + h * 0.41, face],
								[u + w - 0.028, bottom + h * 0.41, face],
								[u + w - 0.028, bottom + h * 0.56, face],
								[u + 0.028, bottom + h * 0.56, face],
							].map((p) => point(p as Point)),
							2,
							true,
						);
					u += w + 0.022 + random() * 0.02;
				}
			}
		}
		// Fine joinery on the end, and restrained diagonal strokes on the plinth.
		for (const side of [-1, 1]) {
			path(
				[
					point([(side * width) / 2, 0.3, -depth * 0.35]),
					point([(side * width) / 2, height - 0.3, -depth * 0.35]),
					point([(side * width) / 2, height - 0.3, depth * 0.35]),
					point([(side * width) / 2, 0.3, depth * 0.35]),
				],
				2,
				true,
			);
		}
	}
	bookshelf(9.3, 0, 26, 6.85, 0.8, -Math.PI / 2, 10, 5);
	for (const shelf of WALL_SHELVES.slice(1))
		bookshelf(
			shelf.x,
			shelf.z,
			shelf.width,
			shelf.height || 6.85,
			shelf.depth,
			Math.PI,
			3,
			5,
		);
	for (const aisle of AISLE_SHELVES) {
		bookshelf(aisle.x - 0.2, aisle.z, 12, 4.45, 0.4, -Math.PI / 2, 5, 4);
		bookshelf(aisle.x + 0.2, aisle.z, 12, 4.45, 0.4, Math.PI / 2, 5, 4);
	}

	function lamp(x: number, z: number, base = 1.04): void {
		turned(
			[
				[0.35, 0],
				[0.35, 0.035],
				[0.27, 0.07],
				[0.13, 0.12],
				[0.07, 0.14],
			],
			x,
			base,
			z,
			0,
			4,
		);
		turned(
			[
				[0.025, 0],
				[0.025, 0.72],
			],
			x,
			base + 0.14,
			z,
			1,
			3,
		);
		// Smooth custom profile, not the tessellation of a low-poly hemisphere.
		const profile: [number, number][] = Array.from({ length: 25 }, (_, i) => {
			const a = (i * Math.PI) / 2 / 24;
			return [0.5 * Math.cos(a) + 0.006, 0.38 * Math.sin(a)];
		});
		turned(profile, x, base + 0.81, z, 0, 6);
		ring(x, base + 0.82, z, 0.465, 1);
		ring(x, base + 0.85, z, 0.49, 2);
		path(
			[
				[x + 0.36, base + 0.82, z],
				[x + 0.36, base + 0.7, z],
				[x + 0.33, base + 0.68, z],
			],
			2,
		);
		for (const dx of [-0.49, 0.49])
			path(
				[
					[x + dx, base + 0.82, z],
					[x + dx, base + 0.77, z],
					[x + dx * 0.94, base + 0.74, z],
				],
				1,
			);
	}
	for (const t of TABLES) {
		box(t.width, 0.14, t.depth, t.x, 0.97, t.z, 0);
		box(t.width - 0.1, 0.045, t.depth - 0.1, t.x, 1.064, t.z, 1);
		for (const sx of [-1, 1])
			for (const sz of [-1, 1]) {
				const x = t.x + sx * (t.width / 2 - 0.21),
					z = t.z + sz * (t.depth / 2 - 0.19);
				box(0.16, 0.9, 0.16, x, 0.45, z, 0);
				box(0.21, 0.1, 0.21, x, 0.8, z, 1);
			}
		for (const side of [-1, 1]) {
			box(
				t.width - 0.36,
				0.22,
				0.075,
				t.x,
				0.79,
				t.z + side * (t.depth / 2 - 0.15),
				1,
			);
			for (let i = 0; i < 5; i++)
				add(
					[t.x - 1.65 + i * 0.07, 0.72, t.z + side * (t.depth / 2 - 0.1)],
					[t.x - 1.61 + i * 0.07, 0.86, t.z + side * (t.depth / 2 - 0.1)],
					2,
				);
		}
		for (const dx of [-1.5, 0, 1.5]) lamp(t.x + dx, t.z);
		// Book stack, page edges, and a curved open book on each reading table.
		for (let i = 0; i < 3; i++) {
			const x = t.x + 1.62 + i * 0.035,
				z = t.z + 0.57;
			box(0.55, 0.11, 0.76, x, 1.14 + i * 0.12, z, 1);
			for (let j = 0; j < 3; j++)
				add(
					[x - 0.268, 1.105 + i * 0.12 + j * 0.019, z + 0.389],
					[x + 0.268, 1.105 + i * 0.12 + j * 0.019, z + 0.389],
					2,
				);
		}
		const x = t.x - 0.68,
			z = t.z + 0.68;
		box(0.76, 0.035, 0.52, x, 1.11, z, 1);
		for (const side of [-1, 1]) {
			for (const edge of [-0.26, 0.26]) {
				path(
					Array.from({ length: 17 }, (_, i): Point => {
						const u = i / 16;
						return [
							x + side * u * 0.37,
							1.14 + 0.042 * Math.sin(u * Math.PI),
							z + edge,
						];
					}),
					1,
				);
			}
			for (let j = 0; j < 5; j++)
				path(
					Array.from({ length: 9 }, (_, i): Point => {
						const u = 0.15 + (i / 8) * 0.72;
						return [
							x + side * u * 0.37,
							1.144 + 0.042 * Math.sin(u * Math.PI),
							z - 0.17 + j * 0.072,
						];
					}),
					2,
				);
		}
		add([x, 1.142, z - 0.26], [x, 1.142, z + 0.26], 1);
	}
	for (const c of CHAIRS) {
		frame = c;
		const table = TABLES.reduce((a, b) =>
			Math.abs(a.z - c.z) < Math.abs(b.z - c.z) ? a : b,
		);
		const back = c.z < table.z ? -1 : 1;
		box(0.57, 0.09, 0.56, c.x, 0.46, c.z, 0);
		for (const sx of [-1, 1])
			for (const sz of [-1, 1]) {
				box(0.067, 0.43, 0.067, c.x + sx * 0.235, 0.215, c.z + sz * 0.22, 1);
				box(0.08, 0.04, 0.08, c.x + sx * 0.235, 0.035, c.z + sz * 0.22, 2);
			}
		for (const sx of [-1, 1])
			box(0.075, 0.78, 0.075, c.x + sx * 0.24, 0.84, c.z + back * 0.24, 0);
		for (const y of [0.68, 0.9, 1.12])
			box(0.44, 0.09, 0.065, c.x, y, c.z + back * 0.24, 1);
		for (const sx of [-1, 1])
			box(0.055, 0.08, 0.44, c.x + sx * 0.235, 0.25, c.z, 1);
	}
	frame = undefined;
	// Window seats occupy the same collision footprints as the previous version.
	for (const z of [0, 8.7]) {
		box(0.94, 0.13, 1.76, -8.2, 0.46, z, 0);
		box(0.9, 0.11, 1.64, -8.2, 0.58, z, 1);
		for (const dz of [-0.7, 0.7]) box(0.65, 0.42, 0.1, -8.2, 0.21, z + dz, 1);
		box(0.08, 0.55, 1.68, -8.65, 0.78, z, 0);
		for (const y of [0.68, 0.92]) box(0.065, 0.06, 1.55, -8.59, y, z, 1);
		lamp(-8.2, z + 0.45, 0.65);
	}
	for (const plant of PLANTS) {
		const x = plant.x,
			z = plant.z;
		turned(
			[
				[0.25, 0],
				[0.3, 0.06],
				[0.39, 0.62],
				[0.42, 0.66],
				[0.42, 0.71],
				[0.36, 0.73],
			],
			x,
			0,
			z,
			0,
			6,
		);
		ring(x, 0.73, z, 0.35, 1);
		for (let i = 0; i < 11; i++) {
			const a = i * 2.399963,
				length = 0.44 + random() * 0.38,
				height = 0.95 + random() * 0.8;
			const stem: Point[] = [
				[x, 0.71, z],
				[
					x + Math.cos(a) * length * 0.2,
					height - 0.24,
					z + Math.sin(a) * length * 0.2,
				],
				[
					x + Math.cos(a) * length * 0.63,
					height,
					z + Math.sin(a) * length * 0.63,
				],
			];
			path(stem, 1);
			const origin = stem[2],
				end: Point = [
					x + Math.cos(a) * length,
					height + 0.16,
					z + Math.sin(a) * length,
				];
			const leaf: Point[] = [];
			for (const side of [-1, 1])
				for (let k = 0; k <= 16; k++) {
					const u = side === -1 ? k / 16 : 1 - k / 16,
						width = Math.sin(u * Math.PI) * 0.115 * side;
					leaf.push([
						origin[0] + (end[0] - origin[0]) * u - Math.sin(a) * width,
						origin[1] + (end[1] - origin[1]) * u + 0.07 * Math.sin(u * Math.PI),
						origin[2] + (end[2] - origin[2]) * u + Math.cos(a) * width,
					]);
				}
			path(leaf, 1, true);
			add(origin, end, 2);
			// A curved leaf mask prevents veins and stems from showing through it.
			const vertices: number[] = [];
			for (let k = 1; k < leaf.length - 1; k++)
				vertices.push(...leaf[0], ...leaf[k], ...leaf[k + 1]);
			const g = new T.BufferGeometry();
			g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
			solid(g, 0, 0, 0);
			for (const u of [0.3, 0.52, 0.72])
				for (const side of [-1, 1]) {
					const p: Point = [
						origin[0] + (end[0] - origin[0]) * u,
						origin[1] + (end[1] - origin[1]) * u + 0.05,
						origin[2] + (end[2] - origin[2]) * u,
					];
					add(
						p,
						[
							p[0] - Math.sin(a) * 0.09 * side + Math.cos(a) * 0.03,
							p[1] + 0.015,
							p[2] + Math.cos(a) * 0.09 * side + Math.sin(a) * 0.03,
						],
						2,
					);
				}
		}
	}
	// Suspended ring fixture with selected smooth contours, no glowing surfaces.
	turned(
		[
			[1.12, 0],
			[1.12, 0.04],
		],
		0,
		5.86,
		0,
		0,
		8,
	);
	for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
		const x = Math.cos(a) * 1.12,
			z = Math.sin(a) * 1.12;
		add([0, 7.6, 0], [x, 5.9, z], 1);
		turned(
			[
				[0.055, 0],
				[0.055, 0.22],
				[0.015, 0.23],
			],
			x,
			5.9,
			z,
			1,
			2,
		);
	}

	// Functional wing: corridor, permanent openings and distinct line-art furniture.
	for (const room of ROOMS) {
		frame = {
			x: room.x,
			z: room.z,
			width: room.width,
			depth: room.depth,
			base: room.base,
		};
		const x = room.doorX,
			z = room.z,
			side = Math.sign(x);
		box(0.2, 1.4, 1.5, x, 3.7, z, 0);
		for (const dz of [-0.81, 0.81]) box(0.24, 3.04, 0.1, x, 1.52, z + dz, 0);
		box(0.28, 0.12, 1.8, x, 3.05, z, 1);
		// A physical plaque, paired with the projected accessible Chinese label.
		box(0.06, 0.28, 0.95, x - side * 0.14, 2.55, z, 1);
		for (const y of [0.16, room.base ? 3.12 : 4.12])
			path(
				[
					[room.x - room.width / 2 + 0.04, y, z - room.depth / 2 + 0.13],
					[room.x - room.width / 2 + 0.04, y, z + room.depth / 2 - 0.13],
					[room.x + room.width / 2 - 0.04, y, z + room.depth / 2 - 0.13],
				],
				1,
			);
	}
	frame = undefined;
	for (const x of [-1.2, 1.2]) add([x, 0.003, 14.25], [x, 0.003, 33.3], 2);
	for (const z of [17, 23.5, 27, 32]) box(2.8, 0.12, 0.16, 0, 4.2, z, 1);
	for (const fixture of ROOM_FIXTURES) {
		frame = fixture;
		const f = fixture,
			side = Math.sign(f.x),
			face = f.x - side * (f.width / 2 + 0.012);
		if (f.kind === "notice") {
			box(f.width, f.height * 0.7, f.depth, f.x, 1.55, f.z, 0);
			for (const dx of [-0.5, 0, 0.5]) {
				box(
					0.34,
					0.63,
					0.025,
					f.x + dx,
					1.55 + (dx === 0 ? 0.06 : -0.03),
					f.z - 0.087,
					1,
				);
				for (const dy of [-0.16, -0.04, 0.08])
					add(
						[f.x + dx - 0.11, 1.55 + dy, f.z - 0.103],
						[f.x + dx + 0.11, 1.55 + dy, f.z - 0.103],
						2,
					);
			}
			continue;
		}
		if (f.kind === "chair") {
			box(0.6, 0.09, 0.58, f.x, 0.46, f.z, 0);
			for (const dx of [-0.23, 0.23])
				for (const dz of [-0.23, 0.23])
					box(0.065, 0.43, 0.065, f.x + dx, 0.215, f.z + dz, 1);
			for (const dx of [-0.24, 0.24])
				box(0.07, 0.8, 0.07, f.x + dx, 0.82, f.z + 0.25, 0);
			for (const y of [0.7, 0.91, 1.13])
				box(0.45, 0.08, 0.06, f.x, y, f.z + 0.25, 1);
			continue;
		}
		if (f.kind === "cabinet" || f.kind === "records") {
			box(f.width, f.height, f.depth, f.x, f.height / 2, f.z, 0);
			box(f.width + 0.08, 0.08, f.depth + 0.1, f.x, f.height + 0.04, f.z, 1);
			for (let row = 0; row < 4; row++)
				for (let column = 0; column < 5; column++) {
					const cy = 0.17 + ((row + 0.5) * (f.height - 0.25)) / 4,
						cz = f.z - f.depth / 2 + ((column + 0.5) * f.depth) / 5;
					const hh = (f.height - 0.3) / 8,
						dd = f.depth / 10 - 0.07;
					path(
						[
							[face, cy - hh, cz - dd],
							[face, cy + hh, cz - dd],
							[face, cy + hh, cz + dd],
							[face, cy - hh, cz + dd],
						],
						1,
						true,
					);
					if (f.kind === "records") {
						path(
							Array.from(
								{ length: 33 },
								(_, i): Point => [
									face - side * 0.004,
									cy + Math.sin((i * Math.PI) / 16) * Math.min(hh, dd) * 0.75,
									cz + Math.cos((i * Math.PI) / 16) * Math.min(hh, dd) * 0.75,
								],
							),
							2,
						);
					} else {
						add(
							[face - side * 0.012, cy - 0.02, cz - 0.14],
							[face - side * 0.012, cy - 0.02, cz + 0.14],
							1,
						);
						path(
							[
								[face - side * 0.014, cy + 0.09, cz - 0.11],
								[face - side * 0.014, cy + 0.19, cz - 0.11],
								[face - side * 0.014, cy + 0.19, cz + 0.11],
								[face - side * 0.014, cy + 0.09, cz + 0.11],
							],
							2,
							true,
						);
					}
				}
			continue;
		}
		if (f.kind === "bench" || f.kind === "sofa") {
			box(f.width, 0.12, f.depth, f.x, 0.46, f.z, 0);
			box(f.width - 0.08, 0.12, f.depth - 0.08, f.x, 0.58, f.z, 1);
			box(f.width, 0.5, 0.09, f.x, 0.86, f.z + f.depth / 2 - 0.05, 0);
			for (const dx of [-f.width / 2 + 0.08, f.width / 2 - 0.08])
				box(0.13, 0.46, f.depth, f.x + dx, 0.68, f.z, 1);
			for (const dx of [-f.width / 6, f.width / 6])
				add(
					[f.x + dx, 0.645, f.z - f.depth / 2 + 0.04],
					[f.x + dx, 0.645, f.z + f.depth / 2 - 0.04],
					2,
				);
			for (const dx of [-f.width / 2 + 0.22, f.width / 2 - 0.22])
				for (const dz of [-0.25, 0.25])
					box(0.09, 0.43, 0.09, f.x + dx, 0.215, f.z + dz, 1);
			continue;
		}
		if (f.kind === "display") {
			box(f.width, 0.78, f.depth, f.x, 0.39, f.z, 0);
			box(f.width + 0.08, 0.08, f.depth + 0.08, f.x, 0.82, f.z, 1);
			// Glass is represented by its frame, with no opaque pane across the exhibit.
			for (const dx of [-f.width / 2, f.width / 2])
				for (const dz of [-f.depth / 2, f.depth / 2])
					add([f.x + dx, 0.86, f.z + dz], [f.x + dx, 1.5, f.z + dz], 1);
			path(
				[
					[f.x - f.width / 2, 1.5, f.z - f.depth / 2],
					[f.x + f.width / 2, 1.5, f.z - f.depth / 2],
					[f.x + f.width / 2, 1.5, f.z + f.depth / 2],
					[f.x - f.width / 2, 1.5, f.z + f.depth / 2],
				],
				1,
				true,
			);
			box(0.7, 0.05, 0.55, f.x, 0.89, f.z, 1);
			for (const dz of [-0.15, 0, 0.15])
				add([f.x - 0.27, 0.918, f.z + dz], [f.x + 0.27, 0.918, f.z + dz], 2);
			continue;
		}
		box(f.width, 0.1, f.depth, f.x, f.height - 0.05, f.z, 0);
		for (const dx of [-f.width / 2 + 0.09, f.width / 2 - 0.09])
			for (const dz of [-f.depth / 2 + 0.09, f.depth / 2 - 0.09])
				box(
					0.08,
					f.height - 0.1,
					0.08,
					f.x + dx,
					(f.height - 0.1) / 2,
					f.z + dz,
					1,
				);
		if (f.kind === "catalogue" || f.kind === "folder") {
			const offsets = f.kind === "catalogue" ? [-1.14, 0, 1.14] : [-0.75, 0.75];
			for (const dx of offsets) {
				box(0.72, 0.035, 0.57, f.x + dx, f.height + 0.03, f.z - 0.12, 1);
				for (const dz of [-0.27, -0.15, -0.03])
					add(
						[f.x + dx - 0.25, f.height + 0.052, f.z + dz],
						[f.x + dx + 0.25, f.height + 0.052, f.z + dz],
						2,
					);
				add(
					[f.x + dx, f.height + 0.055, f.z - 0.38],
					[f.x + dx, f.height + 0.055, f.z + 0.16],
					1,
				);
			}
		} else if (f.kind === "phonograph") {
			box(0.78, 0.14, 0.65, f.x, f.height + 0.08, f.z, 1);
			turned(
				[
					[0.26, 0],
					[0.26, 0.028],
				],
				f.x - 0.1,
				f.height + 0.17,
				f.z,
				1,
				0,
			);
			for (const r of [0.05, 0.12, 0.21])
				ring(f.x - 0.1, f.height + 0.2, f.z, r, 2);
			turned(
				[
					[0.07, 0],
					[0.08, 0.14],
					[0.13, 0.3],
					[0.25, 0.48],
					[0.44, 0.6],
				],
				f.x + 0.35,
				f.height + 0.14,
				f.z + 0.14,
				0,
				5,
			);
			ring(f.x + 0.35, f.height + 0.74, f.z + 0.14, 0.4, 1);
			path(
				[
					[f.x + 0.26, f.height + 0.18, f.z - 0.21],
					[f.x + 0.15, f.height + 0.24, f.z - 0.22],
					[f.x - 0.04, f.height + 0.23, f.z - 0.08],
				],
				1,
			);
		} else if (f.kind === "workbench") {
			if (f.id === "project-desk") {
				box(0.95, 0.7, 0.06, f.x, 1.5, f.z + 0.2, 0);
				path(
					[
						[f.x - 0.39, 1.23, f.z + 0.167],
						[f.x - 0.39, 1.78, f.z + 0.167],
						[f.x + 0.39, 1.78, f.z + 0.167],
						[f.x + 0.39, 1.23, f.z + 0.167],
					],
					1,
					true,
				);
				box(0.16, 0.15, 0.2, f.x, 1.08, f.z, 1);
			} else {
				for (let i = 0; i < 4; i++)
					box(
						0.43,
						0.045,
						0.52,
						f.x - 0.95 + i * 0.62,
						f.height + 0.035,
						f.z,
						1,
					);
				for (const dx of [-0.9, 0.3])
					turned(
						[
							[0.04, 0],
							[0.04, 0.25],
							[0, 0.29],
						],
						f.x + dx,
						f.height,
						f.z + 0.4,
						1,
						2,
					);
			}
		} else lamp(f.x, f.z, f.height);
	}
	frame = undefined;
	// Real two-flight staircase: continuous navigation ramp, visible individual treads.
	for (let flight = 0; flight < 2; flight++) {
		const x = STAIRS.centres[flight],
			bottom = flight === 0 ? 0 : 2.2;
		for (let i = 0; i < STAIRS.steps; i++) {
			const dz = (STAIRS.end - STAIRS.start) / STAIRS.steps;
			const z =
				flight === 0
					? STAIRS.start + (i + 0.5) * dz
					: STAIRS.end - (i + 0.5) * dz;
			const top = bottom + ((i + 1) * STAIRS.rise) / STAIRS.steps;
			box(STAIRS.width, 0.17, dz, x, top - 0.085, z, 1);
		}
		for (const side of [-1, 1]) {
			const rx = x + (side * STAIRS.width) / 2;
			const a: Point = [
					rx,
					bottom + 1.1,
					flight === 0 ? STAIRS.start : STAIRS.end,
				],
				b: Point = [rx, bottom + 3.3, flight === 0 ? STAIRS.end : STAIRS.start];
			add(a, b, 0);
			add([a[0], a[1] - 0.18, a[2]], [b[0], b[1] - 0.18, b[2]], 1);
			for (let i = 0; i <= 6; i++) {
				const t = i / 6,
					z = a[2] + (b[2] - a[2]) * t,
					y = bottom + STAIRS.rise * t;
				add([rx, y + 0.02, z], [rx, y + 1.1, z], 1);
			}
		}
	}
	for (const s of SURFACES.filter((s) => s.z === 34.3 || s.z === 40.55))
		box(s.width, 0.16, s.depth, s.x, s.base - 0.08, s.z, 1);
	for (const g of GUARDS.filter((g) => g.base === UPPER)) {
		const horizontal = g.width > g.depth,
			length = horizontal ? g.width : g.depth;
		const a: Point = [
				g.x - (horizontal ? length / 2 : 0),
				UPPER + 1.1,
				g.z - (horizontal ? 0 : length / 2),
			],
			b: Point = [
				g.x + (horizontal ? length / 2 : 0),
				UPPER + 1.1,
				g.z + (horizontal ? 0 : length / 2),
			];
		add(a, b, 0);
		add([a[0], UPPER + 0.8, a[2]], [b[0], UPPER + 0.8, b[2]], 1);
		for (let i = 0; i <= Math.ceil(length / 0.9); i++) {
			const t = i / Math.ceil(length / 0.9),
				x = a[0] + (b[0] - a[0]) * t,
				z = a[2] + (b[2] - a[2]) * t;
			add([x, UPPER + 0.02, z], [x, UPPER + 1.1, z], 1);
		}
	}
	// Empty gallery frames: decorative outlines, not fabricated album content.
	for (const z of [27.4, 30.7]) {
		box(0.07, 1.8, 1.9, 9.49, 2.1, z, 0);
		for (const inset of [0.12, 0.24])
			path(
				[
					[9.45, 1.2 + inset, z - 0.95 + inset],
					[9.45, 3 - inset, z - 0.95 + inset],
					[9.45, 3 - inset, z + 0.95 - inset],
					[9.45, 1.2 + inset, z + 0.95 - inset],
				],
				1,
				true,
			);
	}

	// Occlusion is drawn before every ink layer, with shared geometry instancing.
	for (const [geometry, matrices] of batches) {
		const mesh = new T.InstancedMesh(geometry, mask, matrices.length);
		matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
		mesh.renderOrder = 0;
		root.add(mesh);
	}
	const lineMaterials: LineMaterial[] = [];
	const widths = [1.15, 0.82, 0.6],
		colors = [0xeeeeee, 0xbcbcbc, 0x929292];
	const ranges = [
		[12, 48],
		[8, 34],
		[4, 14],
	];
	for (let level = 0; level < 3; level++) {
		const geometry = new LineSegmentsGeometry().setPositions(ink[level]);
		geometries.add(geometry);
		const material = new LineMaterial({
			color: colors[level],
			linewidth: widths[level],
			worldUnits: false,
			depthWrite: false,
			depthTest: true,
			alphaToCoverage: true,
			toneMapped: false,
		});
		// Per-fragment distance fading also drops small details, without LOD popping.
		material.vertexShader = material.vertexShader
			.replace("void main() {", "varying float inkDistance;\nvoid main() {")
			.replace(
				"#include <fog_vertex>",
				"inkDistance = length(mvPosition.xyz);\n#include <fog_vertex>",
			);
		material.fragmentShader =
			"varying float inkDistance;\n" + material.fragmentShader;
		material.fragmentShader = material.fragmentShader.replace(
			"#include <fog_fragment>",
			`gl_FragColor.rgb *= 1.0 - smoothstep(${ranges[level][0]}.0, ${ranges[level][1]}.0, inkDistance);\n#include <fog_fragment>`,
		);
		const lines = new LineSegments2(geometry, material);
		lines.renderOrder = 1 + level;
		root.add(lines);
		lineMaterials.push(material);
	}
	return {
		root,
		lineMaterials,
		segments: ink.map((a) => a.length / 6),
		resize(width, height, mobile) {
			lineMaterials.forEach((m, i) => {
				m.resolution.set(width, height);
				m.linewidth = widths[i] * (mobile ? 1.05 : 1);
			});
		},
		dispose() {
			root.traverse((o) => {
				if (o instanceof T.InstancedMesh) o.dispose();
			});
			for (const g of geometries) g.dispose();
			for (const m of lineMaterials) m.dispose();
			mask.dispose();
			root.clear();
		},
	};
}
