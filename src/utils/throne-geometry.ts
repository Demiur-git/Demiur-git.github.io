export interface Point3 {
	x: number;
	y: number;
	z: number;
}
export interface ThroneView {
	width: number;
	height: number;
	distance: number;
	bob?: number;
}
export interface ThroneMark {
	id: string;
	points: Point3[];
	face?: boolean;
	level: 0 | 1 | 2;
	opacity: number;
	glow?: boolean;
	material?: "surface" | "side" | "detail" | "thread";
	width?: number;
}
const p = (x: number, y: number, z = 0): Point3 => ({ x, y, z });
const mix = (a: Point3, b: Point3, t: number): Point3 =>
	p(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const focalLength = (view: ThroneView) =>
	Math.min(view.height * 0.7, view.width * 1.4);

export function throneView(
	width: number,
	height: number,
	progress: number,
	bob = 0,
): ThroneView {
	const t = Math.max(0, Math.min(1, progress));
	return { width, height, distance: 32.5 - 17.7 * (t * t * (3 - 2 * t)), bob };
}
export function projectThrone(
	point: Point3,
	view: ThroneView,
): [number, number] {
	const focal = focalLength(view),
		depth = view.distance + point.z;
	// Camera elevation, not a transform on the webpage or dialogue controls.
	const eye = 2.4 + ((view.bob || 0) * view.distance) / focal;
	return [
		view.width / 2 + (point.x * focal) / depth,
		view.height * 0.42 + ((eye - point.y) * focal) / depth,
	];
}
function cubic(
	a: Point3,
	b: Point3,
	c: Point3,
	d: Point3,
	steps = 28,
): Point3[] {
	return Array.from({ length: steps + 1 }, (_, i) => {
		const t = i / steps,
			u = 1 - t;
		return p(
			u * u * u * a.x +
				3 * u * u * t * b.x +
				3 * u * t * t * c.x +
				t * t * t * d.x,
			u * u * u * a.y +
				3 * u * u * t * b.y +
				3 * u * t * t * c.y +
				t * t * t * d.y,
			u * u * u * a.z +
				3 * u * u * t * b.z +
				3 * u * t * t * c.z +
				t * t * t * d.z,
		);
	});
}
const stroke = (
	id: string,
	points: Point3[],
	level: 0 | 1 | 2 = 1,
	opacity = 0.72,
	glow = false,
): ThroneMark => ({ id, points, level, opacity, glow });
const face = (id: string, points: Point3[]): ThroneMark => ({
	id,
	points,
	face: true,
	material: "surface",
	level: 2,
	opacity: 1,
});

/** Tapered white ribbons supply both material and occlusion. */
function root(
	id: string,
	controls: Point3[],
	width: number,
	brightness = 0.7,
): ThroneMark[] {
	const center = cubic(controls[0], controls[1], controls[2], controls[3]);
	const left: Point3[] = [],
		right: Point3[] = [];
	center.forEach((point, i) => {
		const before = center[Math.max(0, i - 1)],
			after = center[Math.min(center.length - 1, i + 1)];
		const dx = after.x - before.x,
			dy = after.y - before.y,
			length = Math.hypot(dx, dy) || 1;
		const radius = (width * Math.pow(1 - i / (center.length - 1), 1.25)) / 2;
		left.push(
			p(
				point.x - (dy / length) * radius,
				point.y + (dx / length) * radius,
				point.z,
			),
		);
		right.push(
			p(
				point.x + (dy / length) * radius,
				point.y - (dx / length) * radius,
				point.z,
			),
		);
	});
	return [
		face(`${id}-mask`, [...left, ...right.toReversed()]),
		stroke(`${id}-l`, left, 1, brightness, true),
		{ ...stroke(`${id}-r`, right, 2, 0.75), material: "detail" },
	];
}
function buildStructure(): ThroneMark[] {
	const marks: ThroneMark[] = [];
	// A closed, slightly flared pedestal replaces all legs and ground roots.
	const baseFront = [
		p(-1.18, 1.26, -0.07),
		p(1.18, 1.26, -0.07),
		p(1.32, -0.72, -0.18),
		p(-1.32, -0.72, -0.18),
	];
	const baseBack = [
		p(-1.28, 1.26, 1.8),
		p(1.28, 1.26, 1.8),
		p(1.4, -0.72, 1.95),
		p(-1.4, -0.72, 1.95),
	];
	marks.push(face("base-front", baseFront), {
		...face("base-back", baseBack),
		material: "side",
	});
	for (let i = 0; i < 4; i++) {
		const next = (i + 1) % 4;
		marks.push({
			...face(`base-side-${i}`, [
				baseFront[i],
				baseFront[next],
				baseBack[next],
				baseBack[i],
			]),
			material: "side",
		});
	}
	marks.push(
		stroke("base-outline", [...baseFront, baseFront[0]], 1, 0.75, true),
	);
	// A concave, gently waisted back. The far edge records the real thickness.
	const outline = [
		p(-1.12, 1.2),
		p(-0.92, 2.0),
		p(-0.96, 2.8),
		p(-1.18, 3.7),
		p(-1.3, 4.3),
		p(-0.88, 4.45),
		p(-0.4, 4.76),
		p(0, 4.88),
		p(0.4, 4.76),
		p(0.88, 4.45),
		p(1.3, 4.3),
		p(1.18, 3.7),
		p(0.96, 2.8),
		p(0.92, 2),
		p(1.12, 1.2),
	];
	const far = outline.map((v) => p(v.x, v.y, 0.3));
	marks.push(
		face("back", outline),
		stroke("back-outline", [...outline, outline[0]], 0, 0.86, true),
	);
	for (let i = 0; i < outline.length; i++) {
		const j = (i + 1) % outline.length;
		marks.push({
			...face(`rim-${i}`, [outline[i], far[i], far[j], outline[j]]),
			material: "side",
		});
		marks.push(stroke(`rim-edge-${i}`, [far[i], far[j]], 2, 0.4));
	}
	// Seat and armrests extend away from the viewer.
	const seat = [
		p(-1.24, 1.25, -0.04),
		p(1.24, 1.25, -0.04),
		p(1.35, 1.25, 1.9),
		p(-1.35, 1.25, 1.9),
	];
	marks.push(
		face("seat", seat),
		stroke("seat-outline", [...seat, seat[0]], 1, 0.7),
	);
	marks.push(
		stroke(
			"seat-apron",
			[
				p(-1.24, 1.23, -0.07),
				p(-1.19, 1.05, -0.07),
				p(0, 1.02, -0.07),
				p(1.19, 1.05, -0.07),
				p(1.24, 1.23, -0.07),
			],
			1,
			0.7,
		),
	);
	for (const side of [-1, 1]) {
		marks.push(
			...root(
				`arm-${side}`,
				[
					p(side * 1.06, 2.04, 0.1),
					p(side * 1.55, 2.45, 0.65),
					p(side * 1.55, 1.85, 1.8),
					p(side * 1.28, 1.3, 1.9),
				],
				0.16,
				0.7,
			),
		);
	}
	return marks.map((mark) => {
		if (mark.id === "seat-apron")
			return { ...mark, material: "detail", opacity: 0.75 };
		return mark;
	});
}
export const THRONE_STRUCTURE: readonly ThroneMark[] = buildStructure();

/** Asymmetric 3D curves. Time moves the middle of a thread, never its sockets. */
export function buildThroneThreads(time = 0): ThroneMark[] {
	const marks: ThroneMark[] = [];
	for (let i = 0; i < 44; i++) {
		const fine = i >= 28;
		const primary = !fine && (i % 4 === 0 || i === 27);
		const width = fine
			? 0.45 + (i % 3) * 0.1
			: primary
				? 1.2 + (i % 3) * 0.3
				: 0.65 + (i % 4) * 0.115;
		const angle = i * 2.399963229728653;
		const side = Math.cos(angle) > 0 ? 1 : -1;
		const start = p(
			Math.cos(angle) * (19 + (i % 5) * 3),
			2.5 + Math.sin(angle) * (13 + (i % 4) * 2),
			2 + (i % 6) * 1.4,
		);
		const end = p(
			side * (0.94 + (i % 4) * 0.08),
			fine ? -0.35 + (i % 6) * 0.24 : 1.35 + (i % 9) * 0.36,
			fine ? 0.2 : i % 4 === 0 ? -0.12 : 0.2,
		);
		const c1 = p(
			start.x * 0.65 + Math.sin(i * 2.1) * 5,
			start.y * 0.65 + Math.cos(i * 1.3) * 3,
			start.z - 1.8,
		);
		const c2 = p(
			side * (2.4 + (i % 3) * 0.6),
			end.y + Math.sin(i * 1.4) * 2.2,
			i % 4 === 0 ? -1.1 : 1.5,
		);
		const points = cubic(start, c1, c2, end, 40).map((point, n) => {
			const t = n / 40,
				envelope = Math.sin(Math.PI * t) * Math.sin(Math.PI * t);
			return p(
				point.x +
					Math.sin(time * (0.00036 + (i % 5) * 0.000065) + i * 1.7 + t * 8) *
						envelope *
						0.3,
				point.y +
					Math.sin(time * (0.00028 + (i % 7) * 0.00004) + i * 2.3 + t * 7) *
						envelope *
						0.24,
				point.z,
			);
		});
		// Short depth-sorted spans let near strands cross in front while far ones disappear behind the back.
		for (let n = 0; n < 40; n += 5)
			marks.push({
				...stroke(
					`thread-${i}-${n}`,
					points.slice(n, n + 6),
					2,
					(fine ? 0.32 : primary ? 0.65 : 0.4) * (1 - start.z / 35),
				),
				material: "thread",
				width,
			});
		if (i % 5 === 0) {
			const joint = points[15],
				branch = cubic(
					p(start.x * 0.55 + side * 5, start.y + 4, start.z + 2),
					mix(start, joint, 0.3),
					mix(start, joint, 0.8),
					joint,
					15,
				);
			marks.push({
				...stroke(`thread-branch-${i}`, branch, 2, 0.27),
				material: "thread",
				width: 0.65,
			});
		}
	}
	return marks;
}
export function orderThroneMarks(marks: readonly ThroneMark[]): ThroneMark[] {
	const depth = (mark: ThroneMark) =>
		mark.points.reduce((sum, v) => sum + v.z, 0) / mark.points.length;
	return [...marks].sort(
		(a, b) => depth(b) - depth(a) || (a.face ? -1 : 0) - (b.face ? -1 : 0),
	);
}

export function projectedThroneBounds(view: ThroneView): {
	width: number;
	height: number;
	top: number;
	bottom: number;
} {
	const points = THRONE_STRUCTURE.flatMap((mark) =>
		mark.points.map((point) => projectThrone(point, view)),
	);
	const xs = points.map((v) => v[0]),
		ys = points.map((v) => v[1]);
	return {
		width: Math.max(...xs) - Math.min(...xs),
		height: Math.max(...ys) - Math.min(...ys),
		top: Math.min(...ys),
		bottom: Math.max(...ys),
	};
}
