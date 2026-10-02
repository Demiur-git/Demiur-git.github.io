import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import * as T from "three";
import {
	createSolidLibraryModel,
	SOLID_WINDOWS,
} from "../src/utils/library-3d-solid-model";
import {
	effectiveLibraryLighting,
	libraryViewURL,
	readLibraryView,
} from "../src/utils/library-3d-view";
import {
	ENTRY,
	ROOM_FIXTURES,
	LIBRARY_TARGETS,
	canStand,
} from "../src/utils/library-3d-layout";

test("query defaults, invalid values and replace URL preserve unrelated parameters", () => {
	assert.deepEqual(readLibraryView(""), { view: "ink", lighting: "auto" });
	assert.deepEqual(readLibraryView("?view=wrong&lighting=wrong"), {
		view: "ink",
		lighting: "auto",
	});
	assert.deepEqual(readLibraryView("?view=solid&lighting=night"), {
		view: "solid",
		lighting: "night",
	});
	assert.equal(
		libraryViewURL("https://example.com/library-3d/?q=1#here", {
			view: "solid",
			lighting: "day",
		}),
		"/library-3d/?q=1&view=solid&lighting=day#here",
	);
	assert.equal(
		libraryViewURL(
			"https://example.com/library-3d/?view=solid&lighting=night",
			{ view: "ink", lighting: "auto" },
		),
		"/library-3d/?view=ink",
	);
	assert.equal(effectiveLibraryLighting("auto", false), "day");
	assert.equal(effectiveLibraryLighting("auto", true), "night");
	assert.equal(effectiveLibraryLighting("day", true), "day");
	assert.equal(effectiveLibraryLighting("night", false), "night");
});

test("independent solid model covers all shared fixtures with finite instanced geometry", () => {
	let textureDisposals = 0;
	const source = () => ({
		sets: { wood: {}, floor: {}, plaster: {}, fabric: {} },
		failures: [],
		dispose() {
			textureDisposals++;
		},
	});
	const a = createSolidLibraryModel(source(), false),
		b = createSolidLibraryModel(source(), true);
	assert.equal(a.root.name, "solid-library");
	assert.equal(SOLID_WINDOWS.length, 5);
	assert.equal(LIBRARY_TARGETS.length, 10);
	assert.ok(canStand(ENTRY.x, ENTRY.z));
	assert.ok(ROOM_FIXTURES.some((f) => f.base === 4.4 && f.kind === "sofa"));
	const geometries = new Set<T.BufferGeometry>(),
		materials = new Set<T.Material>();
	let instances = 0,
		visibleShadows = 0;
	a.root.traverse((o) => {
		if (o instanceof T.Mesh) {
			geometries.add(o.geometry);
			for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
				materials.add(m);
				assert.ok(m instanceof T.MeshStandardMaterial);
			}
			const p = o.geometry.getAttribute("position");
			for (let i = 0; i < p.count; i++)
				assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite));
			if (o instanceof T.InstancedMesh) {
				instances += o.count;
				const m = new T.Matrix4();
				for (let i = 0; i < o.count; i++) {
					o.getMatrixAt(i, m);
					assert.ok(m.elements.every(Number.isFinite));
				}
			}
		}
		if (
			(o instanceof T.DirectionalLight || o instanceof T.SpotLight) &&
			o.castShadow &&
			o.visible
		)
			visibleShadows++;
	});
	assert.ok(instances > 5000);
	assert.ok(geometries.size < 50);
	assert.equal(visibleShadows, 1);
	a.setLighting("night");
	let nightShadows = 0;
	a.root.traverse((o) => {
		if (
			(o instanceof T.DirectionalLight || o instanceof T.SpotLight) &&
			o.castShadow &&
			o.visible
		)
			nightShadows++;
	});
	assert.equal(nightShadows, 2);
	assert.equal(a.update(new T.Vector3(0, 1.65, -11.8)), true);
	assert.equal(a.update(new T.Vector3(0, 1.65, -11.8)), false);
	assert.equal(a.update(new T.Vector3(-6, 6.05, 29.5)), true);
	a.resize(390, 844, true);
	let disposed = 0;
	for (const asset of [...geometries, ...materials])
		asset.addEventListener("dispose", () => disposed++);
	a.dispose();
	b.dispose();
	assert.equal(disposed, geometries.size + materials.size);
	assert.equal(textureDisposals, 2);
	assert.equal(a.root.children.length, 0);
});

test("local material set includes colour, GL normals, roughness and two resolutions", () => {
	const folder = new URL(
		"../public/assets/library-3d/materials/",
		import.meta.url,
	);
	const files = readdirSync(folder);
	for (const group of ["wood", "floor", "plaster", "fabric"])
		for (const channel of ["color", "normal", "roughness"])
			for (const resolution of [512, 1024]) {
				const name = `${group}-${channel}-${resolution}.webp`;
				assert.ok(files.includes(name));
				assert.equal(
					readFileSync(new URL(name, folder)).subarray(8, 12).toString(),
					"WEBP",
				);
			}
	assert.equal(
		files.some((f) => /\.zip$|\.png$/.test(f)),
		false,
	);
});

test("solid loading is lazy, cancellable, pose-preserving and does not persist settings", () => {
	const read = (p: string) =>
		readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
	const scene = read("src/utils/library-3d-scene.ts");
	assert.match(scene, /import\("\.\/library-3d-solid-model"\)/);
	assert.match(scene, /generation !== this\.generation/);
	assert.match(scene, /this\.loadAbort\?\.abort/);
	assert.match(scene, /history\.replaceState\(\s*history\.state/);
	assert.match(scene, /this\.solidRender\?\.dispose/);
	assert.match(scene, /this\.themeObserver\?\.disconnect/);
	assert.doesNotMatch(scene, /localStorage|sessionStorage|pushState/);
	assert.match(read("src/utils/library-3d-materials.ts"), /signal\.aborted/);
	assert.match(read("src/utils/library-3d-materials.ts"), /bitmap\.close\(\)/);
	assert.match(
		read("src/utils/library-3d-solid-render.ts"),
		/if \(mobile && this\.composer\)/,
	);
	assert.match(
		read("src/utils/library-3d-solid-render.ts"),
		/this\.ao\?\.noiseTexture\?\.dispose\(\)/,
	);
});
