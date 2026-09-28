import assert from "node:assert/strict";
import { test } from "node:test";
import {
	generateStarChunk,
	projectStar,
	STAR_CHUNK_SIZE,
} from "../src/utils/starfield-geometry";

test("each spatial chunk is deterministic and distinct", () => {
	const first = generateStarChunk(0, 0, 0, 12);
	assert.deepEqual(first, generateStarChunk(0, 0, 0, 12));
	assert.notDeepEqual(first, generateStarChunk(1, 0, 0, 12));
	assert.equal(first.length, 12);
	assert.ok(
		first.every(
			(star) =>
				star.x >= 0 &&
				star.x < STAR_CHUNK_SIZE &&
				star.y >= 0 &&
				star.y < STAR_CHUNK_SIZE &&
				star.z >= 0 &&
				star.z < STAR_CHUNK_SIZE,
		),
	);
});

test("perspective follows the camera and excludes stars behind it", () => {
	const camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
	const star = { x: 0, y: 0, z: 60, brightness: 1, radius: 1, phase: 0 };
	const center = projectStar(star, camera, 1440, 900);
	assert.ok(center);
	assert.equal(center.x, 720);
	assert.equal(center.y, 450);
	assert.equal(projectStar({ ...star, z: -60 }, camera, 1440, 900), null);
	assert.equal(projectStar(star, { ...camera, yaw: Math.PI }, 1440, 900), null);
	const shifted = projectStar(star, { ...camera, x: 12 }, 1440, 900);
	const tilted = projectStar(star, { ...camera, pitch: 0.2 }, 1440, 900);
	assert.ok(shifted);
	assert.ok(tilted);
	assert.ok(shifted.x < center.x);
	assert.ok(tilted.y > center.y);
});
