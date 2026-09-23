<script lang="ts">
import { onMount } from "svelte";
import MusicIcon from "@/components/pages/music/MusicIcon.svelte";

export let variant: "sidebar" | "orb";
export let musicHref: string;
export let homeHref = "/";

type Manager = NonNullable<Window["__fireflyMusic"]>;
type MusicState = ReturnType<Manager["getState"]>;
type Track = MusicState["track"];
type SourceStatus = MusicState["sourceStatus"];

let manager: Manager | undefined;
let root: HTMLElement;
let orbButton: HTMLButtonElement;
let visible = false;
let expanded = false;
let track: Track = null;
let isPlaying = false;
let progress = 0;
let currentTimeStr = "0:00";
let durationStr = "0:00";
let duration = 0;
let sourceStatus: SourceStatus = "idle";
let errorMessage = "";
let coverFailed = false;

$: hasTrack = Boolean(track && sourceStatus === "ready");

function syncState(state: MusicState) {
	if (track?.url !== state.track?.url) coverFailed = false;
	track = state.track;
	isPlaying = state.isPlaying;
	progress = state.progress;
	currentTimeStr = state.currentTimeStr;
	durationStr = state.durationStr;
	duration = state.duration;
	sourceStatus = state.sourceStatus;
	errorMessage = state.error ?? "";
}

function isCurrentPath(href: string): boolean {
	const normalize = (path: string) => path.replace(/\/+$/, "") || "/";
	return (
		normalize(location.pathname) ===
		normalize(new URL(href, location.href).pathname)
	);
}

function syncVisibility() {
	if (variant !== "orb") return;
	visible = !isCurrentPath(homeHref) && !isCurrentPath(musicHref);
	if (!visible) expanded = false;
}

function closeFromOutside(event: PointerEvent) {
	if (
		variant === "orb" &&
		expanded &&
		root &&
		!root.contains(event.target as Node)
	) {
		expanded = false;
	}
}

function closeFromEscape(event: KeyboardEvent) {
	if (event.key === "Escape" && expanded) {
		expanded = false;
		orbButton?.focus();
	}
}

function seek(event: Event) {
	manager?.seek(Number((event.currentTarget as HTMLInputElement).value) / 100);
}

onMount(() => {
	manager = window.__fireflyMusic;
	syncVisibility();
	if (!manager) {
		sourceStatus = "error";
		errorMessage = "播放器未能初始化";
		return;
	}

	const sync = () => {
		if (manager) syncState(manager.getState());
	};
	const onTrack = () => {
		coverFailed = false;
		sync();
		errorMessage = "";
	};
	const onError = (event: Event) => {
		sync();
		errorMessage =
			(event as CustomEvent<{ message?: string }>).detail.message ?? "播放失败";
	};
	const subscriptions: Array<[string, EventListener]> = [
		["fm:init", sync],
		["fm:track", onTrack],
		["fm:play-state", sync],
		["fm:time", sync],
		["fm:source-status", sync],
		["fm:error", onError],
	];
	let cleaned = false;
	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		for (const [event, handler] of subscriptions)
			window.removeEventListener(event, handler);
		document.removeEventListener("pointerdown", closeFromOutside);
		document.removeEventListener("keydown", closeFromEscape);
		document.removeEventListener("swup:contentReplaced", onPageChanged);
		document.removeEventListener("astro:page-load", onPageChanged);
		window.removeEventListener("popstate", onPageChanged);
	};
	const onPageChanged = () => {
		// 首页侧栏位于 Swup 容器内，页面替换后主动移除旧实例的全局监听。
		if (variant === "sidebar" && root && !root.isConnected) {
			cleanup();
			return;
		}
		syncVisibility();
	};
	for (const [event, handler] of subscriptions)
		window.addEventListener(event, handler);
	document.addEventListener("pointerdown", closeFromOutside);
	document.addEventListener("keydown", closeFromEscape);
	document.addEventListener("swup:contentReplaced", onPageChanged);
	document.addEventListener("astro:page-load", onPageChanged);
	window.addEventListener("popstate", onPageChanged);

	sync();
	if (!manager.getState().initialized) {
		manager.init();
	}

	return cleanup;
});
</script>

{#if variant === "sidebar"}
	<section class="music-card" aria-label="首页音乐栏" bind:this={root}>
		<header class="card-heading">
			<span>MUSIC · 07</span>
			<strong>音乐馆藏</strong>
		</header>
		<div class="card-body">
			<div class:playing={isPlaying} class="record record-large" aria-hidden="true">
				<div class="record-label">
					{#if track?.pic && !coverFailed}
						<img src={track.pic} alt="" on:error={() => (coverFailed = true)} />
					{:else}
						<MusicIcon name="music-note" />
					{/if}
				</div>
			</div>
			<div class="track-copy" aria-live="polite">
				<small>{isPlaying ? "NOW PLAYING" : "READY TO PLAY"}</small>
				<strong title={track?.name ?? ""}>{track?.name ?? "等待唱片入馆"}</strong>
				<span title={track?.artist ?? ""}>{track?.artist ?? "暂时还没有曲目"}</span>
			</div>
		</div>
		{#if sourceStatus === "loading"}
			<p class="status" role="status">正在整理音乐馆藏…</p>
		{:else if (sourceStatus === "empty" || sourceStatus === "unconfigured")}
			<p class="status" role="status">曲库尚未导入，欢迎稍后再听。</p>
		{:else if (sourceStatus === "error" || errorMessage)}
			<p class="status" role="status">{errorMessage || "曲库暂时无法加载"}</p>
		{/if}
		<div class="progress">
			<input type="range" min="0" max="100" step="0.1" value={progress} on:input={seek} disabled={!hasTrack || !duration} aria-label="播放进度" />
			<div><span>{currentTimeStr}</span><span>{durationStr}</span></div>
		</div>
		<div class="actions">
			<button type="button" on:click={() => manager?.playPrev()} disabled={!hasTrack} aria-label="上一首" title="上一首"><MusicIcon name="prev" /></button>
			<button type="button" class="main-action" on:click={() => manager?.togglePlay()} disabled={!hasTrack} aria-label={isPlaying ? "暂停" : "播放"} title={isPlaying ? "暂停" : "播放"}><MusicIcon name={isPlaying ? "pause" : "play"} /></button>
			<button type="button" on:click={() => manager?.playNext()} disabled={!hasTrack} aria-label="下一首" title="下一首"><MusicIcon name="next" /></button>
		</div>
		<a class="collection-link" href={musicHref}>进入音乐馆藏 <span aria-hidden="true">↗</span></a>
	</section>
{:else if visible}
	<div class="music-orb-wrap" bind:this={root}>
			<section id="music-orb-panel" class="music-orb-panel" aria-label="音乐快捷控制" hidden={!expanded}>
				<div class="panel-top">
					<span>MUSIC · NOW PLAYING</span>
					<button type="button" aria-label="收起音乐控制" title="收起" on:click={() => (expanded = false)}>×</button>
				</div>
				<div class="panel-track">
					<div class:playing={isPlaying} class="record record-small" aria-hidden="true">
						<div class="record-label">
							{#if track?.pic && !coverFailed}
								<img src={track.pic} alt="" on:error={() => (coverFailed = true)} />
							{:else}
								<MusicIcon name="music-note" />
							{/if}
						</div>
					</div>
					<div class="track-copy" aria-live="polite">
						<strong title={track?.name ?? ""}>{track?.name ?? "等待唱片入馆"}</strong>
						<span title={track?.artist ?? ""}>{track?.artist ?? "暂无曲目"}</span>
					</div>
				</div>
				{#if sourceStatus === "loading"}
					<p class="status" role="status">正在整理音乐馆藏…</p>
				{:else if (sourceStatus === "empty" || sourceStatus === "unconfigured")}
					<p class="status" role="status">曲库尚未导入。</p>
				{:else if (sourceStatus === "error" || errorMessage)}
					<p class="status" role="status">{errorMessage || "曲库暂时无法加载"}</p>
				{/if}
				<div class="progress">
					<input type="range" min="0" max="100" step="0.1" value={progress} on:input={seek} disabled={!hasTrack || !duration} aria-label="播放进度" />
					<div><span>{currentTimeStr}</span><span>{durationStr}</span></div>
				</div>
				<div class="actions">
					<button type="button" on:click={() => manager?.playPrev()} disabled={!hasTrack} aria-label="上一首" title="上一首"><MusicIcon name="prev" /></button>
					<button type="button" class="main-action" on:click={() => manager?.togglePlay()} disabled={!hasTrack} aria-label={isPlaying ? "暂停" : "播放"} title={isPlaying ? "暂停" : "播放"}><MusicIcon name={isPlaying ? "pause" : "play"} /></button>
					<button type="button" on:click={() => manager?.playNext()} disabled={!hasTrack} aria-label="下一首" title="下一首"><MusicIcon name="next" /></button>
				</div>
				<a class="collection-link" href={musicHref}>打开音乐馆藏 <span aria-hidden="true">↗</span></a>
			</section>
		<button
			bind:this={orbButton}
			type="button"
			class="orb-trigger"
			aria-label={expanded ? "收起音乐控制" : isPlaying ? "正在播放，展开音乐控制" : "展开音乐控制"}
			aria-expanded={expanded}
			aria-controls="music-orb-panel"
			title={track?.name ?? "音乐馆藏"}
			on:click={() => (expanded = !expanded)}
		>
			<span class:playing={isPlaying} class="record record-orb" aria-hidden="true">
				<span class="record-label">
					{#if track?.pic && !coverFailed}
						<img src={track.pic} alt="" on:error={() => (coverFailed = true)} />
					{:else}
						<MusicIcon name="music-note" />
					{/if}
				</span>
			</span>
		</button>
	</div>
{/if}

<style>
	.music-card,
	.music-orb-panel {
		border: 1px solid var(--library-rule);
		border-radius: 1rem;
		background: var(--card-bg);
		box-shadow: 0 14px 34px rgb(27 26 21 / 16%);
		color: var(--library-ink);
	}
	.music-card {
		min-width: 0;
		padding: 1.15rem;
		background: linear-gradient(150deg, color-mix(in srgb, var(--library-burgundy) 6%, var(--card-bg)), var(--card-bg) 55%);
	}
	.card-heading,
	.panel-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		border-bottom: 1px solid var(--library-rule);
		padding-bottom: 0.75rem;
	}
	.card-heading span,
	.panel-top span,
	.track-copy small {
		color: var(--library-moss);
		font-family: var(--font-code);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.1em;
	}
	.card-heading strong {
		font-family: var(--font-library-serif);
		font-size: 1rem;
	}
	.card-body,
	.panel-track {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		min-width: 0;
	}
	.card-body {
		flex-direction: column;
		padding: 1.4rem 0 1rem;
	}
	.panel-track {
		padding: 0.95rem 0 0.75rem;
	}
	.record {
		position: relative;
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		aspect-ratio: 1;
		border-radius: 50%;
		background: repeating-radial-gradient(circle, #242523 0 2px, #363833 3px 4px, #1c1d1c 5px 7px);
		box-shadow: inset 0 0 0 2px #3d403b, 0 6px 14px rgb(0 0 0 / 19%);
	}
	.record.playing {
		animation: record-spin 8s linear infinite;
	}
	.record-large { width: min(11rem, 78%); }
	.record-small { width: 3.7rem; }
	.record-orb { width: 3.15rem; }
	.record-label {
		position: relative;
		display: grid;
		width: 40%;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		border: 2px solid var(--library-brass);
		border-radius: 50%;
		background: var(--library-burgundy);
		color: #fff8ea;
		font-size: 1rem;
	}
	.record-label::after {
		position: absolute;
		width: 0.22rem;
		aspect-ratio: 1;
		border-radius: 50%;
		background: #f2e6cf;
		content: "";
	}
	.record-label img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.track-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.25rem;
	}
	.card-body .track-copy {
		align-items: center;
		max-width: 100%;
		text-align: center;
	}
	.track-copy strong,
	.track-copy span {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.track-copy strong {
		font-family: var(--font-library-serif);
		font-size: 1rem;
	}
	.track-copy span,
	.status {
		color: var(--content-meta);
		font-size: 0.74rem;
		line-height: 1.5;
	}
	.status {
		margin: 0 0 0.7rem;
		text-align: center;
	}
	.progress input {
		width: 100%;
		margin: 0;
		accent-color: var(--library-burgundy);
		cursor: pointer;
	}
	.progress input:disabled { cursor: default; opacity: 0.45; }
	.progress > div {
		display: flex;
		justify-content: space-between;
		color: var(--content-meta);
		font-family: var(--font-code);
		font-size: 0.64rem;
	}
	.actions {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		margin: 0.75rem 0;
	}
	.actions button,
	.panel-top button {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		place-items: center;
		border: 1px solid var(--library-rule);
		border-radius: 50%;
		background: color-mix(in srgb, var(--library-moss) 8%, var(--card-bg));
		color: var(--library-ink);
		font-size: 1.1rem;
		cursor: pointer;
	}
	.actions .main-action {
		background: var(--library-burgundy);
		color: #fff8ea;
	}
	.actions button:disabled { cursor: default; opacity: 0.45; }
	.collection-link {
		display: flex;
		justify-content: space-between;
		border-top: 1px solid var(--library-rule);
		padding-top: 0.75rem;
		color: var(--library-burgundy);
		font-size: 0.76rem;
		font-weight: 700;
		text-decoration: none;
	}
	.collection-link:hover { text-decoration: underline; }
	.music-orb-wrap {
		position: relative;
		pointer-events: auto;
	}
	.orb-trigger {
		display: grid;
		width: 3.55rem;
		height: 3.55rem;
		place-items: center;
		border: 1px solid var(--library-brass);
		border-radius: 50%;
		background: var(--card-bg);
		box-shadow: 0 8px 24px rgb(25 26 23 / 22%);
		cursor: pointer;
	}
	.music-orb-panel {
		position: absolute;
		right: calc(100% + 0.75rem);
		bottom: 0;
		width: min(18.5rem, calc(100vw - 5.5rem));
		padding: 1rem;
	}
	.panel-top button {
		width: 1.75rem;
		height: 1.75rem;
		font-size: 1.2rem;
	}
	.music-card button:focus-visible,
	.music-card a:focus-visible,
	.music-card input:focus-visible,
	.music-orb-wrap button:focus-visible,
	.music-orb-wrap a:focus-visible,
	.music-orb-wrap input:focus-visible {
		outline: 2px solid var(--library-burgundy);
		outline-offset: 3px;
	}
	@keyframes record-spin { to { transform: rotate(360deg); } }
	@media (max-width: 1100px) {
		.card-body { flex-direction: row; justify-content: flex-start; }
		.card-body .track-copy { align-items: flex-start; text-align: left; }
		.record-large { width: 6.25rem; }
	}
	@media (max-width: 599px) {
		.music-orb-panel {
			right: 0;
			bottom: calc(100% + 0.7rem);
			width: min(18.5rem, calc(100vw - 1rem));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.record.playing { animation: none; }
	}
</style>
