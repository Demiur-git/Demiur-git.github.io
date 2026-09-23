import { createHash } from "node:crypto";
import {
	access,
	copyFile,
	mkdir,
	readdir,
	readFile,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type IAudioMetadata, type IPicture, parseFile } from "music-metadata";
import sharp from "sharp";

type GeneratedTrack = {
	id: string;
	name: string;
	artist: string;
	url: string;
	cover?: string;
	lrc?: string;
	translationLrc?: string;
	romajiLrc?: string;
	album?: string;
	duration?: number;
};

type MusicLibrary = {
	version: number;
	generatedAt: string | null;
	tracks: GeneratedTrack[];
};

type ImportResult = {
	track: GeneratedTrack;
	cover: "embedded" | "sidecar" | "online" | "missing";
	lyrics: "embedded" | "sidecar" | "online" | "missing";
	translation: boolean;
	romaji: boolean;
};

const AUDIO_EXTENSIONS = new Set([
	".aac",
	".flac",
	".m4a",
	".mp3",
	".mp4",
	".ogg",
	".opus",
	".wav",
	".webm",
]);
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const inboxDir = path.join(projectRoot, "music-inbox");
const publicLibraryDir = path.join(
	projectRoot,
	"public",
	"assets",
	"music",
	"library",
);
const manifestPath = path.join(
	projectRoot,
	"src",
	"config",
	"musicLibrary.generated.json",
);

const args = new Set(process.argv.slice(2));
const fetchLyrics = args.has("--fetch-lyrics");
const fetchCover = args.has("--fetch-cover");
const dryRun = args.has("--dry-run");

function showHelp() {
	console.log(`音乐馆藏导入工具

用法：pnpm.cmd music:import -- [选项]

选项：
  --fetch-lyrics  缺少同名 LRC 时，从 LRCLIB 匹配同步歌词
  --fetch-cover   缺少封面且歌曲含 MusicBrainz 专辑 ID 时，从 Cover Art Archive 获取
  --dry-run       只检查和预览，不复制文件或改写清单
  --help          显示本说明
`);
}

async function exists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function walkAudioFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		if (entry.name === "README.md") continue;
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkAudioFiles(entryPath)));
		} else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
			files.push(entryPath);
		}
	}
	return files.sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function slugify(value: string): string {
	return value
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 42);
}

function createTrackId(
	metadata: IAudioMetadata,
	title: string,
	artist: string,
) {
	const recordingId = metadata.common.musicbrainz_recordingid?.trim();
	if (recordingId) return `mb-${recordingId}`;
	const signature = [
		title,
		artist,
		metadata.common.album ?? "",
		Math.round(metadata.format.duration ?? 0),
	].join("\u0000");
	const digest = createHash("sha1")
		.update(signature)
		.digest("hex")
		.slice(0, 10);
	return `${slugify(title) || "track"}-${digest}`;
}

function getArtist(metadata: IAudioMetadata): string {
	const artists = metadata.common.artists?.filter(Boolean);
	if (artists?.length) return artists.join(" / ");
	return metadata.common.artist?.trim() || "未知艺术家";
}

async function findFirst(paths: string[]): Promise<string | undefined> {
	for (const filePath of paths) {
		if (await exists(filePath)) return filePath;
	}
	return undefined;
}

function sidecarCandidates(audioPath: string, suffixes: string[]): string[] {
	const directory = path.dirname(audioPath);
	const stem = path.basename(audioPath, path.extname(audioPath));
	return suffixes.map((suffix) => path.join(directory, `${stem}${suffix}`));
}

async function findSidecarCover(
	audioPath: string,
): Promise<string | undefined> {
	const directory = path.dirname(audioPath);
	const stem = path.basename(audioPath, path.extname(audioPath));
	const candidates = [
		...IMAGE_EXTENSIONS.map((extension) =>
			path.join(directory, `${stem}${extension}`),
		),
		...IMAGE_EXTENSIONS.map((extension) =>
			path.join(directory, `${stem}.cover${extension}`),
		),
		...IMAGE_EXTENSIONS.flatMap((extension) => [
			path.join(directory, `cover${extension}`),
			path.join(directory, `folder${extension}`),
			path.join(directory, `front${extension}`),
		]),
	];
	return findFirst(candidates);
}

async function writeCover(
	picture: IPicture | Buffer,
	targetPath: string,
): Promise<void> {
	const input = Buffer.isBuffer(picture) ? picture : Buffer.from(picture.data);
	await sharp(input)
		.rotate()
		.resize(900, 900, { fit: "cover", withoutEnlargement: true })
		.webp({ quality: 86 })
		.toFile(targetPath);
}

async function fetchCoverArt(
	metadata: IAudioMetadata,
): Promise<Buffer | undefined> {
	const albumId = metadata.common.musicbrainz_albumid?.trim();
	if (!albumId) return undefined;
	const response = await fetch(
		`https://coverartarchive.org/release/${encodeURIComponent(albumId)}/front-500`,
		{ headers: { "User-Agent": "PersonalPagesMusicImporter/1.0" } },
	);
	if (!response.ok) return undefined;
	return Buffer.from(await response.arrayBuffer());
}

async function fetchSyncedLyrics(
	title: string,
	artist: string,
	duration?: number,
): Promise<string | undefined> {
	const endpoint = new URL("https://lrclib.net/api/get");
	endpoint.searchParams.set("track_name", title);
	endpoint.searchParams.set("artist_name", artist);
	if (duration && Number.isFinite(duration)) {
		endpoint.searchParams.set("duration", String(Math.round(duration)));
	}
	const response = await fetch(endpoint, {
		headers: { "User-Agent": "PersonalPagesMusicImporter/1.0" },
	});
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(`LRCLIB HTTP ${response.status}`);
	const result = (await response.json()) as { syncedLyrics?: string | null };
	return result.syncedLyrics?.trim() || undefined;
}

function formatLrcTimestamp(milliseconds: number): string {
	const totalCentiseconds = Math.max(0, Math.round(milliseconds / 10));
	const minutes = Math.floor(totalCentiseconds / 6000);
	const seconds = Math.floor((totalCentiseconds % 6000) / 100);
	const centiseconds = totalCentiseconds % 100;
	return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}]`;
}

function getEmbeddedLyrics(metadata: IAudioMetadata): string | undefined {
	for (const lyrics of metadata.common.lyrics ?? []) {
		if (lyrics.timeStampFormat === 2 && lyrics.syncText.length > 0) {
			return lyrics.syncText
				.map((line) => `${formatLrcTimestamp(line.timestamp ?? 0)}${line.text}`)
				.join("\n");
		}
		if (lyrics.text && /\[\d{2}:\d{2}[.:]\d{2,3}\]/.test(lyrics.text)) {
			return lyrics.text.trim();
		}
	}
	return undefined;
}

async function copyTextFile(source: string, target: string) {
	const text = await readFile(source, "utf8");
	await writeFile(target, text.replace(/\r\n/g, "\n"), "utf8");
}

function publicPath(trackId: string, fileName: string): string {
	return `assets/music/library/${trackId}/${fileName}`;
}

async function importTrack(audioPath: string): Promise<ImportResult> {
	const metadata = await parseFile(audioPath, { duration: true });
	const fallbackTitle = path.basename(audioPath, path.extname(audioPath));
	const title = metadata.common.title?.trim() || fallbackTitle;
	const artist = getArtist(metadata);
	const trackId = createTrackId(metadata, title, artist);
	const targetDir = path.join(publicLibraryDir, trackId);
	const audioExtension = path.extname(audioPath).toLowerCase();
	const audioFileName = `audio${audioExtension}`;
	const track: GeneratedTrack = {
		id: trackId,
		name: title,
		artist,
		url: publicPath(trackId, audioFileName),
	};
	if (metadata.common.album?.trim()) track.album = metadata.common.album.trim();
	if (metadata.format.duration && Number.isFinite(metadata.format.duration)) {
		track.duration = Math.round(metadata.format.duration * 1000) / 1000;
	}

	const mainLrc = await findFirst(sidecarCandidates(audioPath, [".lrc"]));
	const embeddedLyrics = mainLrc ? undefined : getEmbeddedLyrics(metadata);
	const translationLrc = await findFirst(
		sidecarCandidates(audioPath, [
			".translation.lrc",
			".translated.lrc",
			".zh.lrc",
			".cn.lrc",
		]),
	);
	const romajiLrc = await findFirst(
		sidecarCandidates(audioPath, [
			".romaji.lrc",
			".romanized.lrc",
			".roma.lrc",
		]),
	);

	let downloadedLyrics: string | undefined;
	if (!mainLrc && !embeddedLyrics && fetchLyrics) {
		try {
			downloadedLyrics = await fetchSyncedLyrics(
				title,
				artist,
				metadata.format.duration,
			);
		} catch (error) {
			console.warn(
				`  歌词匹配失败：${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	const embeddedCover = metadata.common.picture?.[0];
	const sidecarCover = embeddedCover
		? undefined
		: await findSidecarCover(audioPath);
	let onlineCover: Buffer | undefined;
	if (!embeddedCover && !sidecarCover && fetchCover) {
		try {
			onlineCover = await fetchCoverArt(metadata);
		} catch (error) {
			console.warn(
				`  封面匹配失败：${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	if (!dryRun) {
		await mkdir(targetDir, { recursive: true });
		await copyFile(audioPath, path.join(targetDir, audioFileName));
		if (embeddedCover) {
			await writeCover(embeddedCover, path.join(targetDir, "cover.webp"));
		} else if (sidecarCover) {
			await writeCover(
				await readFile(sidecarCover),
				path.join(targetDir, "cover.webp"),
			);
		} else if (onlineCover) {
			await writeCover(onlineCover, path.join(targetDir, "cover.webp"));
		}

		if (mainLrc)
			await copyTextFile(mainLrc, path.join(targetDir, "lyrics.lrc"));
		else if (embeddedLyrics) {
			await writeFile(
				path.join(targetDir, "lyrics.lrc"),
				`${embeddedLyrics}\n`,
				"utf8",
			);
		} else if (downloadedLyrics) {
			await writeFile(
				path.join(targetDir, "lyrics.lrc"),
				`${downloadedLyrics}\n`,
				"utf8",
			);
		}
		if (translationLrc) {
			await copyTextFile(
				translationLrc,
				path.join(targetDir, "lyrics.translation.lrc"),
			);
		}
		if (romajiLrc) {
			await copyTextFile(romajiLrc, path.join(targetDir, "lyrics.romaji.lrc"));
		}
	}

	if (embeddedCover || sidecarCover || onlineCover) {
		track.cover = publicPath(trackId, "cover.webp");
	}
	if (mainLrc || embeddedLyrics || downloadedLyrics)
		track.lrc = publicPath(trackId, "lyrics.lrc");
	if (translationLrc) {
		track.translationLrc = publicPath(trackId, "lyrics.translation.lrc");
	}
	if (romajiLrc) {
		track.romajiLrc = publicPath(trackId, "lyrics.romaji.lrc");
	}

	return {
		track,
		cover: embeddedCover
			? "embedded"
			: sidecarCover
				? "sidecar"
				: onlineCover
					? "online"
					: "missing",
		lyrics: mainLrc
			? "sidecar"
			: embeddedLyrics
				? "embedded"
				: downloadedLyrics
					? "online"
					: "missing",
		translation: Boolean(translationLrc),
		romaji: Boolean(romajiLrc),
	};
}

async function readManifest(): Promise<MusicLibrary> {
	try {
		return JSON.parse(await readFile(manifestPath, "utf8")) as MusicLibrary;
	} catch {
		return { version: 1, generatedAt: null, tracks: [] };
	}
}

async function main() {
	if (args.has("--help")) {
		showHelp();
		return;
	}

	await mkdir(inboxDir, { recursive: true });
	const files = await walkAudioFiles(inboxDir);
	if (files.length === 0) {
		console.log("music-inbox 中没有找到音频文件。请先放入歌曲，再重新运行。");
		return;
	}

	console.log(`发现 ${files.length} 个音频文件，开始整理……`);
	const results: ImportResult[] = [];
	for (const [index, audioPath] of files.entries()) {
		const relativePath = path.relative(inboxDir, audioPath);
		console.log(`[${index + 1}/${files.length}] ${relativePath}`);
		try {
			const result = await importTrack(audioPath);
			results.push(result);
			console.log(
				`  ✓ ${result.track.name} — ${result.track.artist}｜封面：${result.cover}｜歌词：${result.lyrics}`,
			);
		} catch (error) {
			console.error(
				`  ✗ 导入失败：${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	if (results.length === 0) {
		throw new Error("没有歌曲成功导入，曲目清单未发生变化。");
	}

	if (!dryRun) {
		const current = await readManifest();
		const merged = new Map(current.tracks.map((track) => [track.id, track]));
		for (const result of results) merged.set(result.track.id, result.track);
		const next: MusicLibrary = {
			version: 1,
			generatedAt: new Date().toISOString(),
			tracks: Array.from(merged.values()),
		};
		await writeFile(
			manifestPath,
			`${JSON.stringify(next, null, "\t")}\n`,
			"utf8",
		);
	}

	const missingCovers = results.filter(
		(result) => result.cover === "missing",
	).length;
	const missingLyrics = results.filter(
		(result) => result.lyrics === "missing",
	).length;
	console.log("");
	console.log(
		`${dryRun ? "检查" : "导入"}完成：${results.length} 首；缺少封面 ${missingCovers} 首；缺少同步歌词 ${missingLyrics} 首。`,
	);
	if (dryRun) console.log("这是预览模式，没有写入任何文件。");
	else
		console.log("源文件仍保留在 music-inbox，可在确认网站播放正常后自行移走。");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
