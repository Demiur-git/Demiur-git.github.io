export function selectMusicLibrary<T>(
	source: string | undefined,
	localLibrary: T,
	publicLibrary: T,
): T {
	if (source === undefined || source === "local") return localLibrary;
	if (source === "public") return publicLibrary;
	throw new Error("PUBLIC_MUSIC_LIBRARY 只能设置为 local 或 public。");
}
