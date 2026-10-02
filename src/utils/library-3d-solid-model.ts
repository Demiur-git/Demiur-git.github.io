import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
	AISLE_SHELVES,
	ANNEX_WALLS,
	CHAIRS,
	FLOOR_SLABS,
	GUARDS,
	PLANTS,
	ROOM_FIXTURES,
	ROOMS,
	STAIRS,
	SURFACES,
	TABLES,
	UPPER,
	UPPER_WALLS,
	WALL_SHELVES,
	fixturePoint,
	type FloorBox,
} from "./library-3d-layout";
import type { LibraryDrawing } from "./library-3d-view";
import type {
	LibraryTextures,
	LibraryTextureSet,
} from "./library-3d-materials";

export const SOLID_WINDOWS: readonly number[] = [-10.75, -5.25, 0.25, 5.75, 11];
export interface SolidLibraryDrawing extends LibraryDrawing {
	setLighting(lighting: "day" | "night"): void;
	update(position: T.Vector3): boolean;
}

/** Independent furniture/architecture builder. All dimensions are in shared metres. */
export function createSolidLibraryModel(
	textures: LibraryTextures,
	mobile: boolean,
): SolidLibraryDrawing {
	const root = new T.Group();
	root.name = "solid-library";
	const geometry = new Set<T.BufferGeometry>();
	const materials = new Set<T.Material>();
	const cache = new Map<string, T.BufferGeometry>();
	const batches = new Map<
		string,
		{
			geometry: T.BufferGeometry;
			material: T.Material;
			matrices: T.Matrix4[];
			shadow: boolean;
			detail: boolean;
		}
	>();
	const microDetails: T.InstancedMesh[] = [];
	const bookSpineMeshes: T.InstancedMesh[] = [];
	const lampPoints: T.Vector3[] = [];
	const lampGlow: T.MeshStandardMaterial[] = [];
	let frame: FloorBox = { x: 0, z: 0, width: 0, depth: 0 };
	let seed = 61703;
	const random = () => {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 4294967296;
	};
	const material = (
		value: T.MeshStandardMaterialParameters,
		maps?: LibraryTextureSet,
	) => {
		const m = new T.MeshStandardMaterial({
			...value,
			map: maps?.color || null,
			normalMap: maps?.normal || null,
			roughnessMap: maps?.roughness || null,
		});
		if (maps?.normal) m.normalScale.set(0.28, 0.28);
		if (maps?.color) {
			// World-scaled triplanar colour/roughness: table tops, legs and trim share
			// real-sized grain instead of stretching one image across every part.
			m.onBeforeCompile = (shader) => {
				shader.vertexShader = shader.vertexShader.replace(
					"#include <common>",
					"#include <common>\nvarying vec3 vLibraryWorld; varying vec3 vLibraryNormal;",
				);
				shader.vertexShader = shader.vertexShader.replace(
					"#include <worldpos_vertex>",
					`#include <worldpos_vertex>
				vec4 libraryWorld = vec4(transformed, 1.0); vec3 libraryNormal = objectNormal;
				#ifdef USE_INSTANCING
				 libraryWorld = instanceMatrix * libraryWorld; libraryNormal = mat3(instanceMatrix) * libraryNormal;
				#endif
				vLibraryWorld = (modelMatrix * libraryWorld).xyz; vLibraryNormal = normalize(mat3(modelMatrix) * libraryNormal);`,
				);
				const scale =
					maps === textures.sets.wood
						? 1.25
						: maps === textures.sets.floor
							? 0.5
							: 1;
				shader.fragmentShader = shader.fragmentShader.replace(
					"#include <common>",
					`#include <common>
				varying vec3 vLibraryWorld; varying vec3 vLibraryNormal;
				vec4 librarySample(sampler2D sourceMap) { vec3 w=pow(abs(vLibraryNormal),vec3(8.0)); w/=max(w.x+w.y+w.z,0.0001); vec3 p=vLibraryWorld*${scale.toFixed(2)}; return texture2D(sourceMap,p.zy)*w.x+texture2D(sourceMap,p.xz)*w.y+texture2D(sourceMap,p.xy)*w.z; }`,
				);
				shader.fragmentShader = shader.fragmentShader.replace(
					"#include <map_fragment>",
					T.ShaderChunk.map_fragment.replace(
						"texture2D( map, vMapUv )",
						"librarySample(map)",
					),
				);
				shader.fragmentShader = shader.fragmentShader.replace(
					"#include <roughnessmap_fragment>",
					T.ShaderChunk.roughnessmap_fragment.replace(
						"texture2D( roughnessMap, vRoughnessMapUv )",
						"librarySample(roughnessMap)",
					) +
						`\nroughnessFactor = max(roughnessFactor, ${maps === textures.sets.wood ? "0.58" : maps === textures.sets.floor ? "0.65" : "0.85"});`,
				);
			};
			m.customProgramCacheKey = () =>
				`library-world-${maps === textures.sets.wood ? "wood" : maps === textures.sets.floor ? "floor" : "other"}`;
		}
		materials.add(m);
		return m;
	};
	const wood = material(
		{ color: 0x71503a, roughness: 0.72 },
		textures.sets.wood,
	);
	const trim = material(
		{ color: 0x513727, roughness: 0.66 },
		textures.sets.wood,
	);
	const floor = material(
		{ color: 0xbda47e, roughness: 0.82 },
		textures.sets.floor,
	);
	const plaster = material(
		{ color: 0xe1dbca, roughness: 0.93 },
		textures.sets.plaster,
	);
	const fabric = material(
		{ color: 0x85947b, roughness: 0.95 },
		textures.sets.fabric,
	);
	const brass = material({ color: 0xafa16b, metalness: 0.74, roughness: 0.36 });
	const darkMetal = material({
		color: 0x252b24,
		metalness: 0.65,
		roughness: 0.5,
	});
	const green = material({ color: 0x285744, roughness: 0.28, metalness: 0.12 });
	const ivory = material({ color: 0xe7dfc8, roughness: 0.8 });
	const paper = material({ color: 0xe4d9bf, roughness: 0.97 });
	const pageEdges = material({ color: 0xc7b99c, roughness: 1 });
	const terracotta = material({ color: 0x815f47, roughness: 0.87 });
	const leafMat = material({
		color: 0x456341,
		roughness: 0.8,
		side: T.DoubleSide,
	});
	const leafVein = material({ color: 0x627254, roughness: 0.83 });
	const glass = material({
		color: 0xa8c5ba,
		transparent: true,
		opacity: 0.13,
		roughness: 0.13,
		metalness: 0.18,
		depthWrite: false,
		side: T.DoubleSide,
	});
	const windowGlass = material({
		color: 0xaacbd3,
		transparent: true,
		opacity: 0.1,
		roughness: 0.15,
		depthWrite: false,
		side: T.DoubleSide,
	});
	const sky = material({
		color: 0xbad3d5,
		emissive: 0xbad3d5,
		emissiveIntensity: 0.5,
		roughness: 1,
		side: T.DoubleSide,
	});
	const bulb = material({
		color: 0xffecc0,
		emissive: 0xffd795,
		emissiveIntensity: 1.4,
		roughness: 0.45,
	});
	lampGlow.push(bulb);
	const bookColors = [
		0x556350, 0x674847, 0x3f535b, 0x8f775c, 0x6c6453, 0x484548, 0x76806b,
		0x8d694c,
	].map((color) => material({ color, roughness: 0.87 }));

	function shape(key: string, make: () => T.BufferGeometry): T.BufferGeometry {
		let result = cache.get(key);
		if (!result) {
			result = make();
			geometry.add(result);
			cache.set(key, result);
		}
		return result;
	}
	const cube = shape("cube", () => new T.BoxGeometry(1, 1, 1));
	const bookSpineGeometry = shape(
		"book-spine",
		() => new RoundedBoxGeometry(1, 1, 1, 1, 0.025),
	);
	const rounded = shape(
		"rounded",
		() => new RoundedBoxGeometry(1, 1, 1, 1, 0.035),
	);
	const sphere = shape(
		"sphere",
		() => new T.SphereGeometry(1, mobile ? 10 : 16, 8),
	);
	const cylinder = shape(
		"cylinder",
		() => new T.CylinderGeometry(1, 1, 1, mobile ? 10 : 16),
	);
	const matrix = new T.Matrix4(),
		orientation = new T.Quaternion();
	function instance(
		g: T.BufferGeometry,
		m: T.Material,
		x: number,
		y: number,
		z: number,
		scale: [number, number, number],
		rotation?: T.Euler,
		detail = false,
		shadow = true,
	) {
		const p = fixturePoint(frame, x, y, z);
		orientation.setFromEuler(rotation || new T.Euler());
		orientation.premultiply(
			new T.Quaternion().setFromAxisAngle(
				new T.Vector3(0, 1, 0),
				frame.yaw || 0,
			),
		);
		matrix.compose(
			new T.Vector3(p.x, p.y, p.z),
			orientation,
			new T.Vector3(...scale),
		);
		const bucket = detail
			? `${Math.floor(p.x / 6)}:${Math.floor(p.y / 4)}:${Math.floor(p.z / 6)}`
			: "";
		const key = `${g.uuid}:${m.uuid}:${detail}:${shadow}:${bucket}`;
		let b = batches.get(key);
		if (!b) {
			b = { geometry: g, material: m, matrices: [], detail, shadow };
			batches.set(key, b);
		}
		b.matrices.push(matrix.clone());
	}
	function box(
		x: number,
		y: number,
		z: number,
		w: number,
		h: number,
		d: number,
		m = wood,
		bevel = true,
		rotation?: T.Euler,
		detail = false,
	) {
		instance(
			bevel ? rounded : cube,
			m,
			x,
			y,
			z,
			[w, h, d],
			rotation,
			detail,
			m !== glass && m !== windowGlass && m !== sky && m !== bulb,
		);
	}
	function ball(x: number, y: number, z: number, radius: number, m = brass) {
		instance(sphere, m, x, y, z, [radius, radius, radius]);
	}
	function rod(
		a: T.Vector3,
		b: T.Vector3,
		radius: number,
		m = brass,
		detail = false,
	) {
		const centre = a.clone().add(b).multiplyScalar(0.5);
		const q = new T.Quaternion().setFromUnitVectors(
			new T.Vector3(0, 1, 0),
			b.clone().sub(a).normalize(),
		);
		instance(
			cylinder,
			m,
			centre.x,
			centre.y,
			centre.z,
			[radius, a.distanceTo(b), radius],
			new T.Euler().setFromQuaternion(q),
			detail,
		);
	}
	function lathe(
		key: string,
		points: number[][],
		x: number,
		y: number,
		z: number,
		m: T.Material,
		rotation?: T.Euler,
	) {
		const g = shape(
			key,
			() =>
				new T.LatheGeometry(
					points.map((p) => new T.Vector2(p[0], p[1])),
					mobile ? 18 : 28,
				),
		);
		instance(g, m, x, y, z, [1, 1, 1], rotation);
	}
	function curve(
		key: string,
		points: number[][],
		radius: number,
		m: T.Material,
		detail = false,
	) {
		const g = shape(
			key,
			() =>
				new T.TubeGeometry(
					new T.CatmullRomCurve3(
						points.map(
							(p) => new T.Vector3(...(p as [number, number, number])),
						),
					),
					14,
					radius,
					6,
					false,
				),
		);
		instance(g, m, 0, 0, 0, [1, 1, 1], undefined, detail);
	}
	function inFrame(f: FloorBox, draw: () => void) {
		const previous = frame;
		frame = f;
		draw();
		frame = previous;
	}
	function wall(f: FloorBox) {
		inFrame(f, () => {
			const h = f.height || 4.4;
			box(0, h / 2, 0, f.width, h, f.depth, plaster, false);
			// Panelled dado, two mouldings and a substantial skirting line.
			box(0, 0.61, 0, f.width + 0.025, 1.2, f.depth + 0.028, wood, false);
			for (const [y, height] of [
				[0.1, 0.18],
				[1.21, 0.095],
				[1.3, 0.03],
				[h - 0.12, 0.14],
			])
				box(0, y, 0, f.width + 0.08, height, f.depth + 0.08, trim);
		});
	}
	// Floors use metres in UV coordinates, rather than stretching one tile over a hall.
	const floorBox = (
		x: number,
		y: number,
		z: number,
		w: number,
		h: number,
		d: number,
	) => {
		const g = shape(`floor:${w}:${h}:${d}`, () => {
			const result = new T.BoxGeometry(w, h, d);
			const uv = result.getAttribute("uv"),
				normal = result.getAttribute("normal");
			for (let i = 0; i < uv.count; i++) {
				const ny = Math.abs(normal.getY(i)) > 0.9;
				uv.setXY(
					i,
					uv.getX(i) * (ny ? w / 2 : w),
					uv.getY(i) * (ny ? d / 2 : h),
				);
			}
			return result;
		});
		instance(g, floor, x, y, z, [1, 1, 1]);
	};
	floorBox(0, -0.17, 0, 20.6, 0.3, 28.6);
	floorBox(0, -0.17, 23.75, 19.5, 0.3, 19.5);
	for (const f of FLOOR_SLABS)
		floorBox(
			f.x,
			(f.base || 0) + (f.height || 0.18) / 2,
			f.z,
			f.width,
			f.height || 0.18,
			f.depth,
		);
	for (const f of SURFACES.filter((f) => !f.rise && f.z > 33.5 && f.base === 0))
		floorBox(f.x, -0.085, f.z, f.width, 0.17, f.depth);
	wall({ x: 10, z: 0, width: 0.5, depth: 28, height: 8 });
	wall({ x: 0, z: -14, width: 20, depth: 0.5, height: 8 });
	for (const f of [...ANNEX_WALLS, ...UPPER_WALLS]) wall(f);
	for (const f of GUARDS.filter((f) => !f.base)) wall(f);
	box(0, 8.13, 0, 20.5, 0.25, 28.5, plaster, false);
	box(0, 7.98, 23.75, 19.5, 0.16, 19.5, plaster, false);
	for (const x of [-5.6, 5.6])
		box(x, UPPER - 0.14, 23.75, 8.2, 0.12, 19.5, plaster, false);
	for (const z of [-9, -2, 5, 12]) {
		box(0, 7.7, z, 19.6, 0.3, 0.3, trim);
		box(0, 7.52, z, 19.6, 0.04, 0.42, wood);
	}
	// A single perforated wall, with actual arched holes. Boundary collision stays solid.
	const outsideWall = new T.Shape();
	outsideWall.moveTo(-14, 0);
	outsideWall.lineTo(14, 0);
	outsideWall.lineTo(14, 8);
	outsideWall.lineTo(-14, 8);
	outsideWall.closePath();
	function archOutline(z: number): T.Path {
		const p = new T.Path();
		p.moveTo(z - 2.28, 1.3);
		p.lineTo(z + 2.28, 1.3);
		p.lineTo(z + 2.28, 4.5);
		p.absarc(z, 4.5, 2.28, 0, Math.PI, false);
		p.closePath();
		return p;
	}
	for (const z of SOLID_WINDOWS) outsideWall.holes.push(archOutline(z));
	const wallGeometry = new T.ExtrudeGeometry(outsideWall, {
		depth: 0.4,
		bevelEnabled: false,
		curveSegments: 28,
	});
	geometry.add(wallGeometry);
	const wallMesh = new T.Mesh(wallGeometry, plaster);
	wallMesh.rotation.y = -Math.PI / 2;
	wallMesh.position.x = -9.8;
	wallMesh.castShadow = wallMesh.receiveShadow = true;
	root.add(wallMesh);
	for (const z of SOLID_WINDOWS) {
		const paneShape = new T.Shape(archOutline(z).getPoints(32));
		const paneGeometry = new T.ShapeGeometry(paneShape);
		geometry.add(paneGeometry);
		const pane = new T.Mesh(paneGeometry, windowGlass);
		pane.rotation.y = -Math.PI / 2;
		pane.position.x = -10;
		root.add(pane);
		const outside = new T.Mesh(paneGeometry, sky);
		outside.rotation.y = -Math.PI / 2;
		outside.position.x = -10.22;
		root.add(outside);
		for (const dz of [-2.3, 0, 2.3])
			rod(
				new T.Vector3(-9.7, 1.3, z + dz),
				new T.Vector3(-9.7, dz === 0 ? 6.78 : 4.5, z + dz),
				0.045,
				trim,
			);
		for (const y of [1.3, 3.15, 4.5])
			rod(
				new T.Vector3(-9.7, y, z - 2.3),
				new T.Vector3(-9.7, y, z + 2.3),
				0.045,
				trim,
			);
		const arc = shape(
			"window-arch",
			() => new T.TorusGeometry(2.3, 0.065, 7, 36, Math.PI),
		);
		instance(
			arc,
			trim,
			-9.7,
			4.5,
			z,
			[1, 1, 1],
			new T.Euler(0, -Math.PI / 2, 0),
		);
		for (const angle of [Math.PI / 4, (Math.PI * 3) / 4])
			rod(
				new T.Vector3(-9.7, 4.5, z),
				new T.Vector3(
					-9.7,
					4.5 + Math.sin(angle) * 2.27,
					z + Math.cos(angle) * 2.27,
				),
				0.025,
				trim,
			);
		box(-9.55, 1.21, z, 0.75, 0.14, 4.94, wood);
	}
	box(-9.78, 0.61, 0, 0.22, 1.2, 28, wood, false);
	box(-9.65, 0.1, 0, 0.16, 0.18, 28, trim);
	for (const x of [-1.1, 1.1]) {
		box(x, 1.65, -13.7, 2.12, 3.3, 0.12, trim);
		box(x, 1.75, -13.6, 1.87, 2.84, 0.055, wood);
	}
	for (const x of [-2.26, 0, 2.26]) box(x, 1.7, -13.52, 0.11, 3.5, 0.12, brass);
	for (const x of [-0.14, 0.14]) ball(x, 1.35, -13.48, 0.07);

	function book(
		x: number,
		bottom: number,
		z: number,
		w: number,
		h: number,
		d: number,
		color: T.MeshStandardMaterial,
		lean = 0,
	) {
		const r = new T.Euler(0, 0, lean);
		box(
			x,
			bottom + h / 2,
			z,
			Math.max(w - 0.012, 0.028),
			h - 0.026,
			d - 0.026,
			paper,
			false,
			r,
		);
		for (const side of [-1, 1])
			box(x + (side * w) / 2, bottom + h / 2, z, 0.008, h, d, color, false, r);
		instance(
			bookSpineGeometry,
			color,
			x,
			bottom + h / 2,
			z - d / 2,
			[w + 0.006, h, 0.016],
			r,
		);
		for (const y of [bottom + h * 0.13, bottom + h * 0.83])
			box(
				x,
				y,
				z - d / 2 - 0.01,
				w * 0.85,
				0.009,
				0.004,
				brass,
				false,
				r,
				true,
			);
		box(
			x,
			bottom + h * 0.59,
			z - d / 2 - 0.012,
			w * 0.42,
			h * 0.2,
			0.004,
			pageEdges,
			false,
			r,
			true,
		);
	}
	function bookshelf(
		f: FloorBox,
		width: number,
		height: number,
		depth: number,
		bays: number,
		rows: number,
	) {
		inFrame(f, () => {
			box(0, height / 2, depth / 2 - 0.055, width, height, 0.085, trim, false);
			box(0, 0.095, 0, width + 0.06, 0.19, depth + 0.04, trim);
			box(0, height, 0, width + 0.14, 0.17, depth + 0.14, trim);
			box(0, height - 0.12, -depth / 2, width + 0.08, 0.035, 0.075, brass);
			for (let i = 0; i <= bays; i++) {
				const x = -width / 2 + (i * width) / bays;
				box(x, height / 2, 0, 0.12, height, depth, wood);
				box(
					x,
					height / 2,
					-depth / 2 - 0.02,
					0.145,
					height - 0.12,
					0.045,
					trim,
				);
			}
			for (let row = 0; row <= rows; row++)
				box(
					0,
					0.18 + (row * (height - 0.32)) / rows,
					0,
					width,
					0.078,
					depth,
					wood,
				);
			for (let bay = 0; bay < bays; bay++)
				for (let row = 0; row < rows; row++) {
					const left = -width / 2 + (bay * width) / bays + 0.1;
					const right = left + width / bays - 0.21;
					const bottom = 0.225 + (row * (height - 0.32)) / rows;
					let x = left;
					while (x < right - 0.2) {
						const w = 0.09 + random() * 0.1,
							h = ((height - 0.32) / rows) * (0.51 + random() * 0.34);
						const lean = random() < 0.045 ? (random() - 0.5) * 0.15 : 0;
						book(
							x + w / 2,
							bottom,
							-0.01 - random() * 0.02,
							w,
							h,
							depth * (0.61 + random() * 0.08),
							bookColors[Math.floor(random() * bookColors.length)],
							lean,
						);
						x += w + 0.012 + random() * 0.012;
						if (random() < 0.022) x += 0.11;
					}
				}
		});
	}
	for (const f of WALL_SHELVES) {
		if (f.width < f.depth)
			bookshelf({ ...f, yaw: Math.PI / 2 }, f.depth, f.height!, f.width, 10, 6);
		else bookshelf({ ...f, yaw: 0 }, f.width, f.height!, f.depth, 3, 5);
	}
	for (const f of AISLE_SHELVES)
		for (const side of [-1, 1])
			bookshelf(
				{ ...f, x: f.x + side * 0.2, yaw: (-side * Math.PI) / 2 },
				f.depth,
				4.45,
				0.4,
				5,
				5,
			);

	function desk(w: number, d: number, height: number) {
		box(0, height - 0.06, 0, w, 0.12, d);
		box(0, height - 0.018, 0, w + 0.045, 0.04, d + 0.045, trim);
		for (const x of [-w / 2 + 0.16, w / 2 - 0.16])
			for (const z of [-d / 2 + 0.14, d / 2 - 0.14]) {
				box(x, (height - 0.12) / 2, z, 0.12, height - 0.12, 0.12);
				box(x, 0.12, z, 0.13, 0.065, 0.13, trim);
			}
		for (const z of [-d / 2 + 0.14, d / 2 - 0.14])
			box(0, height - 0.21, z, w - 0.27, 0.19, 0.08, trim);
		for (const x of [-w / 2 + 0.16, w / 2 - 0.16])
			box(x, height - 0.21, 0, 0.08, 0.19, d - 0.28, trim);
	}
	function chair() {
		box(0, 0.46, 0, 0.58, 0.095, 0.57);
		box(0, 0.515, -0.012, 0.5, 0.065, 0.47, fabric);
		for (const x of [-0.23, 0.23])
			for (const z of [-0.22, 0.22]) {
				box(x, 0.215, z, 0.065, 0.43, 0.065);
				box(x, 0.2, 0, 0.025, 0.04, 0.46, trim);
			}
		for (const x of [-0.23, 0.23]) box(x, 0.84, 0.24, 0.066, 0.76, 0.066);
		for (const y of [0.68, 0.88, 1.08]) box(0, y, 0.25, 0.48, 0.1, 0.07);
	}
	function lamp(x: number, y: number, z: number) {
		lathe(
			"lamp-base",
			[
				[0, 0],
				[0.31, 0],
				[0.34, 0.025],
				[0.32, 0.07],
				[0.2, 0.11],
				[0.06, 0.13],
			],
			x,
			y,
			z,
			brass,
		);
		rod(new T.Vector3(x, y + 0.12, z), new T.Vector3(x, y + 0.81, z), 0.024);
		ball(x, y + 0.77, z, 0.046);
		// Curved shell with a separate ivory inner surface, not an opaque hemisphere.
		lathe(
			"shade-outer",
			[
				[0.03, 0.35],
				[0.19, 0.33],
				[0.36, 0.23],
				[0.47, 0.09],
				[0.49, 0.015],
				[0.48, 0],
			].reverse(),
			x,
			y + 0.8,
			z,
			green,
		);
		lathe(
			"shade-inner",
			[
				[0.455, 0.02],
				[0.44, 0.095],
				[0.335, 0.23],
				[0.17, 0.31],
				[0.04, 0.315],
			].reverse(),
			x,
			y + 0.8,
			z,
			ivory,
		);
		const rim = shape(
			"shade-rim",
			() => new T.TorusGeometry(0.478, 0.012, 6, 28),
		);
		instance(
			rim,
			brass,
			x,
			y + 0.806,
			z,
			[1, 1, 1],
			new T.Euler(Math.PI / 2, 0, 0),
		);
		instance(
			sphere,
			bulb,
			x,
			y + 0.89,
			z,
			[0.092, 0.045, 0.06],
			undefined,
			false,
			false,
		);
		const p = fixturePoint(frame, x, y + 0.8, z);
		lampPoints.push(new T.Vector3(p.x, p.y, p.z));
	}
	for (const f of TABLES)
		inFrame(f, () => {
			desk(f.width, f.depth, 1.1);
			for (const x of [-1.5, 0, 1.5]) lamp(x, 1.12, 0);
			for (let i = 0; i < 3; i++) {
				box(
					1.6 + i * 0.035,
					1.16 + i * 0.105,
					0.53,
					0.57,
					0.105,
					0.77,
					bookColors[i],
				);
				box(
					1.6 + i * 0.035,
					1.162 + i * 0.105,
					0.54,
					0.565,
					0.085,
					0.74,
					paper,
				);
			}
			// Slightly crowned pages, seam and covers of an open book.
			for (const s of [-1, 1]) {
				box(
					-0.7 + s * 0.19,
					1.125,
					0.64,
					0.38,
					0.018,
					0.54,
					bookColors[4],
					false,
					new T.Euler(0, 0, s * -0.025),
				);
				box(
					-0.7 + s * 0.19,
					1.145,
					0.64,
					0.37,
					0.03,
					0.52,
					paper,
					true,
					new T.Euler(0, 0, s * -0.035),
				);
				for (let line = 0; line < 6; line++)
					box(
						-0.7 + s * 0.19,
						1.164,
						0.46 + line * 0.053,
						0.25,
						0.002,
						0.003,
						pageEdges,
						false,
						undefined,
						true,
					);
			}
		});
	for (const f of CHAIRS) {
		const table = TABLES.reduce((a, b) =>
			Math.abs(f.z - a.z) < Math.abs(f.z - b.z) ? a : b,
		);
		inFrame({ ...f, yaw: (f.yaw || 0) + (f.z < table.z ? Math.PI : 0) }, chair);
	}
	for (const z of [0, 8.7])
		inFrame({ x: -8.2, z, width: 0, depth: 0 }, () => {
			box(0, 0.48, 0, 0.94, 0.13, 1.76);
			box(0, 0.575, 0, 0.84, 0.11, 1.58, fabric);
			box(-0.46, 0.85, 0, 0.08, 0.66, 1.76);
			for (const side of [-1, 1]) box(0, 0.25, side * 0.7, 0.72, 0.5, 0.09);
			lamp(0, 0.64, 0.46);
		});
	// Curved leaf surfaces with real spatial volume; no crossed billboard leaves.
	const leaf = shape("leaf", () => {
		const positions: number[] = [],
			indices: number[] = [],
			normals: number[] = [];
		for (let row = 0; row <= 9; row++) {
			const t = row / 9,
				halfWidth = Math.sin(t * Math.PI) * 0.17;
			for (let col = 0; col < 3; col++) {
				positions.push(
					(col - 1) * halfWidth,
					t * 0.82 + (col === 1 ? 0.028 : 0),
					t * t * 0.6,
				);
				normals.push(0, 0, 1);
			}
			if (row < 9)
				for (let col = 0; col < 2; col++) {
					const a = row * 3 + col;
					indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
				}
		}
		const g = new T.BufferGeometry();
		g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
		g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
		g.setIndex(indices);
		g.computeVertexNormals();
		return g;
	});
	for (const f of PLANTS)
		inFrame(f, () => {
			lathe(
				"planter",
				[
					[0.24, 0],
					[0.25, 0.05],
					[0.36, 0.63],
					[0.4, 0.68],
					[0.4, 0.74],
					[0.34, 0.74],
					[0.34, 0.67],
				],
				0,
				0,
				0,
				terracotta,
			);
			instance(cylinder, trim, 0, 0.67, 0, [0.34, 0.04, 0.34]);
			for (let i = 0; i < 12; i++) {
				const angle = i * 2.399,
					scale = 0.7 + random() * 0.5;
				instance(
					leaf,
					leafMat,
					0,
					0.76 + random() * 0.3,
					0,
					[scale, scale, scale],
					new T.Euler(0.07 + random() * 0.25, angle, 0),
				);
				rod(
					new T.Vector3(0, 0.7, 0),
					new T.Vector3(
						Math.sin(angle) * 0.22,
						1.45 * scale,
						Math.cos(angle) * 0.22,
					),
					0.008,
					leafVein,
					true,
				);
			}
		});

	for (const room of ROOMS)
		inFrame(room, () => {
			const door = room.doorX - room.x;
			for (const z of [-0.82, 0.82]) box(door, 1.52, z, 0.24, 3.04, 0.15, trim);
			box(door, 3.06, 0, 0.24, 0.15, 1.82, trim);
			box(door, 2.59, 0, 0.28, 0.31, 0.97, wood);
			for (const z of [-0.39, 0.39])
				ball(door - Math.sign(room.x) * 0.16, 2.59, z, 0.018);
		});
	for (const f of ROOM_FIXTURES)
		inFrame(f, () => {
			const w = f.width,
				d = f.depth,
				h = f.height;
			if (f.kind === "chair") {
				chair();
				return;
			}
			if (f.kind === "notice") {
				box(0, 1.55, 0, w, 1.48, d, trim);
				box(0, 1.55, -d / 2 - 0.012, w - 0.13, 1.35, 0.02, fabric);
				for (const x of [-0.5, 0, 0.5]) {
					box(
						x,
						1.54 + x * 0.09,
						-d / 2 - 0.025,
						0.37,
						0.53,
						0.012,
						paper,
						false,
						new T.Euler(0, 0, x * 0.04),
					);
					ball(x, 1.77, -d / 2 - 0.05, 0.023);
				}
				return;
			}
			if (f.kind === "cabinet" || f.kind === "records") {
				box(0, h / 2, 0, w, h, d, trim);
				box(0, h + 0.02, 0, w + 0.08, 0.09, d + 0.1);
				const front = -Math.sign(f.x) * (w / 2 + 0.022);
				for (let row = 0; row < 4; row++)
					for (let col = 0; col < 5; col++) {
						const y = 0.16 + ((row + 0.5) * (h - 0.25)) / 4,
							z = -d / 2 + ((col + 0.5) * d) / 5;
						box(front, y, z, 0.048, (h - 0.25) / 4 - 0.06, d / 5 - 0.065);
						if (f.kind === "cabinet") {
							box(front * 1.055, y + 0.09, z, 0.017, 0.065, 0.18, brass);
							box(front * 1.09, y + 0.09, z, 0.017, 0.044, 0.14, paper);
							rod(
								new T.Vector3(front * 1.1, y - 0.09, z - 0.075),
								new T.Vector3(front * 1.1, y - 0.09, z + 0.075),
								0.014,
							);
						} else {
							box(
								front * 1.06,
								y,
								z,
								0.028,
								0.36,
								0.36,
								bookColors[(col + row) % 8],
							);
							const disc = shape(
								"record-disc",
								() => new T.CylinderGeometry(0.14, 0.14, 0.012, 24),
							);
							instance(
								disc,
								darkMetal,
								front * 1.1,
								y,
								z,
								[1, 1, 1],
								new T.Euler(0, 0, Math.PI / 2),
							);
						}
					}
				return;
			}
			if (f.kind === "bench" || f.kind === "sofa") {
				box(0, 0.43, 0, w, 0.14, d);
				const cushions = 3;
				for (let i = 0; i < cushions; i++) {
					const x = ((i - 1) * (w - 0.3)) / 3;
					box(x, 0.565, -0.02, (w - 0.33) / 3, 0.19, d - 0.16, fabric);
					box(x, 0.84, d / 2 - 0.12, (w - 0.33) / 3, 0.53, 0.19, fabric);
					box(
						x,
						0.665,
						-d / 2 + 0.125,
						(w - 0.38) / 3,
						0.005,
						0.006,
						pageEdges,
						false,
						undefined,
						true,
					);
				}
				for (const side of [-1, 1]) {
					box(side * (w / 2 - 0.075), 0.71, 0, 0.15, 0.43, d, fabric);
					for (const z of [-d / 2 + 0.13, d / 2 - 0.13])
						box(side * (w / 2 - 0.15), 0.2, z, 0.11, 0.4, 0.11, trim);
				}
				return;
			}
			if (f.kind === "display") {
				box(0, 0.39, 0, w, 0.78, d);
				box(0, 0.82, 0, w + 0.04, 0.08, d + 0.04, trim);
				const displayH = 0.52;
				for (const x of [-w / 2, w / 2])
					for (const z of [-d / 2, d / 2])
						box(x, 0.85 + displayH / 2, z, 0.035, displayH, 0.035, brass);
				for (const x of [-w / 2, w / 2])
					box(x, 1.105, 0, 0.012, displayH, d, glass, false);
				for (const z of [-d / 2, d / 2])
					box(0, 1.105, z, w, displayH, 0.012, glass, false);
				box(0, 1.38, 0, w + 0.035, 0.018, d + 0.035, glass, false);
				box(0, 0.89, 0, 0.65, 0.025, 0.48, paper);
				return;
			}
			desk(w, d, h);
			if (f.kind === "catalogue" || f.kind === "folder") {
				const slots = f.kind === "catalogue" ? [-1.14, 0, 1.14] : [-0.75, 0.75];
				for (const x of slots) {
					box(x, h + 0.035, -0.12, 0.72, 0.044, 0.57, bookColors[2]);
					box(x, h + 0.062, -0.12, 0.64, 0.008, 0.5, paper);
					rod(
						new T.Vector3(x - 0.19, h + 0.077, -0.32),
						new T.Vector3(x - 0.19, h + 0.077, 0.08),
						0.008,
						darkMetal,
						true,
					);
				}
			} else if (f.kind === "phonograph") {
				box(0, h + 0.075, 0, 0.78, 0.15, 0.65, trim);
				instance(cylinder, darkMetal, -0.1, h + 0.159, 0, [0.26, 0.01, 0.26]);
				instance(cylinder, paper, -0.1, h + 0.166, 0, [0.075, 0.005, 0.075]);
				curve(
					"record-tonearm",
					[
						[0.24, h + 0.19, 0.16],
						[0.19, h + 0.225, 0.08],
						[0.04, h + 0.2, -0.04],
						[-0.02, h + 0.175, -0.06],
					],
					0.012,
					brass,
				);
				lathe(
					"phonograph-horn",
					[
						[0.065, 0],
						[0.07, 0.14],
						[0.12, 0.3],
						[0.24, 0.48],
						[0.44, 0.6],
						[0.445, 0.625],
						[0.43, 0.625],
						[0.23, 0.49],
						[0.105, 0.3],
						[0.055, 0.14],
					],
					0.35,
					h + 0.16,
					0.14,
					brass,
					new T.Euler(-0.55, 0, 0.12),
				);
			} else if (f.kind === "workbench") {
				if (f.id === "project-desk") {
					box(0, h + 0.5, 0.2, 0.96, 0.63, 0.065, darkMetal);
					box(0, h + 0.5, 0.16, 0.88, 0.55, 0.012, pageEdges);
					box(0, h + 0.12, 0.24, 0.06, 0.22, 0.09, darkMetal);
					box(0, h + 0.028, 0.2, 0.32, 0.04, 0.22, darkMetal);
				} else
					for (let i = 0; i < 4; i++)
						box(
							(i - 1.5) * 0.58,
							h + 0.04,
							-0.06,
							0.46,
							0.065,
							0.58,
							bookColors[i],
						);
			} else lamp(w * 0.22, h + 0.03, 0.06);
		});
	for (const z of [27.4, 30.7]) {
		box(9.47, 2.05, z, 0.12, 1.8, 1.92, trim);
		box(9.39, 2.05, z, 0.028, 1.64, 1.76, paper);
		// Blank framed sheets, not fabricated artworks or project contents.
	}
	// Real treads, stringers, handrail joints and landings, matching continuous physics ramps.
	for (let flight = 0; flight < 2; flight++) {
		const centre = STAIRS.centres[flight],
			bottom = flight * STAIRS.rise;
		for (let step = 0; step < STAIRS.steps; step++) {
			const t = (step + 0.5) / STAIRS.steps,
				z =
					flight === 0
						? STAIRS.start + t * (STAIRS.end - STAIRS.start)
						: STAIRS.end - t * (STAIRS.end - STAIRS.start);
			const top = bottom + ((step + 1) * STAIRS.rise) / STAIRS.steps;
			box(
				centre,
				top - 0.085,
				z,
				STAIRS.width,
				0.17,
				(STAIRS.end - STAIRS.start) / STAIRS.steps,
				wood,
			);
			box(
				centre,
				top - 0.027,
				z,
				STAIRS.width + 0.015,
				0.045,
				(STAIRS.end - STAIRS.start) / STAIRS.steps + 0.02,
				trim,
			);
		}
		const aZ = flight === 0 ? STAIRS.start : STAIRS.end,
			bZ = flight === 0 ? STAIRS.end : STAIRS.start;
		for (const side of [-1, 1]) {
			const x = centre + side * 0.87;
			rod(
				new T.Vector3(x, bottom + 1.08, aZ),
				new T.Vector3(x, bottom + STAIRS.rise + 1.08, bZ),
				0.047,
				wood,
			);
			rod(
				new T.Vector3(x, bottom - 0.04, aZ),
				new T.Vector3(x, bottom + STAIRS.rise - 0.04, bZ),
				0.085,
				trim,
			);
			for (let i = 0; i <= 8; i++) {
				const t = i / 8,
					y = bottom + t * STAIRS.rise;
				rod(
					new T.Vector3(x, y, aZ + (bZ - aZ) * t),
					new T.Vector3(x, y + 1.08, aZ + (bZ - aZ) * t),
					0.018,
					darkMetal,
				);
			}
		}
	}
	for (const f of GUARDS.filter((f) => f.base === UPPER))
		inFrame(f, () => {
			const alongX = f.width > f.depth,
				length = Math.max(f.width, f.depth);
			box(
				0,
				1.09,
				0,
				alongX ? length : 0.11,
				0.1,
				alongX ? 0.11 : length,
				wood,
			);
			for (let i = 0; i <= Math.ceil(length / 0.25); i++) {
				const p = -length / 2 + (length * i) / Math.ceil(length / 0.25);
				rod(
					new T.Vector3(alongX ? p : 0, 0, alongX ? 0 : p),
					new T.Vector3(alongX ? p : 0, 1.04, alongX ? 0 : p),
					0.013,
					darkMetal,
				);
			}
		});
	for (const [key, b] of batches) {
		const mesh = new T.InstancedMesh(b.geometry, b.material, b.matrices.length);
		mesh.name = `solid-batch:${key}`;
		b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
		mesh.instanceMatrix.needsUpdate = true;
		mesh.castShadow = b.shadow && !b.detail;
		mesh.receiveShadow = b.shadow;
		mesh.computeBoundingSphere();
		root.add(mesh);
		if (b.detail) microDetails.push(mesh);
		if (b.geometry === bookSpineGeometry) bookSpineMeshes.push(mesh);
	}
	// Localised illumination: one daylight shadow, at most two night shadow lights.
	const ambient = new T.HemisphereLight(0xdbe4dd, 0x64523c, 1.4);
	root.add(ambient);
	const sun = new T.DirectionalLight(0xffeed4, 3.1);
	sun.position.set(-18, 13, -8);
	sun.target.position.set(-1, 0, 5);
	sun.castShadow = true;
	const shadowSize = mobile ? 1024 : 2048;
	sun.shadow.mapSize.set(shadowSize, shadowSize);
	sun.shadow.camera.left = -20;
	sun.shadow.camera.right = 20;
	sun.shadow.camera.top = 29;
	sun.shadow.camera.bottom = -24;
	sun.shadow.camera.near = 0.5;
	sun.shadow.camera.far = 65;
	sun.shadow.normalBias = 0.028;
	sun.shadow.bias = -0.00018;
	sun.shadow.radius = 3;
	root.add(sun, sun.target);
	const fills: T.PointLight[] = [];
	for (const [x, y, z] of [
		[-4.3, 6, 0],
		[5.8, 6, 8],
		[0, 3.6, 21],
		[0, 6.9, 33],
		[-5.8, 3.5, 29.5],
		[5.8, 3.5, 29.5],
	]) {
		const light = new T.PointLight(0xffdfa8, 8, 15, 2);
		light.position.set(x, y, z);
		root.add(light);
		fills.push(light);
	}
	const nightPositions = [
		...lampPoints,
		...ROOMS.map((r) => new T.Vector3(r.x, (r.base || 0) + 3.15, r.z)),
		new T.Vector3(0, 6.8, 37.5),
		new T.Vector3(0, 7, 12.5),
	];
	for (const point of nightPositions.slice(lampPoints.length)) {
		inFrame({ x: point.x, z: point.z, width: 0, depth: 0 }, () => {
			rod(
				new T.Vector3(0, point.y, 0),
				new T.Vector3(0, point.y + 0.18, 0),
				0.015,
			);
			instance(
				sphere,
				bulb,
				0,
				point.y,
				0,
				[0.14, 0.075, 0.14],
				undefined,
				false,
				false,
			);
		});
	}
	// These fixture batches were added after the main flush: explicitly flush only new instances.
	for (const [key, b] of batches) {
		const existing = root.children.find(
			(o) => o.name === `solid-batch:${key}`,
		) as T.InstancedMesh | undefined;
		const already = existing?.count || 0;
		if (already === b.matrices.length) continue;
		const additional = b.matrices.slice(already),
			mesh = new T.InstancedMesh(b.geometry, b.material, additional.length);
		additional.forEach((m, i) => mesh.setMatrixAt(i, m));
		mesh.castShadow = b.shadow;
		mesh.receiveShadow = b.shadow;
		root.add(mesh);
	}
	const nightLights = Array.from({ length: 2 }, () => {
		const light = new T.SpotLight(0xffd69c, 32, 15, 1.15, 0.72, 2);
		light.castShadow = true;
		light.shadow.mapSize.set(shadowSize, shadowSize);
		light.shadow.camera.near = 0.08;
		light.shadow.camera.far = 18;
		light.shadow.normalBias = 0.018;
		light.shadow.bias = -0.0001;
		root.add(light, light.target);
		return light;
	});
	let lighting: "day" | "night" = "day",
		nightKey = "",
		lastDetail = true;
	function setLighting(next: "day" | "night") {
		lighting = next;
		nightKey = "";
		sun.visible = next === "day";
		ambient.intensity = next === "day" ? 1.5 : 0.48;
		ambient.color.set(next === "day" ? 0xcddfdf : 0x859bb5);
		ambient.groundColor.set(next === "day" ? 0x75644c : 0x514337);
		for (const fill of fills) fill.intensity = next === "day" ? 6 : 12;
		for (const light of nightLights) light.visible = next === "night";
		sky.color.set(next === "day" ? 0xb6cbd0 : 0x172539);
		sky.emissive.copy(sky.color);
		sky.emissiveIntensity = next === "day" ? 0.55 : 0.12;
		for (const m of lampGlow) m.emissiveIntensity = next === "day" ? 0.65 : 1.7;
	}
	setLighting("day");
	return {
		root,
		setLighting,
		resize(_w, _h, coarse) {
			for (const detail of microDetails) detail.visible = !coarse;
			for (const spine of bookSpineMeshes)
				spine.geometry = coarse ? cube : bookSpineGeometry;
			lastDetail = !coarse;
			for (const light of [sun, ...nightLights]) {
				const size = coarse ? 1024 : 2048;
				if (light.shadow.mapSize.x !== size) {
					light.shadow.map?.dispose();
					light.shadow.map = null;
					light.shadow.mapPass?.dispose();
					light.shadow.mapPass = null;
					light.shadow.mapSize.set(size, size);
					light.shadow.needsUpdate = true;
				}
			}
		},
		update(position) {
			// Micro geometry is hidden beyond its bounding sphere; no per-book draw calls.
			if (lastDetail)
				for (const mesh of microDetails)
					mesh.visible =
						position.distanceTo(
							mesh.boundingSphere?.center || new T.Vector3(),
						) <
						24 + (mesh.boundingSphere?.radius || 0);
			if (lighting !== "night") return false;
			const indices = nightPositions
				.map((p, i) => ({
					i,
					distance:
						p.distanceToSquared(position) +
						(Math.abs(p.y - position.y) > 2.8 ? 200 : 0),
				}))
				.sort((a, b) => a.distance - b.distance)
				.slice(0, 2)
				.map((x) => x.i);
			const key = indices.join(":");
			if (key === nightKey) return false;
			nightKey = key;
			indices.forEach((index, i) => {
				nightLights[i].position.copy(nightPositions[index]);
				nightLights[i].target.position.copy(nightPositions[index]).y -= 2;
				nightLights[i].intensity = index < lampPoints.length ? 16 : 65;
			});
			return true;
		},
		dispose() {
			root.traverse((o) => {
				if (o instanceof T.InstancedMesh) o.dispose();
				if (o instanceof T.Light && "shadow" in o)
					(o as T.PointLight | T.DirectionalLight).shadow?.dispose();
			});
			for (const g of geometry) g.dispose();
			for (const m of materials) m.dispose();
			textures.dispose();
			root.clear();
		},
	};
}
