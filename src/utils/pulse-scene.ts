import { EasterEggScene } from "./easter-egg-scene";
import { MorseInput } from "./pulse-morse";
import {
	advanceEchoHold,
	clampEchoOffset,
	DEFAULT_ECHO_RESIDUE,
	draggedEchoResidue,
	echoAligned,
	echoCloseness,
	echoResidueAvailable,
	echoResiduePath,
	ECHO_RESIDUE_REVEAL_MS,
	ECHO_HOLD_MS,
	ECHO_PATH,
	ECHO_START,
	pickEchoResidue,
	type EchoResidue,
} from "./pulse-echo";
import {
	getPuzzleProgress,
	tryUnlockStarfield,
	tryUnlockWorld,
	unlockEcho,
} from "./pulse-puzzle";
import { pulseScenePath } from "./pulse-route";
import { PulseScanner, staticPulsePath } from "./pulse-wave";
import { url } from "./url-utils";

export class PulseScene extends EasterEggScene {
	private scanner = new PulseScanner();
	private input = new MorseInput();
	private mode = false;
	private echoMode = false;
	private echoSucceeded = false;
	private echoTarget: { x: number; y: number } = { ...ECHO_START };
	private echoPosition: { x: number; y: number } = { ...ECHO_START };
	private echoHold = 0;
	private echoArmed = false;
	private echoEligible = false;
	private echoEligibleAt = 0;
	private residueReady = false;
	private residue: EchoResidue | null = null;
	private residueRendered = false;
	private echoDrag: {
		x: number;
		y: number;
		offsetX: number;
		offsetY: number;
	} | null = null;
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
		if (
			location.pathname.replace(/\/+$/, "") ===
			url("/pulse/").replace(/\/+$/, "")
		)
			history.replaceState(
				history.state,
				"",
				`${pulseScenePath()}${location.search}${location.hash}`,
			);
		this.scanner = new PulseScanner();
		this.mode = false;
		this.echoMode = false;
		this.echoSucceeded = false;
		this.echoTarget = { ...ECHO_START };
		this.echoPosition = { ...ECHO_START };
		this.echoHold = 0;
		this.echoArmed = false;
		const progress = getPuzzleProgress();
		this.echoEligible = progress.unlocked && progress.echoClueSeen;
		this.echoEligibleAt = 0;
		this.residueReady = this.echoEligible && progress.echoUnlocked;
		this.residue = this.residueReady ? { ...DEFAULT_ECHO_RESIDUE } : null;
		this.residueRendered = false;
		this.removeAttribute("data-echo");
		this.removeAttribute("data-morse");
		this.querySelector<SVGSVGElement>(".pulse-wave")!.setAttribute(
			"viewBox",
			"0 0 1200 400",
		);
		this.querySelector<HTMLElement>("[data-morse-panel]")!.hidden = true;
		this.input.clear();
		this.inputSignals = [];
		const signal = this.mount("/music/");
		const refreshAccess = () => {
			if (!this.active) return;
			const current = getPuzzleProgress();
			if (!current.unlocked) {
				this.navigate("/music/");
				return;
			}
			const wasEligible = this.echoEligible;
			this.echoEligible = current.echoClueSeen;
			if (!this.echoEligible) {
				this.echoEligibleAt = this.visibleTime;
				this.echoMode = false;
				this.echoSucceeded = false;
				this.echoDrag = null;
				this.echoArmed = false;
				this.echoHold = 0;
				this.residueReady = false;
				this.residue = null;
				this.removeAttribute("data-echo");
				this.querySelector<HTMLButtonElement>("[data-echo-leave]")!.hidden =
					true;
				this.querySelector<HTMLElement>("[data-echo-status]")!.textContent = "";
				if (document.activeElement === this.querySelector("[data-echo-handle]"))
					this.querySelector<HTMLButtonElement>("[data-wave-hold]")!.focus();
				this.hideResidue();
				return;
			}
			if (!wasEligible) {
				// A clue opened in another tab starts its own three-scan wait.
				this.echoEligibleAt = this.visibleTime;
				this.residueReady = false;
				this.residue = null;
				this.hideResidue();
			}
			if (
				echoResidueAvailable(
					this.echoEligible,
					this.visibleTime - this.echoEligibleAt,
					this.reduced,
					current.echoUnlocked,
				)
			) {
				this.residueReady = true;
				this.residue ??= { ...DEFAULT_ECHO_RESIDUE };
				if (!this.echoMode && !this.mode) this.renderResidue();
			}
		};
		window.addEventListener("pulse:progress", refreshAccess, { signal });
		window.addEventListener("storage", refreshAccess, { signal });
		this.querySelector<SVGPathElement>("[data-echo-primary]")!.setAttribute(
			"d",
			ECHO_PATH,
		);
		this.querySelector<SVGPathElement>("[data-echo-ghost]")!.setAttribute(
			"d",
			ECHO_PATH,
		);
		const echo = this.querySelector<HTMLButtonElement>("[data-echo-handle]")!;
		echo.addEventListener(
			"pointerdown",
			(event) => {
				if (
					this.mode ||
					this.echoSucceeded ||
					!this.echoEligible ||
					!this.residueReady ||
					event.button !== 0
				)
					return;
				if (getPuzzleProgress().echoUnlocked) {
					event.preventDefault();
					this.navigate("/echo/");
					return;
				}
				echo.setPointerCapture(event.pointerId);
				this.echoDrag = {
					x: event.clientX,
					y: event.clientY,
					offsetX: this.echoTarget.x,
					offsetY: this.echoTarget.y,
				};
			},
			{ signal },
		);
		echo.addEventListener(
			"pointermove",
			(event) => {
				if (!this.echoDrag) return;
				if (!this.echoMode) {
					if (
						!draggedEchoResidue(
							this.echoDrag.x,
							this.echoDrag.y,
							event.clientX,
							event.clientY,
						)
					)
						return;
					this.enterEchoMode();
				}
				if (!this.echoMode) return;
				const bounds =
					this.querySelector<SVGSVGElement>(
						".pulse-wave",
					)!.getBoundingClientRect();
				this.echoTarget = clampEchoOffset(
					this.echoDrag.offsetX +
						((event.clientX - this.echoDrag.x) * 1200) /
							Math.max(1, bounds.width),
					this.echoDrag.offsetY +
						((event.clientY - this.echoDrag.y) * 400) /
							Math.max(1, bounds.height),
				);
			},
			{ signal },
		);
		for (const name of [
			"pointerup",
			"pointercancel",
			"lostpointercapture",
		] as const)
			echo.addEventListener(
				name,
				() => {
					this.echoDrag = null;
				},
				{ signal },
			);
		this.querySelector<HTMLButtonElement>(
			"[data-echo-leave]",
		)!.addEventListener("click", () => this.leaveEchoMode(), { signal });
		echo.addEventListener(
			"blur",
			() => {
				if (!this.echoMode) this.echoArmed = false;
			},
			{ signal },
		);
		window.addEventListener(
			"resize",
			() => {
				this.residueRendered = false;
				this.renderResidue();
			},
			{ signal },
		);
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
					document.activeElement === echo &&
					[
						"Enter",
						"Space",
						"ArrowLeft",
						"ArrowRight",
						"ArrowUp",
						"ArrowDown",
					].includes(event.code)
				) {
					event.preventDefault();
					if (!this.echoEligible || !this.residueReady) return;
					if (getPuzzleProgress().echoUnlocked) {
						if (!event.repeat && ["Enter", "Space"].includes(event.code))
							this.navigate("/echo/");
						return;
					}
					if (["Enter", "Space"].includes(event.code)) {
						this.echoArmed = true;
						return;
					}
					if (!this.echoArmed) return;
					if (!this.echoMode) this.enterEchoMode();
					if (!this.echoMode) return;
					const step = event.shiftKey ? 24 : 8;
					this.echoTarget = clampEchoOffset(
						this.echoTarget.x +
							(event.code === "ArrowLeft"
								? -step
								: event.code === "ArrowRight"
									? step
									: 0),
						this.echoTarget.y +
							(event.code === "ArrowUp"
								? -step
								: event.code === "ArrowDown"
									? step
									: 0),
					);
					return;
				}
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
		const stars = this.querySelector<HTMLAnchorElement>(
			"[data-starfield-entry]",
		)!;
		stars.href = url("/starfield/");
		stars.addEventListener(
			"click",
			(event) => {
				event.preventDefault();
				this.navigate("/starfield/");
			},
			{ signal },
		);
	}
	protected onVisibility(visible: boolean): void {
		if (!visible) {
			this.holdStart = null;
			this.holdPoint = null;
			this.echoDrag = null;
			this.echoArmed = false;
		}
	}
	protected renderFrame(delta: number): void {
		if (this.holdStart !== null && this.visibleTime - this.holdStart >= 2000)
			this.enterMode();
		const staticLine = this.querySelector<SVGPathElement>("[data-static]")!;
		const trail = this.querySelector<SVGGElement>("[data-trail]")!;
		const head = this.querySelector<SVGCircleElement>("[data-scan-head]")!;
		const primary = this.querySelector<SVGPathElement>("[data-echo-primary]")!;
		const ghost = this.querySelector<SVGPathElement>("[data-echo-ghost]")!;
		if (this.echoMode) {
			this.hideResidue(true);
			trail.replaceChildren();
			staticLine.setAttribute("d", "");
			head.setAttribute("visibility", "hidden");
			primary.setAttribute("visibility", "visible");
			ghost.setAttribute("visibility", "visible");
			const easing = this.reduced ? 1 : Math.min(1, delta / 140);
			this.echoPosition.x += (this.echoTarget.x - this.echoPosition.x) * easing;
			this.echoPosition.y += (this.echoTarget.y - this.echoPosition.y) * easing;
			ghost.setAttribute(
				"transform",
				`translate(${this.echoPosition.x.toFixed(2)} ${this.echoPosition.y.toFixed(2)})`,
			);
			const closeness = echoCloseness(this.echoPosition.x, this.echoPosition.y);
			ghost.setAttribute("opacity", String((0.4 + closeness * 0.6).toFixed(2)));
			primary.setAttribute(
				"stroke-width",
				String((1.6 + closeness * 0.7).toFixed(2)),
			);
			this.echoHold = advanceEchoHold(
				this.echoHold,
				delta,
				echoAligned(this.echoPosition.x, this.echoPosition.y),
			);
			if (
				!this.echoSucceeded &&
				this.echoHold >= ECHO_HOLD_MS &&
				unlockEcho()
			) {
				this.echoSucceeded = true;
				this.querySelector<HTMLElement>("[data-echo-status]")!.textContent =
					"两道信号重合了。";
				const timer = window.setTimeout(
					() => {
						if (this.active && getPuzzleProgress().echoUnlocked)
							this.navigate("/echo/");
					},
					this.reduced ? 120 : 500,
				);
				this.abort?.signal.addEventListener(
					"abort",
					() => clearTimeout(timer),
					{ once: true },
				);
			}
			return;
		}
		primary.setAttribute("visibility", "hidden");
		ghost.setAttribute("visibility", "hidden");
		if (this.mode) {
			this.hideResidue();
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
			if (this.echoEligible) {
				this.residueReady = true;
				this.residue ??= { ...DEFAULT_ECHO_RESIDUE };
			}
			this.renderResidue();
			return;
		}
		staticLine.setAttribute("d", "");
		if (this.visibleTime < 1000) {
			this.renderResidue();
			return;
		}
		const time = this.visibleTime - 1000;
		this.scanner.step(time);
		if (
			this.echoEligible &&
			!this.residue &&
			this.visibleTime - this.echoEligibleAt >= 9000 &&
			this.visibleTime - this.echoEligibleAt < ECHO_RESIDUE_REVEAL_MS &&
			this.scanner.x > 900
		)
			this.residue = pickEchoResidue(this.scanner.segments);
		if (
			echoResidueAvailable(
				this.echoEligible,
				this.visibleTime - this.echoEligibleAt,
				false,
				false,
			)
		) {
			this.residueReady = true;
			this.residue ??= { ...DEFAULT_ECHO_RESIDUE };
		}
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
		this.renderResidue();
	}
	private hideResidue(keepHandle = false): void {
		this.querySelector<SVGPathElement>("[data-echo-residue]")!.setAttribute(
			"visibility",
			"hidden",
		);
		if (!keepHandle)
			this.querySelector<HTMLButtonElement>("[data-echo-handle]")!.hidden =
				true;
		this.residueRendered = false;
	}
	private renderResidue(): void {
		if (
			!this.echoEligible ||
			!this.residueReady ||
			this.echoMode ||
			this.mode
		) {
			this.hideResidue();
			return;
		}
		if (this.residueRendered) return;
		const wave = this.querySelector<SVGSVGElement>(".pulse-wave")!;
		const bounds = wave.getBoundingClientRect();
		const residue = this.residue ?? DEFAULT_ECHO_RESIDUE;
		const mark = this.querySelector<SVGPathElement>("[data-echo-residue]")!;
		mark.setAttribute("d", echoResiduePath(residue, bounds.width));
		mark.setAttribute("visibility", "visible");
		const handle = this.querySelector<HTMLButtonElement>("[data-echo-handle]")!;
		handle.style.setProperty(
			"--echo-hit-x",
			`${bounds.left + (residue.x / 1200) * bounds.width}px`,
		);
		handle.style.setProperty(
			"--echo-hit-y",
			`${bounds.top + (residue.y / 400) * bounds.height}px`,
		);
		handle.hidden = false;
		this.residueRendered = true;
	}
	private enterEchoMode(): void {
		if (this.echoMode || this.mode || !this.echoEligible || !this.residueReady)
			return;
		this.echoMode = true;
		this.echoArmed = false;
		this.holdStart = null;
		this.holdPoint = null;
		this.echoHold = 0;
		this.setAttribute("data-echo", "");
		this.querySelector<HTMLButtonElement>("[data-echo-leave]")!.hidden = false;
		this.querySelector<HTMLElement>("[data-echo-status]")!.textContent =
			"另一条心跳正在靠近。";
	}
	private leaveEchoMode(): void {
		if (this.echoSucceeded) return;
		this.echoMode = false;
		this.echoArmed = false;
		this.echoDrag = null;
		this.echoHold = 0;
		this.echoTarget = { ...ECHO_START };
		this.echoPosition = { ...ECHO_START };
		this.removeAttribute("data-echo");
		this.querySelector<HTMLButtonElement>("[data-echo-leave]")!.hidden = true;
		this.querySelector<HTMLElement>("[data-echo-status]")!.textContent = "";
		this.residueRendered = false;
		this.renderResidue();
		this.querySelector<HTMLButtonElement>("[data-echo-handle]")!.focus();
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
		this.echoArmed = false;
		this.hideResidue();
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
		this.querySelector<HTMLAnchorElement>("[data-starfield-entry]")!.hidden =
			!getPuzzleProgress().starfieldUnlocked;
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
			this.echoEligibleAt = 0;
			this.residueRendered = false;
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
			} else if (tryUnlockStarfield(this.input.letters)) {
				this.status("信号已接通。");
				this.updateReadout();
				this.navigate("/starfield/");
			} else this.status("信号未接通，输入仍然保留。可以继续修改。");
		}
		this.updateReadout();
	}
}
