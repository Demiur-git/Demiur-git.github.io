import * as T from "three";
import { EasterEggScene } from "./easter-egg-scene";
import {
	ENTRY,
	ANNEX_WALLS,
	UPPER_WALLS,
	FLOOR_SLABS,
	AISLE_SHELVES,
	LIBRARY,
	moveVisitor,
	hasLibrarySight,
	nearbyLibraryTarget,
	roomAt,
	ROOMS,
	WALL_SHELVES,
	WALLPAPER_VIEW,
	type Visitor,
} from "./library-3d-layout";
import { createLibraryModel } from "./library-3d-model";
import {
	effectiveLibraryLighting,
	libraryViewURL,
	readLibraryView,
	type LibraryDrawing,
	type LibraryViewOptions,
} from "./library-3d-view";
import type { LibrarySolidRender } from "./library-3d-solid-render";
import {
	advanceRunningReminder,
	freshRunningReminder,
} from "./library-3d-running";

export class Library3DScene extends EasterEggScene {
	private renderer?: T.WebGLRenderer;
	private scene?: T.Scene;
	private camera?: T.PerspectiveCamera;
	private model?: LibraryDrawing;
	private solidRender?: LibrarySolidRender;
	private options: LibraryViewOptions = { view: "ink", lighting: "auto" };
	private generation = 0;
	private loadAbort?: AbortController;
	private changing = false;
	private themeObserver?: MutationObserver;
	private settings!: HTMLDetailsElement;
	private canvas!: HTMLCanvasElement;
	private visitor: Visitor = { ...ENTRY };
	private failed = false;
	private keys = new Set<string>();
	private joystick = { x: 0, y: 0 };
	private joyPointer: number | null = null;
	private lookPointer: number | null = null;
	private look = { x: 0, y: 0 };
	private dirty = true;
	private lastDraw = -100;
	private motionClock = 0;
	private drawCount = 0;
	private mobile = false;
	private runPointer: number | null = null;
	private touchRunning = false;
	private reminder = freshRunningReminder();
	private enabledTargets = new Set<string>();
	private target: string | null = null;
	private opening = false;
	private cardTarget: string | null = null;
	private cardFocus: HTMLElement | null = null;

	connectedCallback(): void {
		if (this.active) return;
		this.canvas = this.querySelector<HTMLCanvasElement>("canvas")!;
		this.visitor = { ...ENTRY };
		this.failed = false;
		this.drawCount = 0;
		this.reminder = freshRunningReminder();
		this.opening = false;
		this.cardTarget = null;
		this.target = null;
		this.enabledTargets = new Set(
			[...this.querySelectorAll<HTMLElement>("[data-library-item]")].map(
				(a) => a.dataset.libraryItem!,
			),
		);
		const help = this.querySelector<HTMLDetailsElement>(".library3d-help")!;
		this.settings = this.querySelector<HTMLDetailsElement>(
			"[data-library-settings]",
		)!;
		this.options = readLibraryView(location.search);
		const signal = this.mount("/");
		this.back.hidden = false;
		this.dataset.mode = "inside";
		this.setupSettings(signal);
		this.dialog.addEventListener(
			"keydown",
			(event) => {
				if (this.cardTarget) {
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopImmediatePropagation();
						if (!this.opening) this.closeCard();
					} else if (event.key === "Tab") {
						const buttons = [
							...this.querySelectorAll<HTMLButtonElement>(
								"[data-library-confirm] button",
							),
						].filter((b) => !b.disabled);
						event.preventDefault();
						const i = buttons.indexOf(
							document.activeElement as HTMLButtonElement,
						);
						buttons[
							(i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
						]?.focus();
					}
					return;
				}
				if (event.key === "Escape" && this.settings.open) {
					event.preventDefault();
					event.stopImmediatePropagation();
					this.settings.open = false;
					this.clearInput(false);
					this.canvas.focus({ preventScroll: true });
					return;
				}
				if (event.key === "Escape" && help.open) {
					event.preventDefault();
					event.stopImmediatePropagation();
					help.open = false;
					return;
				}
				if (this.changing || this.settings.open) return;
				if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
					this.keys.add(event.code);
					return;
				}
				if (
					event.altKey ||
					event.ctrlKey ||
					event.metaKey ||
					(event.target instanceof Element &&
						event.target.closest("button,a,summary,select,input"))
				)
					return;
				if (event.code === "KeyE" && !event.repeat) {
					event.preventDefault();
					this.showCard();
					return;
				}
				if (
					/^(Key[WASD]|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(
						event.code,
					)
				) {
					event.preventDefault();
					this.keys.add(event.code);
				}
			},
			{ capture: true, signal },
		);
		window.addEventListener("keyup", (event) => this.keys.delete(event.code), {
			signal,
		});
		window.addEventListener("resize", () => this.resize(), { signal });
		this.canvas.addEventListener(
			"webglcontextlost",
			(event) => {
				event.preventDefault();
				this.onVisibility(false);
				this.loadAbort?.abort();
				this.generation++;
				this.showError(
					"绘制连接已中断。恢复后会重建阅览空间，也可点击重试或切换线稿。",
				);
			},
			{ signal },
		);
		this.canvas.addEventListener("webglcontextrestored", () => this.prepare(), {
			signal,
		});
		this.querySelector("[data-library-retry]")!.addEventListener(
			"click",
			() => this.prepare(),
			{ signal },
		);
		this.querySelector("[data-library-reset]")!.addEventListener(
			"click",
			() => {
				this.placeVisitor(ENTRY);
				this.status("已回到馆内入口。");
			},
			{ signal },
		);
		this.querySelector("[data-library-reference]")!.addEventListener(
			"click",
			() => {
				help.open = false;
				this.placeVisitor(WALLPAPER_VIEW);
				this.status("已到阅读区观赏位置。");
			},
			{ signal },
		);
		this.setupLook(this.canvas, signal, "mouse");
		this.setupLook(
			this.querySelector<HTMLElement>("[data-library-look]")!,
			signal,
			"touch",
		);
		this.setupJoystick(signal);
		this.setupRunning(signal);
		for (const anchor of this.querySelectorAll<HTMLAnchorElement>(
			"[data-library-item]",
		))
			anchor.addEventListener(
				"click",
				(event) => {
					event.preventDefault();
					if (anchor.dataset.libraryItem === this.target) this.showCard();
				},
				{ signal },
			);
		this.querySelector("[data-library-cancel]")!.addEventListener(
			"click",
			() => {
				if (!this.opening) this.closeCard();
			},
			{ signal },
		);
		this.querySelector("[data-library-confirm-go]")!.addEventListener(
			"click",
			() => void this.openTarget(),
			{ signal },
		);
		void this.prepare();
	}
	private setupSettings(signal: AbortSignal): void {
		const view = this.querySelector<HTMLSelectElement>("[data-library-view]")!;
		const lighting = this.querySelector<HTMLSelectElement>(
			"[data-library-lighting]",
		)!;
		this.settings.addEventListener(
			"toggle",
			() => {
				this.clearInput(false);
				this.motionClock = 0;
			},
			{ signal },
		);
		view.addEventListener(
			"change",
			() => {
				this.options.view = view.value === "solid" ? "solid" : "ink";
				this.updateSettingsURL();
				void this.changeDrawing();
			},
			{ signal },
		);
		lighting.addEventListener(
			"change",
			() => {
				this.options.lighting =
					lighting.value === "day" || lighting.value === "night"
						? lighting.value
						: "auto";
				this.clearInput(false);
				this.updateSettingsURL();
				this.updateLighting();
			},
			{ signal },
		);
		this.querySelector("[data-library-fallback]")!.addEventListener(
			"click",
			() => {
				this.options.view = "ink";
				this.updateSettingsURL();
				if (this.renderer && this.camera && this.scene)
					void this.changeDrawing();
				else void this.prepare();
			},
			{ signal },
		);
		this.themeObserver = new MutationObserver(() => {
			if (this.options.lighting === "auto") this.updateLighting();
		});
		this.themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		// Back/forward within the same document must respect the current URL as well.
		window.addEventListener(
			"popstate",
			() => {
				if (!this.active || !location.pathname.includes("library-3d")) return;
				const next = readLibraryView(location.search),
					changed = next.view !== this.options.view;
				this.options = next;
				this.syncSettings();
				if (changed) void this.changeDrawing();
				else this.updateLighting();
			},
			{ signal },
		);
		this.syncSettings();
	}
	private syncSettings(): void {
		this.querySelector<HTMLSelectElement>("[data-library-view]")!.value =
			this.options.view;
		this.querySelector<HTMLSelectElement>("[data-library-lighting]")!.value =
			this.options.lighting;
		this.querySelector<HTMLElement>("[data-library-lighting-label]")!.hidden =
			this.options.view !== "solid";
		this.querySelector<HTMLElement>("[data-library-fallback]")!.hidden =
			this.options.view !== "solid";
	}
	private updateSettingsURL(): void {
		history.replaceState(
			history.state,
			"",
			libraryViewURL(location.href, this.options),
		);
		this.syncSettings();
	}
	private updateLighting(force = false): void {
		if (
			!this.model ||
			!this.renderer ||
			!this.scene ||
			this.dataset.view !== "solid"
		)
			return;
		const light = effectiveLibraryLighting(
			this.options.lighting,
			document.documentElement.classList.contains("dark"),
		);
		if (!force && this.dataset.lighting === light) return;
		this.model.setLighting?.(light);
		this.scene.environmentIntensity = light === "day" ? 0.25 : 0.12;
		this.renderer.toneMappingExposure = light === "day" ? 1.06 : 1.13;
		this.dataset.lighting = light;
		this.renderer.shadowMap.needsUpdate = true;
		this.dirty = true;
	}
	private placeVisitor(view: Visitor): void {
		if (this.failed) return;
		this.onVisibility(false);
		this.reminder = freshRunningReminder();
		this.querySelector<HTMLElement>("[data-library-reminder]")!.hidden = true;
		this.visitor = { ...view };
		this.updateCamera();
		this.dirty = true;
		this.canvas.focus({ preventScroll: true });
	}
	private async prepare(): Promise<void> {
		if (!this.active) return;
		this.onVisibility(false);
		this.disposeGraphics();
		this.failed = false;
		this.querySelector<HTMLElement>(".library3d-loading")!.hidden = false;
		try {
			this.renderer = new T.WebGLRenderer({
				canvas: this.canvas,
				antialias: true,
				alpha: false,
				powerPreference: "default",
			});
			this.renderer.outputColorSpace = T.SRGBColorSpace;
			this.renderer.toneMapping = T.NoToneMapping;
			this.renderer.setClearColor(0x000000, 1);
			this.scene = new T.Scene();
			this.scene.background = new T.Color(0x000000);
			this.camera = new T.PerspectiveCamera(60, 1, 0.06, 75);
			await this.changeDrawing();
		} catch {
			this.disposeGraphics();
			this.showError(
				"浏览器未能创建 WebGL2 阅览空间。请启用硬件加速后重试；下图仅为原图书馆参考。",
			);
		}
	}
	private async changeDrawing(): Promise<void> {
		if (!this.active || !this.scene || !this.renderer || !this.camera) return;
		const generation = ++this.generation;
		this.loadAbort?.abort();
		const controller = new AbortController();
		this.loadAbort = controller;
		const selected = this.options.view;
		this.clearInput(false);
		this.motionClock = 0;
		this.changing = true;
		this.setDisabled(true);
		this.status("");
		const loading = this.querySelector<HTMLElement>(".library3d-loading")!;
		loading.textContent =
			selected === "solid"
				? "正在准备实体空间与本地材质……"
				: "正在准备线稿空间……";
		loading.hidden = false;
		let next: LibraryDrawing | undefined;
		try {
			if (selected === "solid") {
				const [{ createSolidLibraryModel }, { loadLibraryTextures }] =
					await Promise.all([
						import("./library-3d-solid-model"),
						import("./library-3d-materials"),
					]);
				if (generation !== this.generation || !this.active) return;
				const textures = await loadLibraryTextures(
					matchMedia("(pointer: coarse)").matches || innerWidth <= 600,
					controller.signal,
				);
				if (generation !== this.generation || !this.active) {
					textures.dispose();
					return;
				}
				try {
					next = createSolidLibraryModel(
						textures,
						matchMedia("(pointer: coarse)").matches || innerWidth <= 600,
					);
				} catch (error) {
					textures.dispose();
					throw error;
				}
				if (textures.failures.length)
					this.status(
						"部分材质暂不可用，已使用基础材质；可通过画面设置切回线稿，或重新加载重试。",
					);
			} else next = createLibraryModel();
			if (generation !== this.generation || !this.active) {
				next.dispose();
				return;
			}
			// Build before replacing: cancellation/failure never changes the visitor's pose.
			this.solidRender?.dispose();
			this.solidRender = undefined;
			if (this.model) {
				this.scene.remove(this.model.root);
				this.model.dispose();
			}
			this.model = next;
			this.scene.add(next.root);
			this.renderer.shadowMap.enabled = selected === "solid";
			this.renderer.shadowMap.type = T.PCFShadowMap;
			this.renderer.shadowMap.autoUpdate = false;
			this.renderer.shadowMap.needsUpdate = true;
			this.renderer.toneMapping =
				selected === "solid" ? T.ACESFilmicToneMapping : T.NoToneMapping;
			this.renderer.toneMappingExposure = 1;
			this.dataset.view = selected;
			if (selected === "solid") {
				const { LibrarySolidRender } = await import(
					"./library-3d-solid-render"
				);
				if (generation !== this.generation || !this.active) return;
				this.solidRender = new LibrarySolidRender(
					this.renderer,
					this.scene,
					this.camera,
				);
				this.updateLighting(true);
			} else delete this.dataset.lighting;
			this.querySelector(".library3d-title h1")!.textContent =
				selected === "solid" ? "实体图书馆" : "线稿图书馆";
			this.querySelector(".library3d-title span")!.textContent =
				selected === "solid" ? "PALIB · MATERIAL STUDY" : "PALIB · INK STUDY";
			this.failed = false;
			this.changing = false;
			this.clearInput(false);
			this.motionClock = 0;
			this.querySelector<HTMLElement>(".library3d-error")!.hidden = true;
			loading.hidden = true;
			this.dataset.renderer = "webgl2";
			this.setDisabled(false);
			this.resize();
			this.updateCamera();
			this.dirty = true;
			if (!this.settings.open) this.canvas.focus({ preventScroll: true });
			this.renderFrame(0);
		} catch {
			if (generation !== this.generation || !this.active) return;
			this.changing = false;
			this.showError(
				"当前阅览画面加载失败，位置与视角已保留。请重新加载，或选择线稿模式。",
			);
		}
	}
	private setDisabled(disabled: boolean): void {
		for (const button of this.querySelectorAll<HTMLButtonElement>(
			"[data-library-reset],[data-library-reference],[data-library-run]",
		))
			button.disabled = disabled;
	}
	private showError(message: string): void {
		this.closeCard(false);
		this.failed = true;
		this.reminder = freshRunningReminder();
		this.onVisibility(false);
		this.setDisabled(true);
		this.querySelector<HTMLElement>(".library3d-loading")!.hidden = true;
		this.querySelector<HTMLElement>(".library3d-error")!.hidden = false;
		this.querySelector<HTMLElement>("[data-library-error-text]")!.textContent =
			message;
		this.dataset.renderer = "unavailable";
		this.querySelector<HTMLElement>("[data-library-interaction]")!.hidden =
			true;
		this.querySelector<HTMLElement>("[data-library-reminder]")!.hidden = true;
		for (const plaque of this.querySelectorAll<HTMLElement>(
			"[data-library-room]",
		))
			plaque.hidden = true;
	}
	private status(message: string): void {
		this.querySelector<HTMLElement>("[data-library-status]")!.textContent =
			message;
	}
	private updateCamera(): void {
		if (!this.camera) return;
		const v = this.visitor;
		const eye = (v.elevation || 0) + LIBRARY.eye;
		this.camera.position.set(v.x, eye, v.z);
		this.camera.lookAt(
			v.x + Math.sin(v.yaw) * Math.cos(v.pitch),
			eye + Math.sin(v.pitch),
			v.z + Math.cos(v.yaw) * Math.cos(v.pitch),
		);
	}
	private resize(): void {
		this.mobile = matchMedia("(pointer: coarse)").matches || innerWidth <= 600;
		if (!this.renderer || !this.camera || !this.model) return;
		const w = Math.max(1, innerWidth),
			h = Math.max(1, innerHeight);
		this.renderer.setPixelRatio(
			Math.min(devicePixelRatio || 1, this.mobile ? 1.5 : 2),
		);
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		this.model.resize(w, h, this.mobile);
		this.solidRender?.resize(w, h, this.mobile);
		if (this.solidRender) this.renderer.shadowMap.needsUpdate = true;
		this.dirty = true;
	}
	private setupLook(
		element: HTMLElement,
		signal: AbortSignal,
		type: string,
	): void {
		element.addEventListener(
			"pointerdown",
			(event) => {
				if (
					this.failed ||
					this.changing ||
					this.settings.open ||
					this.cardTarget ||
					this.opening ||
					event.pointerType !== type ||
					event.button !== 0 ||
					this.lookPointer !== null
				)
					return;
				element.setPointerCapture(event.pointerId);
				this.lookPointer = event.pointerId;
				this.look = { x: event.clientX, y: event.clientY };
				this.canvas.focus({ preventScroll: true });
			},
			{ signal },
		);
		element.addEventListener(
			"pointermove",
			(event) => {
				if (this.lookPointer !== event.pointerId) return;
				this.visitor.yaw -= (event.clientX - this.look.x) * 0.004;
				this.visitor.pitch = T.MathUtils.clamp(
					this.visitor.pitch - (event.clientY - this.look.y) * 0.004,
					-1.2,
					1.2,
				);
				this.look = { x: event.clientX, y: event.clientY };
				this.updateCamera();
				this.dirty = true;
			},
			{ signal },
		);
		for (const name of [
			"pointerup",
			"pointercancel",
			"lostpointercapture",
		] as const)
			element.addEventListener(
				name,
				(event) => {
					if (this.lookPointer === event.pointerId) this.lookPointer = null;
				},
				{ signal },
			);
	}
	private setupJoystick(signal: AbortSignal): void {
		const pad = this.querySelector<HTMLElement>("[data-library-joystick]")!,
			knob = this.querySelector<HTMLElement>("[data-library-knob]")!;
		const move = (event: PointerEvent) => {
			if (this.joyPointer !== event.pointerId) return;
			const r = pad.getBoundingClientRect(),
				radius = r.width * 0.36;
			let x = (event.clientX - r.left - r.width / 2) / radius,
				y = (event.clientY - r.top - r.height / 2) / radius;
			const length = Math.max(1, Math.hypot(x, y));
			x /= length;
			y /= length;
			this.joystick = { x, y };
			knob.style.transform = `translate(calc(-50% + ${x * radius}px),calc(-50% + ${y * radius}px))`;
		};
		pad.addEventListener(
			"pointerdown",
			(event) => {
				if (
					this.failed ||
					this.changing ||
					this.settings.open ||
					this.cardTarget ||
					this.opening ||
					this.joyPointer !== null
				)
					return;
				pad.setPointerCapture(event.pointerId);
				this.joyPointer = event.pointerId;
				move(event);
			},
			{ signal },
		);
		pad.addEventListener("pointermove", move, { signal });
		for (const name of [
			"pointerup",
			"pointercancel",
			"lostpointercapture",
		] as const)
			pad.addEventListener(
				name,
				(event) => {
					if (this.joyPointer === event.pointerId) {
						this.joyPointer = null;
						this.joystick = { x: 0, y: 0 };
						knob.style.transform = "translate(-50%,-50%)";
					}
				},
				{ signal },
			);
	}
	private setupRunning(signal: AbortSignal): void {
		const button = this.querySelector<HTMLButtonElement>("[data-library-run]")!;
		const update = (value: boolean) => {
			this.touchRunning = value;
			button.setAttribute("aria-pressed", String(value));
		};
		button.addEventListener(
			"pointerdown",
			(event) => {
				if (
					this.failed ||
					this.changing ||
					this.settings.open ||
					this.opening ||
					this.cardTarget ||
					this.runPointer !== null ||
					event.button !== 0
				)
					return;
				event.preventDefault();
				button.setPointerCapture(event.pointerId);
				this.runPointer = event.pointerId;
				update(true);
			},
			{ signal },
		);
		for (const name of [
			"pointerup",
			"pointercancel",
			"lostpointercapture",
		] as const)
			button.addEventListener(
				name,
				(event) => {
					if (this.runPointer === event.pointerId) {
						this.runPointer = null;
						update(false);
					}
				},
				{ signal },
			);
		button.addEventListener(
			"keydown",
			(event) => {
				if (event.code === "Space" || event.code === "Enter") {
					event.preventDefault();
					if (
						!this.failed &&
						!this.changing &&
						!this.settings.open &&
						!this.opening &&
						!this.cardTarget
					)
						update(true);
				}
			},
			{ signal },
		);
		button.addEventListener(
			"keyup",
			(event) => {
				if (event.code === "Space" || event.code === "Enter") {
					event.preventDefault();
					update(false);
				}
			},
			{ signal },
		);
		button.addEventListener(
			"blur",
			() => {
				if (this.runPointer === null) update(false);
			},
			{ signal },
		);
	}
	private setCardInert(inert: boolean): void {
		for (const child of [...this.dialog.children])
			if (
				child instanceof HTMLElement &&
				!child.matches("[data-library-confirm]")
			)
				child.inert = inert;
	}
	private showCard(): void {
		if (
			this.failed ||
			this.changing ||
			this.settings.open ||
			this.opening ||
			this.cardTarget
		)
			return;
		const target = nearbyLibraryTarget(this.visitor, this.enabledTargets);
		if (!target || target.id !== this.target) return;
		this.cardFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: this.canvas;
		this.clearInput(false);
		this.motionClock = 0;
		this.cardTarget = target.id;
		this.querySelector<HTMLElement>(
			"[data-library-confirm-object]",
		)!.textContent = target.object;
		this.querySelector<HTMLElement>(
			"[data-library-confirm-title]",
		)!.textContent = target.name;
		this.querySelector<HTMLElement>(
			"[data-library-confirm-description]",
		)!.textContent = target.description;
		this.querySelector<HTMLElement>("[data-library-confirm-error]")!.hidden =
			true;
		this.querySelector<HTMLElement>("[data-library-confirm]")!.hidden = false;
		this.querySelector<HTMLElement>("[data-library-interaction]")!.hidden =
			true;
		this.setCardInert(true);
		this.querySelector<HTMLButtonElement>("[data-library-cancel]")!.focus({
			preventScroll: true,
		});
	}
	private closeCard(focus = true): void {
		this.cardTarget = null;
		this.opening = false;
		this.setCardInert(false);
		this.querySelector<HTMLElement>("[data-library-confirm]")!.hidden = true;
		for (const b of this.querySelectorAll<HTMLButtonElement>(
			"[data-library-confirm] button",
		))
			b.disabled = false;
		this.clearInput(false);
		this.motionClock = 0;
		this.dirty = true;
		if (focus && this.active && !document.hidden)
			(this.cardFocus?.isConnected && !this.cardFocus.hidden
				? this.cardFocus
				: this.canvas
			).focus({ preventScroll: true });
		this.cardFocus = null;
	}
	private async openTarget(): Promise<void> {
		if (this.failed || this.opening || !this.cardTarget) return;
		const id = this.cardTarget;
		if (!this.enabledTargets.has(id)) {
			this.closeCard();
			return;
		}
		const anchor = [
			...this.querySelectorAll<HTMLAnchorElement>("[data-library-item]"),
		].find((a) => a.dataset.libraryItem === id);
		if (!anchor) return;
		this.opening = true;
		this.clearInput(false);
		const feedback = this.querySelector<HTMLElement>(
			"[data-library-confirm-error]",
		)!;
		feedback.hidden = false;
		feedback.textContent = "正在打开栏目……";
		for (const b of this.querySelectorAll<HTMLButtonElement>(
			"[data-library-confirm] button",
		))
			b.disabled = true;
		try {
			if (window.swup) {
				await window.swup.navigate(anchor.href);
				if (this.active && this.cardTarget === id)
					throw new Error("navigation cancelled");
			} else location.assign(anchor.href);
		} catch {
			if (this.active && this.cardTarget === id) {
				this.opening = false;
				feedback.textContent = "未能打开页面，请重试，或继续参观。";
				for (const b of this.querySelectorAll<HTMLButtonElement>(
					"[data-library-confirm] button",
				))
					b.disabled = false;
				this.querySelector<HTMLButtonElement>("[data-library-cancel]")!.focus({
					preventScroll: true,
				});
			}
		}
	}
	private updateContext(): void {
		if (!this.camera) return;
		this.camera.updateMatrixWorld(true);
		const room = roomAt(
			this.visitor.x,
			this.visitor.z,
			this.visitor.elevation || 0,
		);
		const label = this.querySelector<HTMLElement>("[data-library-location]")!;
		const location = `${(this.visitor.elevation || 0) > 4.2 ? "二楼" : (this.visitor.elevation || 0) > 0.1 ? "楼梯" : "一楼"} · ${room}`;
		if (label.textContent !== location) label.textContent = location;
		this.dataset.room = room;
		this.target =
			nearbyLibraryTarget(this.visitor, this.enabledTargets)?.id || null;
		this.querySelector<HTMLElement>("[data-library-interaction]")!.hidden =
			!this.target || this.opening || !!this.cardTarget;
		for (const anchor of this.querySelectorAll<HTMLElement>(
			"[data-library-item]",
		))
			anchor.hidden = anchor.dataset.libraryItem !== this.target;
		for (const room of ROOMS) {
			const marker = this.querySelector<HTMLElement>(
				`[data-library-room="${room.id}"]`,
			)!;
			const point = new T.Vector3(
				room.doorX - Math.sign(room.doorX) * 0.185,
				(room.base || 0) + 2.55,
				room.z,
			);
			const near = point.distanceTo(this.camera.position) < 10;
			const visible =
				near &&
				hasLibrarySight(
					{ ...this.visitor, y: this.camera.position.y },
					{ x: point.x, y: point.y, z: point.z },
					[
						...ANNEX_WALLS,
						...UPPER_WALLS,
						...FLOOR_SLABS,
						...AISLE_SHELVES,
						...WALL_SHELVES,
					],
				);
			point.project(this.camera);
			const x = ((point.x + 1) * innerWidth) / 2,
				y = ((1 - point.y) * innerHeight) / 2;
			marker.hidden =
				!visible ||
				point.z < -1 ||
				point.z > 1 ||
				x < 44 ||
				x > innerWidth - 44 ||
				y < 110 ||
				y > innerHeight - 70;
			if (!marker.hidden) {
				marker.style.left = `${x}px`;
				marker.style.top = `${y}px`;
			}
		}
	}
	protected onVisibility(visible: boolean): void {
		this.motionClock = 0;
		if (visible) {
			this.dirty = true;
			return;
		}
		if (this.cardTarget && !this.opening) this.closeCard(false);
		this.clearInput();
	}
	private clearInput(resetRun = true): void {
		this.keys.clear();
		this.joystick = { x: 0, y: 0 };
		this.touchRunning = false;
		if (resetRun) {
			this.reminder.running = 0;
			this.reminder.idle = 0;
		}
		this.querySelector("[data-library-run]")?.setAttribute(
			"aria-pressed",
			"false",
		);
		for (const element of this.querySelectorAll<HTMLElement>(
			"canvas,[data-library-look],[data-library-joystick],[data-library-run]",
		))
			for (const id of [this.joyPointer, this.lookPointer, this.runPointer])
				if (id !== null && element.hasPointerCapture(id))
					element.releasePointerCapture(id);
		this.joyPointer = this.lookPointer = null;
		this.runPointer = null;
		const knob = this.querySelector<HTMLElement>("[data-library-knob]");
		if (knob) knob.style.transform = "translate(-50%,-50%)";
	}
	protected renderFrame(_delta: number): void {
		if (
			!this.renderer ||
			!this.scene ||
			!this.camera ||
			!this.model ||
			this.failed ||
			this.changing
		)
			return;
		// Walk by actual visible elapsed time, in collision-safe substeps.
		const now = performance.now(),
			dt = this.motionClock
				? Math.min(0.5, Math.max(0, (now - this.motionClock) / 1000))
				: 0;
		this.motionClock = now;
		const elapsed = this.cardTarget || this.settings.open ? 0 : dt;
		const side =
			Number(this.keys.has("KeyD")) -
			Number(this.keys.has("KeyA")) +
			this.joystick.x;
		const forward =
			Number(this.keys.has("KeyW")) -
			Number(this.keys.has("KeyS")) -
			this.joystick.y;
		const turn =
			Number(this.keys.has("ArrowLeft")) - Number(this.keys.has("ArrowRight"));
		const tilt =
			Number(this.keys.has("ArrowUp")) - Number(this.keys.has("ArrowDown"));
		const running =
			this.touchRunning ||
			this.keys.has("ShiftLeft") ||
			this.keys.has("ShiftRight");
		const before = {
			x: this.visitor.x,
			z: this.visitor.z,
			elevation: this.visitor.elevation || 0,
		};
		if (
			!this.opening &&
			!this.cardTarget &&
			(side || forward || turn || tilt)
		) {
			for (let remaining = elapsed; remaining > 0; remaining -= 0.1)
				this.visitor = moveVisitor(
					this.visitor,
					side,
					forward,
					Math.min(0.1, remaining),
					running ? LIBRARY.runSpeed : LIBRARY.speed,
				);
			this.visitor.yaw += turn * elapsed * 1.3;
			this.visitor.pitch = T.MathUtils.clamp(
				this.visitor.pitch + tilt * elapsed,
				-1.2,
				1.2,
			);
			this.updateCamera();
			this.dirty = true;
		}
		this.reminder = advanceRunningReminder(
			this.reminder,
			elapsed,
			!this.opening &&
				running &&
				Math.hypot(
					this.visitor.x - before.x,
					this.visitor.z - before.z,
					(this.visitor.elevation || 0) - before.elevation,
				) > 0.001,
		);
		this.querySelector<HTMLElement>("[data-library-reminder]")!.hidden =
			this.reminder.visible <= 0;
		if (
			!this.dirty ||
			this.visibleTime - this.lastDraw < (this.mobile ? 32 : 16)
		)
			return;
		try {
			this.updateContext();
			if (this.model.update?.(this.camera.position))
				this.renderer.shadowMap.needsUpdate = true;
			const started = performance.now();
			this.renderer.info.reset();
			this.renderer.info.autoReset = false;
			if (this.solidRender) this.solidRender.render();
			else this.renderer.render(this.scene, this.camera);
			this.dataset.drawMs = (performance.now() - started).toFixed(2);
			this.dataset.drawCalls = String(this.renderer.info.render.calls);
			this.dataset.triangles = String(this.renderer.info.render.triangles);
			this.dataset.textures = String(this.renderer.info.memory.textures);
			this.dirty = false;
			this.lastDraw = this.visibleTime;
			this.dataset.frames = String(++this.drawCount);
		} catch {
			this.showError("当前画面绘制失败，请重试、切换线稿或返回主页。");
		}
	}
	private disposeGraphics(): void {
		this.generation++;
		this.loadAbort?.abort();
		this.loadAbort = undefined;
		this.changing = false;
		this.solidRender?.dispose();
		this.solidRender = undefined;
		this.model?.dispose();
		this.model = undefined;
		this.renderer?.dispose();
		this.renderer = undefined;
		this.scene?.clear();
		this.scene = undefined;
		this.camera = undefined;
		this.lastDraw = -100;
	}
	protected revealReturn(): void {
		this.back.hidden = false;
	}
	protected cleanup(): void {
		if (!this.active) return;
		this.closeCard(false);
		this.themeObserver?.disconnect();
		this.themeObserver = undefined;
		this.onVisibility(false);
		this.disposeGraphics();
		super.cleanup();
	}
}
