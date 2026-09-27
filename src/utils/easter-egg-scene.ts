import {
	acquireEasterEggMusic,
	isEasterEggPath,
	releaseEasterEggMusic,
} from "./easter-egg-session";
import { url } from "./url-utils";

const scrollOwners = new Set<object>();
let previousOverflow = "";

export abstract class EasterEggScene extends HTMLElement {
	protected abort?: AbortController;
	protected active = false;
	protected reduced = false;
	protected visibleTime = 0;
	protected dialog!: HTMLDialogElement;
	protected back!: HTMLAnchorElement;
	private frame = 0;
	private lastFrame = 0;
	private hideTimer = 0;
	private previousFocus: HTMLElement | null = null;
	protected mount(backPath: string): AbortSignal {
		this.active = true;
		this.visibleTime = 0;
		this.lastFrame = 0;
		this.abort = new AbortController();
		const signal = this.abort.signal;
		this.dialog = this.querySelector<HTMLDialogElement>("dialog")!;
		this.back = this.querySelector<HTMLAnchorElement>("[data-scene-return]")!;
		this.back.hidden = true;
		this.back.href = url(backPath);
		this.previousFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		if (!scrollOwners.size)
			previousOverflow = document.documentElement.style.overflow;
		scrollOwners.add(this);
		document.documentElement.style.overflow = "hidden";
		acquireEasterEggMusic(this);
		this.dialog.showModal();
		this.dialog.focus({ preventScroll: true });
		document.documentElement.removeAttribute("data-pulse-pending");
		document.documentElement.removeAttribute("data-world-pending");
		const motion = matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => {
			this.reduced = motion.matches;
			cancelAnimationFrame(this.frame);
			this.frame = 0;
			this.lastFrame = 0;
			this.onVisibility(!document.hidden);
			if (this.reduced) this.renderFrame(0);
			if (!document.hidden) this.frame = requestAnimationFrame(this.tick);
		};
		motion.addEventListener("change", update, { signal });
		document.addEventListener("visibilitychange", update, { signal });
		window.addEventListener("blur", () => this.onVisibility(false), { signal });
		window.addEventListener("pagehide", () => this.cleanup(), { signal });
		this.dialog.addEventListener(
			"cancel",
			(event) => {
				event.preventDefault();
				this.navigate(backPath);
			},
			{ signal },
		);
		this.dialog.addEventListener(
			"keydown",
			(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					this.navigate(backPath);
				}
				if (event.key === "Tab" && this.back.hidden) this.revealReturn();
			},
			{ signal },
		);
		this.back.addEventListener(
			"click",
			(event) => {
				event.preventDefault();
				this.navigate(backPath);
			},
			{ signal },
		);
		this.back.addEventListener("focus", () => clearTimeout(this.hideTimer), {
			signal,
		});
		this.back.addEventListener("blur", () => this.revealReturn(), { signal });
		this.dialog.addEventListener(
			"click",
			(event) => {
				if (
					!(
						event.target instanceof Element &&
						event.target.closest(
							"button,a,[data-morse-panel],[data-world-dialogue]",
						)
					)
				)
					this.revealReturn();
			},
			{ signal },
		);
		update();
		this.dataset.ready = "true";
		return signal;
	}
	private tick = (time: number) => {
		if (!this.active) return;
		const delta = this.lastFrame ? Math.min(60, time - this.lastFrame) : 0;
		this.lastFrame = time;
		this.visibleTime += delta;
		this.renderFrame(delta);
		this.frame = requestAnimationFrame(this.tick);
	};
	protected abstract renderFrame(delta: number): void;
	protected onVisibility(_visible: boolean): void {}
	protected revealReturn(): void {
		this.back.hidden = false;
		clearTimeout(this.hideTimer);
		if (document.activeElement !== this.back)
			this.hideTimer = window.setTimeout(() => {
				if (document.activeElement !== this.back) this.back.hidden = true;
			}, 3000);
	}
	protected navigate(path: string): void {
		if (window.swup) void window.swup.navigate(url(path));
		else location.assign(url(path));
	}
	protected cleanup(): void {
		if (!this.active) return;
		this.active = false;
		cancelAnimationFrame(this.frame);
		clearTimeout(this.hideTimer);
		this.abort?.abort();
		this.onVisibility(false);
		this.dialog.close();
		scrollOwners.delete(this);
		if (!scrollOwners.size)
			document.documentElement.style.overflow = previousOverflow;
		document.documentElement.removeAttribute("data-pulse-pending");
		document.documentElement.removeAttribute("data-world-pending");
		// Keep the destination's blank field until its lazy controller mounts.
		// Otherwise the site wallpaper can peek through between the two scenes.
		if (!scrollOwners.size && isEasterEggPath(location.pathname))
			document.documentElement.setAttribute(
				location.pathname.replace(/\/+$/, "").endsWith("/newworld")
					? "data-world-pending"
					: "data-pulse-pending",
				"",
			);
		releaseEasterEggMusic(this);
		if (this.previousFocus?.isConnected)
			this.previousFocus.focus({ preventScroll: true });
	}
	disconnectedCallback(): void {
		this.cleanup();
	}
}

export function registerEasterEgg(
	name: string,
	constructor: CustomElementConstructor,
): void {
	if (customElements.get(name)) return;
	customElements.define(name, constructor);
	window.addEventListener("pageshow", (event) => {
		if (event.persisted)
			document
				.querySelectorAll<HTMLElement & { connectedCallback(): void }>(name)
				.forEach((scene) => scene.connectedCallback());
	});
}
