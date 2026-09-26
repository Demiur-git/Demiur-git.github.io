import { randomUUID } from "node:crypto";
import {
	readFile,
	realpath,
	stat,
	writeFile,
	rename,
	unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { MusicLocalTrack } from "../src/types/musicConfig.ts";

type Library = {
	version: number;
	generatedAt: string | null;
	tracks: MusicLocalTrack[];
};

const help = `公开曲库导出工具（不会上传或发布音乐）

pnpm music:export -- --list
pnpm music:export -- --ids "歌曲ID1,歌曲ID2" --base-url "https://你的音乐域名" [--dry-run] [--force]

--list      列出本地歌曲 ID、歌名和作者
--ids       逗号分隔的歌曲 ID，必须明确选择
--base-url  R2 HTTPS 公开地址；上传时保留 library/歌曲ID/文件名
--dry-run   验证并显示 JSON，不写入文件
--force     允许替换非空公开清单（仅保留本次所选歌曲）
--help      显示说明

输出：src/config/musicLibrary.public.json
个人清单和音乐文件不会被修改。`;

function parseArgs(argv: string[]): Map<string, string | boolean> {
	const result = new Map<string, string | boolean>();
	for (let index = 0; index < argv.length; index++) {
		const flag = argv[index];
		if (flag === "--") continue;
		if (
			![
				"--list",
				"--ids",
				"--base-url",
				"--dry-run",
				"--force",
				"--help",
			].includes(flag)
		) {
			throw new Error(`未知参数：${flag}`);
		}
		if (result.has(flag)) throw new Error(`重复参数：${flag}`);
		if (flag === "--ids" || flag === "--base-url") {
			const value = argv[++index];
			if (!value || value.startsWith("--")) throw new Error(`${flag} 缺少值。`);
			result.set(flag, value);
		} else result.set(flag, true);
	}
	return result;
}

function validateLibrary(value: unknown): Library {
	if (!value || typeof value !== "object")
		throw new Error("曲库清单格式错误。");
	const library = value as Library;
	if (library.version !== 1 || !Array.isArray(library.tracks))
		throw new Error("仅支持 version=1 的曲库清单。");
	const ids = new Set<string>();
	for (const track of library.tracks) {
		if (
			!track ||
			typeof track !== "object" ||
			typeof track.id !== "string" ||
			!track.id.trim()
		) {
			throw new Error("每首歌曲必须有非空 ID。");
		}
		if (ids.has(track.id)) throw new Error(`曲库 ID 重复：${track.id}`);
		ids.add(track.id);
		for (const field of ["name", "artist", "url"] as const) {
			if (typeof track[field] !== "string" || !track[field].trim())
				throw new Error(`${track.id} 缺少 ${field}。`);
		}
	}
	return library;
}

function inside(root: string, target: string): boolean {
	const relative = path.relative(root, target);
	return (
		relative !== "" &&
		!relative.startsWith(`..${path.sep}`) &&
		relative !== ".." &&
		!path.isAbsolute(relative)
	);
}

export async function exportPublicMusic(
	argv: string[],
	projectRoot: string,
	log: (message: string) => void = console.log,
): Promise<Library | undefined> {
	const args = parseArgs(argv);
	if (args.has("--help")) {
		log(help);
		return;
	}
	const sourcePath = path.join(
		projectRoot,
		"src/config/musicLibrary.generated.json",
	);
	const outputPath = path.join(
		projectRoot,
		"src/config/musicLibrary.public.json",
	);
	const source = validateLibrary(
		JSON.parse(await readFile(sourcePath, "utf8")),
	);
	if (args.has("--list")) {
		if (args.size !== 1) throw new Error("--list 不能与导出参数混用。");
		log(
			source.tracks
				.map((track) => `${track.id}\t${track.name} — ${track.artist}`)
				.join("\n") || "本地曲库为空。",
		);
		return;
	}
	const idsValue = args.get("--ids");
	const baseValue = args.get("--base-url");
	if (typeof idsValue !== "string" || typeof baseValue !== "string")
		throw new Error("必须提供 --ids 和 --base-url；不会默认公开全部曲库。");
	const ids = idsValue.split(",").map((id) => id.trim());
	if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
		throw new Error("--ids 中存在空 ID 或重复 ID。");
	let base: URL;
	try {
		base = new URL(baseValue);
	} catch {
		throw new Error("--base-url 必须是有效的 HTTPS 地址。");
	}
	if (
		base.protocol !== "https:" ||
		base.username ||
		base.password ||
		/[?#\\]/.test(baseValue)
	) {
		throw new Error(
			"--base-url 必须使用 HTTPS，且不能含凭证、查询参数、片段或反斜线。",
		);
	}
	const requested = new Set(ids);
	for (const id of requested) {
		if (!source.tracks.some((track) => track.id === id))
			throw new Error(`未知歌曲 ID：${id}`);
	}
	const publicRoot = await realpath(path.join(projectRoot, "public"));
	const libraryRoot = await realpath(
		path.join(publicRoot, "assets/music/library"),
	);
	if (!inside(publicRoot, libraryRoot))
		throw new Error("音乐目录不能指向 public 外部。");
	const mapAsset = async (value: unknown, label: string): Promise<string> => {
		if (typeof value !== "string")
			throw new Error(`${label} 必须是本地资源路径。`);
		const normalized = value.replace(/^\//, "");
		const segments = normalized.split("/");
		if (
			!normalized.startsWith("assets/music/library/") ||
			/[\\?#:\u0000-\u001f\u007f]/.test(value) ||
			segments.some(
				(segment) => !segment || segment === "." || segment === "..",
			) ||
			/%(?:2e|2f|5c)/i.test(value)
		) {
			throw new Error(
				`${label} 路径不合法，只接受 assets/music/library/ 下的文件。`,
			);
		}
		let resolved: string;
		try {
			resolved = await realpath(path.join(publicRoot, ...segments));
		} catch {
			throw new Error(`${label} 引用文件缺失：${value}`);
		}
		if (!inside(libraryRoot, resolved) || !(await stat(resolved)).isFile())
			throw new Error(`${label} 不属于音乐目录中的普通文件。`);
		const remotePath = segments.slice(2).map(encodeURIComponent).join("/");
		return `${base.href.replace(/\/+$/, "")}/${remotePath}`;
	};
	const tracks: MusicLocalTrack[] = [];
	for (const track of source.tracks.filter((entry) =>
		requested.has(entry.id as string),
	)) {
		const output: MusicLocalTrack = {
			id: track.id,
			name: track.name,
			artist: track.artist,
			url: await mapAsset(track.url, `${track.id} 音频`),
		};
		for (const field of [
			"cover",
			"lrc",
			"translationLrc",
			"romajiLrc",
		] as const) {
			if (track[field] !== undefined)
				output[field] = await mapAsset(track[field], `${track.id} ${field}`);
		}
		if (track.album !== undefined) {
			if (typeof track.album !== "string")
				throw new Error(`${track.id} 专辑格式错误。`);
			output.album = track.album;
		}
		if (track.duration !== undefined) {
			if (!Number.isFinite(track.duration) || track.duration < 0)
				throw new Error(`${track.id} 时长格式错误。`);
			output.duration = track.duration;
		}
		tracks.push(output);
	}
	const output: Library = {
		version: 1,
		generatedAt: new Date().toISOString(),
		tracks,
	};
	const json = `${JSON.stringify(output, null, "\t")}\n`;
	if (args.has("--dry-run")) {
		log(json);
		log("只读预览：没有写入、上传或发布任何文件。");
		return output;
	}
	const checkOverwrite = async (): Promise<void> => {
		try {
			const existing = validateLibrary(
				JSON.parse(await readFile(outputPath, "utf8")),
			);
			if (existing.tracks.length && !args.has("--force"))
				throw new Error("公开清单非空；确认替换后请使用 --force。");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	};
	await checkOverwrite();
	const temporary = `${outputPath}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporary, json, { encoding: "utf8", flag: "wx" });
		await checkOverwrite();
		await rename(temporary, outputPath);
	} finally {
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
	log(
		`已导出 ${tracks.length} 首至 src/config/musicLibrary.public.json；没有上传或发布文件。`,
	);
	return output;
}

if (
	process.argv[1] &&
	pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
	const projectRoot = path.resolve(
		fileURLToPath(new URL(".", import.meta.url)),
		"..",
	);
	exportPublicMusic(process.argv.slice(2), projectRoot).catch(
		(error: unknown) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		},
	);
}
