import { echoAperturePath } from "./echo-aperture";
import { EasterEggScene } from "./easter-egg-scene";
import { getPuzzleProgress } from "./pulse-puzzle";
import { pulseScenePath } from "./pulse-route";
import { url } from "./url-utils";

type EchoPhase = "idle" | "opening" | "recovering";

export class EchoScene extends EasterEggScene {
	private seamReady = false;
	private phase: EchoPhase = "idle";
	private hovered = false;
	private keyboardFocused = false;
	private touchArmed = false;
	private suppressTouchClickUntil = 0;
	private preview = 0;
	private opening = 0;
	private openingElapsed = 0;
	private navigating = false;
	private exitRequested = false;
	private focusAfterFailure = false;
	private lastApertureKey = "";
	private whiteReady: Promise<boolean> | null = null;

	connectedCallback(): void {
		if (this.active) return;
		if (!getPuzzleProgress().echoUnlocked) {
			document.documentElement.removeAttribute("data-echo-pending");
			location.replace(pulseScenePath());
			return;
		}
		this.seamReady = false;
		this.phase = "idle";
		this.hovered = false;
		this.keyboardFocused = false;
		this.touchArmed = false;
		this.suppressTouchClickUntil = 0;
		this.preview = 0;
		this.opening = 0;
		this.openingElapsed = 0;
		this.navigating = false;
		this.exitRequested = false;
		this.focusAfterFailure = false;
		this.lastApertureKey = "";
		this.whiteReady = null;
		const seam = this.querySelector<HTMLButtonElement>("[data-echo-seam]")!;
		seam.hidden = true;
		seam.disabled = false;
		this.querySelector<HTMLElement>("[data-echo-error]")!.hidden = true;
		const signal = this.mount(pulseScenePath());
		seam.addEventListener("pointerenter", (event) => {
			if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
			this.hovered = true;
		}, { signal });
		seam.addEventListener("pointerleave", (event) => {
			if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
			this.hovered = false;
		}, { signal });
		seam.addEventListener("focus", () => {
			this.keyboardFocused = seam.matches(":focus-visible");
		}, { signal });
		seam.addEventListener("blur", () => {
			this.keyboardFocused = false;
		}, { signal });
		seam.addEventListener("pointerdown", (event) => {
			if (event.pointerType === "touch") this.keyboardFocused = false;
		}, { signal });
		seam.addEventListener("pointerup", (event) => {
			if (event.pointerType !== "touch" || this.phase !== "idle") return;
			event.preventDefault();
			this.suppressTouchClickUntil = performance.now() + 700;
			if (this.touchArmed) this.beginOpening();
			else this.touchArmed = true;
		}, { signal });
		seam.addEventListener("click", (event) => {
			if (event.detail > 0 && performance.now() < this.suppressTouchClickUntil) {
				event.preventDefault();
				return;
			}
			this.beginOpening();
		}, { signal });
		this.querySelector<HTMLDialogElement>("dialog")!.addEventListener("pointerdown", (event) => {
			if (event.pointerType !== "touch" || event.target === seam) return;
			if (event.target instanceof Element && event.target.closest("[data-echo-seam]")) return;
			this.touchArmed = false;
			this.keyboardFocused = false;
			seam.blur();
		}, { signal });
		this.querySelector<HTMLDialogElement>("dialog")!.addEventListener("keydown", (event) => {
			if (event.key === "Escape") this.exitRequested = true;
		}, { signal, capture: true });
		this.querySelector<HTMLAnchorElement>("[data-scene-return]")!.addEventListener("click", () => {
			this.exitRequested = true;
		}, { signal, capture: true });
		window.addEventListener("popstate", () => {
			this.exitRequested = true;
		}, { signal });
		const checkAccess = () => {
			if (this.active && !getPuzzleProgress().echoUnlocked)
				this.navigate(pulseScenePath());
		};
		window.addEventListener("pulse:progress", checkAccess, { signal });
		window.addEventListener("storage", checkAccess, { signal });
	}

	protected renderFrame(delta: number): void {
		const seam = this.querySelector<HTMLButtonElement>("[data-echo-seam]")!;
		if (!this.seamReady && (this.reduced || this.visibleTime >= 2800)) {
			this.seamReady = true;
			seam.hidden = false;
			if (matchMedia("(hover: hover)").matches && seam.matches(":hover"))
				this.hovered = true;
		}
		if (this.phase === "idle") {
			const target = this.hovered || this.keyboardFocused || this.touchArmed ? 1 : 0;
			this.preview = this.reduced
				? target
				: Math.max(0, Math.min(1, this.preview + Math.sign(target - this.preview) * Math.min(Math.abs(target - this.preview), delta / 220)));
		} else if (this.phase === "opening") {
			this.openingElapsed += delta;
			this.opening = this.reduced ? 1 : Math.min(1, this.openingElapsed / 900);
			if (this.opening === 1 && this.openingElapsed >= (this.reduced ? 120 : 900) && !this.navigating) {
				this.navigating = true;
				void this.finishOpening();
			}
		} else {
			this.opening = Math.max(0, this.opening - delta / 260);
			if (this.opening === 0) {
				this.phase = "idle";
				seam.disabled = false;
				if (this.focusAfterFailure) {
					this.focusAfterFailure = false;
					seam.focus({ preventScroll: true });
				}
			}
		}
		this.renderAperture();
	}

	private renderAperture(): void {
		const source = this.querySelector<SVGSVGElement>(".echo-space")!;
		const aperture = this.querySelector<SVGSVGElement>("[data-echo-aperture]")!;
		const seam = this.querySelector<HTMLButtonElement>("[data-echo-seam]")!;
		const bounds = this.dialog.getBoundingClientRect();
		const apertureKey = `${bounds.width}/${bounds.height}/${this.preview.toFixed(4)}/${this.opening.toFixed(4)}`;
		if (apertureKey === this.lastApertureKey) return;
		this.lastApertureKey = apertureKey;
		const matrix = source.getScreenCTM();
		const point = (x: number, y: number) => matrix
			? { x: matrix.a * x + matrix.c * y + matrix.e - bounds.left,
				y: matrix.b * x + matrix.d * y + matrix.f - bounds.top }
			: { x: bounds.width / 2, y: bounds.height / 2 + y - 350 };
		const center = point(600, 350);
		const top = point(600, 286);
		const bottom = point(600, 419);
		const seamHalfHeight = Math.hypot(bottom.x - top.x, bottom.y - top.y) / 2;
		aperture.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
		this.querySelector<SVGPathElement>("[data-echo-aperture-path]")!.setAttribute(
			"d",
			echoAperturePath({
				width: bounds.width,
				height: bounds.height,
				centerX: center.x,
				centerY: center.y,
				seamHalfHeight,
				preview: this.preview,
				opening: this.opening,
			}),
		);
		seam.style.left = `${center.x}px`;
		seam.style.top = `${center.y}px`;
		seam.style.height = `${Math.max(48, seamHalfHeight * 2 + 24)}px`;
	}

	private beginOpening(): void {
		if (!this.active || !this.seamReady || this.phase !== "idle" || this.exitRequested || !this.abort) return;
		this.phase = "opening";
		this.focusAfterFailure = this.keyboardFocused;
		this.touchArmed = false;
		this.openingElapsed = 0;
		this.navigating = false;
		this.querySelector<HTMLButtonElement>("[data-echo-seam]")!.disabled = true;
		this.querySelector<HTMLElement>("[data-echo-error]")!.hidden = true;
		this.whiteReady = this.prepareWhite(this.abort.signal).then(() => true, () => false);
	}

	private async prepareWhite(signal: AbortSignal): Promise<void> {
		const destination = url("/echo/white/");
		const response = await fetch(destination, {
			headers: { "X-Requested-With": "swup" },
			signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
		});
		if (!response.ok) throw new Error("White room request failed");
		const html = await response.text();
		const parsed = new DOMParser().parseFromString(html, "text/html");
		if (!parsed.querySelector("echo-white-scene"))
			throw new Error("White room scene missing");
		const swup = window.swup;
		if (!swup) return;
		if (!(swup.options.containers as string[]).every((selector) => parsed.querySelector(selector)))
			throw new Error("Incomplete white room");
		swup.cache.set(destination, { url: destination, html });
	}

	private async finishOpening(): Promise<void> {
		if (!this.whiteReady || !this.abort) return;
		const ready = await this.whiteReady;
		if (!this.active || this.abort.signal.aborted || this.exitRequested) return;
		if (!ready) {
			this.recover();
			return;
		}
		const destination = url("/echo/white/");
		const swup = window.swup;
		if (!swup) {
			location.assign(destination);
			return;
		}
		try {
			await new Promise<void>((resolve, reject) => {
				const token = {};
				let timer = 0;
				type Visit = { meta?: { echoOpening?: object } };
				const clear = () => {
					clearTimeout(timer);
					swup.hooks.off("visit:end", end);
					swup.hooks.off("visit:abort", failed);
					swup.hooks.off("visit:start", start);
					this.abort?.signal.removeEventListener("abort", cancelled);
				};
				const cancelled = () => { clear(); reject(new Error("Cancelled")); };
				const failed = (visit: Visit) => {
					if (visit.meta?.echoOpening === token) { clear(); reject(new Error("Navigation failed")); }
				};
				const start = (visit: Visit) => {
					if (visit.meta?.echoOpening !== token) cancelled();
				};
				const end = (visit: Visit) => {
					if (visit.meta?.echoOpening === token) { clear(); resolve(); }
				};
				swup.hooks.on("visit:end", end);
				swup.hooks.on("visit:abort", failed);
				swup.hooks.on("visit:start", start);
				this.abort?.signal.addEventListener("abort", cancelled, { once: true });
				timer = window.setTimeout(() => { clear(); reject(new Error("Navigation timeout")); }, 15000);
				try {
					swup.navigate(destination, { animate: false, cache: { read: true }, meta: { echoOpening: token } });
				} catch (error) { clear(); reject(error); }
			});
		} catch {
			if (this.active) this.recover();
		}
	}

	private recover(): void {
		this.phase = "recovering";
		this.navigating = false;
		this.querySelector<HTMLElement>("[data-echo-error]")!.hidden = false;
	}

	protected onVisibility(visible: boolean): void {
		this.toggleAttribute("data-paused", !visible);
	}
}
