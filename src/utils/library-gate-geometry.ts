export type GatePoint = readonly [x: number, depth: number, height: number];
export type GateSide = "left" | "right";
export type GateInkKind = "outline" | "structure" | "detail" | "metal";
export type GateTone = "wood" | "edge" | "glass" | "stone" | "void" | "none";

// All dimensions, including the reveal and fixed fanlight, share this model.
export const GATE = {
	viewWidth: 1200, viewHeight: 900,
	halfWidth: 120, doorHeight: 300, clearance: 1.2,
	frontDepth: 12, thickness: 6, revealDepth: 20,
	springHeight: 310, maxAngle: 86,
	stepHalfWidth: 163, stepRun: 28, stepRise: 10,
} as const;

export const GATE_CAMERA = {
	distance: 650, eyeHeight: 165, scale: 1.65,
	centerX: 600, horizonY: 507.75,
} as const;

export interface GateCamera { distance: number; eyeHeight: number }

export interface GateInk {
	id: string;
	d: string;
	kind: GateInkKind;
	tone: GateTone;
}

interface LocalInk {
	id: string;
	points: GatePoint[];
	closed: boolean;
	kind: GateInkKind;
	tone: GateTone;
}

export interface GateFace {
	id: string;
	points: GatePoint[];
	normal: GatePoint;
	depth: number;
	visible: boolean;
	d: string;
	tone: GateTone;
	details: GateInk[];
}

export interface GateDoorGeometry {
	faces: GateFace[];
	hinge: GatePoint;
	corners: GatePoint[];
	hit: { left: number; top: number; width: number; height: number; polygon: string };
}

export function projectGate([x, depth, height]: GatePoint, camera: GateCamera = GATE_CAMERA): [number, number] {
	// Fixed focal length: dolly the eye, not the web page or the lens zoom.
	const k = GATE_CAMERA.scale * GATE_CAMERA.distance / (camera.distance + depth);
	return [
		GATE_CAMERA.centerX + x * k,
		GATE_CAMERA.horizonY + (camera.eyeHeight - height) * k,
	];
}

export function gatePath(points: readonly GatePoint[], close = false, camera: GateCamera = GATE_CAMERA): string {
	return points.map((point, index) => {
		const [x, y] = projectGate(point, camera);
		return (index ? "L" : "M") + x.toFixed(3) + " " + y.toFixed(3);
	}).join(" ") + (close ? " Z" : "");
}

export function gateRect(left: number, right: number, bottom: number, top: number, depth = 0): GatePoint[] {
	return [[left, depth, bottom], [right, depth, bottom], [right, depth, top], [left, depth, top]];
}

// Subdivision bounds projected midpoint error, including scaled large displays.
export function gateArc(radius: number, centerHeight: number, depth = 0, start = 0, end: number = Math.PI, camera: GateCamera = GATE_CAMERA): GatePoint[] {
	const point = (angle: number): GatePoint => [radius * Math.cos(angle), depth, centerHeight + radius * Math.sin(angle)];
	const result: GatePoint[] = [point(start)];
	const subdivide = (a: number, b: number, level: number): void => {
		const pa = projectGate(point(a), camera);
		const pb = projectGate(point(b), camera);
		const mid = (a + b) / 2;
		const pm = projectGate(point(mid), camera);
		const error = Math.hypot(pm[0] - (pa[0] + pb[0]) / 2, pm[1] - (pa[1] + pb[1]) / 2);
		if (error > 0.1 && level < 12) {
			subdivide(a, mid, level + 1);
			subdivide(mid, b, level + 1);
		} else result.push(point(b));
	};
	subdivide(start, end, 0);
	return result;
}

export function gateHinge(side: GateSide): GatePoint {
	return [(side === "left" ? -1 : 1) * (GATE.halfWidth - GATE.clearance), GATE.frontDepth + GATE.thickness, 0];
}

function rotateVector([x, y, z]: GatePoint, side: GateSide, progress: number): GatePoint {
	const angle = (side === "left" ? 1 : -1) * Math.max(0, Math.min(1, progress)) * GATE.maxAngle * Math.PI / 180;
	return [Math.cos(angle) * x - Math.sin(angle) * y, Math.sin(angle) * x + Math.cos(angle) * y, z];
}

export function rotateGatePoint(point: GatePoint, side: GateSide, progress: number): GatePoint {
	const hinge = gateHinge(side);
	const rotated = rotateVector([point[0] - hinge[0], point[1] - hinge[1], point[2]], side, progress);
	return [rotated[0] + hinge[0], rotated[1] + hinge[1], rotated[2]];
}

const LEFT = -GATE.halfWidth + GATE.clearance;
const RIGHT = -GATE.clearance;
const FRONT = GATE.frontDepth;
const BACK = FRONT + GATE.thickness;
const BOTTOM = GATE.clearance;
const TOP = GATE.doorHeight - GATE.clearance;

function makeFrontDetails(): LocalInk[] {
	const details: LocalInk[] = [];
	const add = (id: string, points: GatePoint[], closed = false, kind: GateInkKind = "detail", tone: GateTone = "none"): void => {
		details.push({ id, points, closed, kind, tone });
	};
	const rect = (id: string, inset: number, bottom: number, top: number, kind: GateInkKind = "detail", tone: GateTone = "none", depth = FRONT - 0.1): void =>
		add(id, gateRect(LEFT + inset, RIGHT - inset, bottom, top, depth), true, kind, tone);
	rect("inner-stile", 4, 7, 293, "structure");
	rect("stile-bead", 5.4, 8.4, 291.6);
	rect("window-outer", 12, 155, 282, "structure", "wood");
	rect("window-bead", 14, 157, 280);
	rect("window-glass", 18, 161, 276, "structure", "glass", FRONT + 1);
	const mid = (LEFT + RIGHT) / 2;
	for (const offset of [-1, 1]) add("mullion-v-" + offset, [[mid + offset, FRONT - .2, 161], [mid + offset, FRONT - .2, 276]], false, "structure");
	for (const z of [199, 238]) {
		for (const offset of [-.9, .9]) add("mullion-h-" + z + "-" + offset, [[LEFT + 18, FRONT - .2, z + offset], [RIGHT - 18, FRONT - .2, z + offset]], false, "structure");
	}
	// Each panel bevel is part of the door face and will be clipped with it.
	for (const [name, bottom, top] of [["lower", 26, 118], ["rail", 130, 143]] as const) {
		rect(name + "-outer", 12, bottom, top, "structure");
		rect(name + "-inner", 17, bottom + 5, top - 5, "detail", "wood", FRONT + .8);
		const outer = gateRect(LEFT + 12, RIGHT - 12, bottom, top, FRONT - .1);
		const inner = gateRect(LEFT + 17, RIGHT - 17, bottom + 5, top - 5, FRONT + .8);
		for (let i = 0; i < 4; i++) add(name + "-bevel-" + i, [outer[i], inner[i]]);
	}
	for (const x of [LEFT + 8, RIGHT - 8]) {
		for (const z of [12, 287]) {
			add("pin-" + x + "-" + z, Array.from({ length: 13 }, (_, i): GatePoint => [x + .75 * Math.cos(i * Math.PI / 6), FRONT - .3, z + .75 * Math.sin(i * Math.PI / 6)]), true);
		}
	}
	const handleX = RIGHT - 9;
	for (const z of [131, 158]) {
		add("rosette-" + z, Array.from({ length: 25 }, (_, i): GatePoint => [handleX + 3.1 * Math.cos(i * Math.PI / 12), FRONT - .5, z + 4.2 * Math.sin(i * Math.PI / 12)]), true, "metal", "wood");
		add("rosette-inner-" + z, Array.from({ length: 25 }, (_, i): GatePoint => [handleX + 2 * Math.cos(i * Math.PI / 12), FRONT - .65, z + 3.1 * Math.sin(i * Math.PI / 12)]), true);
	}
	// A bowed pull: both contours and end caps have real depth, not a flat stroke.
	const handle = (offset: number): GatePoint[] => Array.from({ length: 25 }, (_, i): GatePoint => {
		const t = i / 24;
		return [handleX + offset, FRONT - .8 - 4.2 * Math.sin(t * Math.PI), 131 + 27 * t];
	});
	add("handle-body", [...handle(-.9), ...handle(.9).reverse()], true, "metal", "edge");
	add("handle-highlight", handle(-.25), false, "detail");
	return details;
}

const FRONT_DETAILS = makeFrontDetails();

export function buildGateDoor(side: GateSide, progress: number, camera: GateCamera = GATE_CAMERA): GateDoorGeometry {
	const path = (points: readonly GatePoint[], closed = false): string => gatePath(points, closed, camera);
	const mirror = ([x, y, z]: GatePoint): GatePoint => [side === "left" ? x : -x, y, z];
	const move = (point: GatePoint): GatePoint => rotateGatePoint(mirror(point), side, progress);
	const definitions: Array<{ id: string; points: GatePoint[]; normal: GatePoint; tone: GateTone }> = [
		{ id: "front", points: gateRect(LEFT, RIGHT, BOTTOM, TOP, FRONT), normal: [0, -1, 0], tone: "wood" },
		{ id: "back", points: gateRect(LEFT, RIGHT, BOTTOM, TOP, BACK), normal: [0, 1, 0], tone: "wood" },
		{ id: "hinge", points: [[LEFT, FRONT, BOTTOM], [LEFT, BACK, BOTTOM], [LEFT, BACK, TOP], [LEFT, FRONT, TOP]], normal: [-1, 0, 0], tone: "edge" },
		{ id: "latch", points: [[RIGHT, FRONT, BOTTOM], [RIGHT, BACK, BOTTOM], [RIGHT, BACK, TOP], [RIGHT, FRONT, TOP]], normal: [1, 0, 0], tone: "edge" },
		{ id: "top", points: [[LEFT, FRONT, TOP], [RIGHT, FRONT, TOP], [RIGHT, BACK, TOP], [LEFT, BACK, TOP]], normal: [0, 0, 1], tone: "edge" },
		{ id: "bottom", points: [[LEFT, FRONT, BOTTOM], [RIGHT, FRONT, BOTTOM], [RIGHT, BACK, BOTTOM], [LEFT, BACK, BOTTOM]], normal: [0, 0, -1], tone: "edge" },
	];
	const faces: GateFace[] = definitions.map((face) => {
		const points = face.points.map(move);
		const center = points.reduce<number[]>((sum, p) => sum.map((v, i) => v + p[i] / points.length), [0, 0, 0]);
		const normal = rotateVector(mirror(face.normal), side, progress);
		const towardCamera = [-center[0], -camera.distance - center[1], camera.eyeHeight - center[2]];
		const visible = normal.reduce((sum, v, i) => sum + v * towardCamera[i], 0) > .001;
		let details: GateInk[] = [];
		if (face.id === "front") {
			details = FRONT_DETAILS.map((ink) => ({ id: ink.id, kind: ink.kind, tone: ink.tone, d: path(ink.points.map(move), ink.closed) }));
		} else if (face.id === "hinge") {
			for (const z of [43, 148, 253]) {
				const hingePoints: GatePoint[] = [[LEFT - .05, FRONT + .8, z], [LEFT - .05, BACK - .8, z], [LEFT - .05, BACK - .8, z + 13], [LEFT - .05, FRONT + .8, z + 13]];
				details.push({ id: "hinge-" + z, kind: "metal", tone: "edge", d: path(hingePoints.map(move), true) });
				for (const dz of [3, 6.5, 10]) {
					const knuckle: GatePoint[] = [[LEFT - .1, FRONT + .8, z + dz], [LEFT - .1, BACK - .8, z + dz]];
					details.push({ id: "knuckle-" + z + "-" + dz, kind: "detail", tone: "none", d: path(knuckle.map(move)) });
				}
			}
		}
		return { id: face.id, points, normal, visible, depth: center[1], d: path(points, true), tone: face.tone, details };
	}).sort((a, b) => b.depth - a.depth || a.id.localeCompare(b.id));
	const front = faces.find((face) => face.id === "front")!;
	const projected = front.points.map((point) => projectGate(point, camera));
	const xs = projected.map((p) => p[0]);
	const ys = projected.map((p) => p[1]);
	const left = Math.min(...xs), top = Math.min(...ys);
	const width = Math.max(...xs) - left, height = Math.max(...ys) - top;
	return {
		faces, hinge: gateHinge(side), corners: [...gateRect(LEFT, RIGHT, BOTTOM, TOP, FRONT), ...gateRect(LEFT, RIGHT, BOTTOM, TOP, BACK)].map(move),
		hit: { left, top, width, height, polygon: "polygon(" + projected.map(([x, y]) => ((x - left) / width * 100).toFixed(3) + "% " + ((y - top) / height * 100).toFixed(3) + "%").join(",") + ")" },
	};
}

export function gateHitStyle(geometry: GateDoorGeometry): string {
	const hit = geometry.hit;
	return "left:" + hit.left / GATE.viewWidth * 100 + "%;top:" + hit.top / GATE.viewHeight * 100 + "%;width:" + hit.width / GATE.viewWidth * 100 + "%;height:" + hit.height / GATE.viewHeight * 100 + "%;clip-path:" + hit.polygon;
}

export interface GateStep {
	top: GatePoint[];
	riser: GatePoint[];
}

export function buildGateSteps(): GateStep[] {
	return Array.from({ length: 3 }, (_, i): GateStep => {
		const back = -i * GATE.stepRun, front = -(i + 1) * GATE.stepRun;
		const top = -i * GATE.stepRise, bottom = -(i + 1) * GATE.stepRise;
		const w = GATE.stepHalfWidth;
		return {
			top: [[-w, back, top], [w, back, top], [w, front, top], [-w, front, top]],
			riser: [[-w, front, top], [w, front, top], [w, front, bottom], [-w, front, bottom]],
		};
	});
}
