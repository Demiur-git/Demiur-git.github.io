import { pulsePuzzle } from "../config/pulsePuzzle";
import { EasterEggScene } from "./easter-egg-scene";
import { getPuzzleProgress } from "./pulse-puzzle";
import {
	THRONE_STRUCTURE,
	buildThroneThreads,
	orderThroneMarks,
	projectThrone,
	throneView,
} from "./throne-geometry";
import { returnHomeThroughWhite } from "./world-return";
import { url } from "./url-utils";

export class NewWorldScene extends EasterEggScene {
	private discovered = false;
	private moving = false;
	private progress = 0;
	private lastGeometry = "";
	private ripples: Array<{ x: number; y: number; born: number }> = [];
	private phase: "space" | "dialogue" | "rest" | "returning" = "space";
	private walkTime = 0;
	private walkStrength = 0;
	private geometryTime = -100;
	private marks = new Map<string, SVGElement>();
	private line = 0;
	private shown = 0;
	private lineTime = 0;
	private completedAt = 0;
	private auto = false;
	connectedCallback(): void {
		if (this.active) return;
		if (!getPuzzleProgress().worldUnlocked) {
			document.documentElement.removeAttribute("data-world-pending");
			location.replace(url("/pulse/"));
			return;
		}
		this.discovered = false;
		this.moving = false;
		this.progress = 0;
		this.phase = "space";
		this.ripples = [];
		this.lastGeometry = "";
		this.auto = false;
		this.walkTime = 0;
		this.walkStrength = 0;
		this.geometryTime = -100;
		this.marks.clear();
		this.querySelector<HTMLElement>("[data-world-throne]")!.replaceChildren();
		this.querySelector<HTMLElement>("[data-world-choice]")!.hidden = true;
		this.querySelector<HTMLButtonElement>("[data-world-home]")!.disabled =
			false;
		this.querySelector<HTMLElement>("[data-world-dialogue]")!.hidden = true;
		this.querySelector<HTMLElement>("[data-world-forward]")!.hidden = true;
		this.querySelector<HTMLElement>("[data-world-error]")!.textContent = "";
		this.querySelector<HTMLElement>("[data-world-auto]")!.setAttribute(
			"aria-pressed",
			"false",
		);
		this.querySelector<HTMLElement>("[data-world-auto]")!.setAttribute(
			"aria-label",
			"自动推进：关闭",
		);
		const signal = this.mount("/pulse/");
		this.querySelector<HTMLButtonElement>(
			"[data-world-home]",
		)!.addEventListener(
			"click",
			() => {
				void this.returnHome();
			},
			{ signal },
		);
		const forward = this.querySelector<HTMLButtonElement>(
			"[data-world-forward]",
		)!;
		forward.addEventListener(
			"pointerdown",
			(event) => {
				if (event.button !== 0 || this.phase !== "space") return;
				event.preventDefault();
				forward.setPointerCapture(event.pointerId);
				this.moving = true;
			},
			{ signal },
		);
		for (const name of [
			"pointerup",
			"pointercancel",
			"lostpointercapture",
		] as const)
			forward.addEventListener(
				name,
				() => {
					this.moving = false;
				},
				{ signal },
			);
		this.dialog.addEventListener(
			"click",
			(event) => {
				if (this.phase === "returning") return;
				if (event.target instanceof Element && event.target.closest("button,a"))
					return;
				if (this.phase === "dialogue") {
					this.advanceDialogue();
					return;
				}
				this.addRipple(event.clientX, event.clientY);
			},
			{ signal },
		);
		this.dialog.addEventListener(
			"keydown",
			(event) => {
				if (this.phase === "returning") return;
				if (event.key === "Escape" || event.key === "Tab") return;
				if (
					event.target instanceof Element &&
					event.target.closest("button,a") &&
					!["ArrowUp", "w", "W"].includes(event.key)
				)
					return;
				if (this.phase === "dialogue" && ["Enter", " "].includes(event.key)) {
					event.preventDefault();
					if (!event.repeat) this.advanceDialogue();
				} else if (
					this.phase === "space" &&
					["ArrowUp", "w", "W"].includes(event.key)
				) {
					event.preventDefault();
					if (!this.discovered) this.addRipple(innerWidth / 2, innerHeight / 2);
					this.moving = true;
				} else if (
					this.phase !== "dialogue" &&
					["Enter", " "].includes(event.key)
				) {
					event.preventDefault();
					if (!event.repeat) this.addRipple(innerWidth / 2, innerHeight / 2);
				}
			},
			{ signal },
		);
		this.dialog.addEventListener(
			"keyup",
			(event) => {
				if (["ArrowUp", "w", "W"].includes(event.key)) this.moving = false;
			},
			{ signal },
		);
		const auto = this.querySelector<HTMLButtonElement>("[data-world-auto]")!;
		auto.addEventListener(
			"click",
			() => {
				this.auto = !this.auto;
				auto.setAttribute("aria-pressed", String(this.auto));
				auto.setAttribute(
					"aria-label",
					`自动推进：${this.auto ? "开启" : "关闭"}`,
				);
				this.completedAt = this.visibleTime;
			},
			{ signal },
		);
		window.addEventListener(
			"resize",
			() => {
				this.lastGeometry = "";
			},
			{ signal },
		);
	}
	protected onVisibility(visible: boolean): void {
		if (!visible) this.moving = false;
	}
	private addRipple(x: number, y: number): void {
		this.ripples.push({ x, y, born: this.visibleTime });
		this.ripples = this.ripples.slice(-8);
		if (!this.discovered) {
			this.discovered = true;
			this.querySelector<HTMLButtonElement>("[data-world-forward]")!.hidden =
				false;
		}
	}
	protected renderFrame(delta: number): void {
		if (this.phase === "returning") return;
		const walking = this.moving && this.phase === "space";
		if (walking) this.walkTime += delta;
		this.walkStrength = Math.max(
			0,
			Math.min(1, this.walkStrength + ((walking ? 1 : -1) * delta) / 150),
		);
		if (this.moving && this.phase === "space") {
			this.progress = Math.min(1, this.progress + delta / 4000);
			if (this.progress >= 1) {
				this.moving = false;
				this.beginDialogue();
			}
		}
		const svg = this.querySelector<SVGSVGElement>("svg.world-art")!;
		svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
		const position = this.reduced
			? this.progress >= 1
				? 1
				: this.progress >= 0.5
					? 0.5
					: 0
			: this.progress;
		const geometryKey = `${innerWidth}/${innerHeight}/${this.discovered}/${position}`;
		if (
			geometryKey !== this.lastGeometry ||
			(!this.reduced &&
				this.discovered &&
				this.visibleTime - this.geometryTime >= 32)
		) {
			this.renderGeometry();
			this.lastGeometry = geometryKey;
			this.geometryTime = this.visibleTime;
		}
		this.ripples = this.ripples.filter(
			(ripple) => this.visibleTime - ripple.born < 1800,
		);
		const rippleGroup = this.querySelector<SVGGElement>(
			"[data-world-ripples]",
		)!;
		const fragment = document.createDocumentFragment();
		for (const ripple of this.ripples) {
			const age = (this.visibleTime - ripple.born) / 1800;
			const circle = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"circle",
			);
			circle.setAttribute("cx", String(ripple.x));
			circle.setAttribute("cy", String(ripple.y));
			circle.setAttribute("r", String(this.reduced ? 30 : 10 + age * 180));
			circle.setAttribute("fill", "none");
			circle.setAttribute("stroke", "#59636a");
			circle.setAttribute("stroke-width", "1");
			circle.setAttribute(
				"opacity",
				String(this.reduced ? 0.25 : (1 - age) * 0.45),
			);
			fragment.append(circle);
		}
		rippleGroup.replaceChildren(fragment);
		if (this.phase === "dialogue") {
			const text = pulsePuzzle.worldDialogue[this.line].text;
			const count = this.reduced
				? text.length
				: Math.min(
						text.length,
						Math.floor((this.visibleTime - this.lineTime) / 45),
					);
			if (count !== this.shown) {
				this.shown = count;
				this.querySelector<HTMLElement>("[data-world-words]")!.textContent =
					text.slice(0, count);
				if (count === text.length) this.completedAt = this.visibleTime;
			}
			if (
				this.auto &&
				this.shown === text.length &&
				this.visibleTime - this.completedAt >= 2500 &&
				this.line < pulsePuzzle.worldDialogue.length - 1
			)
				this.nextLine();
		}
	}
	private renderGeometry(): void {
		const group = this.querySelector<SVGGElement>("[data-world-throne]")!;
		if (!this.discovered) {
			group.replaceChildren();
			return;
		}
		const position = this.reduced
			? this.progress >= 1
				? 1
				: this.progress >= 0.5
					? 0.5
					: 0
			: this.progress;
		const bob = this.reduced
			? 0
			: Math.sin((this.walkTime / 1000) * Math.PI * 2 * 1.6) *
				this.walkStrength *
				(innerWidth <= 480 ? 1 : 2);
		const view = throneView(innerWidth, innerHeight, position, bob);
		const glow = this.reduced
			? 0.15
			: 0.15 + Math.sin((this.visibleTime / 6000) * Math.PI * 2) * 0.025;
		const ordered = orderThroneMarks([
			...THRONE_STRUCTURE,
			...buildThroneThreads(this.reduced ? 0 : this.visibleTime),
		]);
		for (const mark of ordered) {
			let element = this.marks.get(mark.id);
			if (!element) {
				element = document.createElementNS("http://www.w3.org/2000/svg", "g");
				element.setAttribute("data-mark", mark.id);
				this.marks.set(mark.id, element);
				group.append(element);
			}
			const d =
				mark.points
					.map(
						(point, index) =>
							`${index ? "L" : "M"}${projectThrone(point, view)
								.map((v) => v.toFixed(2))
								.join(" ")}`,
					)
					.join(" ") + (mark.face ? " Z" : "");
			const path = (index: number) => {
				while (element!.children.length <= index)
					element!.append(
						document.createElementNS("http://www.w3.org/2000/svg", "path"),
					);
				return element!.children[index];
			};
			const line = path(mark.glow ? 1 : 0);
			const fill = mark.material === "side" ? "#d8d8d8" : "#fff";
			line.setAttribute("d", d);
			line.setAttribute("fill", mark.face ? fill : "none");
			line.setAttribute(
				"stroke",
				mark.face ? "none" : mark.material === "detail" ? "#545454" : "#fff",
			);
			line.setAttribute(
				"stroke-width",
				String(mark.width ?? [1.05, 0.7, 0.45][mark.level]),
			);
			line.setAttribute("stroke-linejoin", "round");
			line.setAttribute("stroke-linecap", "round");
			line.setAttribute(
				"opacity",
				String(mark.face ? 1 : mark.opacity * (0.65 + position * 0.35)),
			);
			if (mark.glow) {
				const halo = path(0);
				halo.setAttribute("d", d);
				halo.setAttribute("fill", "none");
				halo.setAttribute("stroke", "#ebeeee");
				halo.setAttribute("stroke-width", "2");
				halo.setAttribute("opacity", String(glow));
				halo.setAttribute("filter", "url(#throne-line-glow)");
			}
		}
	}
	private beginDialogue(): void {
		this.phase = "dialogue";
		this.line = 0;
		this.querySelector<HTMLButtonElement>("[data-world-forward]")!.hidden =
			true;
		this.querySelector<HTMLElement>("[data-world-dialogue]")!.hidden = false;
		this.showLine();
		this.dialog.focus({ preventScroll: true });
	}
	private showLine(): void {
		this.shown = 0;
		this.lineTime = this.visibleTime;
		this.completedAt = this.visibleTime;
		const item = pulsePuzzle.worldDialogue[this.line];
		this.querySelector<HTMLElement>("[data-world-speaker]")!.textContent =
			item.speaker;
		this.querySelector<HTMLElement>("[data-world-accessible]")!.textContent =
			item.text;
		this.querySelector<HTMLElement>("[data-world-words]")!.textContent = "";
		this.querySelector<HTMLElement>("[data-world-count]")!.textContent =
			`${this.line + 1} / ${pulsePuzzle.worldDialogue.length}`;
	}
	private nextLine(): void {
		this.line++;
		this.showLine();
	}
	private advanceDialogue(): void {
		const text = pulsePuzzle.worldDialogue[this.line].text;
		if (this.shown < text.length) {
			this.shown = text.length;
			this.lineTime = this.visibleTime - text.length * 45;
			this.completedAt = this.visibleTime;
			this.querySelector<HTMLElement>("[data-world-words]")!.textContent = text;
		} else if (this.line < pulsePuzzle.worldDialogue.length - 1)
			this.nextLine();
		else {
			this.phase = "rest";
			this.querySelector<HTMLElement>("[data-world-dialogue]")!.hidden = true;
			this.querySelector<HTMLElement>("[data-world-choice]")!.hidden = false;
			this.querySelector<HTMLButtonElement>("[data-world-home]")!.focus({
				preventScroll: true,
			});
		}
	}
	private async returnHome(): Promise<void> {
		if (this.phase !== "rest" || !this.abort) return;
		this.phase = "returning";
		this.moving = false;
		this.auto = false;
		const button = this.querySelector<HTMLButtonElement>("[data-world-home]")!;
		button.disabled = true;
		this.querySelector<HTMLElement>("[data-world-error]")!.textContent = "";
		const returned = await returnHomeThroughWhite(
			this,
			this.reduced,
			this.abort.signal,
		);
		if (!returned && this.isConnected && this.active) {
			this.phase = "rest";
			button.disabled = false;
			this.querySelector<HTMLElement>("[data-world-error]")!.textContent =
				"主页暂时未能打开，请重试。";
			button.focus({ preventScroll: true });
		}
	}
}
