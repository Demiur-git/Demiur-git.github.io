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
	isStillnessReady,
	tryUnlockStarfield,
	tryUnlockWorld,
	unlockEcho,
	unlockStillness,
} from "./pulse-puzzle";
import { pulseScenePath } from "./pulse-route";
import { PulseScanner, pulseWaveGeometry, staticPulsePath } from "./pulse-wave";
import { coolStillnessRhythm, emptyStillnessRhythm, stillnessIntensity, strikeStillnessRhythm, type RhythmKey } from "./stillness-rhythm";
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
	private stillness = emptyStillnessRhythm();
	private stillnessEligible = false;
	private stillnessUnlocked = false;
	private flatlineElapsed: number | null = null;
	private stillnessNavigating = false;
	private warningStrength = 0;
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
		this.stillness = emptyStillnessRhythm();
		this.stillnessEligible = isStillnessReady(progress);
		this.stillnessUnlocked = progress.stillnessUnlocked;
		this.flatlineElapsed = null;
		this.stillnessNavigating = false;
		this.warningStrength = 0;
		this.removeAttribute("data-stillness-building");
		this.removeAttribute("data-flatline");
		this.querySelector<HTMLDialogElement>("dialog")!.style.removeProperty("--stillness-bg");
		this.querySelector<HTMLDialogElement>("dialog")!.style.removeProperty("--stillness-warning");
		this.querySelector<HTMLElement>("[data-stillness-status]")!.textContent = "";
		const signal = this.mount("/music/");
		this.updateStillnessAccess();
		const onStillnessAbort = (visit: { to?: { url?: string } }) => {
			if (!this.stillnessNavigating || !this.active || !visit.to?.url?.includes("/stillness/")) return;
			this.recoverStillnessNavigation();
		};
		window.swup?.hooks.on("visit:abort", onStillnessAbort);
		signal.addEventListener("abort", () => window.swup?.hooks.off("visit:abort", onStillnessAbort), { once: true });
		const refreshAccess = () => {
			if (!this.active) return;
			const current = getPuzzleProgress();
			if (!current.unlocked) {
				this.navigate("/music/");
				return;
			}
			this.stillnessEligible = isStillnessReady(current);
			this.stillnessUnlocked = current.stillnessUnlocked;
			if (!this.stillnessEligible) this.resetStillness();
			this.updateStillnessAccess();
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
		this.querySelectorAll<HTMLButtonElement>("[data-stillness-key]").forEach((button) =>
			button.addEventListener("click", () => this.stillnessStrike(button.dataset.stillnessKey as RhythmKey), { signal }),
		);
		this.querySelector<HTMLButtonElement>("[data-stillness-revisit]")!.addEventListener("click", () => {
			if (getPuzzleProgress().stillnessUnlocked && isStillnessReady(getPuzzleProgress())) this.navigate("/stillness/");
		}, { signal });
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
				if (this.mode || this.flatlineElapsed !== null || event.button !== 0) return;
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
			if ((event.code === "KeyJ" || event.code === "KeyK") && !this.mode && !this.echoMode && this.flatlineElapsed === null) {
				if (event.target instanceof Element && event.target.closest("input,textarea,select,a")) return;
				event.preventDefault();
				if (event.repeat) return;
				if (!this.stillnessEligible) return;
				this.stillnessStrike(event.code === "KeyJ" ? "J" : "K");
				return;
			}
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
					this.flatlineElapsed === null &&
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
	private updateStillnessAccess(): void {
		this.querySelector<HTMLElement>("[data-stillness-keys]")!.hidden =
			!this.stillnessEligible || this.stillnessUnlocked || this.mode || this.echoMode || this.flatlineElapsed !== null;
		this.querySelector<HTMLButtonElement>("[data-stillness-revisit]")!.hidden =
			!this.stillnessEligible || !this.stillnessUnlocked || this.mode || this.echoMode || this.flatlineElapsed !== null;
	}
	private resetStillness(): void {
		this.stillness = emptyStillnessRhythm();
		this.flatlineElapsed = null;
		this.stillnessNavigating = false;
		this.warningStrength = 0;
		this.removeAttribute("data-stillness-building");
		this.removeAttribute("data-flatline");
		const dialog = this.querySelector<HTMLDialogElement>("dialog")!;
		dialog.style.removeProperty("--stillness-bg");
		dialog.style.removeProperty("--stillness-warning");
		if (!this.mode && !this.echoMode) {
			const wave = this.querySelector<SVGSVGElement>(".pulse-wave")!;
			wave.setAttribute("viewBox", "0 0 1200 400");
			wave.style.height = "";
		}
		this.querySelector<HTMLElement>("[data-stillness-status]")!.textContent = "";
	}
	private stillnessStrike(key: RhythmKey): void {
		if (!this.active || !this.stillnessEligible || this.mode || this.echoMode || this.flatlineElapsed !== null || this.stillnessUnlocked) return;
		const result = strikeStillnessRhythm(this.stillness, key, this.visibleTime);
		this.stillness = result.state;
		const intensity = stillnessIntensity(this.stillness, this.visibleTime);
		this.warningStrength = Math.max(this.warningStrength, this.reduced ? 0.25 : 0.14 + intensity * 0.5);
		if (result.zeroed) {
			this.flatlineElapsed = 0;
			this.holdStart = null;
			this.holdPoint = null;
			this.hideResidue();
			this.setAttribute("data-flatline", "");
			this.removeAttribute("data-stillness-building");
			this.querySelector<HTMLElement>("[data-stillness-status]")!.textContent = "信号归零。";
		} else this.querySelector<HTMLElement>("[data-stillness-status]")!.textContent =
			this.stillness.armed ? "节拍急促。" : this.stillness.beats > 0 ? "心跳加快。" : "节奏断了。";
		this.updateStillnessAccess();
	}
	protected renderFrame(delta: number): void {
		if (this.flatlineElapsed === null && this.holdStart !== null && this.visibleTime - this.holdStart >= 2000)
			this.enterMode();
		const staticLine = this.querySelector<SVGPathElement>("[data-static]")!;
		const trail = this.querySelector<SVGGElement>("[data-trail]")!;
		const head = this.querySelector<SVGCircleElement>("[data-scan-head]")!;
		const primary = this.querySelector<SVGPathElement>("[data-echo-primary]")!;
		const ghost = this.querySelector<SVGPathElement>("[data-echo-ghost]")!;
		const dialog = this.dialog;
		if (this.flatlineElapsed !== null) {
			this.flatlineElapsed += delta;
			const total = this.reduced ? 480 : 8000;
			const progress = Math.min(1, this.flatlineElapsed / total);
			const shade = this.reduced ? (progress >= 0.5 ? 229 : 255) : Math.round(255 - progress * 26);
			dialog.style.setProperty("--stillness-bg", `rgb(${shade},${shade},${shade})`);
			this.warningStrength = this.reduced ? 0 : Math.max(0, this.warningStrength - delta / 500);
			dialog.style.setProperty("--stillness-warning", String(this.warningStrength));
			this.hideResidue();
			trail.replaceChildren();
			const wave = this.querySelector<SVGSVGElement>(".pulse-wave")!;
			wave.setAttribute("viewBox", "0 0 1200 400");
			wave.style.height = "";
			primary.setAttribute("visibility", "hidden");
			ghost.setAttribute("visibility", "hidden");
			staticLine.setAttribute("transform", "");
			staticLine.setAttribute("d", "M0 200 H1200");
			head.setAttribute("visibility", this.reduced ? "hidden" : "visible");
			head.setAttribute("cy", "200");
			head.setAttribute("cx", String(this.flatlineElapsed >= 8000 ? 1200 : ((this.flatlineElapsed % 4000) / 4000) * 1200));
			if (progress >= 1 && !this.stillnessNavigating && unlockStillness()) {
				this.stillnessNavigating = true;
				void this.enterStillness();
			}
			return;
		}
		if (this.stillnessEligible && !this.mode && !this.echoMode && !this.stillnessUnlocked)
			this.stillness = coolStillnessRhythm(this.stillness, this.visibleTime);
		const intensity = this.stillnessEligible && !this.mode && !this.echoMode ? stillnessIntensity(this.stillness, this.visibleTime) : 0;
		const warningTarget = intensity > 0 ? 0.12 + intensity * 0.78 : 0;
		this.warningStrength = this.reduced ? (intensity > 0 ? 0.25 : 0) : this.warningStrength + (warningTarget - this.warningStrength) * Math.min(1, delta / 220);
		dialog.style.setProperty("--stillness-warning", String(this.warningStrength));
		this.toggleAttribute("data-stillness-building", intensity > 0);
		if (!this.mode && !this.echoMode) {
			const wave = this.querySelector<SVGSVGElement>(".pulse-wave")!;
			const geometry = pulseWaveGeometry(intensity);
			wave.setAttribute("viewBox", `0 ${geometry.top.toFixed(2)} 1200 ${geometry.height.toFixed(2)}`);
			wave.style.height = intensity > 0 ? `min(${geometry.viewportHeight.toFixed(2)}dvh,${geometry.maxHeight.toFixed(2)}px)` : "";
		} else this.querySelector<SVGSVGElement>(".pulse-wave")!.style.height = "";
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
			staticLine.setAttribute("transform", intensity > 0 ? `translate(0 200) scale(1 ${(1 + intensity * 0.95).toFixed(2)}) translate(0 -200)` : "");
			trail.replaceChildren();
			head.setAttribute("visibility", "hidden");
			if (this.echoEligible) {
				this.residueReady = true;
				this.residue ??= { ...DEFAULT_ECHO_RESIDUE };
			}
			if (intensity > 0) this.hideResidue();
			else this.renderResidue();
			return;
		}
		staticLine.setAttribute("transform", "");
		staticLine.setAttribute("d", "");
		if (this.visibleTime < 1000) {
			if (intensity > 0) this.hideResidue();
			else this.renderResidue();
			return;
		}
		const time = this.visibleTime - 1000;
		this.scanner.step(time, 1200, intensity);
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
		if (intensity > 0) this.hideResidue();
		else this.renderResidue();
	}
	private async enterStillness(): Promise<void> {
		if (!this.abort) return;
		const destination = url("/stillness/");
		try {
			const response = await fetch(destination, {
				headers: { "X-Requested-With": "swup" },
				signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(10000)]),
			});
			if (!response.ok) throw new Error("Stillness scene unavailable");
			const html = await response.text();
			const parsed = new DOMParser().parseFromString(html, "text/html");
			if (!parsed.querySelector("stillness-scene")) throw new Error("Stillness scene missing");
			if (!this.active || this.abort.signal.aborted) return;
			if (window.swup) {
				if (!(window.swup.options.containers as string[]).every((selector) => parsed.querySelector(selector)))
					throw new Error("Stillness page incomplete");
				window.swup.cache.set(destination, { url: destination, html });
				window.swup.navigate(destination, { animate: false, cache: { read: true } });
				const timer = window.setTimeout(() => {
					if (this.active && this.stillnessNavigating) this.recoverStillnessNavigation();
				}, 15000);
				this.abort.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
			} else location.assign(destination);
		} catch {
			if (this.active && !this.abort.signal.aborted) this.recoverStillnessNavigation();
		}
	}
	private recoverStillnessNavigation(): void {
		this.resetStillness();
		this.updateStillnessAccess();
		this.querySelector<HTMLElement>("[data-stillness-status]")!.textContent = "暂时无法进入，可重试静止的线。";
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
		this.stillness = emptyStillnessRhythm();
		this.removeAttribute("data-stillness-building");
		this.echoMode = true;
		this.querySelector<SVGSVGElement>(".pulse-wave")!.setAttribute("viewBox", "0 0 1200 400");
		this.updateStillnessAccess();
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
		this.updateStillnessAccess();
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
		if (this.flatlineElapsed !== null) return;
		this.stillness = emptyStillnessRhythm();
		this.removeAttribute("data-stillness-building");
		this.mode = true;
		this.updateStillnessAccess();
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
			this.updateStillnessAccess();
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
