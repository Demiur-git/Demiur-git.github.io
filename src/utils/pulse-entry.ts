import { url } from "./url-utils";

export type PulseDestination = "newworld" | "starfield" | "echo" | "stillness";
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function ease(value: number): number {
	const x = clamp(value);
	return x * x * (3 - 2 * x);
}

export function entryDuration(
	first: boolean,
	reduced: boolean,
	flat = false,
): number {
	return flat ? 0 : reduced ? 120 : first ? 2400 : 350;
}
export function entryFrame(
	kind: PulseDestination,
	progress: number,
	initialShade = 255,
): {
	background: number;
	ink: number;
	spread: number;
	opacity: number;
} {
	const p = clamp(progress),
		unfold = ease((p - 0.04) / 0.85);
	return {
		background: Math.round(
			initialShade + ((kind === "stillness" ? 229 : 0) - initialShade) * unfold,
		),
		ink: Math.round(17 + 220 * unfold),
		spread: unfold,
		opacity: 1 - ease((p - 0.66) / 0.34),
	};
}

/** A top-layer curtain survives Swup's DOM replacement until the scene mounts. */
export class PulseEntry {
	private abort = new AbortController();
	private curtain = document.createElement("dialog");
	private frame = 0;
	private elapsed = 0;
	private previous = 0;
	private ready = false;
	private navigating = false;
	private ended = false;
	private deadline = 0;
	private priorFocus = document.activeElement;
	private svg: SVGSVGElement;
	private drawing: SVGGElement;
	private veil = document.createElement("div");
	private revealElapsed = 0;
	private revealDuration: number;
	private initialShade: number;
	private anchors: DOMPoint[];
	private dots: SVGCircleElement[];
	constructor(
		private kind: PulseDestination,
		private duration: number,
		private reduced: boolean,
		source: SVGSVGElement,
		private recover: (failed: boolean, returning: boolean) => void,
	) {
		const d = this.curtain;
		d.dataset.pulseEntry = kind;
		d.setAttribute("aria-label", "正在进入，按 Esc 取消");
		d.tabIndex = -1;
		d.style.cssText =
			"position:fixed;inset:0;margin:0;border:0;border-radius:0;outline:none;box-shadow:none;padding:0;width:100vw;height:100dvh;max-width:none;max-height:none;overflow:hidden;background:#fff;color:#111;";
		const bounds = source.getBoundingClientRect();
		const screen = source.closest("dialog")!;
		this.initialShade = Number(
			getComputedStyle(screen).backgroundColor.match(/\d+/)?.[0] ?? 255,
		);
		this.revealDuration = Math.min(duration / 2, 160);
		this.veil.style.cssText =
			"position:fixed;inset:0;pointer-events:auto;z-index:100;background:white;";
		this.veil.dataset.entryVeil = "";
		d.append(this.veil);
		this.svg = source.cloneNode(true) as SVGSVGElement;
		this.svg.removeAttribute("class");
		this.svg.setAttribute(
			"style",
			`position:absolute;left:${(bounds.left / innerWidth) * 100}%;top:${(bounds.top / innerHeight) * 100}%;width:${(bounds.width / innerWidth) * 100}%;height:${(bounds.height / innerHeight) * 100}%;overflow:visible;pointer-events:none`,
		);
		this.svg.querySelector("[data-echo-hit]")?.remove();
		this.svg.querySelector("clipPath")?.setAttribute("id", "pulse-entry-clip");
		this.svg
			.querySelector("[clip-path]")
			?.setAttribute("clip-path", "url(#pulse-entry-clip)");
		this.drawing = document.createElementNS("http://www.w3.org/2000/svg", "g");
		for (const child of Array.from(this.svg.children)) {
			if (child.tagName !== "defs") this.drawing.append(child);
		}
		this.svg.append(this.drawing);
		this.veil.append(this.svg);
		const line =
			source.querySelector<SVGPathElement>(
				'[data-echo-primary][visibility="visible"]',
			) ?? source.querySelector<SVGPathElement>("[data-static]")!;
		const transform = line.transform.baseVal.numberOfItems
			? line.transform.baseVal.getItem(0).matrix
			: undefined;
		const length = line.getTotalLength();
		const center =
			this.svg.viewBox.baseVal.height / 2 + this.svg.viewBox.baseVal.y;
		this.anchors = Array.from({ length: 22 }, (_, i) => {
			if (!length) return new DOMPoint(((i + 0.5) * 1200) / 22, center);
			const point = line.getPointAtLength((length * (i + 0.5)) / 22);
			return new DOMPoint(point.x, point.y).matrixTransform(transform);
		});
		this.dots = Array.from({ length: 22 }, (_, i) => {
			const dot = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"circle",
			);
			dot.setAttribute("opacity", "0");
			dot.setAttribute("r", String(0.7 + (i % 3) * 0.35));
			this.svg.append(dot);
			return dot;
		});
		document.body.append(d);
		d.showModal();
		d.focus({ preventScroll: true });
		const signal = this.abort.signal;
		d.addEventListener(
			"cancel",
			(e) => {
				e.preventDefault();
				this.cancel(false);
			},
			{ signal },
		);
		window.addEventListener(
			"keydown",
			(e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					this.cancel(false);
				}
				if (e.key === "Tab") e.preventDefault();
				e.stopImmediatePropagation();
			},
			{ signal, capture: true },
		);
		window.addEventListener("pagehide", () => this.dispose(), { signal });
		window.addEventListener("popstate", () => this.dispose(), { signal });
		document.addEventListener(
			"visibilitychange",
			() => {
				cancelAnimationFrame(this.frame);
				this.previous = 0;
				if (!document.hidden) this.frame = requestAnimationFrame(this.tick);
			},
			{ signal },
		);
		this.paint(0);
		this.frame = requestAnimationFrame(this.tick);
		void this.prepare();
	}
	private async prepare() {
		try {
			const destination = url(`/${this.kind}/`);
			const response = await fetch(destination, {
				headers: { "X-Requested-With": "swup" },
				signal: AbortSignal.any([
					this.abort.signal,
					AbortSignal.timeout(10000),
				]),
			});
			if (!response.ok) throw new Error("Unavailable scene");
			const html = await response.text(),
				parsed = new DOMParser().parseFromString(html, "text/html");
			const tag =
				this.kind === "newworld" ? "new-world-scene" : `${this.kind}-scene`;
			if (!parsed.querySelector(tag)) throw new Error("Missing scene");
			if (window.swup) {
				if (
					!(window.swup.options.containers as string[]).every((s) =>
						parsed.querySelector(s),
					)
				)
					throw new Error("Incomplete page");
				window.swup.cache.set(destination, { url: destination, html });
			}
			if (!this.ended) this.ready = true;
		} catch {
			if (!this.ended) this.cancel(true);
		}
	}
	private tick = (now: number) => {
		if (this.ended) return;
		const delta = this.previous ? Math.min(60, now - this.previous) : 0;
		this.previous = now;
		this.elapsed += delta;
		const drawingDuration = this.duration - this.revealDuration;
		const p = drawingDuration ? clamp(this.elapsed / drawingDuration) : 1;
		if (!this.navigating) this.paint(p);
		if (p === 1 && this.ready && !this.navigating) this.commit();
		if (this.navigating) {
			this.deadline += delta;
			const tag =
				this.kind === "newworld" ? "new-world-scene" : `${this.kind}-scene`;
			const scene = document.querySelector(`${tag}[data-ready="true"]`);
			if (scene?.hasAttribute("data-frame-painted")) {
				// The destination dialog is now the top modal. Transfer the opaque surface
				// into it so its first painted frame is already underneath the reveal.
				const target = scene.querySelector<HTMLDialogElement>("dialog")!;
				if (this.veil.parentElement !== target) target.append(this.veil);
				else this.revealElapsed += delta;
				const reveal = this.revealDuration
					? ease(this.revealElapsed / this.revealDuration)
					: 1;
				this.veil.style.opacity = String(1 - reveal);
				if (reveal < 1) {
					this.frame = requestAnimationFrame(this.tick);
					return;
				}
				this.dispose();
				scene
					.querySelector<HTMLDialogElement>("dialog")
					?.focus({ preventScroll: true });
				return;
			}
			if (this.deadline > 10000) {
				this.cancel(true);
				return;
			}
		}
		this.frame = requestAnimationFrame(this.tick);
	};
	private paint(p: number) {
		const f = entryFrame(this.kind, p, this.initialShade);
		const t = f.spread;
		const shade = f.background;
		this.veil.style.background = `rgb(${shade},${shade},${shade})`;
		this.curtain.style.background = "transparent";
		this.veil.style.opacity = String(
			this.navigating || !this.duration ? 1 : ease(p / 0.16),
		);
		this.svg.style.opacity = String(f.opacity);
		if (this.reduced) return;
		const center =
			this.svg.viewBox.baseVal.y + this.svg.viewBox.baseVal.height / 2;
		const scaleX = this.kind === "newworld" ? 1 - 0.8 * t : 1;
		const scaleY = 1 - 0.96 * t;
		const tilt = this.kind === "echo" ? 0.15 * t : 0;
		this.drawing.setAttribute(
			"transform",
			`matrix(${scaleX} ${tilt} 0 ${scaleY} ${600 * (1 - scaleX)} ${center * (1 - scaleY) - 600 * tilt})`,
		);
		this.drawing.style.filter = t ? `invert(${t})` : "";
		if (this.kind !== "starfield") return;
		this.drawing.style.opacity = String(1 - t);
		this.dots.forEach((dot, i) => {
			const origin = this.anchors[i];
			dot.setAttribute("cx", String(origin.x + Math.sin(i * 8.3) * 320 * t));
			dot.setAttribute("cy", String(origin.y + Math.cos(i * 3.7) * 180 * t));
			dot.setAttribute("fill", `rgb(${f.ink},${f.ink},${f.ink})`);
			dot.setAttribute("opacity", String(t));
		});
	}
	private commit() {
		this.navigating = true;
		const destination = url(`/${this.kind}/`);
		if (window.swup) {
			void Promise.resolve(
				window.swup.navigate(destination, {
					animate: false,
					cache: { read: true },
				}),
			).catch(() => this.cancel(true));
		} else location.assign(destination);
	}
	/** Source teardown during the intended handoff must not expose the wallpaper. */
	leaveSource(): void {
		if (
			!this.navigating ||
			location.pathname.replace(/\/+$/, "") !==
				url(`/${this.kind}/`).replace(/\/+$/, "")
		)
			this.dispose();
	}
	cancel(failed: boolean): void {
		if (this.ended) return;
		this.dispose();
		this.recover(failed, this.navigating);
		if (this.navigating) {
			if (window.swup)
				void window.swup.navigate(url("/pulse/"), { animate: false });
			else location.assign(url("/pulse/"));
		}
		if (this.priorFocus instanceof HTMLElement && this.priorFocus.isConnected)
			this.priorFocus.focus({ preventScroll: true });
	}
	dispose(): void {
		this.ended = true;
		this.abort.abort();
		cancelAnimationFrame(this.frame);
		this.curtain.close();
		this.curtain.remove();
		this.veil.remove();
	}
}
