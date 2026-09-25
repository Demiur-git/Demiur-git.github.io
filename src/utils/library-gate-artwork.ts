import {
	GATE, GATE_CAMERA, buildGateSteps, gateArc as projectArc, gatePath as projectPath, gateRect, type GateCamera,
	type GateInk, type GateInkKind, type GatePoint, type GateTone,
} from "./library-gate-geometry";

export interface GateArchitecture {
	surround: GateInk[];
	recess: GateInk[];
	fanlight: GateInk[];
	trim: GateInk[];
	steps: GateInk[];
	aperture: string;
}

export function buildGateArchitecture(camera: GateCamera = GATE_CAMERA): GateArchitecture {
	const gatePath = (points: readonly GatePoint[], closed = false): string => projectPath(points, closed, camera);
	const gateArc = (radius: number, height: number, depth = 0, start = 0, end: number = Math.PI): GatePoint[] => projectArc(radius, height, depth, start, end, camera);
	const archProfile = (radius: number, depth: number, bottom = 0): GatePoint[] =>
		[[-radius, depth, bottom], ...gateArc(radius, GATE.springHeight, depth, Math.PI, 0), [radius, depth, bottom]];
	const surround: GateInk[] = [], recess: GateInk[] = [], fanlight: GateInk[] = [], trim: GateInk[] = [], steps: GateInk[] = [];
	let nextId = 0;
	const add = (target: GateInk[], points: GatePoint[], closed = false, kind: GateInkKind = "detail", tone: GateTone = "none"): void => {
		target.push({ id: "architecture-" + nextId++, d: gatePath(points, closed), kind, tone });
	};
	const rect = (target: GateInk[], l: number, r: number, b: number, t: number, depth = 0, kind: GateInkKind = "structure", tone: GateTone = "none"): void =>
		add(target, gateRect(l, r, b, t, depth), true, kind, tone);

	// Quiet stone courses and the cropped sidelights frame the central entrance.
	for (const side of [-1, 1]) {
		const mirrored = (points: GatePoint[]): GatePoint[] => points.map(([x, y, z]) => [x * side, y, z]);
		for (const z of [32, 98, 164, 230, 330, 396, 462]) {
			add(surround, mirrored([[177, 3, z], [345, 3, z]]));
		}
		for (const [x, low, high] of [[318, 33, 97], [298, 99, 163], [318, 165, 229], [298, 331, 395], [318, 397, 461]]) {
			add(surround, mirrored([[x, 3, low], [x, 3, high]]));
		}
		const windowCenter = 236 * side;
		const windowProfile = (r: number, d: number, bottom: number): GatePoint[] => [
			[windowCenter - r, d, bottom],
			...gateArc(r, 275, d, Math.PI, 0).map(([x, y, z]): GatePoint => [x + windowCenter, y, z]),
			[windowCenter + r, d, bottom],
		];
		add(surround, windowProfile(39, 0, 63), true, "structure", "stone");
		add(surround, windowProfile(34, -1, 68), true, "structure", "glass");
		add(surround, windowProfile(31, -1.1, 71), true);
		add(surround, [[windowCenter, -1.2, 71], [windowCenter, -1.2, 306]], false, "structure");
		for (const z of [132, 202, 274]) add(surround, [[windowCenter - 31, -1.2, z], [windowCenter + 31, -1.2, z]], false, "structure");
		for (const z of [58, 61]) add(surround, [[windowCenter - 44, -2, z], [windowCenter + 44, -2, z]], false, "structure");
	}

	add(recess, archProfile(GATE.halfWidth, 0), true, "outline", "void");
	for (const x of [-GATE.halfWidth, GATE.halfWidth]) {
		add(recess, [[x, 0, 0], [x, GATE.revealDepth, 0], [x, GATE.revealDepth, GATE.springHeight], [x, 0, GATE.springHeight]], true, "structure", "edge");
	}
	add(recess, [...gateArc(120, GATE.springHeight, 0), ...gateArc(120, GATE.springHeight, GATE.revealDepth).reverse()], true, "structure", "edge");

	// Fanlight and transom are fixed to the building, never to the moving leaves.
	add(fanlight, gateArc(120, GATE.springHeight, GATE.frontDepth), true, "structure", "glass");
	for (const radius of [114, 111, 73, 22, 19]) add(fanlight, gateArc(radius, GATE.springHeight, GATE.frontDepth - .2), false, radius === 111 || radius === 22 ? "structure" : "detail");
	for (let i = 1; i < 8; i++) {
		const angle = i * Math.PI / 8;
		for (const offset of [-.65, .65]) {
			const point = (radius: number): GatePoint => [
				radius * Math.cos(angle) - offset * Math.sin(angle),
				GATE.frontDepth - .4,
				GATE.springHeight + radius * Math.sin(angle) + offset * Math.cos(angle),
			];
			add(fanlight, [point(22), point(111)], false, "detail");
		}
	}
	add(fanlight, [[-114, GATE.frontDepth - .3, GATE.springHeight], [114, GATE.frontDepth - .3, GATE.springHeight]], false, "structure");

	// A compound mask gives the frame real foreground occlusion without a panel
	// across the opening. All trim contours use the same arch center and radius.
	trim.push({
		id: "frame-solid", kind: "outline", tone: "stone",
		d: gatePath(archProfile(148, -3), true) + " " + gatePath(archProfile(120, -3), true),
	});
	for (const radius of [123, 126, 129, 139, 143, 146]) {
		add(trim, archProfile(radius, -3.1), false, radius === 129 || radius === 143 ? "structure" : "detail");
	}
	for (let i = 1; i < 12; i++) {
		const angle = i * Math.PI / 12;
		add(trim, [[130 * Math.cos(angle), -3.2, GATE.springHeight + 130 * Math.sin(angle)], [139 * Math.cos(angle), -3.2, GATE.springHeight + 139 * Math.sin(angle)]]);
	}
	for (const sign of [-1, 1]) {
		const l = sign < 0 ? -172 : 150, r = sign < 0 ? -150 : 172;
		rect(trim, l, r, 29, 294, -4, "structure", "stone");
		for (const inset of [3, 5.5]) rect(trim, l + inset, r - inset, 37, 286, -4.2, "detail");
		for (const [bottom, top, extension] of [[0, 7, 5], [7, 13, 3], [13, 29, 1], [294, 301, 3], [301, 308, 5], [308, 312, 7]]) {
			rect(trim, l - extension, r + extension, bottom, top, -5, "structure", "stone");
		}
	}
	rect(trim, -120, 120, 300, GATE.springHeight, -3, "outline", "stone");
	for (const z of [302.5, 307.5]) add(trim, [[-120, -3.2, z], [120, -3.2, z]]);
	add(trim, [[-120, -3, 0], [120, -3, 0], [120, GATE.revealDepth, 0], [-120, GATE.revealDepth, 0]], true, "structure", "stone");
	add(trim, [[-120, 0, .5], [120, 0, .5]], false, "detail");

	for (const step of buildGateSteps()) {
		add(steps, step.top, true, "structure", "stone");
		add(steps, step.riser, true, "structure", "edge");
		const a = step.riser[0], b = step.riser[1];
		add(steps, [[a[0], a[1] - .2, a[2] - 1.4], [b[0], b[1] - .2, b[2] - 1.4]]);
	}
	return { surround, recess, fanlight, trim, steps, aperture: gatePath(gateRect(-120, 120, 0, 300, -3), true) };
}
