const MEETING_BACKGROUNDS = {
	day: "/images/home-entrance/library-meeting-day.webp",
	night: "/images/home-entrance/library-meeting-night.webp",
};

function preloadImage(src: string, signal: AbortSignal): Promise<boolean> {
	if (!src || signal.aborted) return Promise.resolve(false);
	return new Promise((resolve) => {
		const image = new Image();
		let settled = false;
		const finish = (ready: boolean): void => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timeout);
			image.removeEventListener("load", loaded);
			image.removeEventListener("error", failed);
			signal.removeEventListener("abort", failed);
			if (!ready) image.removeAttribute("src");
			resolve(ready);
		};
		const loaded = (): void => { void image.decode().then(() => finish(true), () => finish(image.naturalWidth > 0)); };
		const failed = (): void => finish(false);
		const timeout = window.setTimeout(failed, 8000);
		image.addEventListener("load", loaded, { once: true });
		image.addEventListener("error", failed, { once: true });
		signal.addEventListener("abort", failed, { once: true });
		image.src = src;
		if (image.complete && image.naturalWidth > 0) loaded();
	});
}

export interface HomeCharacterScene {
	ready: () => Promise<void>;
}

/** All observers, image waits and timeouts belong to this one prologue visit. */
export function prepareHomeCharacterScene(overlay: HTMLElement, signal: AbortSignal): HomeCharacterScene {
	if (signal.aborted) return { ready: () => Promise.resolve() };
	const background = overlay.querySelector<HTMLImageElement>("[data-character-background]");
	const portrait = overlay.querySelector<HTMLImageElement>("[data-character-portrait]");
	const root = document.documentElement;
	let requestedSrc = "";
	let pendingBackground: Promise<void> = Promise.resolve();
	function syncBackground(): void {
		if (signal.aborted || !background) return;
		const src = root.classList.contains("dark") ? MEETING_BACKGROUNDS.night : MEETING_BACKGROUNDS.day;
		if (src !== requestedSrc) {
			requestedSrc = src;
			pendingBackground = preloadImage(src, signal).then((ready) => {
				if (signal.aborted || requestedSrc !== src) return;
				if (ready) {
					background.src = src;
					background.hidden = false;
				} else {
					background.hidden = true;
					background.removeAttribute("src");
				}
			});
		}
	}
	const observer = new MutationObserver(syncBackground);
	observer.observe(root, { attributes: true, attributeFilter: ["class"] });
	signal.addEventListener("abort", () => {
		observer.disconnect();
	}, { once: true });
	syncBackground();
	const portraitReady = preloadImage(portrait?.dataset.src || "", signal).then((ready) => {
		if (!portrait || signal.aborted || !ready) return;
		portrait.src = portrait.dataset.src || "";
		portrait.hidden = false;
	});
	return {
		async ready(): Promise<void> {
			// Recheck even after initial preparation, including a last-moment theme change.
			syncBackground();
			let preparing: Promise<void>;
			do {
				preparing = pendingBackground;
				await Promise.all([portraitReady, preparing]);
			} while (!signal.aborted && preparing !== pendingBackground);
		},
	};
}
