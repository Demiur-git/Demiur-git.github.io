import { EasterEggScene } from "./easter-egg-scene";
import { getPuzzleProgress, isStillnessReady } from "./pulse-puzzle";
import { pulseScenePath } from "./pulse-route";

export class StillnessScene extends EasterEggScene {
	connectedCallback(): void {
		if (this.active) return;
		const progress = getPuzzleProgress();
		if (!progress.stillnessUnlocked || !isStillnessReady(progress)) {
			document.documentElement.removeAttribute("data-stillness-pending");
			location.replace(pulseScenePath());
			return;
		}
		const signal = this.mount(pulseScenePath());
		this.dialog.addEventListener("click", (event) => {
			if (event.target instanceof Element && event.target.closest("a,button")) return;
			this.revealReturn();
		}, { signal });
		const checkAccess = () => {
			const current = getPuzzleProgress();
			if (this.active && (!current.stillnessUnlocked || !isStillnessReady(current))) this.navigate(pulseScenePath());
		};
		window.addEventListener("pulse:progress", checkAccess, { signal });
		window.addEventListener("storage", checkAccess, { signal });
	}

	protected renderFrame(): void {}
}
