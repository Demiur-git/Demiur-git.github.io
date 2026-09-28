export interface StarPoint {
	x: number;
	y: number;
	z: number;
	brightness: number;
	radius: number;
	phase: number;
}

export interface StarCamera {
	x: number;
	y: number;
	z: number;
	yaw: number;
	pitch: number;
}

export const STAR_CHUNK_SIZE = 80;
export const STAR_DRAW_DISTANCE = 280;

function randomForChunk(x: number, y: number, z: number): () => number {
	let seed =
		(Math.imul(x, 73856093) ^
			Math.imul(y, 19349663) ^
			Math.imul(z, 83492791) ^
			0x6a09e667) >>>
		0;
	return () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 0x100000000;
	};
}

export function generateStarChunk(
	x: number,
	y: number,
	z: number,
	count: number,
): StarPoint[] {
	const random = randomForChunk(x, y, z);
	return Array.from({ length: count }, () => ({
		x: (x + random()) * STAR_CHUNK_SIZE,
		y: (y + random()) * STAR_CHUNK_SIZE,
		z: (z + random()) * STAR_CHUNK_SIZE,
		brightness: 0.5 + random() * 0.5,
		radius: 0.55 + random() ** 3 * 1.65,
		phase: random() * Math.PI * 2,
	}));
}

export function projectStar(
	star: StarPoint,
	camera: StarCamera,
	width: number,
	height: number,
	fov = 75,
): { x: number; y: number; depth: number } | null {
	const dx = star.x - camera.x;
	const dy = star.y - camera.y;
	const dz = star.z - camera.z;
	const sinYaw = Math.sin(camera.yaw);
	const cosYaw = Math.cos(camera.yaw);
	const right = dx * cosYaw - dz * sinYaw;
	const forward = dx * sinYaw + dz * cosYaw;
	const sinPitch = Math.sin(camera.pitch);
	const cosPitch = Math.cos(camera.pitch);
	const up = dy * cosPitch - forward * sinPitch;
	const depth = dy * sinPitch + forward * cosPitch;
	if (depth <= 0.5 || depth > STAR_DRAW_DISTANCE) return null;
	const focal = height / (2 * Math.tan((fov * Math.PI) / 360));
	const x = width / 2 + (right * focal) / depth;
	const y = height / 2 - (up * focal) / depth;
	if (x < -12 || x > width + 12 || y < -12 || y > height + 12) return null;
	return { x, y, depth };
}
