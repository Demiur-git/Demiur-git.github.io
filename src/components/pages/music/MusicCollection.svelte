<script lang="ts">
import { onMount, tick } from "svelte";
import MusicIcon, { type MusicIconName } from "./MusicIcon.svelte";

export let title = "音乐馆藏";
export let description = "在唱片与歌词之间，收藏想要反复聆听的声音。";

type Manager = NonNullable<Window["__fireflyMusic"]>;
type MusicState = ReturnType<Manager["getState"]>;
type Track = MusicState["playlist"][number];
type LyricLine = MusicState["lyrics"][number];
type SourceStatus = MusicState["sourceStatus"];
type SecondaryMode = "translation" | "romaji";

let manager: Manager | undefined;
let playlist: Track[] = [];
let currentTrack: Track | null = null;
let currentIndex = 0;
let isPlaying = false;
let playMode = 0;
let volume = 0.7;
let isMuted = false;
let progress = 0;
let currentTime = 0;
let currentTimeStr = "0:00";
let durationStr = "0:00";
let lyrics: LyricLine[] = [];
let translationLyrics: LyricLine[] = [];
let romajiLyrics: LyricLine[] = [];
let lyricStatus: "none" | "loading" | "loaded" | "failed" = "none";
let currentLrcIndex = -1;
let sourceStatus: SourceStatus = "idle";
let errorMessage = "";
let activeSecondary: SecondaryMode = "translation";
let lyricsScroller: HTMLDivElement;
let userScrolling = false;
let scrollTimer: ReturnType<typeof setTimeout> | undefined;
let lyricLayoutFrame = 0;
let lyricTopPadding = 0;
let lyricBottomPadding = 0;
let lastFollowedIndex = -2;
let spinOffset = 0;
let spinSeeded = false;
let catalogDialog: HTMLDialogElement;
let catalogTrigger: HTMLButtonElement;
let catalogIndex = 0;
let narrowCatalog = false;
let catalogWheelDelta = 0;
let lastCatalogStep = 0;
let touchStartY: number | null = null;
let suppressCatalogClickUntil = 0;
let previousRootOverflow = "";

const playModeLabels = ["列表循环", "单曲循环", "随机播放"];
const playModeIcons: MusicIconName[] = ["repeat", "repeat-one", "shuffle"];

$: hasTranslation = translationLyrics.length > 0;
$: hasRomaji = romajiLyrics.length > 0;
$: baseLyrics =
	lyrics.length > 0
		? lyrics
		: translationLyrics.length > 0
			? translationLyrics
			: romajiLyrics;
$: secondaryLyrics =
	lyrics.length === 0
		? []
		: activeSecondary === "romaji"
			? romajiLyrics
			: translationLyrics;
$: renderedLyrics = baseLyrics.map((line) => ({
	...line,
	secondary: findNearestLine(secondaryLyrics, line.time),
}));
$: displayedActiveIndex =
	lyrics.length > 0
		? currentLrcIndex
		: findCurrentLine(baseLyrics, currentTime);
$: focusedLyricIndex =
	displayedActiveIndex >= 0
		? displayedActiveIndex
		: renderedLyrics.length > 0 ? 0 : -1;
$: if (lyricsScroller && renderedLyrics) scheduleLyricLayout();
$: if (lyricsScroller && focusedLyricIndex !== lastFollowedIndex) {
	lastFollowedIndex = focusedLyricIndex;
	followActiveLine();
}
$: catalogRadius = narrowCatalog ? 1 : 2;
$: visibleCatalogTracks = playlist
	.map((track, index) => ({ track, index, offset: index - catalogIndex }))
	.filter(({ offset }) => Math.abs(offset) <= catalogRadius);

function catalogTrackStyle(offset: number): string {
	const angle = (offset * (narrowCatalog ? 25 : 21) * Math.PI) / 180;
	const orbitX = 33 + 30 * Math.cos(angle);
	const orbitY = 50 + (narrowCatalog ? 40 : 50) * Math.sin(angle);
	const mobileX = offset === 0 ? 56 : 50;
	const mobileY = offset < 0 ? 31 : offset > 0 ? 57 : 44;
	const distance = Math.abs(offset);
	const opacity = distance === 0 ? 1 : distance === 1 ? 0.8 : 0.58;
	return `--orbit-x: ${orbitX}%; --orbit-y: ${orbitY}%; --orbit-tilt: ${offset * 9}deg; --mobile-x: ${mobileX}%; --mobile-y: ${mobileY}%; --mobile-tilt: ${offset * 10}deg; --card-opacity: ${opacity}; --stagger: ${(offset + 2) * 60}ms`;
}

function eventDetail<T>(event: Event): T {
	return (event as CustomEvent<T>).detail;
}

function syncState(state: MusicState) {
	if (!spinSeeded) {
		spinOffset = -(Number.isFinite(state.currentTime) ? state.currentTime % 8 : 0);
		spinSeeded = true;
	}
	playlist = state.playlist;
	catalogIndex = Math.max(0, Math.min(catalogIndex, playlist.length - 1));
	currentTrack = state.track;
	currentIndex = state.currentIndex;
	isPlaying = state.isPlaying;
	playMode = state.playMode;
	volume = state.volume;
	isMuted = state.isMuted;
	progress = state.progress;
	currentTime = state.currentTime;
	currentTimeStr = state.currentTimeStr;
	durationStr = state.durationStr;
	lyrics = state.lyrics;
	translationLyrics = state.lyricVariants.translation;
	romajiLyrics = state.lyricVariants.romaji;
	lyricStatus =
		lyrics.length > 0 || translationLyrics.length > 0 || romajiLyrics.length > 0
			? "loaded"
			: "none";
	currentLrcIndex = state.currentLrcIndex;
	sourceStatus = state.sourceStatus;
	errorMessage = state.error ?? "";
	chooseAvailableSecondary();
}

function chooseAvailableSecondary() {
	if (activeSecondary === "translation" && translationLyrics.length === 0) {
		activeSecondary = romajiLyrics.length > 0 ? "romaji" : "translation";
	} else if (activeSecondary === "romaji" && romajiLyrics.length === 0) {
		activeSecondary = translationLyrics.length > 0 ? "translation" : "romaji";
	}
}

function findNearestLine(linesToSearch: LyricLine[], time: number): string {
	let nearest: LyricLine | undefined;
	let distance = Number.POSITIVE_INFINITY;
	for (const line of linesToSearch) {
		const currentDistance = Math.abs(line.time - time);
		if (currentDistance < distance) {
			nearest = line;
			distance = currentDistance;
		}
		if (line.time > time && currentDistance > distance) break;
	}
	return distance <= 0.75 ? (nearest?.text ?? "") : "";
}

function findCurrentLine(linesToSearch: LyricLine[], time: number): number {
	let found = -1;
	for (let index = 0; index < linesToSearch.length; index += 1) {
		if (time >= linesToSearch[index].time) found = index;
		else break;
	}
	return found;
}

async function followActiveLine(behavior: ScrollBehavior = "smooth") {
	if (userScrolling || !lyricsScroller?.isConnected || focusedLyricIndex < 0) return;
	await tick();
	if (!lyricsScroller?.isConnected) return;
	const line = lyricsScroller.querySelector<HTMLElement>(
		`[data-lyric-index="${focusedLyricIndex}"]`,
	);
	if (!line) return;
	const top =
		line.offsetTop - lyricsScroller.clientHeight / 2 + line.offsetHeight / 2;
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	lyricsScroller.scrollTo({
		top,
		behavior: reducedMotion ? "auto" : behavior,
	});
}

function scheduleLyricLayout() {
	if (!lyricsScroller?.isConnected || typeof window === "undefined") return;
	if (lyricLayoutFrame) cancelAnimationFrame(lyricLayoutFrame);
	lyricLayoutFrame = requestAnimationFrame(async () => {
		lyricLayoutFrame = 0;
		await tick();
		if (!lyricsScroller?.isConnected) return;
		const first = lyricsScroller.querySelector<HTMLElement>(".lyric-line");
		const last = lyricsScroller.querySelector<HTMLElement>(".lyric-line:last-of-type");
		if (!first || !last) {
			lyricTopPadding = 0;
			lyricBottomPadding = 0;
			return;
		}
		lyricTopPadding = Math.max(0, (lyricsScroller.clientHeight - first.offsetHeight) / 2);
		lyricBottomPadding = Math.max(0, (lyricsScroller.clientHeight - last.offsetHeight) / 2);
		await tick();
		followActiveLine("auto");
	});
}

function suspendLyricFollow() {
	userScrolling = true;
	if (scrollTimer) clearTimeout(scrollTimer);
	scrollTimer = setTimeout(() => {
		userScrolling = false;
		followActiveLine("auto");
	}, 3000);
}

function handleLyricsKeydown(event: KeyboardEvent) {
	if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
		suspendLyricFollow();
	}
}

function selectCatalogTrack(index: number, event: MouseEvent) {
	if (event.detail > 0 && performance.now() < suppressCatalogClickUntil) return;
	errorMessage = "";
	if (index !== currentIndex || !isPlaying) manager?.playTrackByIndex(index);
	closeCatalog();
}

function focusCatalogTrack() {
	const track = catalogDialog?.querySelector<HTMLButtonElement>(
		`.catalog-track[data-index="${catalogIndex}"]`,
	);
	(track ?? catalogDialog?.querySelector<HTMLButtonElement>(".catalog-close"))?.focus();
}

function moveCatalog(direction: number) {
	if (playlist.length === 0) return;
	const next = Math.max(0, Math.min(playlist.length - 1, catalogIndex + direction));
	if (next === catalogIndex) return;
	catalogIndex = next;
	tick().then(focusCatalogTrack);
}

function openCatalog() {
	if (!catalogDialog || catalogDialog.open) return;
	catalogIndex = Math.max(0, Math.min(currentIndex, playlist.length - 1));
	catalogWheelDelta = 0;
	lastCatalogStep = 0;
	previousRootOverflow = document.documentElement.style.overflow;
	document.documentElement.style.overflow = "hidden";
	catalogDialog.showModal();
	window.addEventListener("wheel", handleCatalogWheel, { capture: true, passive: false });
	tick().then(focusCatalogTrack);
}

function closeCatalog() {
	if (catalogDialog?.open) catalogDialog.close();
}

function handleCatalogClose() {
	document.documentElement.style.overflow = previousRootOverflow;
	window.removeEventListener("wheel", handleCatalogWheel, true);
	catalogWheelDelta = 0;
	touchStartY = null;
	if (catalogTrigger?.isConnected) catalogTrigger.focus();
}

function handleCatalogWheel(event: WheelEvent) {
	if (!catalogDialog?.open) return;
	event.preventDefault();
	const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
	const delta = event.deltaY * multiplier;
	if (Math.sign(delta) !== Math.sign(catalogWheelDelta)) catalogWheelDelta = 0;
	catalogWheelDelta += delta;
	if (Math.abs(catalogWheelDelta) < 60) return;
	catalogWheelDelta = 0;
	const now = performance.now();
	if (now - lastCatalogStep < 120) return;
	lastCatalogStep = now;
	moveCatalog(delta > 0 ? 1 : -1);
}

function handleCatalogKeydown(event: KeyboardEvent) {
	if (event.key === "ArrowDown" || event.key === "ArrowRight") {
		event.preventDefault();
		moveCatalog(1);
	} else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
		event.preventDefault();
		moveCatalog(-1);
	} else if (event.key === "Home" || event.key === "End") {
		event.preventDefault();
		catalogIndex = event.key === "Home" ? 0 : Math.max(0, playlist.length - 1);
		tick().then(focusCatalogTrack);
	} else if (event.key === "Escape") {
		closeCatalog();
	}
}

function handleCatalogTouchStart(event: TouchEvent) {
	touchStartY = event.touches[0]?.clientY ?? null;
}

function handleCatalogTouchMove(event: TouchEvent) {
	if (touchStartY !== null && Math.abs((event.touches[0]?.clientY ?? touchStartY) - touchStartY) > 8) {
		event.preventDefault();
	}
}

function handleCatalogTouchEnd(event: TouchEvent) {
	if (touchStartY === null) return;
	const distance = (event.changedTouches[0]?.clientY ?? touchStartY) - touchStartY;
	touchStartY = null;
	if (Math.abs(distance) < 35) return;
	suppressCatalogClickUntil = performance.now() + 350;
	moveCatalog(distance < 0 ? 1 : -1);
}

function handleCatalogBackdropClick(event: MouseEvent) {
	if (event.target === catalogDialog) closeCatalog();
}

function seekFromInput(event: Event) {
	manager?.seek(Number((event.currentTarget as HTMLInputElement).value) / 100);
}

function volumeFromInput(event: Event) {
	manager?.setVolume(
		Number((event.currentTarget as HTMLInputElement).value) / 100,
	);
}

function seekToLyric(time: number) {
	manager?.seekToTime(time);
	if (scrollTimer) clearTimeout(scrollTimer);
	userScrolling = false;
	tick().then(() => followActiveLine("smooth"));
}

function retrySource() {
	errorMessage = "";
	manager?.retry();
}

onMount(() => {
	const narrowQuery = window.matchMedia("(max-width: 900px), (max-height: 600px)");
	const syncCatalogWidth = () => (narrowCatalog = narrowQuery.matches);
	syncCatalogWidth();
	narrowQuery.addEventListener("change", syncCatalogWidth);
	const lyricsResizeObserver = typeof ResizeObserver !== "undefined"
		? new ResizeObserver(scheduleLyricLayout)
		: undefined;
	if (lyricsScroller) lyricsResizeObserver?.observe(lyricsScroller);
	window.addEventListener("resize", scheduleLyricLayout);
	scheduleLyricLayout();
	manager = window.__fireflyMusic;
	if (!manager) {
		sourceStatus = "error";
		errorMessage = "播放器未能初始化";
		return () => {
			narrowQuery.removeEventListener("change", syncCatalogWidth);
			lyricsResizeObserver?.disconnect();
			window.removeEventListener("resize", scheduleLyricLayout);
			if (lyricLayoutFrame) cancelAnimationFrame(lyricLayoutFrame);
			window.removeEventListener("wheel", handleCatalogWheel, true);
			if (catalogDialog?.open) {
				catalogDialog.close();
				document.documentElement.style.overflow = previousRootOverflow;
			}
		};
	}

	const listeners: Array<[string, EventListener]> = [];
	const listen = <T,>(name: string, handler: (detail: T) => void) => {
		const listener: EventListener = (event) => handler(eventDetail<T>(event));
		window.addEventListener(name, listener);
		listeners.push([name, listener]);
	};

	listen<{
		playlist: Track[];
		playMode: number;
		volume: number;
		isMuted: boolean;
		sourceStatus?: SourceStatus;
	}>("fm:init", () => syncState(manager?.getState() as MusicState));
	listen<{ index: number; track: Track }>("fm:track", (detail) => {
		currentIndex = detail.index;
		currentTrack = detail.track;
		errorMessage = "";
	});
	listen<{ isPlaying: boolean }>("fm:play-state", (detail) => {
		isPlaying = detail.isPlaying;
	});
	listen<{
		currentTime: number;
		duration: number;
		progress: number;
		currentTimeStr: string;
		durationStr: string;
	}>("fm:time", (detail) => {
		currentTime = detail.currentTime;
		progress = detail.progress;
		currentTimeStr = detail.currentTimeStr;
		durationStr = detail.durationStr;
	});
	listen<{ playMode: number }>("fm:mode", (detail) => {
		playMode = detail.playMode;
	});
	listen<{ volume: number; isMuted: boolean }>("fm:volume", (detail) => {
		volume = detail.volume;
		isMuted = detail.isMuted;
	});
	listen<{
		lyrics: LyricLine[];
		variants?: { translation: LyricLine[]; romaji: LyricLine[] };
		status: "none" | "loading" | "loaded" | "failed";
	}>("fm:lyrics", (detail) => {
		lyrics = detail.lyrics;
		translationLyrics = detail.variants?.translation ?? [];
		romajiLyrics = detail.variants?.romaji ?? [];
		lyricStatus = detail.status;
		currentLrcIndex = -1;
		chooseAvailableSecondary();
	});
	listen<{ index: number }>("fm:lrc-index", (detail) => {
		currentLrcIndex = detail.index;
	});
	listen<{ status: SourceStatus; message?: string }>(
		"fm:source-status",
		(detail) => {
			sourceStatus = detail.status;
			if (detail.message) errorMessage = detail.message;
		},
	);
	listen<{ message?: string }>("fm:error", (detail) => {
		errorMessage = detail.message ?? "播放器发生错误";
	});

	const state = manager.getState();
	if (state.initialized) syncState(state);
	else {
		sourceStatus = "loading";
		manager.init();
	}

	return () => {
		narrowQuery.removeEventListener("change", syncCatalogWidth);
		lyricsResizeObserver?.disconnect();
		window.removeEventListener("resize", scheduleLyricLayout);
		if (lyricLayoutFrame) cancelAnimationFrame(lyricLayoutFrame);
		window.removeEventListener("wheel", handleCatalogWheel, true);
		if (catalogDialog?.open) {
			catalogDialog.close();
			document.documentElement.style.overflow = previousRootOverflow;
		}
		for (const [name, listener] of listeners) {
			window.removeEventListener(name, listener);
		}
		if (scrollTimer) clearTimeout(scrollTimer);
	};
});
</script>

<section class="music-workspace" aria-labelledby="music-page-title">
	<header class="music-page-header">
		<div>
			<span class="music-kicker">PRIVATE LIBRARY · SOUND ARCHIVE</span>
			<h2 id="music-page-title">{title}</h2>
			<p>{description}</p>
		</div>
		<div class="collection-count" aria-label={`馆藏曲目 ${playlist.length} 首`}>
			<span>COLLECTION</span>
			<strong>{String(playlist.length).padStart(2, "0")}</strong>
		</div>
	</header>

	<div class="player-spread">
		<section class="turntable-panel" aria-label="唱片机播放器">
			<div class="panel-label">
				<span>RECORD PLAYER</span>
				<span class:active={isPlaying}>{isPlaying ? "PLAYING" : "STANDBY"}</span>
			</div>

			<div class:playing={isPlaying} class:has-track={Boolean(currentTrack)} class="turntable-stage">
				<div class="turntable-deck">
					<div class="record-shadow"></div>
					<button
						type="button"
						class="vinyl"
						bind:this={catalogTrigger}
						on:click={openCatalog}
						aria-label="翻阅馆藏曲目"
						aria-haspopup="dialog"
						style={`--record-spin-offset: ${spinOffset}s`}
					>
						<div class="vinyl-grooves"></div>
						<div class="record-label">
							{#if currentTrack?.pic}
								<img src={currentTrack.pic} alt={`${currentTrack.name} 曲绘`} />
							{:else}
								<MusicIcon name="music-note" />
							{/if}
						</div>
						<div class="record-spindle"></div>
					</button>
					<svg class="tonearm" viewBox="0 0 190 210" aria-hidden="true" focusable="false">
						<circle class="tonearm-pivot-rim" cx="160" cy="30" r="21" />
						<circle class="tonearm-pivot-core" cx="160" cy="30" r="14" />
						<path class="tonearm-bar-shadow" d="M160 31 L154 63 Q153 68 149 72 L85 139" />
						<path class="tonearm-bar" d="M160 31 L154 63 Q153 68 149 72 L85 139" />
						<path class="tonearm-joint" d="M86 138 L69 153" />
						<path class="tonearm-head" d="M62 145 L75 136 L88 144 L74 157 Z" />
						<path class="tonearm-stylus" d="M67 155 L62 166" />
					</svg>
					<div class="deck-switch" aria-hidden="true"></div>
				</div>
			</div>
			<p class="catalog-hint">点击唱片翻阅馆藏 <span aria-hidden="true">↗</span></p>

			<div class="track-meta" aria-live="polite">
				<span class="track-catalog">NOW PLAYING · {String(currentIndex + 1).padStart(2, "0")}</span>
				<h3>{currentTrack?.name ?? "等待唱片入馆"}</h3>
				<p>{currentTrack?.artist ?? "将歌曲放入 music-inbox，再运行音乐导入工具"}</p>
			</div>

			<div class="progress-group">
				<input
					type="range"
					min="0"
					max="100"
					step="0.1"
					value={progress}
					on:input={seekFromInput}
					aria-label="播放进度"
				/>
				<div><span>{currentTimeStr}</span><span>{durationStr}</span></div>
			</div>

			<div class="player-controls">
				<button
					type="button"
					class="minor-control"
					on:click={() => manager?.cyclePlayMode()}
					aria-label={playModeLabels[playMode]}
					title={playModeLabels[playMode]}
				>
					<MusicIcon name={playModeIcons[playMode]} />
				</button>
				<button type="button" class="transport-control" on:click={() => manager?.playPrev()} aria-label="上一首">
					<MusicIcon name="prev" />
				</button>
				<button
					type="button"
					class="play-control"
					on:click={() => manager?.togglePlay()}
					disabled={!currentTrack}
					aria-label={isPlaying ? "暂停" : "播放"}
				>
					<MusicIcon name={isPlaying ? "pause" : "play"} />
				</button>
				<button type="button" class="transport-control" on:click={() => manager?.playNext()} aria-label="下一首">
					<MusicIcon name="next" />
				</button>
				<button
					type="button"
					class="minor-control"
					on:click={() => manager?.toggleMute()}
					aria-label={isMuted ? "取消静音" : "静音"}
				>
					<MusicIcon name={isMuted ? "volume-off" : "volume-up"} />
				</button>
			</div>

			<div class="volume-control">
				<span>VOLUME</span>
				<input
					type="range"
					min="0"
					max="100"
					value={isMuted ? 0 : volume * 100}
					on:input={volumeFromInput}
					aria-label="音量"
				/>
			</div>

			{#if errorMessage && sourceStatus === "ready"}
				<p class="inline-error" role="status">{errorMessage}</p>
			{/if}
		</section>

		<section class="lyrics-panel" aria-label="实时歌词">
			<header class="lyrics-header">
				<div>
					<span>LYRICS · LIVE INDEX</span>
					<h3>歌词页</h3>
				</div>
				{#if hasTranslation && hasRomaji}
					<div class="lyric-mode-switch" aria-label="辅助歌词">
						<button
							type="button"
							class:active={activeSecondary === "translation"}
							on:click={() => (activeSecondary = "translation")}
						>译文</button>
						<button
							type="button"
							class:active={activeSecondary === "romaji"}
							on:click={() => (activeSecondary = "romaji")}
						>罗马音</button>
					</div>
				{:else if hasTranslation || hasRomaji}
					<span class="single-lyric-mode">{hasTranslation ? "译文" : "罗马音"}</span>
				{/if}
			</header>

			<div
				class="lyrics-scroll"
				bind:this={lyricsScroller}
				on:wheel={suspendLyricFollow}
				on:touchstart={suspendLyricFollow}
				on:keydown={handleLyricsKeydown}
				tabindex="0"
			>
				{#if lyricStatus === "loading"}
					<div class="lyrics-empty">
						<MusicIcon name="spinner" />
						<p>正在翻找歌词页……</p>
					</div>
				{:else if renderedLyrics.length > 0}
					<div class="lyrics-padding" style={`height: ${lyricTopPadding}px`} aria-hidden="true"></div>
					{#each renderedLyrics as line, index}
						<button
							type="button"
							class="lyric-line"
							class:active={index === displayedActiveIndex}
							data-lyric-index={index}
							aria-current={index === displayedActiveIndex ? "true" : undefined}
							on:click={() => seekToLyric(line.time)}
						>
							<span>{line.text}</span>
							{#if line.secondary}<small>{line.secondary}</small>{/if}
						</button>
					{/each}
					<div class="lyrics-padding" style={`height: ${lyricBottomPadding}px`} aria-hidden="true"></div>
				{:else}
					<div class="lyrics-empty">
						<MusicIcon name="lyrics" />
						<p>{lyricStatus === "failed" ? "歌词页读取失败" : "这张唱片暂时没有歌词"}</p>
						<span>INSTRUMENTAL / NO LYRICS</span>
					</div>
				{/if}
			</div>
		</section>
	</div>

	<dialog
		bind:this={catalogDialog}
		class="catalog-dialog"
		aria-label="馆藏曲目"
		on:close={handleCatalogClose}
		on:click={handleCatalogBackdropClick}
		on:keydown={handleCatalogKeydown}
		on:touchstart={handleCatalogTouchStart}
		on:touchmove|nonpassive={handleCatalogTouchMove}
		on:touchend={handleCatalogTouchEnd}
	>
		<button type="button" class="catalog-close" on:click={closeCatalog} aria-label="关闭馆藏曲目">×</button>
		<div class="catalog-surface">
			<div class="catalog-stage">
				<div class="catalog-sleeve-scene" aria-hidden="true">
					<div class="sleeve-back"></div>
					<div class="catalog-vinyl">
						<div class="catalog-vinyl-grooves"></div>
						<div class="catalog-record-label">
							<MusicIcon name="music-note" />
							{#if playlist[catalogIndex]?.pic}
								<img src={playlist[catalogIndex].pic} alt="" on:load={(event) => (event.currentTarget.style.display = "block")} on:error={(event) => (event.currentTarget.style.display = "none")} />
							{/if}
						</div>
					</div>
					<div class="sleeve-front">
						<span>PERSONAL LIBRARY</span>
						<strong>SOUND<br />ARCHIVE</strong>
						<small>CATALOG / {playlist.length > 0 ? String(catalogIndex + 1).padStart(2, "0") : "--"}</small>
					</div>
				</div>

				{#if sourceStatus === "unconfigured"}
					<div class="catalog-state" role="status">
						<h3>等待第一张唱片入馆</h3>
						<p>把音频放入 <code>music-inbox</code>，运行 <code>pnpm.cmd music:import</code> 即可生成静态曲库。</p>
					</div>
				{:else if sourceStatus === "loading" || sourceStatus === "idle"}
					<div class="catalog-state" role="status">
						<h3>正在整理唱片架</h3><p>稍候，正在读取静态曲库与唱片封面。</p>
					</div>
				{:else if sourceStatus === "error" || sourceStatus === "empty" || playlist.length === 0}
					<div class="catalog-state" role="alert">
						<h3>唱片架暂时无法打开</h3><p>{errorMessage || "歌单为空或接口暂时不可用。"}</p>
						<button type="button" on:click={retrySource}>重新尝试</button>
					</div>
				{:else}
					<div class="catalog-tracks" role="group" aria-label="馆藏曲目，滚动浏览，点击播放">
						{#each visibleCatalogTracks as { track, index, offset } (index)}
							<button
								type="button"
								class="catalog-track"
								class:focused={offset === 0}
								class:playing-track={index === currentIndex && isPlaying}
								data-index={index}
								style={catalogTrackStyle(offset)}
								on:click={(event) => selectCatalogTrack(index, event)}
								aria-current={index === currentIndex ? "true" : undefined}
								aria-label={`${String(index + 1).padStart(2, "0")}，${track.name}，${track.artist}${index === currentIndex && isPlaying ? "，正在播放" : ""}`}
							>
								<span class="track-cover">
									<MusicIcon name="album" />
									{#if track.pic}<img src={track.pic} alt="" loading="lazy" on:load={(event) => (event.currentTarget.style.display = "block")} on:error={(event) => (event.currentTarget.style.display = "none")} />{/if}
								</span>
								<span class="track-copy"><strong>{track.name}</strong><small>{track.artist}</small></span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</dialog>
</section>

<style>
	.music-workspace {
		--music-paper: rgb(255 250 240 / 94%);
		--music-paper-solid: #fffaf0;
		--music-ink: #3d342f;
		--music-muted: rgb(61 52 47 / 62%);
		--music-rule: rgb(112 79 61 / 18%);
		--music-wine: #a45f6a;
		--music-wine-deep: #7f3f4d;
		--music-brass: #b18b53;
		--music-deck: #f1e3d5;
		display: grid;
		gap: 1rem;
		color: var(--music-ink);
	}

	:global(:root.dark) .music-workspace {
		--music-paper: rgb(24 37 31 / 94%);
		--music-paper-solid: #18251f;
		--music-ink: #eee7da;
		--music-muted: rgb(238 231 218 / 60%);
		--music-rule: rgb(210 180 122 / 16%);
		--music-wine: #c87988;
		--music-wine-deep: #a45767;
		--music-brass: #cfac6e;
		--music-deck: #27372f;
	}

	.music-page-header,
	.turntable-panel,
	.lyrics-panel {
		border: 1px solid var(--music-rule);
		background: var(--music-paper);
		box-shadow: var(--library-soft-shadow);
		backdrop-filter: blur(16px);
	}

	.music-page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		border-radius: 1rem;
		padding: 1.35rem 1.6rem;
		background:
			linear-gradient(90deg, transparent 0 3.2rem, rgb(164 95 106 / 12%) 3.2rem 3.27rem, transparent 3.27rem),
			repeating-linear-gradient(0deg, transparent 0 2rem, var(--music-rule) 2rem 2.05rem),
			var(--music-paper);
	}

	.music-kicker,
	.panel-label,
	.track-catalog,
	.lyrics-header > div > span,
	.collection-count span,
	.volume-control > span {
		font-family: var(--font-code);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.14em;
	}

	.music-kicker,
	.track-catalog,
	.lyrics-header > div > span {
		color: var(--music-wine);
	}

	.music-page-header h2 {
		margin: 0.3rem 0 0.25rem;
		font-family: var(--font-library-serif);
		font-size: clamp(1.65rem, 4vw, 2.35rem);
	}

	.music-page-header p {
		margin: 0;
		color: var(--music-muted);
		font-size: 0.92rem;
	}

	.collection-count {
		display: flex;
		min-width: 5.2rem;
		flex-direction: column;
		align-items: flex-end;
		color: var(--music-brass);
	}

	.collection-count strong {
		font-family: var(--font-code);
		font-size: 2rem;
		font-weight: 400;
		line-height: 1;
	}

	.player-spread {
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
		align-items: start;
		gap: 1rem;
	}

	.turntable-panel,
	.lyrics-panel {
		border-radius: 1rem;
		overflow: hidden;
	}

	.turntable-panel {
		padding: 1rem 1.2rem 1.25rem;
	}

	.panel-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: var(--music-muted);
	}

	.panel-label span:last-child {
		border: 1px solid var(--music-rule);
		border-radius: 999px;
		padding: 0.18rem 0.45rem;
		color: var(--music-muted);
	}

	.panel-label span:last-child.active {
		border-color: color-mix(in srgb, var(--music-wine) 45%, transparent);
		color: var(--music-wine);
	}

	.turntable-stage {
		display: grid;
		place-items: center;
		padding: 1rem 0 0.75rem;
	}

	.turntable-deck {
		position: relative;
		width: min(100%, 25rem);
		aspect-ratio: 1.4;
		border: 1px solid color-mix(in srgb, var(--music-wine) 24%, transparent);
		border-radius: 1.15rem;
		background:
			linear-gradient(135deg, rgb(255 255 255 / 34%), transparent 48%),
			var(--music-deck);
		box-shadow:
			inset 0 0 0 5px color-mix(in srgb, var(--music-paper-solid) 68%, transparent),
			0 14px 28px rgb(66 43 37 / 16%);
	}

	.record-shadow,
	.vinyl {
		position: absolute;
		top: 50%;
		left: 39%;
		width: 67%;
		aspect-ratio: 1;
		border-radius: 50%;
		transform: translate(-50%, -50%);
	}

	.record-shadow {
		background: rgb(50 31 28 / 22%);
		filter: blur(10px);
		transform: translate(-48%, -46%) scale(0.98);
	}

	.vinyl {
		isolation: isolate;
		overflow: hidden;
		border: 0;
		padding: 0;
		background:
			radial-gradient(circle at center, transparent 0 17%, rgb(7 8 8 / 85%) 17.5% 19%, transparent 19.5%),
			repeating-radial-gradient(circle, #242323 0 2px, #0e0f0f 3px 5px);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 8%), 0 8px 18px rgb(0 0 0 / 34%);
		cursor: pointer;
		animation: record-spin 8s linear infinite;
		animation-delay: var(--record-spin-offset, 0s);
		animation-play-state: paused;
	}

	.vinyl:focus-visible {
		outline: 3px solid var(--music-wine);
		outline-offset: 5px;
	}

	.playing .vinyl {
		animation-play-state: running;
	}

	.vinyl-grooves {
		position: absolute;
		inset: 7%;
		border-radius: 50%;
		background: conic-gradient(from 35deg, transparent, rgb(255 255 255 / 13%), transparent 16%, transparent 58%, rgb(255 255 255 / 7%), transparent 76%);
	}

	.record-label {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 2;
		display: grid;
		width: 34%;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		border: 3px solid #d8aaad;
		border-radius: 50%;
		background: #f7e8df;
		color: var(--music-wine-deep);
		font-size: 2rem;
		transform: translate(-50%, -50%);
	}

	.record-label img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.record-spindle {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 3;
		width: 0.55rem;
		aspect-ratio: 1;
		border: 2px solid #eee2c8;
		border-radius: 50%;
		background: var(--music-brass);
		transform: translate(-50%, -50%);
	}

	.tonearm {
		position: absolute;
		top: 4%;
		right: 3%;
		z-index: 4;
		width: 39%;
		height: 70%;
		overflow: visible;
		pointer-events: none;
		filter: drop-shadow(0 3px 2px rgb(0 0 0 / 24%));
		transform: rotate(-20deg);
		transform-origin: 84.2% 14.3%;
		transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.has-track .tonearm {
		transform: rotate(-4deg);
	}

	.playing .tonearm {
		transform: rotate(4deg);
	}

	.tonearm-pivot-rim {
		fill: color-mix(in srgb, var(--music-paper-solid) 68%, var(--music-brass));
		stroke: var(--music-brass);
		stroke-width: 3;
	}

	.tonearm-pivot-core {
		fill: var(--music-brass);
		stroke: color-mix(in srgb, var(--music-ink) 35%, transparent);
		stroke-width: 1;
	}

	.tonearm-bar-shadow,
	.tonearm-bar {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.tonearm-bar-shadow {
		stroke: color-mix(in srgb, var(--music-ink) 58%, var(--music-brass));
		stroke-width: 9;
	}

	.tonearm-bar {
		stroke: #e6ca8d;
		stroke-width: 5;
	}

	.tonearm-joint {
		fill: none;
		stroke: var(--music-brass);
		stroke-linecap: round;
		stroke-width: 7;
	}

	.tonearm-head {
		fill: var(--music-wine-deep);
		stroke: color-mix(in srgb, var(--music-paper-solid) 75%, var(--music-wine));
		stroke-linejoin: round;
		stroke-width: 2;
	}

	.tonearm-stylus {
		fill: none;
		stroke: var(--music-ink);
		stroke-linecap: round;
		stroke-width: 2.5;
	}

	.deck-switch {
		position: absolute;
		right: 8%;
		bottom: 8%;
		width: 1.15rem;
		aspect-ratio: 1;
		border: 3px solid color-mix(in srgb, var(--music-paper-solid) 56%, transparent);
		border-radius: 50%;
		background: var(--music-wine);
		box-shadow: 0 2px 5px rgb(0 0 0 / 18%);
	}

	.catalog-hint {
		margin: -0.15rem 0 0.7rem;
		color: var(--music-wine);
		font-family: var(--font-code);
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-align: center;
	}

	.catalog-hint span {
		font-size: 0.9rem;
	}

	.track-meta {
		min-height: 4.8rem;
		text-align: center;
	}

	.track-meta h3 {
		margin: 0.25rem 0 0.1rem;
		overflow: hidden;
		font-family: var(--font-library-serif);
		font-size: 1.22rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-meta p {
		margin: 0;
		overflow: hidden;
		color: var(--music-muted);
		font-size: 0.78rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.progress-group input,
	.volume-control input {
		width: 100%;
		accent-color: var(--music-wine);
		cursor: pointer;
	}

	.progress-group > div {
		display: flex;
		justify-content: space-between;
		color: var(--music-muted);
		font-family: var(--font-code);
		font-size: 0.62rem;
	}

	.player-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		margin-top: 0.5rem;
	}

	.player-controls button,
	.lyric-mode-switch button {
		display: grid;
		place-items: center;
		border: 1px solid var(--music-rule);
		background: color-mix(in srgb, var(--music-paper-solid) 82%, var(--music-wine) 18%);
		color: var(--music-ink);
		cursor: pointer;
		transition: transform 180ms ease, background-color 180ms ease, color 180ms ease;
	}

	.player-controls button:hover,
	.player-controls button:focus-visible {
		color: var(--music-wine);
		transform: translateY(-2px);
	}

	.minor-control,
	.transport-control {
		width: 2.45rem;
		height: 2.45rem;
		border-radius: 50%;
		font-size: 1.15rem;
	}

	.play-control {
		width: 3.5rem;
		height: 3.5rem;
		border-color: var(--music-wine-deep) !important;
		border-radius: 50%;
		background: var(--music-wine) !important;
		color: white !important;
		font-size: 1.8rem;
		box-shadow: inset 0 0 0 4px rgb(255 255 255 / 18%), 0 6px 14px rgb(110 54 68 / 25%);
	}

	.play-control:disabled {
		cursor: not-allowed;
		opacity: 0.42;
	}

	.volume-control {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.75rem;
		margin: 0.7rem auto 0;
		max-width: 18rem;
		color: var(--music-muted);
	}

	.inline-error {
		margin: 0.6rem 0 0;
		color: var(--music-wine);
		font-size: 0.75rem;
		text-align: center;
	}

	.lyrics-panel {
		display: flex;
		height: clamp(32rem, calc(100svh - 12rem), 40rem);
		min-height: 0;
		flex-direction: column;
		background:
			linear-gradient(90deg, transparent 0 2.7rem, rgb(164 95 106 / 12%) 2.7rem 2.76rem, transparent 2.76rem),
			repeating-linear-gradient(0deg, transparent 0 2.3rem, var(--music-rule) 2.3rem 2.35rem),
			var(--music-paper);
	}

	.lyrics-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--music-rule);
		padding: 1rem 1.2rem;
	}

	.lyrics-header h3 {
		margin: 0.12rem 0 0;
		font-family: var(--font-library-serif);
		font-size: 1.25rem;
	}

	.lyric-mode-switch {
		display: flex;
		border: 1px solid var(--music-rule);
		border-radius: 999px;
		padding: 0.18rem;
		background: color-mix(in srgb, var(--music-paper-solid) 90%, transparent);
	}

	.lyric-mode-switch button {
		border: 0;
		border-radius: 999px;
		padding: 0.35rem 0.65rem;
		background: transparent;
		font-size: 0.72rem;
	}

	.lyric-mode-switch button.active {
		background: var(--music-wine);
		color: white;
	}

	.single-lyric-mode {
		border: 1px solid var(--music-rule);
		border-radius: 999px;
		padding: 0.35rem 0.65rem;
		color: var(--music-muted);
		font-size: 0.72rem;
	}

	.lyrics-scroll {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-color: color-mix(in srgb, var(--music-wine) 35%, transparent) transparent;
		scrollbar-width: thin;
		mask-image: linear-gradient(to bottom, transparent, black 14%, black 86%, transparent);
	}

	.lyrics-padding {
		flex: none;
	}

	.lyric-line {
		display: flex;
		width: calc(100% - 3.5rem);
		min-height: 3.5rem;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		margin-left: 3.1rem;
		border: 0;
		border-left: 3px solid transparent;
		padding: 0.55rem 1.2rem;
		background: transparent;
		color: var(--music-muted);
		font-family: var(--font-library-serif);
		font-size: 0.93rem;
		line-height: 1.55;
		text-align: left;
		cursor: pointer;
		opacity: 0.72;
		transition: color 220ms ease, opacity 220ms ease, transform 220ms ease, border-color 220ms ease, background-color 220ms ease;
	}

	.lyric-line:hover,
	.lyric-line:focus-visible {
		opacity: 0.9;
	}

	.lyric-line.active {
		border-left-color: var(--music-wine);
		background: linear-gradient(90deg, color-mix(in srgb, var(--music-wine) 13%, transparent), transparent 80%);
		color: var(--music-ink);
		font-size: 1.08rem;
		font-weight: 700;
		opacity: 1;
		transform: translateX(0.3rem);
	}

	.lyric-line small {
		color: var(--music-wine);
		font-family: var(--font-library-sans);
		font-size: 0.74rem;
		font-weight: 400;
	}

	.lyrics-empty {
		display: flex;
		height: 100%;
		min-height: 0;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 0.55rem;
		color: var(--music-muted);
		text-align: center;
	}

	.lyrics-empty :global(svg) {
		font-size: 3rem;
		color: var(--music-wine);
		opacity: 0.7;
	}

	.lyrics-empty p {
		margin: 0;
		font-family: var(--font-library-serif);
	}

	.lyrics-empty span {
		font-family: var(--font-code);
		font-size: 0.55rem;
		letter-spacing: 0.13em;
	}

	.catalog-dialog {
		position: fixed;
		inset: 0;
		width: 100vw;
		max-width: none;
		height: 100dvh;
		max-height: none;
		margin: 0;
		border: 0;
		padding: 0;
		background: transparent;
		color: #fff9ef;
		overflow: hidden;
		overscroll-behavior: contain;
		touch-action: none;
	}

	.catalog-dialog[open] {
		display: grid;
		place-items: center;
	}

	.catalog-dialog::backdrop {
		background: rgb(5 11 9 / 78%);
	}

	@supports (backdrop-filter: blur(1px)) {
		.catalog-dialog::backdrop {
			background: rgb(5 11 9 / 38%);
			backdrop-filter: blur(16px) brightness(0.64);
		}
	}

	.catalog-surface {
		position: relative;
		width: min(100%, 75rem);
		height: min(46rem, calc(100dvh - 2rem));
		background: transparent;
		animation: catalog-arrive 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	.catalog-close {
		position: fixed;
		top: clamp(1rem, 3vw, 2rem);
		right: clamp(1rem, 3vw, 2rem);
		z-index: 5;
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border: 0;
		padding: 0;
		background: transparent;
		color: white;
		font-size: 1.4rem;
		font-weight: 300;
		line-height: 1;
		text-shadow: 0 1px 6px rgb(0 0 0 / 65%);
		cursor: pointer;
	}

	.catalog-close:focus-visible {
		outline: 1px solid white;
		outline-offset: 2px;
	}

	.catalog-close:hover {
		opacity: 0.75;
	}

	.catalog-stage {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.catalog-sleeve-scene {
		position: absolute;
		top: 50%;
		left: 12%;
		width: min(38%, 25rem);
		aspect-ratio: 1;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.sleeve-back,
	.sleeve-front {
		position: absolute;
		left: 0;
		width: 80%;
		height: 77%;
		border: 1px solid color-mix(in srgb, var(--music-brass) 70%, var(--music-rule));
	}

	.sleeve-back {
		top: 17%;
		z-index: 1;
		background: color-mix(in srgb, var(--music-paper-solid) 73%, var(--music-brass) 27%);
		box-shadow: 0 1.1rem 2.2rem rgb(32 19 12 / 20%);
		animation: sleeve-rise 430ms ease-out both;
	}

	.catalog-vinyl {
		position: absolute;
		top: -2%;
		left: 24%;
		z-index: 2;
		width: 77%;
		aspect-ratio: 1;
		border-radius: 50%;
		background:
			radial-gradient(circle at center, transparent 0 17%, #080909 18% 20%, transparent 21%),
			repeating-radial-gradient(circle, #292a2a 0 2px, #0c0e0e 3px 5px);
		box-shadow: inset 0 0 0 2px rgb(255 255 255 / 9%), 0 0.8rem 1.7rem rgb(0 0 0 / 28%);
		animation: catalog-record-rise 610ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both;
	}

	.catalog-vinyl-grooves {
		position: absolute;
		inset: 7%;
		border-radius: 50%;
		background: conic-gradient(from 35deg, transparent, rgb(255 255 255 / 14%), transparent 16%, transparent 58%, rgb(255 255 255 / 8%), transparent 76%);
	}

	.catalog-record-label {
		position: absolute;
		top: 50%;
		left: 50%;
		display: grid;
		width: 34%;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		border: 3px solid var(--music-wine);
		border-radius: 50%;
		background: var(--music-deck);
		color: var(--music-wine);
		font-size: 2rem;
		transform: translate(-50%, -50%);
	}

	.catalog-record-label img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.sleeve-front {
		top: 22%;
		z-index: 3;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 8% 7%;
		background:
			linear-gradient(130deg, color-mix(in srgb, var(--music-paper-solid) 86%, white 14%), var(--music-deck)),
			var(--music-paper-solid);
		box-shadow: inset 0 0 0 0.45rem color-mix(in srgb, var(--music-brass) 17%, transparent), 0 0.5rem 1.3rem rgb(0 0 0 / 16%);
		mask-image: radial-gradient(circle at 78% 20%, transparent 0 16%, black 16.5%);
		animation: sleeve-rise 430ms ease-out both;
	}

	.sleeve-front span,
	.sleeve-front small {
		color: var(--music-wine);
		font-family: var(--font-code);
		font-size: clamp(0.48rem, 1vw, 0.65rem);
		font-weight: 700;
		letter-spacing: 0.12em;
	}

	.sleeve-front strong {
		margin-top: auto;
		color: var(--music-ink);
		font-family: var(--font-library-serif);
		font-size: clamp(1.2rem, 3vw, 2.1rem);
		line-height: 1.05;
	}

	.sleeve-front small {
		margin-top: 0.7rem;
	}

	.catalog-tracks {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.catalog-track {
		display: grid;
		position: absolute;
		top: var(--orbit-y);
		left: var(--orbit-x);
		grid-template-columns: 2.8rem minmax(0, 1fr);
		align-items: center;
		gap: 0.7rem;
		width: min(25%, 16rem);
		min-height: 3.5rem;
		border: 0;
		padding: 0.2rem;
		background: transparent;
		color: #fff9ef;
		text-align: left;
		text-shadow: 0 2px 7px rgb(0 0 0 / 78%);
		cursor: pointer;
		opacity: var(--card-opacity);
		pointer-events: auto;
		transform: translateY(-50%) rotate(var(--orbit-tilt));
		transform-origin: left center;
		animation: catalog-card-arrive 420ms cubic-bezier(0.2, 0.8, 0.2, 1) var(--stagger) backwards;
		transition: top 300ms ease, left 300ms ease, transform 300ms ease, opacity 200ms ease;
	}

	.catalog-track:hover,
	.catalog-track:focus-visible,
	.catalog-track.focused {
		opacity: 1;
	}

	.catalog-track:focus-visible {
		outline: none;
	}

	.catalog-track:focus-visible .track-copy strong,
	.catalog-track:hover .track-copy strong {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.track-cover {
		position: relative;
		display: grid;
		width: 2.8rem;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		border-radius: 50%;
		background: #272524;
		color: #e9d4b5;
		font-size: 1.2rem;
		box-shadow: 0 3px 13px rgb(0 0 0 / 30%);
		transition: transform 200ms ease, box-shadow 200ms ease;
	}

	.catalog-track.focused .track-cover,
	.catalog-track:hover .track-cover,
	.catalog-track:focus-visible .track-cover {
		box-shadow: 0 0 0 2px #fff9ef, 0 4px 18px rgb(0 0 0 / 48%);
		transform: scale(1.13);
	}

	.track-cover img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.track-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
	}

	.track-copy strong,
	.track-copy small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-copy strong {
		font-family: var(--font-library-serif);
		font-size: 0.88rem;
		transition: font-size 200ms ease;
	}

	.catalog-track.focused .track-copy strong {
		font-size: 1.02rem;
	}

	.track-copy small {
		color: rgb(255 249 239 / 78%);
		font-size: 0.69rem;
	}

	.catalog-state {
		position: absolute;
		top: 50%;
		left: 58%;
		width: min(35%, 25rem);
		color: #fff9ef;
		text-shadow: 0 2px 8px rgb(0 0 0 / 75%);
		transform: translateY(-50%);
	}

	.catalog-state h3,
	.catalog-state p {
		margin: 0;
	}

	.catalog-state h3 {
		font-family: var(--font-library-serif);
		font-size: 1.1rem;
	}

	.catalog-state p {
		margin-top: 0.4rem;
		font-size: 0.8rem;
		line-height: 1.6;
	}

	.catalog-state code {
		color: #fff9ef;
		font-weight: 700;
	}

	.catalog-state button {
		margin-top: 0.8rem;
		border: 0;
		border-bottom: 1px solid currentColor;
		padding: 0.1rem 0;
		background: transparent;
		color: #fff9ef;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.catalog-state button:focus-visible {
		outline: 1px solid white;
		outline-offset: 3px;
	}

	@keyframes record-spin {
		to { transform: translate(-50%, -50%) rotate(360deg); }
	}

	@keyframes catalog-arrive {
		from { opacity: 0; transform: translateY(1rem) scale(0.985); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	@keyframes sleeve-rise {
		from { opacity: 0; transform: translateY(1.7rem); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes catalog-record-rise {
		from { opacity: 0; transform: translate(-14%, 18%); }
		to { opacity: 1; transform: translate(0, 0); }
	}

	@keyframes catalog-card-arrive {
		from { opacity: 0; transform: translate(-0.8rem, -50%) rotate(var(--orbit-tilt)); }
		to { opacity: var(--card-opacity); transform: translateY(-50%) rotate(var(--orbit-tilt)); }
	}

	@media (max-width: 1023px) {
		.player-spread {
			grid-template-columns: 1fr;
		}

		.turntable-deck {
			width: min(100%, 31rem);
		}

		.lyrics-panel {
			height: clamp(22rem, 48svh, 32rem);
		}
	}

	@media (max-width: 900px), (max-height: 600px) {
		.catalog-sleeve-scene {
			left: 3%;
			width: min(43%, 20rem);
		}

		.catalog-track {
			width: min(34%, 15rem);
		}
	}

	@media (max-width: 640px) {
		.music-page-header {
			align-items: flex-start;
			padding: 1.15rem;
		}

		.collection-count {
			min-width: 3.5rem;
		}

		.turntable-panel {
			padding: 0.9rem;
		}

		.turntable-deck {
			aspect-ratio: 1.25;
		}

		.record-shadow,
		.vinyl {
			left: 40%;
			width: 70%;
		}

		.lyrics-panel {
			height: clamp(22rem, 48svh, 28rem);
		}

		.lyric-line {
			width: calc(100% - 2.2rem);
			margin-left: 1.8rem;
			padding-right: 0.7rem;
			padding-left: 0.7rem;
		}

		.catalog-dialog {
			padding: 0;
		}

		.catalog-surface {
			height: 100dvh;
		}

		.catalog-sleeve-scene {
			top: 35%;
			left: 44%;
			width: min(50vw, 13rem);
			transform: translateX(-50%);
		}

		.catalog-track {
			top: var(--mobile-y);
			left: var(--mobile-x);
			grid-template-columns: 2.15rem minmax(0, 1fr);
			gap: 0.35rem;
			width: 43%;
			min-height: 3.5rem;
			padding: 0.2rem;
			transform: translateY(-50%) rotate(var(--mobile-tilt));
			transform-origin: left center;
			animation-name: catalog-card-arrive-mobile;
		}

		.catalog-track .track-cover {
			width: 2.15rem;
			font-size: 1rem;
		}

		.catalog-track .track-copy strong {
			font-size: 0.74rem;
		}

		.catalog-track.focused .track-copy strong {
			font-size: 0.84rem;
		}

		.catalog-track .track-copy small {
			font-size: 0.6rem;
		}

		.catalog-state {
			top: auto;
			bottom: 9%;
			left: 50%;
			width: 84%;
			text-align: center;
			transform: translateX(-50%);
		}
	}

	@media (max-width: 640px) and (max-height: 650px) {
		.catalog-sleeve-scene {
			width: min(35vw, 9rem);
		}

		.catalog-track {
			min-height: 3.4rem;
		}
	}

	@keyframes catalog-card-arrive-mobile {
		from { opacity: 0; transform: translate(0.8rem, calc(-50% + 0.8rem)) rotate(var(--mobile-tilt)); }
		to { opacity: var(--card-opacity); transform: translateY(-50%) rotate(var(--mobile-tilt)); }
	}

	@media (prefers-reduced-motion: reduce) {
		.vinyl {
			animation: none;
		}

		.tonearm,
		.catalog-track,
		.lyric-line,
		.player-controls button {
			transition: none;
		}

		.catalog-surface,
		.sleeve-back,
		.sleeve-front,
		.catalog-vinyl,
		.catalog-track {
			animation: none;
		}
	}
</style>
