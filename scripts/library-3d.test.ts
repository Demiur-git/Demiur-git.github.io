import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	AISLE_SHELVES,
	canStand,
	CHAIRS,
	COLLIDERS,
	ENTRY,
	LIBRARY,
	moveVisitor,
	TABLES,
	WALLPAPER_VIEW,
	ANNEX_WALLS,
	LIBRARY_TARGETS,
	nearbyLibraryTarget,
	hasLibrarySight,
	ROOMS,
	roomAt,
	UPPER,
	supportHeight,
	ROOM_FIXTURES,
	fixturePoint,
} from "../src/utils/library-3d-layout";
import {
	advanceRunningReminder,
	freshRunningReminder,
} from "../src/utils/library-3d-running";
import * as T from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { createLibraryModel } from "../src/utils/library-3d-model";

test("intentional ink layers are deterministic, smooth, finite and fully disposable", () => {
	const a = createLibraryModel(),
		b = createLibraryModel();
	assert.deepEqual(a.segments, b.segments);
	assert.ok(a.segments.every((n) => n > 100));
	assert.equal(a.lineMaterials.length, 3);
	assert.equal(a.root.name, "library-ink-interior");
	let masks = 0,
		lines = 0,
		disposed = 0;
	const geometries = new Set<T.BufferGeometry>(),
		materials = new Set<T.Material>();
	a.root.traverse((o) => {
		if (o instanceof T.Mesh) {
			geometries.add(o.geometry);
			if (o instanceof LineSegments2) {
				lines++;
			} else {
				masks++;
				assert.ok(o instanceof T.InstancedMesh);
				assert.ok(o.material instanceof T.MeshBasicMaterial);
				assert.equal(o.material.color.getHex(), 0);
			}
			if (!Array.isArray(o.material)) materials.add(o.material);
			for (const name of ["position", "instanceStart", "instanceEnd"]) {
				const attr:
					| T.BufferAttribute
					| T.InterleavedBufferAttribute
					| undefined = o.geometry.getAttribute(name);
				if (attr)
					for (let i = 0; i < attr.count; i++) {
						assert.ok(Number.isFinite(attr.getX(i)));
						assert.ok(Number.isFinite(attr.getY(i)));
						assert.ok(Number.isFinite(attr.getZ(i)));
					}
			}
		}
	});
	assert.equal(lines, 3);
	assert.ok(masks < 50);
	a.resize(390, 844, true);
	for (const m of a.lineMaterials) {
		assert.equal(m.resolution.x, 390);
		assert.equal(m.resolution.y, 844);
		assert.equal(m.depthWrite, false);
		assert.match(m.fragmentShader, /smoothstep/);
		assert.ok(m.linewidth > 0.4);
	}
	for (const r of [...geometries, ...materials])
		r.addEventListener("dispose", () => disposed++);
	a.dispose();
	assert.equal(a.root.children.length, 0);
	assert.equal(disposed, geometries.size + materials.size);
	b.dispose();
});

test("entrance, wallpaper viewpoint and passage connections are walkable", () => {
	assert.ok(canStand(ENTRY.x, ENTRY.z));
	assert.ok(canStand(WALLPAPER_VIEW.x, WALLPAPER_VIEW.z));
	for (const x of [0, 4.6, 8.1])
		for (let z = -8; z <= 10; z += 0.5)
			assert.ok(canStand(x, z), `blocked passage ${x}/${z}`);
	assert.equal(TABLES.length, 2);
	assert.equal(AISLE_SHELVES.length, 2);
	assert.equal(CHAIRS.length, 12);
});
test("furniture, walls and invalid coordinates are solid", () => {
	for (const b of COLLIDERS)
		assert.equal(canStand(b.x, b.z, b.base || 0), false);
	for (const point of [
		[10, 0],
		[-10, 0],
		[0, 42],
		[0, -14],
		[NaN, 0],
		[0, Infinity],
	])
		assert.equal(canStand(point[0], point[1]), false);
});

test("four rooms are reachable through the corridor and open doors at run speed", () => {
	const go = (v: typeof ENTRY, x: number, z: number) => {
		let steps = 0;
		while (Math.hypot(x - v.x, z - v.z) > 0.12 && steps++ < 800) {
			v = { ...v, yaw: Math.atan2(x - v.x, z - v.z) };
			const next = moveVisitor(v, 0, 1, 0.02, LIBRARY.runSpeed);
			assert.ok(canStand(next.x, next.z, next.elevation));
			assert.ok(
				Math.hypot(next.x - v.x, next.z - v.z) > 0.001,
				"blocked waypoint",
			);
			v = next;
		}
		assert.ok(steps < 800);
		return v;
	};
	for (const r of ROOMS) {
		let v = { ...ENTRY };
		if (r.base) {
			for (const [x, z] of [
				[0, 34.3],
				[1, 34.3],
				[1, 40.55],
				[-1, 40.55],
				[-1, 34.3],
				[0, 34.3],
			])
				v = go(v, x, z);
			assert.ok(Math.abs((v.elevation || 0) - UPPER) < 0.01);
		}
		v = go(v, 0, r.z);
		v = go(v, Math.sign(r.x) * 2.6, r.z);
		assert.equal(roomAt(v.x, v.z, v.elevation), r.name);
		v = go(v, 0, r.z);
		if (r.base) {
			for (const [x, z] of [
				[0, 34.3],
				[-1, 34.3],
				[-1, 40.55],
				[1, 40.55],
				[1, 34.3],
				[0, 34.3],
			])
				v = go(v, x, z);
		}
		v = go(v, 0, ENTRY.z);
		assert.equal(roomAt(v.x, v.z), "大厅");
		assert.equal(canStand(r.doorX, r.z, r.base || 0), true);
		assert.equal(canStand(r.doorX, r.z - 1.1, r.base || 0), false);
	}
});
test("functional targets require range, facing, enabled pages and line of sight", () => {
	const all = new Set(LIBRARY_TARGETS.map((t) => t.id));
	for (const t of LIBRARY_TARGETS) {
		const candidates = Array.from({ length: 36 }, (_, i) => {
			const a = (i * Math.PI) / 18,
				x = t.x + Math.sin(a) * 1.2,
				z = t.z + Math.cos(a) * 1.2;
			return {
				x,
				z,
				yaw: Math.atan2(t.x - x, t.z - z),
				pitch: Math.atan2(t.y - t.base - LIBRARY.eye, 1.2),
				elevation: t.base,
			};
		});
		const v = candidates.find(
			(v) =>
				canStand(v.x, v.z, v.elevation) &&
				nearbyLibraryTarget(v, all)?.id === t.id,
		);
		assert.ok(v, `no usable spot for ${t.id}`);
		assert.equal(nearbyLibraryTarget(v, all)?.id, t.id);
		assert.equal(
			nearbyLibraryTarget({ ...v, yaw: v.yaw + Math.PI }, all),
			undefined,
		);
		assert.equal(nearbyLibraryTarget(v, new Set()), undefined);
		assert.equal(
			nearbyLibraryTarget({ ...v, elevation: t.base === 0 ? UPPER : 0 }, all)
				?.id === t.id,
			false,
		);
	}
	assert.equal(
		hasLibrarySight({ x: 0, z: 20 }, { x: -3.11, z: 20 }, ANNEX_WALLS),
		true,
	);
	assert.equal(
		hasLibrarySight({ x: 0, z: 18 }, { x: -3.11, z: 18 }, ANNEX_WALLS),
		false,
	);
	assert.equal(
		hasLibrarySight({ x: -3, z: 20 }, { x: 3, z: 22 }, ANNEX_WALLS),
		false,
	);
});
test("stairs are continuous, traversable both ways, bounded and never switch levels remotely", () => {
	let v = { ...ENTRY, x: 1, z: 35.1 };
	let distance = 0;
	for (let i = 0; i < 60; i++) {
		const next = moveVisitor(v, 0, 1, 1 / 60);
		assert.ok(Math.abs((next.elevation || 0) - (v.elevation || 0)) < 0.021);
		distance += Math.hypot(
			next.x - v.x,
			next.z - v.z,
			(next.elevation || 0) - (v.elevation || 0),
		);
		v = next;
	}
	assert.ok(Math.abs(distance - LIBRARY.speed) < 0.002);
	assert.ok((v.elevation || 0) > 1);
	assert.equal(supportHeight(0, 20, 2.2), undefined);
	assert.equal(canStand(0, 10.85, UPPER), false, "balcony front guard");
	assert.equal(canStand(0, 9, UPPER), false, "no floor above main hall");
	assert.equal(
		hasLibrarySight({ x: 0, z: 20, y: 1.65 }, { x: 0, z: 20, y: 6.05 }),
		false,
		"floor blocks vertical rays",
	);
});
test("furniture anchors use the same fixed rotation and elevation as drawing and collisions", () => {
	assert.equal(LIBRARY_TARGETS.length, 10);
	assert.equal(ROOM_FIXTURES.filter((f) => f.kind === "catalogue").length, 1);
	for (const f of ROOM_FIXTURES) {
		const p = fixturePoint(f, 0.1, f.height, 0.2);
		assert.ok([p.x, p.y, p.z].every(Number.isFinite));
		assert.equal(p.y, (f.base || 0) + f.height);
		assert.equal(canStand(f.x, f.z, f.base || 0), false);
	}
	assert.ok(CHAIRS.some((c) => c.yaw));
});
test("running is normalized, collision-safe and cannot tunnel through annex walls", () => {
	for (const diagonal of [0, 1]) {
		let v = { ...ENTRY };
		for (let i = 0; i < 60; i++)
			v = moveVisitor(v, diagonal, 1, 1 / 60, LIBRARY.runSpeed);
		assert.ok(Math.abs(Math.hypot(v.x - ENTRY.x, v.z - ENTRY.z) - 4.55) < 1e-8);
	}
	let v = { ...ENTRY, x: 0, z: 18, yaw: -Math.PI / 2 };
	for (let i = 0; i < 200; i++) {
		v = moveVisitor(v, 0, 1, 0.1, LIBRARY.runSpeed);
		assert.ok(canStand(v.x, v.z));
	}
	assert.ok(v.x > -1.13);
});
test("Aya only reminds after actual running, with five seconds visible and a cooldown", () => {
	let s = freshRunningReminder();
	for (let i = 0; i < 23; i++) s = advanceRunningReminder(s, 0.5, true);
	assert.equal(s.visible, 0);
	s = advanceRunningReminder(s, 0.5, true);
	assert.equal(s.visible, 5);
	assert.equal(s.cooldown, 45);
	for (let i = 0; i < 10; i++) s = advanceRunningReminder(s, 0.5, true);
	assert.equal(s.visible, 0);
	assert.equal(s.cooldown, 40);
	for (let i = 0; i < 24; i++) s = advanceRunningReminder(s, 0.5, true);
	assert.equal(s.visible, 0);
	let stopped = freshRunningReminder();
	for (let i = 0; i < 30; i++)
		stopped = advanceRunningReminder(stopped, 0.5, false);
	assert.equal(stopped.visible, 0);
	assert.equal(stopped.running, 0);
	let interrupted = { ...freshRunningReminder(), running: 11 };
	for (let i = 0; i < 4; i++)
		interrupted = advanceRunningReminder(interrupted, 0.5, false);
	assert.equal(interrupted.running, 0);
});
test("equal-time movement and diagonals have equal speed", () => {
	const walk = (fps: number, side = 0) => {
		let v = { ...ENTRY };
		for (let i = 0; i < fps; i++) v = moveVisitor(v, side, 1, 1 / fps);
		return Math.hypot(v.x - ENTRY.x, v.z - ENTRY.z);
	};
	for (const fps of [15, 30, 60, 144]) {
		assert.ok(Math.abs(walk(fps) - LIBRARY.speed) < 1e-8);
		assert.ok(Math.abs(walk(fps, 1) - LIBRARY.speed) < 1e-8);
	}
});
test("collision substeps prevent tunnelling and allow wall sliding", () => {
	let v = { ...ENTRY, x: 8.6, z: -8 };
	for (let i = 0; i < 100; i++) {
		v = moveVisitor(v, -1, 1, 0.1);
		assert.ok(canStand(v.x, v.z));
	}
	assert.ok(v.z > -5);
	assert.ok(v.x < 8.8);
	const spike = moveVisitor(ENTRY, 0, 1, 100);
	assert.ok(spike.z - ENTRY.z <= 0.261);
});
test("hidden integration, lazy renderer and disposal remain explicit", () => {
	const read = (path: string) =>
		readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
	assert.match(
		read("src/utils/easter-egg-session.ts"),
		/url\("\/library-3d\/"\)/,
	);
	assert.match(read("astro.config.mjs"), /stillness\|library-3d/);
	assert.match(read("src/pages/library-3d.astro"), /noindex, nofollow/);
	assert.match(
		read("src/components/features/Library3DScene.astro"),
		/await import\("@\/utils\/library-3d-scene"\)/,
	);
	const scene = read("src/utils/library-3d-scene.ts");
	assert.match(scene, /this\.renderer\?\.dispose/);
	assert.match(scene, /webglcontextlost/);
	assert.match(scene, /webglcontextrestored/);
	assert.doesNotMatch(scene, /localStorage|sessionStorage|requestPointerLock/);
	const model = read("src/utils/library-3d-model.ts");
	assert.match(model, /InstancedMesh/);
	assert.match(model, /LineSegmentsGeometry/);
	assert.doesNotMatch(
		model,
		/EdgesGeometry|WireframeGeometry|CanvasTexture|MeshStandardMaterial|PointLight/,
	);
	assert.match(model, /mask\.dispose\(\)/);
	assert.doesNotMatch(model, /fetch\(|TextureLoader|\.glb|https:\/\//);
	assert.doesNotMatch(
		scene,
		/OrbitControls|exteriorDistance|applyTheme/,
	);
	assert.doesNotMatch(
		read("src/components/features/Library3DScene.astro"),
		/data-library-enter|data-library-outside|library3d-fade/,
	);
	assert.match(read("src/pages/library-3d.astro"), /background:#000/);
});

test("home visit window is an accessible static SVG link without a renderer or new island", () => {
	const read = (path: string) =>
		readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
	const entry = read("src/components/features/LibraryVisitWindow.astro");
	assert.match(entry, /href=\{url\("\/library-3d\/\?view=ink"\)\}/);
	assert.match(entry, /href=\{url\("\/library-3d\/\?view=solid"\)\}/);
	assert.match(entry, /aria-labelledby="library-visit-title"/);
	assert.match(entry, /<svg viewBox="0 0 480 300"/);
	assert.match(entry, /focusable="false"/);
	assert.match(entry, /图书馆阅览/);
	assert.match(entry, /线稿预览/);
	assert.match(entry, /实体阅览/);
	assert.doesNotMatch(entry, /<script|<canvas|<use\b|<image\b|three|client:|https:\/\//);
	const home = read("src/components/layout/HomeIntro.astro");
	assert.match(home, /<MusicMiniPlayer[^>]*client:load[^>]*\/>\s*<LibraryVisitWindow\s*\/>/);
});
