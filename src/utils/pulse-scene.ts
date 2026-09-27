import { EasterEggScene } from "./easter-egg-scene";
import { MorseInput } from "./pulse-morse";
import { getPuzzleProgress, tryUnlockWorld } from "./pulse-puzzle";
import { PulseScanner, staticPulsePath } from "./pulse-wave";
import { url } from "./url-utils";

export class PulseScene extends EasterEggScene {
	private scanner = new PulseScanner();
	private input = new MorseInput();
	private mode = false;
	private holdStart: number | null = null;
	private holdPoint: { x: number; y: number } | null = null;
	private inputSignals: Array<{
		symbol: "." | "-";
		start: number;
		end: number;
	}> = [];
	connectedCallback(): void {
		if (this.active) return;
		if (!getPuzzleProgress().unlocked) {
			document.documentElement.removeAttribute("data-pulse-pending");
			location.replace(`${url("/music/")}?find-bookmarks=1`);
			return;
		}
		this.scanner = new PulseScanner();
		this.mode = false;
		this.removeAttribute("data-morse");
		this.querySelector<SVGSVGElement>(".pulse-wave")!.setAttribute(
			"viewBox",
			"0 0 1200 400",
		);
		this.querySelector<HTMLElement>("[data-morse-panel]")!.hidden = true;
		this.input.clear();
		this.inputSignals = [];
		const signal = this.mount("/music/");
		const hold = this.querySelector<HTMLButtonElement>("[data-wave-hold]")!;
		const cancel = () => {
			this.holdStart = null;
			this.holdPoint = null;
		};
		hold.addEventListener(
			"pointerdown",
			(event) => {
				if (this.mode || event.button !== 0) return;
				hold.setPointerCapture(event.pointerId);
				this.holdStart = this.visibleTime;
				this.holdPoint = { x: event.clientX, y: event.clientY };
			},
			{ signal },
		);
		hold.addEventListener(
			"pointermove",
			(event) => {
				if (
					this.holdPoint &&
					Math.hypot(
						event.clientX - this.holdPoint.x,
						event.clientY - this.holdPoint.y,
					) > 12
				)
					cancel();
			},
			{ signal },
		);
		for (const name of [
			"pointerup",
			"pointercancel",
			"lostpointercapture",
		] as const)
			hold.addEventListener(name, cancel, { signal });
		this.dialog.addEventListener(
			"keydown",
			(event) => {
				if (
					event.repeat &&
					["ArrowUp", "ArrowDown", "Enter", "Backspace"].includes(event.key)
				) {
					event.preventDefault();
					return;
				}
				if (
					!this.mode &&
					event.code === "Space" &&
					document.activeElement === hold
				) {
					event.preventDefault();
					if (!event.repeat) this.holdStart = this.visibleTime;
					return;
				}
				if (
					!this.mode ||
					!["ArrowUp", "ArrowDown", "Enter", "Backspace"].includes(event.key)
				)
					return;
				if (
					event.key === "Enter" &&
					event.target instanceof Element &&
					event.target.closest("button,a") &&
					event.target !== hold
				)
					return;
				event.preventDefault();
				if (event.repeat) return;
				this.action(
					(
						{
							ArrowUp: "dot",
							ArrowDown: "dash",
							Enter: "confirm",
							Backspace: "undo",
						} as Record<string, string>
					)[event.key],
				);
			},
			{ signal },
		);
		this.dialog.addEventListener(
			"keyup",
			(event) => {
				if (event.code === "Space") cancel();
			},
			{ signal },
		);
		this.querySelectorAll<HTMLButtonElement>("[data-morse-action]").forEach(
			(button) =>
				button.addEventListener(
					"click",
					() => this.action(button.dataset.morseAction!),
					{ signal },
				),
		);
		const enter = this.querySelector<HTMLAnchorElement>("[data-world-entry]")!;
		enter.href = url("/newworld/");
		enter.addEventListener(
			"click",
			(event) => {
				event.preventDefault();
				this.navigate("/newworld/");
			},
			{ signal },
		);
	}
	protected onVisibility(visible: boolean): void {
		if (!visible) {
			this.holdStart = null;
			this.holdPoint = null;
		}
	}
	protected renderFrame(_delta: number): void {
		if (this.holdStart !== null && this.visibleTime - this.holdStart >= 2000)
			this.enterMode();
		const staticLine = this.querySelector<SVGPathElement>("[data-static]")!;
		const trail = this.querySelector<SVGGElement>("[data-trail]")!;
		const head = this.querySelector<SVGCircleElement>("[data-scan-head]")!;
		if (this.mode) {
			trail.replaceChildren();
			head.setAttribute("visibility", "hidden");
			const active = this.inputSignals.find(
				(item) => item.start <= this.visibleTime && item.end > this.visibleTime,
			);
			this.inputSignals = this.inputSignals.filter(
				(item) => item.end > this.visibleTime,
			);
			if (this.reduced || !active || active.symbol === "-")
				staticLine.setAttribute("d", "M0 130 H1200");
			else {
				const phase =
					(this.visibleTime - active.start) / (active.end - active.start);
				const peak = Math.sin(Math.PI * phase) * 65;
				staticLine.setAttribute(
					"d",
					`M0 130 H560 L580 ${130 - peak} L598 ${130 + peak * 0.6} L618 130 H1200`,
				);
			}
			return;
		}
		if (this.reduced) {
			staticLine.setAttribute("d", staticPulsePath());
			trail.replaceChildren();
			head.setAttribute("visibility", "hidden");
			return;
		}
		staticLine.setAttribute("d", "");
		if (this.visibleTime < 1000) return;
		const time = this.visibleTime - 1000;
		this.scanner.step(time);
		const fragment = document.createDocumentFragment();
		for (const segment of this.scanner.segments) {
			const line = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"path",
			);
			line.setAttribute(
				"d",
				`M${segment.x1} ${segment.y1} L${segment.x2} ${segment.y2}`,
			);
			line.setAttribute("stroke", "#111");
			line.setAttribute("stroke-width", "1.4");
			line.setAttribute("fill", "none");
			line.setAttribute("vector-effect", "non-scaling-stroke");
			line.setAttribute(
				"opacity",
				String(Math.max(0, 1 - Math.max(0, time - segment.born - 180) / 920)),
			);
			fragment.append(line);
		}
		trail.replaceChildren(fragment);
		head.setAttribute("cx", String(this.scanner.x));
		head.setAttribute("cy", String(this.scanner.y));
		head.setAttribute("visibility", "visible");
	}
	private enterMode(): void {
		this.mode = true;
		this.setAttribute("data-morse", "");
		this.querySelector<SVGSVGElement>(".pulse-wave")!.setAttribute(
			"viewBox",
			"0 0 1200 260",
		);
		this.holdStart = null;
		this.holdPoint = null;
		this.querySelector<HTMLElement>("[data-morse-panel]")!.hidden = false;
		this.querySelector<HTMLElement>("[data-wave-hold]")!.setAttribute(
			"aria-label",
			"摩斯输入：上键为点，下键为划，Enter 确认字母",
		);
		this.updateReadout();
	}
	private status(text: string): void {
		this.querySelector<HTMLElement>("[data-morse-status]")!.textContent = text;
	}
	private updateReadout(): void {
		this.querySelector<HTMLElement>("[data-morse-symbols]")!.textContent =
			this.input.symbols.replaceAll(".", "·").replaceAll("-", "—") || "…";
		this.querySelector<HTMLElement>("[data-morse-letters]")!.textContent =
			this.input.letters;
		this.querySelector<HTMLAnchorElement>("[data-world-entry]")!.hidden =
			!getPuzzleProgress().worldUnlocked;
	}
	private action(action: string): void {
		this.status("");
		if (action === "dot" || action === "dash") {
			const symbol = action === "dot" ? "." : "-";
			if (!this.input.append(symbol))
				this.status("当前字母过长，请确认或退格。");
			else if (!this.reduced) {
				const start = Math.max(
					this.visibleTime,
					this.inputSignals.at(-1)?.end || 0,
				);
				this.inputSignals.push({
					symbol,
					start,
					end: start + (symbol === "." ? 150 : 450),
				});
			}
		} else if (action === "confirm") {
			if (!this.input.confirm())
				this.status("这组点划不是有效字母，请修改后再确认。");
		} else if (action === "undo") this.input.undo();
		else if (action === "clear") {
			this.input.clear();
			this.inputSignals = [];
		} else if (action === "leave") {
			this.mode = false;
			this.removeAttribute("data-morse");
			this.querySelector<SVGSVGElement>(".pulse-wave")!.setAttribute(
				"viewBox",
				"0 0 1200 400",
			);
			this.inputSignals = [];
			this.scanner = new PulseScanner();
			this.visibleTime = 0;
			this.querySelector<HTMLElement>("[data-morse-panel]")!.hidden = true;
			const hold = this.querySelector<HTMLButtonElement>("[data-wave-hold]")!;
			hold.setAttribute("aria-label", "让心电线停留：按住空格");
			hold.focus();
		} else if (action === "submit") {
			if (this.input.symbols) this.status("请先确认当前字母。");
			else if (tryUnlockWorld(this.input.letters)) {
				this.status("信号已接通。");
				this.updateReadout();
				this.navigate("/newworld/");
			} else this.status("信号未接通，输入仍然保留。可以继续修改。");
		}
		this.updateReadout();
	}
}
