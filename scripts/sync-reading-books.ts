import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readingPlanConfig } from "../src/config/readingPlanConfig";
import type {
	ReadingBookMetadata,
	ReadingPlanItem,
} from "../src/types/readingPlanConfig";

type ReadingCache = { version: 1; items: ReadingBookMetadata[] };
type Fetcher = typeof fetch;

const imageExtensions: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/avif": "avif",
};

function cachePath(root: string): string {
	return path.join(root, "src/config/readingBooks.generated.json");
}

async function readCache(root: string): Promise<ReadingCache> {
	try {
		const data: unknown = JSON.parse(await readFile(cachePath(root), "utf8"));
		if (
			data &&
			typeof data === "object" &&
			"version" in data &&
			data.version === 1 &&
			"items" in data &&
			Array.isArray(data.items)
		)
			return { version: 1, items: data.items as ReadingBookMetadata[] };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT")
			console.warn("[READING] Cannot read previous metadata cache:", error);
	}
	return { version: 1, items: [] };
}

async function fetchCover(
	subjectId: number,
	root: string,
	fetcher: Fetcher,
): Promise<string | undefined> {
	const response = await fetcher(
		`https://api.bgm.tv/v0/subjects/${subjectId}/image?type=large`,
		{
			headers: {
				"User-Agent": "Demiur-Reading-Shelf/1.0 (https://demiur-git.github.io)",
			},
			signal: AbortSignal.timeout(10000),
		},
	);
	if (!response.ok || response.url.includes("no_icon_subject"))
		return undefined;
	const mime =
		response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ||
		"";
	const extension = imageExtensions[mime];
	if (!extension) return undefined;
	const bytes = Buffer.from(await response.arrayBuffer());
	if (bytes.length === 0 || bytes.length > 5_000_000) return undefined;
	const directory = path.join(root, "public/assets/reading/covers");
	await mkdir(directory, { recursive: true });
	const filename = `${subjectId}.${extension}`;
	const target = path.join(directory, filename);
	await writeFile(`${target}.tmp`, bytes);
	await rename(`${target}.tmp`, target);
	return `/assets/reading/covers/${filename}`;
}

export async function syncReadingBooks(
	root: string,
	books: ReadingPlanItem[],
	fetcher: Fetcher = fetch,
): Promise<ReadingCache> {
	const previous = await readCache(root);
	const previousById = new Map(
		previous.items.map((item) => [item.subjectId, item]),
	);
	const ids = [
		...new Set(
			books
				.map((book) => book.bangumiSubjectId)
				.filter((id): id is number => id !== undefined),
		),
	];
	for (const book of books) {
		if (
			book.personalRating !== undefined &&
			(!Number.isFinite(book.personalRating) ||
				book.personalRating < 0 ||
				book.personalRating > 10)
		)
			throw new Error(
				`[READING] ${book.title}: personalRating must be between 0 and 10.`,
			);
	}
	for (const id of ids)
		if (!Number.isSafeInteger(id) || id <= 0)
			throw new Error(`[READING] Invalid Bangumi subject ID: ${id}`);

	const items: ReadingBookMetadata[] = [];
	for (const id of ids) {
		const old = previousById.get(id);
		try {
			const response = await fetcher(`https://api.bgm.tv/v0/subjects/${id}`, {
				headers: {
					"User-Agent":
						"Demiur-Reading-Shelf/1.0 (https://demiur-git.github.io)",
					Accept: "application/json",
				},
				signal: AbortSignal.timeout(10000),
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const subject: unknown = await response.json();
			if (
				!subject ||
				typeof subject !== "object" ||
				!("type" in subject) ||
				subject.type !== 1
			)
				throw new Error("Bangumi entry is not a book");
			const rawSummary = "summary" in subject ? subject.summary : undefined;
			const rawRating = "rating" in subject ? subject.rating : undefined;
			const rawScore =
				rawRating && typeof rawRating === "object" && "score" in rawRating
					? rawRating.score
					: undefined;
			const summary = typeof rawSummary === "string" ? rawSummary.trim() : "";
			const score =
				typeof rawScore === "number" &&
				Number.isFinite(rawScore) &&
				rawScore > 0 &&
				rawScore <= 10
					? rawScore
					: undefined;
			let cover =
				old?.cover &&
				existsSync(path.join(root, "public", old.cover.replace(/^\//, "")))
					? old.cover
					: undefined;
			try {
				cover = (await fetchCover(id, root, fetcher)) || cover;
			} catch (error) {
				console.warn(
					`[READING] Cover for ${id} could not be refreshed; using cache if present:`,
					error,
				);
			}
			items.push({
				subjectId: id,
				summary,
				...(score === undefined ? {} : { score }),
				...(cover ? { cover } : {}),
			});
		} catch (error) {
			console.warn(
				`[READING] Subject ${id} could not be refreshed; using cache if present:`,
				error,
			);
			if (old)
				items.push({
					...old,
					cover:
						old.cover &&
						existsSync(path.join(root, "public", old.cover.replace(/^\//, "")))
							? old.cover
							: undefined,
				});
		}
	}
	const result: ReadingCache = { version: 1, items };
	const serialized = `${JSON.stringify(result, null, "\t")}\n`;
	if (
		(await readFile(cachePath(root), "utf8").catch(() => "")) !== serialized
	) {
		await mkdir(path.dirname(cachePath(root)), { recursive: true });
		await writeFile(`${cachePath(root)}.tmp`, serialized);
		await rename(`${cachePath(root)}.tmp`, cachePath(root));
	}
	console.log(
		`[READING] Synced ${items.length}/${ids.length} Bangumi book entries.`,
	);
	return result;
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	await syncReadingBooks(process.cwd(), readingPlanConfig.books);
}
