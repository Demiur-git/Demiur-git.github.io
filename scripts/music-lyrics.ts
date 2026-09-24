type TimedLine = {
	time: number;
	tag: string;
	text: string;
};

type Group = {
	time: number;
	lines: TimedLine[];
};

export type LyricSplitResult =
	| {
			status: "split";
			original: string;
			translation: string;
			pairs: number;
	  }
	| {
			status: "unchanged" | "ambiguous";
			reason: string;
			pairs: number;
	  };

const leadingTimestamp = /^\[(\d{2}):(\d{2})[.:](\d{2,3})\]/;
const kana = /[\u3040-\u30ff]/u;
const han = /[\u3400-\u9fff]/u;
const latin = /[A-Za-z]/;

function parseLines(source: string): { headers: string[]; groups: Group[] } {
	const headers: string[] = [];
	const groups = new Map<number, Group>();
	for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
		let remaining = raw.trim();
		const stamps: Array<{ time: number; tag: string }> = [];
		let match = leadingTimestamp.exec(remaining);
		while (match) {
			const fraction = Number(match[3]) * (match[3].length === 2 ? 10 : 1);
			stamps.push({
				time: Number(match[1]) * 60000 + Number(match[2]) * 1000 + fraction,
				tag: match[0],
			});
			remaining = remaining.slice(match[0].length);
			match = leadingTimestamp.exec(remaining);
		}
		if (stamps.length === 0) {
			if (remaining) headers.push(remaining);
			continue;
		}
		const text = remaining.trim();
		if (!text) continue;
		for (const stamp of stamps) {
			const group = groups.get(stamp.time) ?? { time: stamp.time, lines: [] };
			group.lines.push({ ...stamp, text });
			groups.set(stamp.time, group);
		}
	}
	return {
		headers,
		groups: [...groups.values()].sort((left, right) => left.time - right.time),
	};
}

/**
 * Only split a whole song when its repeated timestamps consistently look like
 * original-first / Chinese-translation-second. Han-only Japanese lines inherit
 * that song-wide order; they are never classified in isolation.
 */
export function splitBilingualLrc(source: string): LyricSplitResult {
	const { headers, groups } = parseLines(source);
	const songGroups = groups.filter((group) => group.time > 0);
	const pairs = songGroups.filter((group) => group.lines.length === 2);
	if (pairs.length < 5 || pairs.length / Math.max(songGroups.length, 1) < 0.6) {
		return {
			status: "unchanged",
			reason: "未发现稳定的成对双语时间戳",
			pairs: pairs.length,
		};
	}
	if (songGroups.some((group) => group.lines.length > 2)) {
		return {
			status: "ambiguous",
			reason: "歌曲正文含三行以上的同时间戳内容",
			pairs: pairs.length,
		};
	}
	const translationEvidence = pairs.filter(
		(group) => han.test(group.lines[1].text) && !kana.test(group.lines[1].text),
	).length / pairs.length;
	const originalEvidence = pairs.filter(
		(group) => kana.test(group.lines[0].text) || latin.test(group.lines[0].text),
	).length / pairs.length;
	if (translationEvidence < 0.8 || originalEvidence < 0.6) {
		return {
			status: "ambiguous",
			reason: "无法可靠确认原文在前、中文译文在后",
			pairs: pairs.length,
		};
	}

	const original = [...headers];
	const translation: string[] = [];
	let splitPairs = 0;
	for (const group of groups) {
		if (group.lines.length > 2) {
			// Intro credits sometimes share 00:00; retain all distinct text once.
			const combined = [...new Set(group.lines.map((line) => line.text))].join(" / ");
			original.push(`${group.lines[0].tag}${combined}`);
		} else {
			const [main, translated] = group.lines;
			original.push(`${main.tag}${main.text}`);
			if (translated) {
				translation.push(`${translated.tag}${translated.text}`);
				splitPairs += 1;
			}
		}
	}
	return {
		status: "split",
		original: `${original.join("\n")}\n`,
		translation: `${translation.join("\n")}\n`,
		pairs: splitPairs,
	};
}
