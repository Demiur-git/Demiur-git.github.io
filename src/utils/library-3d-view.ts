import type * as T from "three";

export type LibraryView = "ink" | "solid";
export type LibraryLighting = "auto" | "day" | "night";
export interface LibraryViewOptions {
	view: LibraryView;
	lighting: LibraryLighting;
}
export function readLibraryView(search: string): LibraryViewOptions {
	const query = new URLSearchParams(search);
	const lighting = query.get("lighting");
	return {
		view: query.get("view") === "solid" ? "solid" : "ink",
		lighting: lighting === "day" || lighting === "night" ? lighting : "auto",
	};
}
export function libraryViewURL(
	address: string,
	options: LibraryViewOptions,
): string {
	const result = new URL(address);
	result.searchParams.set("view", options.view);
	if (options.lighting === "auto") result.searchParams.delete("lighting");
	else result.searchParams.set("lighting", options.lighting);
	return `${result.pathname}${result.search}${result.hash}`;
}
export function effectiveLibraryLighting(
	lighting: LibraryLighting,
	dark: boolean,
): "day" | "night" {
	return lighting === "auto" ? (dark ? "night" : "day") : lighting;
}
/** Ink and solid share visitors and layout, not drawing materials or geometry. */
export interface LibraryDrawing {
	root: T.Group;
	resize(width: number, height: number, mobile: boolean): void;
	dispose(): void;
	setLighting?(lighting: "day" | "night"): void;
	update?(position: T.Vector3): boolean;
}
