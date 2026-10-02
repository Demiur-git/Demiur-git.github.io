import * as T from "three";
import { url } from "./url-utils";

export const LIBRARY_MATERIAL_GROUPS = [
	"wood",
	"floor",
	"plaster",
	"fabric",
] as const;
export type LibraryMaterialGroup = (typeof LIBRARY_MATERIAL_GROUPS)[number];
export interface LibraryTextureSet {
	color?: T.Texture;
	normal?: T.Texture;
	roughness?: T.Texture;
}
export interface LibraryTextures {
	sets: Record<LibraryMaterialGroup, LibraryTextureSet>;
	failures: string[];
	dispose(): void;
}
/** Only called by the dynamically imported solid builder. No CDN or early preload. */
export async function loadLibraryTextures(
	mobile: boolean,
	signal: AbortSignal,
): Promise<LibraryTextures> {
	const size = mobile ? 512 : 1024;
	const sets = Object.fromEntries(
		LIBRARY_MATERIAL_GROUPS.map((name) => [name, {}]),
	) as LibraryTextures["sets"];
	const failures: string[] = [];
	const textures: T.Texture[] = [];
	const images: ImageBitmap[] = [];
	const tasks = LIBRARY_MATERIAL_GROUPS.flatMap((name) =>
		(["color", "normal", "roughness"] as const).map(async (channel) => {
			const address = url(
				`/assets/library-3d/materials/${name}-${channel}-${size}.webp`,
			);
			try {
				const response = await fetch(address, {
					signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
				});
				if (!response.ok) throw new Error(String(response.status));
				const bitmap = await createImageBitmap(await response.blob(), {
					imageOrientation: "flipY",
					premultiplyAlpha: "none",
					colorSpaceConversion: "none",
				});
				if (signal.aborted) {
					bitmap.close();
					return;
				}
				const texture = new T.Texture(bitmap);
				texture.flipY = false;
				texture.wrapS = texture.wrapT = T.RepeatWrapping;
				texture.colorSpace =
					channel === "color" ? T.SRGBColorSpace : T.NoColorSpace;
				texture.anisotropy = mobile ? 2 : 4;
				texture.needsUpdate = true;
				sets[name][channel] = texture;
				textures.push(texture);
				images.push(bitmap);
			} catch {
				if (!signal.aborted) failures.push(`${name}/${channel}`);
			}
		}),
	);
	await Promise.all(tasks);
	const result = {
		sets,
		failures,
		dispose() {
			for (const texture of textures) texture.dispose();
			for (const bitmap of images) bitmap.close();
		},
	};
	if (signal.aborted) {
		result.dispose();
		throw new DOMException("Scene load cancelled", "AbortError");
	}
	return result;
}
