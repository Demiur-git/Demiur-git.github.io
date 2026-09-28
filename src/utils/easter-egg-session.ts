import { pulseScenePath } from "./pulse-route";
import { url } from "./url-utils";

export function isEasterEggPath(pathname: string): boolean {
	return [
		url("/pulse/"),
		pulseScenePath(),
		url("/newworld/"),
		url("/starfield/"),
		url("/echo/"),
		url("/echo/white/"),
	].some((path) => path.replace(/\/+$/, "") === pathname.replace(/\/+$/, ""));
}

let snapshot: { playing: boolean; id: string; source: string } | null = null;
const owners = new Set<object>();

export function acquireEasterEggMusic(owner: object): void {
	owners.add(owner);
	const music = window.__fireflyMusic;
	const state = music?.getState();
	if (!snapshot && state)
		snapshot = {
			playing: state.isPlaying,
			id: state.trackId,
			source: state.track?.url || "",
		};
	if (state?.isPlaying) music?.togglePlay();
}

export function releaseEasterEggMusic(owner: object): void {
	owners.delete(owner);
	resumeEasterEggMusicIfOutside();
}

export function resumeEasterEggMusicIfOutside(): void {
	if (owners.size || isEasterEggPath(location.pathname) || !snapshot) return;
	const original = snapshot;
	snapshot = null;
	const music = window.__fireflyMusic;
	const state = music?.getState();
	if (
		original.playing &&
		state &&
		!state.isPlaying &&
		state.trackId === original.id &&
		state.track?.url === original.source
	)
		music?.togglePlay();
}
