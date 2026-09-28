import { EasterEggScene } from "./easter-egg-scene";
import { getPuzzleProgress } from "./pulse-puzzle";
import { pulseScenePath } from "./pulse-route";

export class EchoScene extends EasterEggScene {
	private seamReady = false;
	connectedCallback(): void {
		if (this.active) return;
		if (!getPuzzleProgress().echoUnlocked) {
			document.documentElement.removeAttribute("data-echo-pending");
			location.replace(pulseScenePath());
			return;
		}
		this.seamReady = false;
		const seam = this.querySelector<HTMLButtonElement>("[data-echo-seam]")!;
		seam.hidden = true;
		const signal = this.mount(pulseScenePath());
		seam.addEventListener("click", () => this.navigate("/echo/white/"), { signal });
		const checkAccess = () => {
			if (this.active && !getPuzzleProgress().echoUnlocked)
				this.navigate(pulseScenePath());
		};
		window.addEventListener("pulse:progress", checkAccess, { signal });
		window.addEventListener("storage", checkAccess, { signal });
	}
	protected renderFrame(): void {
		if (!this.seamReady && (this.reduced || this.visibleTime >= 2800)) {
			this.seamReady = true;
			this.querySelector<HTMLButtonElement>("[data-echo-seam]")!.hidden = false;
		}
	}
	protected onVisibility(visible: boolean): void {
		this.toggleAttribute("data-paused", !visible);
	}
}
