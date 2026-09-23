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

function eventDetail<T>(event: Event): T {
	return (event as CustomEvent<T>).detail;
}

function syncState(state: MusicState) {
	playlist = state.playlist;
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
	if (userScrolling || !lyricsScroller || displayedActiveIndex < 0) return;
	await tick();
	const line = lyricsScroller.querySelector<HTMLElement>(
		`[data-lyric-index="${displayedActiveIndex}"]`,
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

function suspendLyricFollow() {
	userScrolling = true;
	if (scrollTimer) clearTimeout(scrollTimer);
	scrollTimer = setTimeout(() => {
		userScrolling = false;
		followActiveLine("auto");
	}, 3000);
}

function selectTrack(index: number) {
	errorMessage = "";
	manager?.playTrackByIndex(index);
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
	userScrolling = false;
	followActiveLine("smooth");
}

function retrySource() {
	errorMessage = "";
	manager?.retry();
}

onMount(() => {
	manager = window.__fireflyMusic;
	if (!manager) {
		sourceStatus = "error";
		errorMessage = "播放器未能初始化";
		return;
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
		followActiveLine();
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

			<div class:playing={isPlaying} class="turntable-stage">
				<div class="turntable-deck">
					<div class="record-shadow"></div>
					<div class="vinyl">
						<div class="vinyl-grooves"></div>
						<div class="record-label">
							{#if currentTrack?.pic}
								<img src={currentTrack.pic} alt={`${currentTrack.name} 曲绘`} />
							{:else}
								<MusicIcon name="music-note" />
							{/if}
						</div>
						<div class="record-spindle"></div>
					</div>
					<div class="tonearm" aria-hidden="true">
						<div class="tonearm-pivot"></div>
						<div class="tonearm-bar"></div>
						<div class="tonearm-head"></div>
					</div>
					<div class="deck-switch" aria-hidden="true"></div>
				</div>
			</div>

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
				tabindex="0"
			>
				{#if lyricStatus === "loading"}
					<div class="lyrics-empty">
						<MusicIcon name="spinner" />
						<p>正在翻找歌词页……</p>
					</div>
				{:else if renderedLyrics.length > 0}
					<div class="lyrics-padding" aria-hidden="true"></div>
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
					<div class="lyrics-padding" aria-hidden="true"></div>
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

	<section class="playlist-section" aria-labelledby="playlist-title">
		<header>
			<div>
				<span>CATALOG · RECORD LIST</span>
				<h3 id="playlist-title">馆藏曲目</h3>
			</div>
			<span>{playlist.length} TRACKS</span>
		</header>

		{#if sourceStatus === "unconfigured"}
			<div class="source-state">
				<MusicIcon name="settings" />
				<div>
					<h4>等待第一张唱片入馆</h4>
					<p>把音频放入 <code>music-inbox</code>，运行 <code>pnpm.cmd music:import</code> 即可生成静态曲库。</p>
				</div>
				<span class="state-stamp">IMPORT</span>
			</div>
		{:else if sourceStatus === "loading" || sourceStatus === "idle"}
			<div class="source-state">
				<MusicIcon name="spinner" />
				<div><h4>正在整理唱片架</h4><p>稍候，正在读取静态曲库与唱片封面。</p></div>
			</div>
		{:else if sourceStatus === "error" || sourceStatus === "empty"}
			<div class="source-state error" role="alert">
				<MusicIcon name="album" />
				<div><h4>唱片架暂时无法打开</h4><p>{errorMessage || "歌单为空或接口暂时不可用。"}</p></div>
				<button type="button" on:click={retrySource}>重新尝试</button>
			</div>
		{:else}
			<div class="track-grid">
				{#each playlist as track, index}
					<button
						type="button"
						class="track-card"
						class:active={index === currentIndex}
						on:click={() => selectTrack(index)}
						aria-current={index === currentIndex ? "true" : undefined}
					>
						<span class="track-number">{String(index + 1).padStart(2, "0")}</span>
						<span class="track-cover">
							{#if track.pic}<img src={track.pic} alt="" loading="lazy" />{:else}<MusicIcon name="album" />{/if}
						</span>
						<span class="track-copy"><strong>{track.name}</strong><small>{track.artist}</small></span>
						{#if index === currentIndex && isPlaying}
							<span class="equalizer" aria-label="正在播放"><i></i><i></i><i></i></span>
						{:else}
							<MusicIcon className="track-action" name="play" />
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</section>
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
	.lyrics-panel,
	.playlist-section {
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
	.playlist-section > header span,
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
	.lyrics-header > div > span,
	.playlist-section > header span {
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
		gap: 1rem;
	}

	.turntable-panel,
	.lyrics-panel,
	.playlist-section {
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
		background:
			radial-gradient(circle at center, transparent 0 17%, rgb(7 8 8 / 85%) 17.5% 19%, transparent 19.5%),
			repeating-radial-gradient(circle, #242323 0 2px, #0e0f0f 3px 5px);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 8%), 0 8px 18px rgb(0 0 0 / 34%);
	}

	.playing .vinyl {
		animation: record-spin 8s linear infinite;
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
		top: 15%;
		right: 8%;
		z-index: 4;
		width: 28%;
		height: 70%;
		transform: rotate(-18deg);
		transform-origin: 78% 18%;
		transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.playing .tonearm {
		transform: rotate(5deg);
	}

	.tonearm-pivot {
		position: absolute;
		top: 2%;
		right: 2%;
		width: 2.4rem;
		aspect-ratio: 1;
		border: 5px solid color-mix(in srgb, var(--music-paper-solid) 45%, transparent);
		border-radius: 50%;
		background: var(--music-brass);
		box-shadow: 0 3px 8px rgb(0 0 0 / 18%);
	}

	.tonearm-bar {
		position: absolute;
		top: 18%;
		right: 17%;
		width: 0.38rem;
		height: 66%;
		border-radius: 999px;
		background: linear-gradient(90deg, #8f713e, #e3c27e, #806032);
		transform: rotate(17deg);
		transform-origin: top;
	}

	.tonearm-head {
		position: absolute;
		right: 34%;
		bottom: 6%;
		width: 1.7rem;
		height: 0.8rem;
		border-radius: 0.18rem 0.5rem 0.5rem 0.18rem;
		background: var(--music-wine-deep);
		transform: rotate(17deg);
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
	.lyric-mode-switch button,
	.source-state button {
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
		min-height: 39rem;
		flex-direction: column;
		background:
			linear-gradient(90deg, transparent 0 2.7rem, rgb(164 95 106 / 12%) 2.7rem 2.76rem, transparent 2.76rem),
			repeating-linear-gradient(0deg, transparent 0 2.3rem, var(--music-rule) 2.3rem 2.35rem),
			var(--music-paper);
	}

	.lyrics-header,
	.playlist-section > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--music-rule);
		padding: 1rem 1.2rem;
	}

	.lyrics-header h3,
	.playlist-section h3 {
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
		flex: 1;
		overflow-y: auto;
		scrollbar-color: color-mix(in srgb, var(--music-wine) 35%, transparent) transparent;
		scrollbar-width: thin;
		mask-image: linear-gradient(to bottom, transparent, black 14%, black 86%, transparent);
	}

	.lyrics-padding {
		height: 12rem;
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
		opacity: 0.55;
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
		min-height: 26rem;
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

	.playlist-section {
		padding-bottom: 1.1rem;
	}

	.playlist-section > header > span {
		color: var(--music-muted);
	}

	.track-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		padding: 1rem 1.2rem 0;
	}

	.track-card {
		display: grid;
		grid-template-columns: auto 3rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		border: 1px solid var(--music-rule);
		border-left: 3px solid transparent;
		border-radius: 0.75rem;
		padding: 0.65rem 0.75rem;
		background: color-mix(in srgb, var(--music-paper-solid) 88%, transparent);
		color: var(--music-ink);
		text-align: left;
		cursor: pointer;
		transition: transform 180ms ease, border-color 180ms ease, background-color 180ms ease;
	}

	.track-card:hover,
	.track-card:focus-visible,
	.track-card.active {
		border-left-color: var(--music-wine);
		background: color-mix(in srgb, var(--music-paper-solid) 88%, var(--music-wine) 12%);
		transform: translateY(-2px);
	}

	.track-number {
		color: var(--music-brass);
		font-family: var(--font-code);
		font-size: 0.58rem;
	}

	.track-cover {
		display: grid;
		width: 3rem;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		border-radius: 50%;
		background: #272524;
		color: var(--music-brass);
		font-size: 1.35rem;
	}

	.track-cover img {
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
		font-size: 0.9rem;
	}

	.track-copy small {
		color: var(--music-muted);
		font-size: 0.7rem;
	}

	:global(.track-action) {
		color: var(--music-wine);
		font-size: 1.25rem;
	}

	.equalizer {
		display: flex;
		height: 1.1rem;
		align-items: flex-end;
		gap: 2px;
	}

	.equalizer i {
		width: 3px;
		height: 35%;
		border-radius: 999px;
		background: var(--music-wine);
		animation: equalizer-bounce 0.8s ease-in-out infinite alternate;
	}

	.equalizer i:nth-child(2) {
		animation-delay: -0.35s;
	}

	.equalizer i:nth-child(3) {
		animation-delay: -0.15s;
	}

	.source-state {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 1rem;
		margin: 1rem 1.2rem 0;
		border: 1px dashed color-mix(in srgb, var(--music-wine) 38%, transparent);
		border-radius: 0.8rem;
		padding: 1.15rem;
		background: color-mix(in srgb, var(--music-paper-solid) 88%, var(--music-wine) 12%);
	}

	.source-state > :global(svg) {
		color: var(--music-wine);
		font-size: 2rem;
	}

	.source-state h4,
	.source-state p {
		margin: 0;
	}

	.source-state h4 {
		font-family: var(--font-library-serif);
	}

	.source-state p {
		margin-top: 0.25rem;
		color: var(--music-muted);
		font-size: 0.8rem;
	}

	.source-state code {
		color: var(--music-wine);
	}

	.state-stamp {
		border: 1px solid currentColor;
		border-radius: 0.2rem;
		padding: 0.3rem 0.45rem;
		color: var(--music-wine);
		font-family: var(--font-code);
		font-size: 0.55rem;
		letter-spacing: 0.12em;
	}

	.source-state button {
		border-radius: 999px;
		padding: 0.55rem 0.8rem;
		font-size: 0.75rem;
	}

	@keyframes record-spin {
		to { transform: translate(-50%, -50%) rotate(360deg); }
	}

	@keyframes equalizer-bounce {
		to { height: 100%; }
	}

	@media (max-width: 1023px) {
		.player-spread {
			grid-template-columns: 1fr;
		}

		.turntable-deck {
			width: min(100%, 31rem);
		}

		.lyrics-panel {
			min-height: 32rem;
		}

		.lyrics-scroll {
			height: 27rem;
			flex: none;
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
			min-height: 28rem;
		}

		.lyrics-scroll {
			height: 23rem;
		}

		.lyric-line {
			width: calc(100% - 2.2rem);
			margin-left: 1.8rem;
			padding-right: 0.7rem;
			padding-left: 0.7rem;
		}

		.track-grid {
			grid-template-columns: 1fr;
			padding-right: 0.85rem;
			padding-left: 0.85rem;
		}

		.source-state {
			grid-template-columns: auto minmax(0, 1fr);
			margin-right: 0.85rem;
			margin-left: 0.85rem;
		}

		.source-state > :last-child {
			grid-column: 2;
			justify-self: start;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.playing .vinyl,
		.equalizer i {
			animation: none;
		}

		.tonearm,
		.track-card,
		.lyric-line,
		.player-controls button {
			transition: none;
		}
	}
</style>
