import { buildGateDoor, gateHitStyle, GATE_CAMERA, type GateCamera, type GateSide } from "@/utils/library-gate-geometry";
import { buildGateArchitecture } from "@/utils/library-gate-artwork";
import { ENTRANCE_TIMING, sampleEyeReveal, sampleGateWalk } from "@/utils/home-entrance-motion";

interface DialogueLine { speaker: string; text: string }
type EntrancePhase = "idle" | "approaching" | "active" | "opening" | "walking" | "black" | "dialogue" | "waking";

/** The home-only prologue lives outside Swup's replaceable content. */
export function initHomeEntrance(): void {
	const overlay = document.getElementById("library-door-entrance");
	if (!overlay) return;
	const entrance = overlay;
	const root = document.documentElement;
	const doors = Array.from(overlay.querySelectorAll<HTMLButtonElement>("[data-door-side]"));
	const skip = overlay.querySelector<HTMLButtonElement>("[data-door-skip]");
	const message = overlay.querySelector<HTMLElement>("[data-door-message]");
	const panel = overlay.querySelector<HTMLElement>("[data-dialogue-panel]");
	const speaker = overlay.querySelector<HTMLElement>("[data-dialogue-speaker]");
	const visualText = overlay.querySelector<HTMLElement>("[data-dialogue-text]");
	const accessibleText = overlay.querySelector<HTMLElement>("[data-dialogue-accessible]");
	const indexLabel = overlay.querySelector<HTMLElement>("[data-dialogue-index]");
	const autoButton = overlay.querySelector<HTMLButtonElement>("[data-dialogue-auto]");
	const nextButton = overlay.querySelector<HTMLButtonElement>("[data-dialogue-next]");
	const enterButton = overlay.querySelector<HTMLButtonElement>("[data-dialogue-enter]");
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const scene = overlay.querySelector<HTMLElement>(".library-gate-scene");
	const aperture = overlay.querySelector<SVGPathElement>("[data-gate-aperture]");
	const eyeTop = overlay.querySelector<SVGPathElement>("[data-eye-top]");
	const eyeBottom = overlay.querySelector<SVGPathElement>("[data-eye-bottom]");
	const architecturePaths = new Map(Array.from(overlay.querySelectorAll<SVGPathElement>("[data-gate-architecture]"), (path) => [path.dataset.gateArchitecture!, path]));
	let camera: GateCamera = { ...GATE_CAMERA };
	let dialogue: DialogueLine[] = [];
	try {
		const parsed: unknown = JSON.parse(overlay.dataset.dialogue || "[]");
		if (Array.isArray(parsed)) dialogue = parsed.filter((line): line is DialogueLine =>
			line && typeof line.speaker === "string" && typeof line.text === "string");
	} catch { /* Invalid optional dialogue data should not block entry. */ }

	type FaceElements = { group: SVGGElement; outline: SVGPathElement; clip: SVGPathElement; details: Map<string, SVGPathElement> };
	const doorArtwork = new Map<GateSide, { group: SVGGElement; faces: Map<string, FaceElements>; button?: HTMLButtonElement; order: string }>();
	for (const side of ["left", "right"] as const) {
		const group = overlay.querySelector<SVGGElement>(`[data-gate-door="${side}"]`);
		if (!group) continue;
		const faces = new Map<string, FaceElements>();
		for (const face of group.querySelectorAll<SVGGElement>("[data-gate-face]")) {
			const id = face.dataset.gateFace || "";
			const outline = face.querySelector<SVGPathElement>("[data-face-outline]");
			const clip = overlay.querySelector<SVGPathElement>('[data-gate-clip="' + side + "-" + id + '"]');
			if (!outline || !clip) continue;
			const details = new Map<string, SVGPathElement>();
			for (const path of face.querySelectorAll<SVGPathElement>("[data-gate-ink]")) details.set(path.dataset.gateInk || "", path);
			faces.set(id, { group: face, outline, clip, details });
		}
		doorArtwork.set(side, { group, faces, button: doors.find((button) => button.dataset.doorSide === side), order: "" });
	}
	for (const path of overlay.querySelectorAll<SVGPathElement>(".gate-draw-lines path, .gate-door path"))
		path.setAttribute("pathLength", "1");

	let phase: EntrancePhase = "idle";
	let contentReady = false;
	let drawingDone = false;
	let pendingAction: "open" | "skip" | null = null;
	let generation = 0;
	let currentProgress = 0;
	let animationFrame = 0;
	const timers = new Set<number>();
	let autoTimer = 0;
	let typeTimer = 0;
	let autoEnabled = false;
	let dialogueIndex = 0;
	let characters: string[] = [];
	let visibleCount = 0;
	let previousFocus: HTMLElement | null = null;
	let inerted: Array<{ element: HTMLElement; wasInert: boolean }> = [];
	let drag: { pointerId: number; side: GateSide; startX: number; base: number; moved: boolean } | null = null;
	let suppressClickUntil = 0;

	function schedule(callback: () => void, delay: number): number {
		const current = generation;
		const timer = window.setTimeout(() => {
			timers.delete(timer);
			if (current === generation) callback();
		}, delay);
		timers.add(timer);
		return timer;
	}

	function cancelTimer(timer: number): void {
		if (!timer) return;
		window.clearTimeout(timer);
		timers.delete(timer);
	}

	function cancelAuto(): void { cancelTimer(autoTimer); autoTimer = 0; }
	function cancelTyping(): void { cancelTimer(typeTimer); typeTimer = 0; }
	function cancelAnimation(): void { if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = 0; }

	function setPhase(next: EntrancePhase): void {
		phase = next;
		if (next === "idle") root.removeAttribute("data-home-intro");
		else root.setAttribute("data-home-intro", next);
		panel?.setAttribute("aria-hidden", next === "dialogue" ? "false" : "true");
		for (const door of doors) door.disabled = next !== "active";
	}

	function renderArchitecture(): void {
		const architecture = buildGateArchitecture(camera);
		for (const ink of [...architecture.surround, ...architecture.recess, ...architecture.fanlight, ...architecture.trim, ...architecture.steps]) {
			architecturePaths.get(ink.id)?.setAttribute("d", ink.d);
		}
		aperture?.setAttribute("d", architecture.aperture);
	}

	function setProgress(progress: number): void {
		currentProgress = Math.max(0, Math.min(1, progress));
		entrance.dataset.gateProgress = String(currentProgress);
		for (const side of ["left", "right"] as const) {
			const shape = buildGateDoor(side, currentProgress, camera);
			const artwork = doorArtwork.get(side);
			if (!artwork) continue;
			for (const face of shape.faces) {
				const elements = artwork.faces.get(face.id);
				if (!elements) continue;
				elements.group.setAttribute("display", face.visible ? "inline" : "none");
				elements.outline.setAttribute("d", face.d);
				elements.clip.setAttribute("d", face.d);
				for (const ink of face.details) elements.details.get(ink.id)?.setAttribute("d", ink.d);
			}
			const order = shape.faces.map((face) => face.id).join(",");
			if (artwork.order !== order) {
				for (const face of shape.faces) {
					const node = artwork.faces.get(face.id)?.group;
					if (node) artwork.group.append(node);
				}
				artwork.order = order;
			}
			artwork.button?.setAttribute("style", gateHitStyle(shape));
		}
	}

	function animateScene(duration: number, update: (elapsed: number) => void, onDone: () => void): void {
		cancelAnimation();
		const started = performance.now();
		const current = generation;
		update(0);
		const frame = (now: number) => {
			if (current !== generation) return;
			const elapsed = Math.min(duration, now - started);
			update(elapsed);
			if (elapsed < duration) animationFrame = requestAnimationFrame(frame);
			else { animationFrame = 0; onDone(); }
		};
		animationFrame = requestAnimationFrame(frame);
	}

	function walkCamera(from: number, to: number, duration: number, entering: boolean, done: () => void): void {
		animateScene(duration, (elapsed) => {
			const t = elapsed / duration;
			const sample = sampleGateWalk(t, from, to, window.innerWidth <= 600 ? 1 : 2);
			const sceneScale = (scene?.clientWidth || 1200) / 1200;
			camera = { distance: sample.distance, eyeHeight: GATE_CAMERA.eyeHeight + sample.offsetPx / sceneScale * sample.distance / (GATE_CAMERA.scale * GATE_CAMERA.distance) };
			renderArchitecture();
			setProgress(currentProgress);
			if (entering) entrance.style.setProperty("--gate-blackout", String(Math.max(0, (t - .75) / .25)));
		}, done);
	}

	function setEye(elapsed: number): void {
		const { openness, blur, shade } = sampleEyeReveal(elapsed);
		const edge = 500 - 600 * openness, center = 500 - 1100 * openness;
		eyeTop?.setAttribute("d", `M0 0H1000V${edge}Q500 ${center} 0 ${edge}Z`);
		eyeBottom?.setAttribute("d", `M0 1000H1000V${1000 - edge}Q500 ${1000 - center} 0 ${1000 - edge}Z`);
		entrance.style.setProperty("--eye-blur", `${blur}px`);
		entrance.style.setProperty("--eye-shade", String(shade));
	}

	function animateProgress(target: number, duration: number, onDone?: () => void): void {
		cancelAnimation();
		const from = currentProgress;
		const started = performance.now();
		const current = generation;
		const frame = (now: number) => {
			if (current !== generation) return;
			const fraction = Math.min(1, (now - started) / duration);
			setProgress(from + (target - from) * (1 - (1 - fraction) ** 3));
			if (fraction < 1) animationFrame = requestAnimationFrame(frame);
			else { animationFrame = 0; onDone?.(); }
		};
		animationFrame = requestAnimationFrame(frame);
	}

	function restoreInert(): void {
		for (const { element, wasInert } of inerted) element.inert = wasInert;
		inerted = [];
	}

	function clear(entered: boolean): void {
		generation++;
		for (const timer of timers) window.clearTimeout(timer);
		timers.clear();
		cancelAnimation();
		autoTimer = 0;
		typeTimer = 0;
		autoEnabled = false;
		contentReady = false;
		drawingDone = false;
		pendingAction = null;
		if (drag) {
			const captured = doors.find((door) => door.hasPointerCapture(drag!.pointerId));
			captured?.releasePointerCapture(drag.pointerId);
		}
		drag = null;
		suppressClickUntil = 0;
		entrance.classList.remove("door-dragging");
		entrance.setAttribute("aria-hidden", "true");
		setPhase("idle");
		root.classList.remove("is-home-entering");
		restoreInert();
		camera = { ...GATE_CAMERA };
		renderArchitecture();
		for (const property of ["--gate-blackout", "--eye-blur", "--eye-shade"]) entrance.style.removeProperty(property);
		eyeTop?.setAttribute("d", "M0 0H1000V500Q500 500 0 500Z");
		eyeBottom?.setAttribute("d", "M0 1000H1000V500Q500 500 0 500Z");
		setProgress(0);
		if (entered) {
			const heading = document.getElementById("home-intro-title");
			if (heading) {
				heading.setAttribute("tabindex", "-1");
				heading.focus({ preventScroll: true });
				heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
			}
		} else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
		previousFocus = null;
	}

	function finishIntro(): void {
		if (phase !== "dialogue" || !contentReady) return;
		cancelAuto();
		cancelTyping();
		setEye(0);
		setPhase("waking");
		entrance.focus({ preventScroll: true });
		animateScene(ENTRANCE_TIMING.wake, setEye, () => clear(true));
	}

	function updateDialogueActions(): void {
		const last = dialogueIndex >= dialogue.length - 1;
		const complete = visibleCount >= characters.length;
		if (nextButton) nextButton.hidden = last && complete;
		if (enterButton) enterButton.hidden = !(last && complete);
	}

	function maybeScheduleAuto(): void {
		cancelAuto();
		if (phase !== "dialogue" || !autoEnabled || dialogueIndex >= dialogue.length - 1 || visibleCount < characters.length) return;
		autoTimer = schedule(() => { autoTimer = 0; showLine(dialogueIndex + 1); }, 2500);
	}

	function completeLine(): void {
		cancelTyping();
		visibleCount = characters.length;
		if (visualText) visualText.textContent = characters.join("");
		updateDialogueActions();
		maybeScheduleAuto();
		if (dialogueIndex === dialogue.length - 1) enterButton?.focus({ preventScroll: true });
	}

	function typeNext(): void {
		if (phase !== "dialogue") return;
		visibleCount++;
		if (visualText) visualText.textContent = characters.slice(0, visibleCount).join("");
		if (visibleCount >= characters.length) completeLine();
		else typeTimer = schedule(typeNext, 33);
	}

	function showLine(index: number): void {
		cancelAuto();
		cancelTyping();
		dialogueIndex = index;
		const line = dialogue[index];
		if (!line) { finishIntro(); return; }
		characters = Array.from(line.text);
		visibleCount = 0;
		if (speaker) speaker.textContent = line.speaker;
		if (visualText) visualText.textContent = "";
		if (accessibleText) accessibleText.textContent = `${line.speaker}：${line.text}`;
		if (indexLabel) indexLabel.textContent = `${String(index + 1).padStart(2, "0")} / ${String(dialogue.length).padStart(2, "0")}`;
		updateDialogueActions();
		typeTimer = schedule(typeNext, 33);
	}

	function advanceDialogue(): void {
		if (phase !== "dialogue") return;
		if (visibleCount < characters.length) { completeLine(); return; }
		if (dialogueIndex < dialogue.length - 1) showLine(dialogueIndex + 1);
	}

	function startDialogue(): void {
		setPhase("dialogue");
		if (dialogue.length === 0) { finishIntro(); return; }
		showLine(0);
		nextButton?.focus({ preventScroll: true });
	}

	function requestOpen(): void {
		if (phase !== "approaching" && phase !== "active") return;
		if (!contentReady || !drawingDone) {
			pendingAction = "open";
			if (message) message.textContent = "图书馆正在准备，请稍候…";
			return;
		}
		setPhase("opening");
		animateProgress(1, ENTRANCE_TIMING.open, () => {
			setPhase("walking");
			walkCamera(GATE_CAMERA.distance, 120, ENTRANCE_TIMING.walk, true, () => {
				setPhase("black");
				schedule(startDialogue, ENTRANCE_TIMING.black);
			});
		});
	}

	function skipEntrance(): void {
		if (phase === "idle") return;
		if (!contentReady) {
			pendingAction = "skip";
			if (message) message.textContent = "主页正在准备，请稍候…";
			return;
		}
		clear(true);
	}

	function maybeReady(): void {
		if (phase !== "approaching" || !contentReady || !drawingDone) return;
		setPhase("active");
		if (message) message.textContent = "向两侧推开线稿大门，或点击门把入馆";
		const action = pendingAction;
		pendingAction = null;
		if (action === "skip") skipEntrance();
		else if (action === "open") requestOpen();
	}

	function activate(): void {
		clear(false);
		if (reducedMotion.matches) return;
		generation++;
		previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		root.classList.add("is-home-entering");
		entrance.setAttribute("aria-hidden", "false");
		setPhase("approaching");
		if (message) message.textContent = "正在走近图书馆…";
		if (autoButton) { autoButton.setAttribute("aria-pressed", "false"); autoButton.textContent = "自动推进：关"; }
		for (const child of Array.from(document.body.children)) {
			if (!(child instanceof HTMLElement) || child === overlay || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(child.tagName)) continue;
			inerted.push({ element: child, wasInert: child.inert });
			child.inert = true;
		}
		entrance.focus({ preventScroll: true });
		walkCamera(980, GATE_CAMERA.distance, ENTRANCE_TIMING.approach, false, () => {
			drawingDone = true;
			if (message) message.textContent = "主页正在准备，请稍候…";
			maybeReady();
		});
	}

	function markReady(): void {
		if (phase === "idle") return;
		const current = generation;
		requestAnimationFrame(() => {
			if (current !== generation) return;
			contentReady = true;
			if (pendingAction === "skip") { skipEntrance(); return; }
			maybeReady();
		});
	}

	for (const door of doors) {
		door.addEventListener("pointerdown", (event) => {
			if (phase !== "active" || (event.pointerType === "mouse" && event.button !== 0)) return;
			cancelAnimation();
			drag = { pointerId: event.pointerId, side: door.dataset.doorSide as GateSide, startX: event.clientX, base: currentProgress, moved: false };
			door.setPointerCapture(event.pointerId);
			overlay.classList.add("door-dragging");
		});
		door.addEventListener("pointermove", (event) => {
			if (!drag || drag.pointerId !== event.pointerId || phase !== "active") return;
			const delta = drag.side === "left" ? drag.startX - event.clientX : event.clientX - drag.startX;
			if (Math.abs(event.clientX - drag.startX) > 7) drag.moved = true;
			setProgress(drag.base + delta / Math.max(110, overlay.clientWidth * .34));
		});
		const endDrag = (event: PointerEvent) => {
			if (!drag || drag.pointerId !== event.pointerId) return;
			const moved = drag.moved;
			drag = null;
			overlay.classList.remove("door-dragging");
			if (moved) suppressClickUntil = performance.now() + 350;
			if (event.type !== "pointercancel" && currentProgress >= .32) requestOpen();
			else animateProgress(0, 240);
		};
		door.addEventListener("pointerup", endDrag);
		door.addEventListener("pointercancel", endDrag);
		door.addEventListener("click", () => { if (performance.now() >= suppressClickUntil) requestOpen(); });
	}

	skip?.addEventListener("click", skipEntrance);
	nextButton?.addEventListener("click", advanceDialogue);
	enterButton?.addEventListener("click", finishIntro);
	autoButton?.addEventListener("click", () => {
		if (phase !== "dialogue") return;
		autoEnabled = !autoEnabled;
		autoButton.setAttribute("aria-pressed", String(autoEnabled));
		autoButton.textContent = `自动推进：${autoEnabled ? "开" : "关"}`;
		if (autoEnabled) maybeScheduleAuto();
		else cancelAuto();
	});

	document.addEventListener("keydown", (event) => {
		if (phase === "idle") return;
		if (event.key === "Escape") { event.preventDefault(); skipEntrance(); return; }
		if ((phase === "approaching" || phase === "active") && (event.key === "Enter" || event.key === " ") && event.target === entrance) {
			event.preventDefault();
			requestOpen();
			return;
		}
		if (phase === "dialogue" && (event.key === "Enter" || event.key === " ") && !(event.target instanceof HTMLButtonElement)) {
			event.preventDefault();
			advanceDialogue();
			return;
		}
		if (event.key !== "Tab") return;
		const controls = phase === "dialogue"
			? [autoButton, ...(enterButton && !enterButton.hidden ? [enterButton] : [nextButton]), skip]
			: phase === "active" ? [...doors, skip] : [skip];
		const enabled = controls.filter((control): control is HTMLButtonElement => !!control);
		if (!enabled.length) return;
		const first = enabled[0];
		const last = enabled[enabled.length - 1];
		if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
		else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
		else if (!enabled.includes(document.activeElement as HTMLButtonElement)) { event.preventDefault(); first.focus(); }
	});

	document.addEventListener("firefly:home-entrance-start", activate);
	document.addEventListener("firefly:home-entrance-ready", markReady);
	document.addEventListener("firefly:home-entrance-cancel", () => { if (phase !== "idle" || root.hasAttribute("data-home-intro")) clear(false); });
	reducedMotion.addEventListener("change", () => { if (reducedMotion.matches && phase !== "idle") clear(true); });
	window.addEventListener("pageshow", (event) => {
		if (event.persisted && document.getElementById("home-intro-title")) { activate(); markReady(); }
	});
	if (root.hasAttribute("data-home-intro")) {
		activate();
		if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", markReady, { once: true });
		else markReady();
	}
}
