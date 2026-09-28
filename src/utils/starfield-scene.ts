import { EasterEggScene } from "./easter-egg-scene";
import { getPuzzleProgress } from "./pulse-puzzle";
import { pulseScenePath } from "./pulse-route";
import {
	generateStarChunk,
	projectStar,
	STAR_CHUNK_SIZE,
	type StarCamera,
	type StarPoint,
} from "./starfield-geometry";

const START_CAMERA: StarCamera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const MOVE_SPEED = 25;
const LOOK_SPEED = 0.004;
const MAX_PITCH = (85 * Math.PI) / 180;

export class StarfieldScene extends EasterEggScene {
	private camera: StarCamera = { ...START_CAMERA };
	private context: CanvasRenderingContext2D | null = null;
	private canvas!: HTMLCanvasElement;
	private keys = new Set<string>();
	private joystick = { x: 0, y: 0 };
	private vertical = 0;
	private stars: StarPoint[] = [];
	private chunkKey = "";
	private width = 0;
	private height = 0;
	private fov = 75;
	private lastDraw = -100;
	private dirty = true;
	private lookPointer: number | null = null;
	private lastLook = { x: 0, y: 0 };
	private joystickPointer: number | null = null;
	private verticalPointer: number | null = null;

	connectedCallback(): void {
		if (this.active) return;
		if (!getPuzzleProgress().starfieldUnlocked) {
			document.documentElement.removeAttribute("data-starfield-pending");
			location.replace(pulseScenePath());
			return;
		}
		this.camera = { ...START_CAMERA };
		this.keys.clear();
		this.joystick = { x: 0, y: 0 };
		this.vertical = 0;
		this.chunkKey = "";
		this.fov = 75;
		this.lastDraw = -100;
		this.dirty = true;
		this.canvas = this.querySelector<HTMLCanvasElement>("canvas")!;
		try {
			this.context = this.canvas.getContext("2d", { alpha: false });
		} catch {
			this.context = null;
		}
		this.querySelector<HTMLElement>("[data-star-error]")!.hidden =
			this.context !== null;
		this.resize();
		const signal = this.mount(pulseScenePath());
		this.back.hidden = false;
		this.canvas.addEventListener(
			"contextlost",
			(event) => {
				event.preventDefault();
				this.context = null;
				this.querySelector<HTMLElement>("[data-star-error]")!.hidden = false;
			},
			{ signal },
		);
		this.canvas.addEventListener(
			"contextrestored",
			() => {
				this.context = this.canvas.getContext("2d", { alpha: false });
				this.querySelector<HTMLElement>("[data-star-error]")!.hidden =
					this.context !== null;
				this.resize();
			},
			{ signal },
		);
		window.addEventListener("resize", () => this.resize(), { signal });
		window.addEventListener("blur", () => this.onVisibility(false), { signal });
		this.dialog.addEventListener(
			"keydown",
			(event) => {
				if (event.altKey || event.ctrlKey || event.metaKey) return;
				if (
					!/^(Key[WASDQE]|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(
						event.code,
					)
				)
					return;
				event.preventDefault();
				this.keys.add(event.code);
			},
			{ signal },
		);
		window.addEventListener("keyup", (event) => this.keys.delete(event.code), {
			signal,
		});
		this.setupLook(this.canvas, signal, "mouse");
		this.setupLook(
			this.querySelector<HTMLElement>("[data-star-look]")!,
			signal,
			"touch",
		);
		this.setupJoystick(signal);
		this.setupVertical(signal);
		this.querySelector<HTMLButtonElement>(
			"[data-star-reset]",
		)!.addEventListener(
			"click",
			() => {
				this.camera = { ...START_CAMERA };
				this.fov = 75;
				this.chunkKey = "";
				this.dirty = true;
			},
			{ signal },
		);
		this.canvas.addEventListener(
			"wheel",
			(event) => {
				event.preventDefault();
				this.fov = Math.max(45, Math.min(95, this.fov + event.deltaY * 0.02));
				this.dirty = true;
			},
			{ passive: false, signal },
		);
	}

	protected onVisibility(visible: boolean): void {
		if (visible) return;
		this.keys.clear();
		this.joystick = { x: 0, y: 0 };
		this.vertical = 0;
		this.lookPointer = null;
		this.joystickPointer = null;
		this.verticalPointer = null;
		const knob = this.querySelector<HTMLElement>("[data-star-knob]");
		if (knob) knob.style.transform = "translate(-50%, -50%)";
	}

	private resize(): void {
		this.width = Math.max(1, innerWidth);
		this.height = Math.max(1, innerHeight);
		const dpr = Math.min(devicePixelRatio || 1, this.width <= 480 ? 1.5 : 2);
		this.canvas.width = Math.round(this.width * dpr);
		this.canvas.height = Math.round(this.height * dpr);
		this.context?.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.chunkKey = "";
		this.dirty = true;
	}

	private setupLook(
		element: HTMLElement,
		signal: AbortSignal,
		pointerType: "mouse" | "touch",
	): void {
		element.addEventListener(
			"pointerdown",
			(event) => {
				if (event.pointerType !== pointerType || event.button !== 0) return;
				element.setPointerCapture(event.pointerId);
				this.lookPointer = event.pointerId;
				this.lastLook = { x: event.clientX, y: event.clientY };
			},
			{ signal },
		);
		element.addEventListener(
			"pointermove",
			(event) => {
				if (this.lookPointer !== event.pointerId) return;
				this.camera.yaw += (event.clientX - this.lastLook.x) * LOOK_SPEED;
				this.camera.pitch = Math.max(
					-MAX_PITCH,
					Math.min(
						MAX_PITCH,
						this.camera.pitch - (event.clientY - this.lastLook.y) * LOOK_SPEED,
					),
				);
				this.lastLook = { x: event.clientX, y: event.clientY };
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
		const pad = this.querySelector<HTMLElement>("[data-star-joystick]")!;
		const knob = this.querySelector<HTMLElement>("[data-star-knob]")!;
		const move = (event: PointerEvent) => {
			if (this.joystickPointer !== event.pointerId) return;
			const rect = pad.getBoundingClientRect();
			const radius = rect.width * 0.36;
			let x = (event.clientX - rect.left - rect.width / 2) / radius;
			let y = (event.clientY - rect.top - rect.height / 2) / radius;
			const length = Math.hypot(x, y);
			if (length > 1) {
				x /= length;
				y /= length;
			}
			this.joystick = { x, y };
			knob.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
		};
		pad.addEventListener(
			"pointerdown",
			(event) => {
				if (this.joystickPointer !== null) return;
				pad.setPointerCapture(event.pointerId);
				this.joystickPointer = event.pointerId;
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
					if (this.joystickPointer !== event.pointerId) return;
					this.joystickPointer = null;
					this.joystick = { x: 0, y: 0 };
					knob.style.transform = "translate(-50%, -50%)";
				},
				{ signal },
			);
	}

	private setupVertical(signal: AbortSignal): void {
		this.querySelectorAll<HTMLButtonElement>("[data-star-vertical]").forEach(
			(button) => {
				button.addEventListener(
					"click",
					(event) => {
						if (event.detail !== 0) return;
						this.camera.y += button.dataset.starVertical === "up" ? 2 : -2;
						this.dirty = true;
					},
					{ signal },
				);
				button.addEventListener(
					"pointerdown",
					(event) => {
						button.setPointerCapture(event.pointerId);
						this.verticalPointer = event.pointerId;
						this.vertical = button.dataset.starVertical === "up" ? 1 : -1;
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
							if (this.verticalPointer !== event.pointerId) return;
							this.verticalPointer = null;
							this.vertical = 0;
						},
						{ signal },
					);
			},
		);
	}

	protected renderFrame(delta: number): void {
		if (!this.context) return;
		const forward =
			Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
			Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) -
			this.joystick.y;
		const right =
			Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
			Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")) +
			this.joystick.x;
		const up =
			Number(this.keys.has("KeyE")) -
			Number(this.keys.has("KeyQ")) +
			this.vertical;
		const length = Math.hypot(forward, right, up);
		if (length > 0 && delta > 0) {
			const distance = (MOVE_SPEED * delta) / (1000 * Math.max(1, length));
			const sinYaw = Math.sin(this.camera.yaw);
			const cosYaw = Math.cos(this.camera.yaw);
			const cosPitch = Math.cos(this.camera.pitch);
			this.camera.x +=
				(forward * sinYaw * cosPitch + right * cosYaw) * distance;
			this.camera.y += (forward * Math.sin(this.camera.pitch) + up) * distance;
			this.camera.z +=
				(forward * cosYaw * cosPitch - right * sinYaw) * distance;
			this.dirty = true;
		}
		if (this.reduced && !this.dirty) return;
		if (
			this.width <= 480 &&
			!this.reduced &&
			this.visibleTime - this.lastDraw < 33
		)
			return;
		this.lastDraw = this.visibleTime;
		this.dirty = false;
		this.refreshStars();
		const ctx = this.context;
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, this.width, this.height);
		for (const star of this.stars) {
			const point = projectStar(
				star,
				this.camera,
				this.width,
				this.height,
				this.fov,
			);
			if (!point) continue;
			const near = 1 - point.depth / 280;
			const fade = Math.min(1, point.depth / 12);
			const twinkle = this.reduced
				? 1
				: 0.9 + 0.1 * Math.sin(this.visibleTime * 0.0014 + star.phase);
			const alpha = Math.min(
				0.95,
				star.brightness * (0.27 + near * 0.78) * fade * twinkle,
			);
			const radius = star.radius * (0.6 + near * 1.55);
			if (star.radius > 1.65) {
				ctx.fillStyle = `rgba(255,255,255,${alpha * 0.065})`;
				ctx.beginPath();
				ctx.arc(point.x, point.y, radius * 2.5, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.fillStyle = `rgba(255,255,255,${alpha})`;
			ctx.beginPath();
			ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	private refreshStars(): void {
		const cx = Math.floor(this.camera.x / STAR_CHUNK_SIZE);
		const cy = Math.floor(this.camera.y / STAR_CHUNK_SIZE);
		const cz = Math.floor(this.camera.z / STAR_CHUNK_SIZE);
		const key = `${cx}/${cy}/${cz}/${this.width <= 480}`;
		if (key === this.chunkKey) return;
		this.chunkKey = key;
		const count = this.width <= 480 ? 16 : 22;
		const stars: StarPoint[] = [];
		for (let x = -4; x <= 4; x++)
			for (let y = -4; y <= 4; y++)
				for (let z = -4; z <= 4; z++) {
					if (x * x + y * y + z * z > 20) continue;
					stars.push(...generateStarChunk(cx + x, cy + y, cz + z, count));
				}
		this.stars = stars;
	}
}
