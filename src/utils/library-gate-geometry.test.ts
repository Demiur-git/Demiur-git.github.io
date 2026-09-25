import assert from "node:assert/strict";
import test from "node:test";
import {
	GATE, GATE_CAMERA, buildGateDoor, buildGateSteps, gateArc, gateHinge, projectGate, rotateGatePoint,
	type GatePoint,
} from "./library-gate-geometry.ts";

const close = (actual: number, expected: number, tolerance = 1e-8): void => {
	assert.ok(Math.abs(actual - expected) <= tolerance, actual + " should equal " + expected);
};
const distance = (a: GatePoint, b: GatePoint): number => Math.hypot(...a.map((v, i) => v - b[i]));

test("standing-eye camera keeps the facade level and depth lines at one vanishing point", () => {
	assert.ok(GATE_CAMERA.eyeHeight > GATE.doorHeight / 2 && GATE_CAMERA.eyeHeight < GATE.doorHeight * .65);
	close(projectGate([-120, 0, 150])[1], projectGate([120, 0, 150])[1]);
	close(projectGate([120, 0, 0])[0], projectGate([120, 0, 300])[0]);
	const a = projectGate([120, 0, 0]), b = projectGate([120, 100, 0]);
	close((a[0] - GATE_CAMERA.centerX) * (b[1] - GATE_CAMERA.horizonY), (b[0] - GATE_CAMERA.centerX) * (a[1] - GATE_CAMERA.horizonY));
});

test("every opening angle preserves hinge location, rigid thickness and frame clearance", () => {
	for (let degree = 0; degree <= 86; degree++) {
		for (const side of ["left", "right"] as const) {
			const progress = degree / GATE.maxAngle;
			const hinge = gateHinge(side);
			const moved = rotateGatePoint(hinge, side, progress);
			moved.forEach((v, i) => close(v, hinge[i]));
			const door = buildGateDoor(side, progress);
			close(distance(door.corners[0], door.corners[4]), GATE.thickness);
			close(distance(door.corners[0], door.corners[1]), GATE.halfWidth - 2 * GATE.clearance);
			for (const [x, y, z] of door.corners) {
				assert.ok(Math.abs(x) < GATE.halfWidth, "door must remain inside the jambs at " + degree);
				assert.ok(side === "left" ? x < 0 : x > 0, "leaves must never intersect at " + degree);
				assert.ok(y >= GATE.frontDepth - 1e-8, "door must open inwards");
				assert.ok(z > 0 && z < GATE.doorHeight, "door must clear the lintel and threshold");
			}
		}
	}
});

test("projected leaves remain exact mirrors through the six visual inspection angles", () => {
	for (const degree of [0, 15, 30, 45, 60, 86]) {
		const left = buildGateDoor("left", degree / 86), right = buildGateDoor("right", degree / 86);
		for (let i = 0; i < left.corners.length; i++) {
			const l = projectGate(left.corners[i]), r = projectGate(right.corners[i]);
			close(l[0] + r[0], GATE_CAMERA.centerX * 2);
			close(l[1], r[1]);
		}
		for (const geometry of [left, right]) {
			assert.ok(geometry.hit.width > 0 && geometry.hit.height > 0);
			for (const face of geometry.faces) assert.ok(!/NaN|Infinity/.test(face.d));
			assert.equal(geometry.faces.find((f) => f.id === "back")?.visible, false);
			assert.equal(geometry.faces.find((f) => f.id === "top")?.visible, false, "an observer below the lintel cannot see the top face");
		}
	}
	assert.equal(buildGateDoor("left", 45 / 86).faces.find((f) => f.id === "hinge")?.visible, true);
	assert.equal(buildGateDoor("left", 45 / 86).faces.find((f) => f.id === "latch")?.visible, false, "the far latch edge must not show through the front");
});

test("three rectangular steps have equal width and rise and meet without gaps", () => {
	const steps = buildGateSteps();
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		close(step.top[1][0] - step.top[0][0], GATE.stepHalfWidth * 2);
		close(step.top[2][0] - step.top[3][0], GATE.stepHalfWidth * 2);
		close(step.riser[0][2] - step.riser[3][2], GATE.stepRise);
		if (i + 1 < steps.length) {
			assert.deepEqual(step.riser[3], steps[i + 1].top[0]);
			assert.deepEqual(step.riser[2], steps[i + 1].top[1]);
		}
	}
});

test("fanlight arcs stay within a tenth of an artboard pixel", () => {
	const radius = 148, center = GATE.springHeight;
	const arc = gateArc(radius, center, -3);
	for (let i = 1; i < arc.length; i++) {
		const a = arc[i - 1], b = arc[i];
		const angle = (Math.atan2(a[2] - center, a[0]) + Math.atan2(b[2] - center, b[0])) / 2;
		const midpoint = projectGate([radius * Math.cos(angle), -3, center + radius * Math.sin(angle)]);
		const pa = projectGate(a), pb = projectGate(b);
		assert.ok(Math.hypot(midpoint[0] - (pa[0] + pb[0]) / 2, midpoint[1] - (pa[1] + pb[1]) / 2) <= .101);
	}
});

test("dolly cameras preserve symmetry, finite paths and rigid hinges", () => {
	for (const distance of [980, 800, 650, 400, 200, 120]) {
		const camera = { distance, eyeHeight: GATE_CAMERA.eyeHeight };
		const a = projectGate([-120, 12, 165], camera), b = projectGate([120, 12, 165], camera);
		close(a[0] + b[0], 1200);
		close(a[1], b[1]);
		for (const side of ["left", "right"] as const) {
			const door = buildGateDoor(side, distance < 650 ? 1 : 0, camera);
			assert.deepEqual(door.hinge, gateHinge(side));
			for (const face of door.faces) assert.ok(!/NaN|Infinity/.test(face.d));
		}
		for (const step of buildGateSteps()) for (const p of [...step.top, ...step.riser]) assert.ok(p[1] + distance > 0);
	}
});
