<script lang="ts">
import { onMount } from "svelte";
import type { OcPetConfig } from "@/types/pioConfig";

interface Props {
	config: OcPetConfig;
}

const { config }: Props = $props();

let container: HTMLElement;
let collapsed = $state(false);
let message = $state("");
let messageVisible = $state(false);
let imageFailed = $state(false);
let activeAsset = $state(config.assets?.idle ?? "");
let x = $state<number | null>(null);
let y = $state<number | null>(null);
let dragging = $state(false);
let moved = false;
let suppressClick = false;
let pointerId: number | null = null;
let startPointerX = 0;
let startPointerY = 0;
let startX = 0;
let startY = 0;
let messageTimer: ReturnType<typeof setTimeout> | undefined;
let blinkTimer: ReturnType<typeof setTimeout> | undefined;
let assetTimer: ReturnType<typeof setTimeout> | undefined;
let previousMessage = -1;

const storageKey = config.storageKey ?? "oc-pet";
const positionKey = `${storageKey}:position`;
const collapsedKey = `${storageKey}:collapsed`;

function currentSize(): number {
	if (typeof window === "undefined") return config.size?.desktop ?? 168;
	return window.matchMedia("(max-width: 768px)").matches
		? (config.size?.mobile ?? 112)
		: (config.size?.desktop ?? 168);
}

function clampPosition(nextX: number, nextY: number) {
	const width = container?.offsetWidth || currentSize();
	const height = container?.offsetHeight || currentSize();
	const margin = 8;
	return {
		x: Math.min(
			Math.max(margin, nextX),
			Math.max(margin, window.innerWidth - width - margin),
		),
		y: Math.min(
			Math.max(margin, nextY),
			Math.max(margin, window.innerHeight - height - margin),
		),
	};
}

function savePosition() {
	if (x === null || y === null) return;
	localStorage.setItem(positionKey, JSON.stringify({ x, y }));
}

function restorePosition() {
	try {
		const saved = localStorage.getItem(positionKey);
		if (!saved) return;
		const parsed = JSON.parse(saved) as { x?: unknown; y?: unknown };
		if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return;
		const next = clampPosition(parsed.x, parsed.y);
		x = next.x;
		y = next.y;
	} catch {
		localStorage.removeItem(positionKey);
	}
}

function pickMessage() {
	const messages = config.messages ?? [];
	if (messages.length === 0) return "欢迎来到阅览室。";
	if (messages.length === 1) return messages[0];
	let index = Math.floor(Math.random() * messages.length);
	if (index === previousMessage) index = (index + 1) % messages.length;
	previousMessage = index;
	return messages[index];
}

function speak() {
	message = pickMessage();
	messageVisible = true;
	clearTimeout(messageTimer);
	messageTimer = setTimeout(() => {
		messageVisible = false;
	}, config.messageDuration ?? 3200);

	const interactAsset = config.assets?.interact;
	if (interactAsset) {
		clearTimeout(blinkTimer);
		clearTimeout(assetTimer);
		activeAsset = interactAsset;
		imageFailed = false;
		assetTimer = setTimeout(() => {
			activeAsset = config.assets?.idle ?? "";
			scheduleBlink();
		}, 520);
	}
}

function scheduleBlink() {
	clearTimeout(blinkTimer);
	if (
		!config.assets?.blink ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	)
		return;
	const min = config.blinkInterval?.min ?? 4500;
	const max = Math.max(min, config.blinkInterval?.max ?? 9000);
	blinkTimer = setTimeout(
		() => {
			activeAsset = config.assets?.blink ?? config.assets?.idle ?? "";
			imageFailed = false;
			clearTimeout(assetTimer);
			assetTimer = setTimeout(() => {
				activeAsset = config.assets?.idle ?? "";
				scheduleBlink();
			}, 180);
		},
		min + Math.random() * (max - min),
	);
}

function handleImageError() {
	const idleAsset = config.assets?.idle ?? "";
	if (activeAsset && activeAsset !== idleAsset) {
		activeAsset = idleAsset;
		return;
	}
	imageFailed = true;
}

function beginDrag(event: PointerEvent) {
	if (event.button !== 0 || collapsed) return;
	pointerId = event.pointerId;
	(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	const rect = container.getBoundingClientRect();
	startX = rect.left;
	startY = rect.top;
	startPointerX = event.clientX;
	startPointerY = event.clientY;
	moved = false;
	dragging = true;
}

function drag(event: PointerEvent) {
	if (!dragging || pointerId !== event.pointerId) return;
	const dx = event.clientX - startPointerX;
	const dy = event.clientY - startPointerY;
	if (Math.hypot(dx, dy) > 6) moved = true;
	const next = clampPosition(startX + dx, startY + dy);
	x = next.x;
	y = next.y;
}

function endDrag(event: PointerEvent) {
	if (!dragging || pointerId !== event.pointerId) return;
	dragging = false;
	pointerId = null;
	const target = event.currentTarget;
	if (
		target instanceof HTMLElement &&
		target.hasPointerCapture(event.pointerId)
	)
		target.releasePointerCapture(event.pointerId);
	suppressClick = moved;
	if (moved) savePosition();
}

function handleClick() {
	// click 是 pointerup 丢失时的兜底，同时避免拖动结束后误触发台词。
	if (dragging) {
		dragging = false;
		pointerId = null;
	}
	if (suppressClick) {
		suppressClick = false;
		return;
	}
	speak();
}

function handleLostPointerCapture() {
	if (!dragging) return;
	dragging = false;
	pointerId = null;
	if (moved) savePosition();
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		speak();
	}
}

function collapsePet(event: MouseEvent) {
	event.stopPropagation();
	collapsed = true;
	messageVisible = false;
	localStorage.setItem(collapsedKey, "true");
}

function wakePet() {
	collapsed = false;
	localStorage.setItem(collapsedKey, "false");
	setTimeout(() => {
		restorePosition();
		speak();
	});
}

onMount(() => {
	collapsed = localStorage.getItem(collapsedKey) === "true";
	restorePosition();
	scheduleBlink();

	const handleResize = () => {
		if (x === null || y === null) return;
		const next = clampPosition(x, y);
		x = next.x;
		y = next.y;
		savePosition();
	};
	window.addEventListener("resize", handleResize);
	window.addEventListener("pointerup", endDrag);
	window.addEventListener("pointercancel", endDrag);

	return () => {
		window.removeEventListener("resize", handleResize);
		window.removeEventListener("pointerup", endDrag);
		window.removeEventListener("pointercancel", endDrag);
		clearTimeout(messageTimer);
		clearTimeout(blinkTimer);
		clearTimeout(assetTimer);
	};
});
</script>

<div
	bind:this={container}
	class:dragging
	class:collapsed
	class="oc-pet"
	style={`--pet-size-desktop:${config.size?.desktop ?? 168}px;--pet-size-mobile:${config.size?.mobile ?? 112}px;--pet-z:${config.zIndex ?? 980};${x !== null && y !== null ? `left:${x}px;top:${y}px;right:auto;bottom:auto;` : ""}`}
	data-position={config.position ?? "bottom-left"}
>
	{#if collapsed}
		<button class="wake-button" type="button" aria-label={`唤回${config.name}`} title={`唤回${config.name}`} onclick={wakePet}>
			<span aria-hidden="true">书签</span>
		</button>
	{:else}
		<div class:visible={messageVisible} class="pet-bubble" role="status" aria-live="polite">
			<span>{message}</span>
		</div>
		<button class="collapse-button" type="button" aria-label={`收起${config.name}`} title={`收起${config.name}`} onclick={collapsePet}>×</button>
		<div
			class="pet-hit-area"
			role="button"
			tabindex="0"
			aria-label={`${config.name}，点击互动，拖动可以移动位置`}
			onkeydown={handleKeydown}
			onclick={handleClick}
			onpointerdown={beginDrag}
			onpointermove={drag}
			onpointerup={endDrag}
			onpointercancel={endDrag}
			onlostpointercapture={handleLostPointerCapture}
		>
			<div class="pet-figure">
				{#if activeAsset && !imageFailed}
					<img src={activeAsset} alt={config.name} draggable="false" onerror={handleImageError} />
				{:else}
					<div class="bookmark-placeholder" aria-hidden="true">
						<span class="catalog-code">OC · 图像暂缺</span>
						<svg viewBox="0 0 72 72" role="presentation">
							<path d="M13 19c9-4 17-3 23 2v35c-6-5-14-6-23-2V19Z" />
							<path d="M59 19c-9-4-17-3-23 2v35c6-5 14-6 23-2V19Z" />
							<path d="M36 21v35" />
						</svg>
						<strong>绫</strong>
						<small>图片暂不可用</small>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.oc-pet {
		position: fixed;
		z-index: var(--pet-z);
		width: var(--pet-size-desktop);
		min-height: var(--pet-size-desktop);
		left: 1rem;
		bottom: 1rem;
		color: var(--library-ink, #27332c);
		filter: drop-shadow(0 12px 18px rgb(31 43 34 / 18%));
		transition: filter 160ms ease;
		user-select: none;
	}

	.oc-pet[data-position="bottom-right"] {
		left: auto;
		right: 1rem;
	}

	.oc-pet.dragging {
		filter: drop-shadow(0 16px 22px rgb(31 43 34 / 28%));
	}

	.pet-hit-area {
		width: 100%;
		min-height: var(--pet-size-desktop);
		cursor: grab;
		touch-action: none;
		outline: none;
	}

	.pet-hit-area:active,
	.dragging .pet-hit-area {
		cursor: grabbing;
	}

	.pet-hit-area:focus-visible,
	.wake-button:focus-visible,
	.collapse-button:focus-visible {
		outline: 3px solid color-mix(in oklch, var(--primary) 72%, white);
		outline-offset: 3px;
	}

	.pet-figure {
		width: 100%;
		height: var(--pet-size-desktop);
		animation: pet-idle 3.8s ease-in-out infinite;
	}

	.pet-figure img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
	}

	:global(:root.dark) .pet-figure img {
		filter: drop-shadow(0 0 1.5px rgb(226 209 173 / 65%)) drop-shadow(0 8px 13px rgb(0 0 0 / 35%));
	}

	.bookmark-placeholder {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 86%;
		height: 96%;
		margin-inline: auto;
		padding: 1.65rem 0.65rem 1rem;
		border: 1px solid color-mix(in oklch, var(--library-brass, #aa7c38) 55%, transparent);
		border-radius: 45% 45% 1rem 1rem / 1.1rem 1.1rem 1rem 1rem;
		background:
			radial-gradient(circle at 2px 2px, rgb(52 72 57 / 8%) 1px, transparent 1.2px) 0 0 / 8px 8px,
			linear-gradient(155deg, #fffdf5, #efe2c5);
		box-shadow: inset 0 0 0 5px rgb(255 255 255 / 42%);
	}

	.bookmark-placeholder::after {
		position: absolute;
		bottom: -0.72rem;
		left: 50%;
		width: 1.3rem;
		height: 1.5rem;
		content: "";
		background: #7a2431;
		clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%);
		transform: translateX(-50%);
	}

	.bookmark-placeholder svg {
		width: 3rem;
		height: 3rem;
		margin-block: 0.35rem 0.2rem;
		fill: none;
		stroke: #315244;
		stroke-width: 2.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.catalog-code {
		position: absolute;
		top: 0.55rem;
		font-family: ui-monospace, "Cascadia Code", monospace;
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		color: #7a2431;
	}

	.bookmark-placeholder strong {
		font-family: var(--font-library-serif);
		font-size: 0.9rem;
		letter-spacing: 0.08em;
	}

	.bookmark-placeholder small {
		margin-top: 0.08rem;
		font-size: 0.61rem;
		opacity: 0.66;
	}

	.pet-bubble {
		position: absolute;
		bottom: calc(100% - 0.25rem);
		left: 50%;
		width: max-content;
		max-width: min(15rem, calc(100vw - 2rem));
		padding: 0.72rem 0.9rem;
		border: 1px solid color-mix(in oklch, var(--library-ink, #27332c) 25%, transparent);
		border-radius: 1rem 1rem 1rem 0.25rem;
		background:
			radial-gradient(circle at 2px 2px, rgb(52 72 57 / 7%) 1px, transparent 1.2px) 0 0 / 7px 7px,
			color-mix(in oklch, var(--card-bg, #fffdf5) 94%, transparent);
		box-shadow: 0 8px 24px rgb(20 31 24 / 16%);
		font-family: var(--font-library-serif);
		font-size: 0.78rem;
		line-height: 1.55;
		opacity: 0;
		pointer-events: none;
		transform: translate(-28%, 0.5rem) scale(0.94);
		transform-origin: left bottom;
		transition: opacity 160ms ease, transform 160ms ease;
	}

	.pet-bubble.visible {
		opacity: 1;
		transform: translate(-28%, 0) scale(1);
	}

	.pet-bubble::after {
		position: absolute;
		bottom: -0.48rem;
		left: 1.3rem;
		width: 0.85rem;
		height: 0.85rem;
		content: "";
		border-right: inherit;
		border-bottom: inherit;
		background: inherit;
		transform: rotate(45deg);
	}

	.collapse-button {
		position: absolute;
		top: 0.1rem;
		right: 0.1rem;
		z-index: 2;
		display: grid;
		width: 1.65rem;
		height: 1.65rem;
		place-items: center;
		border: 1px solid rgb(49 82 68 / 22%);
		border-radius: 50%;
		background: color-mix(in oklch, var(--card-bg, #fffdf5) 90%, transparent);
		color: inherit;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		backdrop-filter: blur(8px);
	}

	.oc-pet.collapsed {
		width: auto;
		min-height: 0;
	}

	.wake-button {
		position: relative;
		padding: 0.7rem 0.55rem 1rem;
		border: 1px solid color-mix(in oklch, var(--library-brass, #aa7c38) 55%, transparent);
		border-radius: 0.65rem 0.65rem 0.2rem 0.2rem;
		background:
			radial-gradient(circle at 2px 2px, rgb(52 72 57 / 8%) 1px, transparent 1.2px) 0 0 / 7px 7px,
			color-mix(in oklch, var(--card-bg, #fffdf5) 94%, #efe2c5);
		color: inherit;
		font-family: var(--font-library-serif);
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		writing-mode: vertical-rl;
		cursor: pointer;
	}

	.wake-button::after {
		position: absolute;
		bottom: -0.38rem;
		left: 0;
		width: 100%;
		height: 0.48rem;
		content: "";
		background: #7a2431;
		clip-path: polygon(0 0, 100% 0, 50% 100%);
	}

	@keyframes pet-idle {
		0%, 100% { transform: translateY(0) rotate(-0.6deg); }
		50% { transform: translateY(-0.42rem) rotate(0.8deg); }
	}

	@media (max-width: 768px) {
		.oc-pet {
			width: var(--pet-size-mobile);
			min-height: var(--pet-size-mobile);
			left: 0.55rem;
			bottom: 0.65rem;
		}

		.oc-pet[data-position="bottom-right"] {
			left: auto;
			right: 0.55rem;
		}

		.pet-hit-area,
		.pet-figure {
			min-height: var(--pet-size-mobile);
			height: var(--pet-size-mobile);
		}

		.catalog-code { font-size: 0.48rem; }
		.bookmark-placeholder { padding: 1.35rem 0.4rem 0.75rem; }
		.bookmark-placeholder svg { width: 2.15rem; height: 2.15rem; }
		.bookmark-placeholder strong { font-size: 0.7rem; }
		.bookmark-placeholder small { font-size: 0.52rem; }
		.pet-bubble { font-size: 0.72rem; }
	}

	@media (prefers-reduced-motion: reduce) {
		.pet-figure { animation: none; }
		.pet-bubble { transition: opacity 80ms linear; }
	}
</style>
