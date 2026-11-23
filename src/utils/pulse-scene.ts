import { PulseEntry, entryDuration, type PulseDestination } from "./pulse-entry";
import { EasterEggScene } from "./easter-egg-scene";
import { MorseInput } from "./pulse-morse";
import {
	echoDragOffset,
	echoReveal,
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

// Only a cancelled in-flight navigation uses this temporary hand-back, never storage.
let recoveredInput: { symbols: string; letters: string; mode: boolean; failed: boolean; destination: PulseDestination } | null = null;

export class PulseScene extends EasterEggScene {
	private scanner = new PulseScanner();
	private input = new MorseInput();
	private mode = false;
	private echoMode = false;
	private echoSucceeded = false;
	private echoTarget: { x: number; y: number } = { ...ECHO_START };
	private echoPosition: { x: number; y: number } = { ...ECHO_START };
	private echoHold = 0;
	private echoRevealAt = 0;
	private echoBaseline = 0;
	private echoPointer: { element: Element; id: number } | null = null;
	private cancelEchoDrag(): void {
		this.echoDrag = null;
		const pointer = this.echoPointer; this.echoPointer = null;
		if (pointer?.element.hasPointerCapture(pointer.id)) pointer.element.releasePointerCapture(pointer.id);
	}
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
	private entry: PulseEntry | null = null;
	private retryDestination: PulseDestination | null = null;
	private holdFeedback = 0;
	private beatFeedback = { J: -1000, K: -1000 };
	private criticalAt = -1000;
	private confirmedAt = -1000;
	private entryAllowed(kind: PulseDestination): boolean {
		const p = getPuzzleProgress();
		return p.unlocked && (kind === "newworld" ? p.worldUnlocked : kind === "starfield" ? p.starfieldUnlocked : kind === "echo" ? p.echoClueSeen && p.echoUnlocked : isStillnessReady(p) && p.stillnessUnlocked);
	}
	private beginEntry(kind: PulseDestination, first = false, flat = false): void {
		if (this.entry || !this.entryAllowed(kind)) return;
		this.holdStart = null; this.holdPoint = null; this.echoDrag = null;
		this.retryDestination = kind;
		this.querySelector<HTMLElement>("[data-entry-error]")!.hidden = true;
		this.entry = new PulseEntry(kind, entryDuration(first, this.reduced, flat), this.reduced, this.querySelector<SVGSVGElement>(".pulse-wave")!, (failed, returning) => {
			if (returning) recoveredInput = { symbols: this.input.symbols, letters: this.input.letters, mode: this.mode, failed, destination: kind };
			this.entry = null;
			this.echoSucceeded = false;
			this.echoMode = false;
			this.removeAttribute("data-echo");
			this.querySelector<HTMLElement>("[data-echo-leave]")!.hidden = true;
			this.resetStillness();
			this.stillnessUnlocked = getPuzzleProgress().stillnessUnlocked;
			this.updateStillnessAccess(); this.updateReadout();
			this.residueRendered = false;
			this.querySelector<HTMLElement>("[data-entry-error]")!.hidden = !failed;
		});
	}
	protected cleanup(): void {
		this.cancelEchoDrag();
		this.entry?.leaveSource();
		this.entry = null;
		super.cleanup();
	}
	connectedCallback(): void {
		if (this.active) return;
		if (!getPuzzleProgress().unlocked) {
			recoveredInput = null;
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
		this.entry?.dispose(); this.entry = null;
		this.holdFeedback = 0; this.holdStart = null; this.holdPoint = null;
		this.beatFeedback = { J: -1000, K: -1000 }; this.criticalAt = -1000;
		this.querySelector<HTMLElement>("[data-entry-error]")!.hidden = true;
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
		if (import.meta.env.DEV) {
			window.addEventListener("palib:debug-pause", () => {
				this.entry?.cancel(false); this.cancelEchoDrag(); this.onVisibility(false);
			}, { signal });
			this.addEventListener("palib:debug-stage", event => {
				const stage = (event as CustomEvent<string>).detail;
				this.holdStart = null; this.holdPoint = null; this.cancelEchoDrag(); this.resetStillness();
				if (stage === "residue" || stage === "resonance") {
					this.residueReady = true; this.residue = { ...DEFAULT_ECHO_RESIDUE };
					this.residueRendered = false; this.renderResidue();
					if (stage === "resonance") this.enterEchoMode();
				} else if (stage === "morse") this.enterMode();
				else if (stage === "flatline") {
					this.flatlineElapsed = 0; this.setAttribute("data-flatline", ""); this.hideResidue();
				} else if (stage === "entry-newworld") this.beginEntry("newworld", true);
				else if (stage === "entry-starfield") this.beginEntry("starfield", true);
				else if (stage === "entry-echo") this.beginEntry("echo", true);
				this.updateStillnessAccess();
			}, { signal });
		}
		if (recoveredInput) {
			const saved = recoveredInput; recoveredInput = null;
			this.input.symbols = saved.symbols; this.input.letters = saved.letters;
			if (saved.mode) this.enterMode();
			this.updateReadout(); this.retryDestination = saved.destination;
			this.querySelector<HTMLElement>("[data-entry-error]")!.hidden = !saved.failed;
		}
		this.updateStillnessAccess();
		this.querySelector<HTMLButtonElement>("[data-entry-retry]")!.addEventListener("click", () => {
			if (this.retryDestination) this.beginEntry(this.retryDestination);
		}, { signal });
		const onEntryAbort = () => this.entry?.cancel(true);
		window.swup?.hooks.on("visit:abort", onEntryAbort);
		signal.addEventListener("abort", () => window.swup?.hooks.off("visit:abort", onEntryAbort), { once: true });
		const refreshAccess = () => {
			if (!this.active) return;
			const current = getPuzzleProgress();
			if (this.entry && this.retryDestination && !this.entryAllowed(this.retryDestination)) this.entry.cancel(false);
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
			if (getPuzzleProgress().stillnessUnlocked && isStillnessReady(getPuzzleProgress())) this.beginEntry("stillness");
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
		const hit = this.querySelector<SVGPathElement>("[data-echo-hit]")!;
		hit.setAttribute("d", ECHO_PATH);
		for (const target of [echo, hit]) {
		target.addEventListener(
			"pointerdown",
			(event) => {
				if (!(event instanceof PointerEvent) || this.echoPointer) return;
				if (
					this.entry || this.mode ||
					this.echoSucceeded ||
					!this.echoEligible ||
					!this.residueReady ||
					event.button !== 0
				)
					return;
				event.preventDefault();
				target.setPointerCapture(event.pointerId);
				this.echoPointer = { element: target, id: event.pointerId };
				this.echoDrag = {
					x: event.clientX,
					y: event.clientY,
					offsetX: this.echoTarget.x,
					offsetY: this.echoTarget.y,
				};
			},
			{ signal },
		);
		target.addEventListener(
			"pointermove",
			(event) => {
				if (!(event instanceof PointerEvent) || !this.echoDrag || this.echoPointer?.id !== event.pointerId) return;
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
					this.echoDrag = { x: event.clientX, y: event.clientY, offsetX: this.echoTarget.x, offsetY: this.echoTarget.y };
					return;
				}
				if (!this.echoMode) return;
				const bounds =
					this.querySelector<SVGSVGElement>(
						".pulse-wave",
					)!.getBoundingClientRect();
				this.echoTarget = echoDragOffset(
					{ x: this.echoDrag.offsetX, y: this.echoDrag.offsetY },
					{ x: event.clientX - this.echoDrag.x, y: event.clientY - this.echoDrag.y },
					bounds,
				);
			},
			{ signal },
		);
		for (const name of [
			"pointerup",
			"pointercancel",
			"lostpointercapture",
		] as const)
			target.addEventListener(
				name,
				(event) => {
					if (!(event instanceof PointerEvent) || this.echoPointer?.id !== event.pointerId) return;
					const start = this.echoDrag;
					this.cancelEchoDrag();
					if (name === "pointerup" && start && !this.echoMode &&
						!draggedEchoResidue(start.x, start.y, event.clientX, event.clientY) &&
						getPuzzleProgress().echoUnlocked) this.beginEntry("echo");
				},
				{ signal },
			);
		}
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
				this.cancelEchoDrag();
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
				if (this.entry || this.mode || this.echoMode || this.flatlineElapsed !== null || event.button !== 0) return;
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
					if (!this.echoMode && event.code === "Enter" && getPuzzleProgress().echoUnlocked) {
						if (!event.repeat) this.beginEntry("echo");
						return;
					}
					if (["Enter", "Space"].includes(event.code)) {
						this.echoArmed = true;
						return;
					}
					if (!this.echoArmed) return;
					if (!this.echoMode) this.enterEchoMode();
					if (!this.echoMode) return;
					this.echoArmed = true;
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
				this.beginEntry("newworld");
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
				this.beginEntry("starfield");
			},
			{ signal },
		);
	}
	protected onVisibility(visible: boolean): void {
		if (!visible) {
			this.holdStart = null;
			this.holdPoint = null;
			this.cancelEchoDrag();
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
		if (this.entry || !this.active || !this.stillnessEligible || this.mode || this.echoMode || this.flatlineElapsed !== null || this.stillnessUnlocked) return;
		const previous = this.stillness;
		const result = strikeStillnessRhythm(previous, key, this.visibleTime);
		if (previous.lastKey !== key) this.beatFeedback[key] = this.visibleTime;
		if (!previous.armed && result.state.armed) this.criticalAt = this.visibleTime;
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
		if (this.entry) return;
		const desired = this.holdStart === null ? 0 : Math.min(1, (this.visibleTime - this.holdStart) / 2000);
		this.holdFeedback = this.reduced ? desired : this.holdFeedback + (desired - this.holdFeedback) * Math.min(1, delta / 80);
		const holdMark = this.querySelector<SVGPathElement>("[data-hold-feedback]")!;
		const bounds = this.querySelector<SVGSVGElement>(".pulse-wave")!.getBoundingClientRect();
		const x = this.holdPoint ? Math.max(80, Math.min(1120, (this.holdPoint.x - bounds.left) / Math.max(1, bounds.width) * 1200)) : 600;
		const h = this.holdFeedback, a = 34 * (1-h);
		holdMark.setAttribute("d", `M${x-70} 200 H${x-25} L${x-10} ${200-a} L${x+5} ${200+a*.6} L${x+20} 200 H${x+70}`);
		holdMark.setAttribute("opacity", String(this.mode || this.echoMode || this.flatlineElapsed !== null ? 0 : h));
		holdMark.setAttribute("stroke-width", String(1.4+h));
		for (const key of ["J","K"] as const)
			this.querySelector<HTMLElement>(`[data-stillness-key="${key}"]`)!.style.setProperty("--beat", String(Math.max(0, 1-(this.visibleTime-this.beatFeedback[key])/240)));
		const critical = this.querySelector<SVGPathElement>("[data-critical-feedback]")!;
		critical.setAttribute("opacity", String(this.stillness.armed && !this.mode && !this.echoMode ? (this.reduced ? 0.6 : Math.max(0, 1-(this.visibleTime-this.criticalAt)/650)) : 0));
		this.querySelector<HTMLElement>("[data-morse-letters]")!.style.opacity = String(this.visibleTime-this.confirmedAt < 180 ? 0.6 : 1);
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
			const reveal = echoReveal(this.visibleTime - this.echoRevealAt, this.reduced);
			trail.style.opacity = String(1 - reveal);
			if (reveal === 1) trail.replaceChildren();
			staticLine.setAttribute("d", "");
			head.setAttribute("visibility", "hidden");
			primary.setAttribute("visibility", "visible");
			ghost.setAttribute("visibility", "visible");
			this.echoPosition = { ...this.echoTarget };
			primary.setAttribute("transform", `translate(0 ${this.echoBaseline})`);
			primary.setAttribute("opacity", String(reveal));
			const hit = this.querySelector<SVGPathElement>("[data-echo-hit]")!;
			const transform = `translate(${this.echoPosition.x} ${this.echoPosition.y + this.echoBaseline})`;
			hit.setAttribute("transform", transform); hit.setAttribute("visibility", "visible");
			const center = (this.residue?.x ?? 720) - ECHO_START.x;
			const clip = this.querySelector<SVGRectElement>("[data-echo-clip]")!;
			const span = 13 + 1400 * reveal;
			clip.setAttribute("x", String(center-span)); clip.setAttribute("width", String(span*2));
			const bounds = this.querySelector<SVGSVGElement>(".pulse-wave")!.getBoundingClientRect();
			const handle = this.querySelector<HTMLElement>("[data-echo-handle]")!;
			handle.hidden = false;
			handle.style.setProperty("--echo-hit-x", `${bounds.left + (center+this.echoPosition.x)*bounds.width/1200}px`);
			handle.style.setProperty("--echo-hit-y", `${bounds.top + (200+this.echoBaseline+this.echoPosition.y)*bounds.height/400}px`);
			ghost.setAttribute(
				"transform",
				`translate(${this.echoPosition.x.toFixed(2)} ${(this.echoPosition.y + this.echoBaseline).toFixed(2)})`,
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
				reveal === 1 && echoAligned(this.echoPosition.x, this.echoPosition.y),
			);
			if (
				!this.echoSucceeded &&
				this.echoHold >= ECHO_HOLD_MS &&
				unlockEcho()
			) {
				this.echoSucceeded = true;
				this.querySelector<HTMLElement>("[data-echo-status]")!.textContent =
					"两道信号重合了。";
				this.beginEntry("echo", true);
			}
			return;
		}
		trail.style.opacity = "1";
		this.querySelector<SVGPathElement>("[data-echo-hit]")!.setAttribute("visibility", "hidden");
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
			if ((!active && !this.reduced) || (this.reduced && !this.input.symbols.endsWith(".")) || active?.symbol === "-")
				staticLine.setAttribute("d", "M0 130 H1200");
			else {
				const phase =
					this.reduced ? 0.5 : (this.visibleTime - active!.start) / (active!.end - active!.start);
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
				`M${segment.x1} ${200 + (segment.y1-200)*(1-h*Math.max(0,1-Math.abs(segment.x1-x)/110)*.65)} L${segment.x2} ${200 + (segment.y2-200)*(1-h*Math.max(0,1-Math.abs(segment.x2-x)/110)*.65)}`,
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
		this.beginEntry("stillness", true, true);
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
		handle.setAttribute("aria-label", getPuzzleProgress().echoUnlocked
			? "轻点或按 Enter 进入裂缝。拖动可重演共振，也可按空格选取后用方向键移动。"
			: "没有消失的短线。按 Enter 或空格选取，再用方向键移动；也可拖动");
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
		this.echoRevealAt = this.visibleTime;
		this.echoBaseline = (this.residue?.y ?? 203) - 200 - ECHO_START.y;
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
		this.cancelEchoDrag();
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
		if (this.entry) return;
		const prior = getPuzzleProgress();
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
			else this.confirmedAt = this.visibleTime;
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
				this.beginEntry("newworld", !prior.worldUnlocked);
			} else if (tryUnlockStarfield(this.input.letters)) {
				this.status("信号已接通。");
				this.updateReadout();
				this.beginEntry("starfield", !prior.starfieldUnlocked);
			} else this.status("信号未接通，输入仍然保留。可以继续修改。");
		}
		this.updateReadout();
	}
}
