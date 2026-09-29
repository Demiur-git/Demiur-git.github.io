import assert from "node:assert/strict";
import test from "node:test";
import { echoAperturePath } from "../src/utils/echo-aperture";

function inside(path: string, x: number, y: number): boolean {
	const points = [...path.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(
		([, px, py]) => [Number(px), Number(py)] as const,
	);
	let contained = false;
	for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
		const [x1, y1] = points[index];
		const [x2, y2] = points[previous];
		if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1)
			contained = !contained;
	}
	return contained;
}

for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
	test(`裂缝展开覆盖 ${width}×${height} 视口`, () => {
		const frame = {
			width,
			height,
			centerX: width / 2,
			centerY: height / 2,
			seamHalfHeight: 80,
			preview: 1,
			opening: 0.9,
		};
		assert.equal(echoAperturePath({ ...frame, preview: 0, opening: 0 }), "");
		const small = echoAperturePath({ ...frame, opening: 0 });
		assert.ok(small.startsWith("M") && small.endsWith(" Z"));
		assert.equal(inside(small, width / 2, height / 2), true);
		assert.equal(inside(small, 1, 1), false);
		const large = echoAperturePath(frame);
		for (const x of [1, width - 1])
			for (const y of [1, height - 1])
				assert.equal(inside(large, x, y), true, `corner ${x}, ${y}`);
		assert.equal(
			echoAperturePath({ ...frame, opening: 1 }),
			`M0 0 H${width.toFixed(2)} V${height.toFixed(2)} H0 Z`,
		);
	});
}
