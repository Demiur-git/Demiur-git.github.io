export type PageWritingStroke = {
	d: string;
	startRatio: number;
	endRatio: number;
	maskWidth: number;
};

export type PageWritingGlyph = {
	character: string;
	x: number;
	baseline: number;
	width: number;
	strokes: PageWritingStroke[];
};

export type PageWritingLine = {
	text: string;
	x: number;
	baseline: number;
	width: number;
	maskId: string;
	strokes: PageWritingStroke[];
};

export type PageWritingLayout = {
	viewWidth: number;
	viewHeight: number;
	glyphs: PageWritingGlyph[];
	lines: PageWritingLine[];
};

type GlyphDraft = Omit<PageWritingGlyph, "strokes"> & {
	strokePaths: string[];
};

const MAX_LINE_UNITS = 12;
const LINE_HEIGHT = 124;
const VIEW_PADDING = 18;

function hashText(value: string): number {
	let hash = 2166136261;
	for (const character of value) {
		hash ^= character.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function createRandom(seed: number): () => number {
	let state = seed || 1;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

function jitter(random: () => number, range = 3): number {
	return (random() * 2 - 1) * range;
}

function isLatinLike(character: string): boolean {
	return /^[\p{Script=Latin}\p{Number}\p{Punctuation}]$/u.test(character);
}

function getGlyphWidth(character: string): number {
	if (/\s/u.test(character)) return 34;
	if (isLatinLike(character)) {
		return /^[MW@#%&]$/u.test(character) ? 78 : 62;
	}
	return 100;
}

function createWideGlyphPaths(
	x: number,
	top: number,
	width: number,
	random: () => number,
): string[] {
	const left = x + 6;
	const right = x + width - 6;
	const center = x + width * (0.46 + jitter(random, 0.035));
	const j = () => jitter(random);

	return [
		`M ${left} ${top + 25 + j()} C ${x + width * 0.3} ${top + 18 + j()}, ${x + width * 0.7} ${top + 31 + j()}, ${right} ${top + 24 + j()}`,
		`M ${center + j()} ${top + 8} C ${center - 8 + j()} ${top + 38}, ${center + 9 + j()} ${top + 70}, ${center - 2 + j()} ${top + 108}`,
		`M ${left} ${top + 51 + j()} C ${x + width * 0.34} ${top + 45 + j()}, ${x + width * 0.72} ${top + 61 + j()}, ${right} ${top + 54 + j()} C ${x + width * 0.75} ${top + 72 + j()}, ${x + width * 0.3} ${top + 70 + j()}, ${left + 2} ${top + 82 + j()} C ${x + width * 0.33} ${top + 98 + j()}, ${x + width * 0.7} ${top + 92 + j()}, ${right - 2} ${top + 106 + j()}`,
	];
}

function createLatinGlyphPath(
	x: number,
	top: number,
	width: number,
	random: () => number,
): string {
	const left = x + 5;
	const right = x + width - 5;
	const j = () => jitter(random, 2.4);
	return `M ${left} ${top + 18 + j()} C ${x + width * 0.35} ${top + 10 + j()}, ${x + width * 0.75} ${top + 25 + j()}, ${right} ${top + 31 + j()} C ${x + width * 0.72} ${top + 43 + j()}, ${x + width * 0.28} ${top + 39 + j()}, ${left} ${top + 55 + j()} C ${x + width * 0.25} ${top + 72 + j()}, ${x + width * 0.75} ${top + 65 + j()}, ${right} ${top + 80 + j()} C ${x + width * 0.68} ${top + 100 + j()}, ${x + width * 0.3} ${top + 91 + j()}, ${left + 3} ${top + 108 + j()}`;
}

/**
 * 为目的地英文标题生成稳定的“拟手写”引导路径。路径只负责控制墨迹显现，
 * 最终字形仍由站点字体绘制，因此更换栏目名称不需要重新制作 SVG 素材。
 */
export function createPageWritingLayout(
	title: string,
	penLift: boolean,
	maxLineUnits: number = MAX_LINE_UNITS,
): PageWritingLayout {
	const normalizedTitle = title.trim().replace(/\s+/gu, " ") || " ";
	const words = normalizedTitle.split(" ");
	const lineTexts: string[] = [];
	let currentLine = "";
	for (const word of words) {
		const candidate = currentLine ? `${currentLine} ${word}` : word;
		const candidateUnits = Array.from(candidate).reduce(
			(total, character) => total + getGlyphWidth(character) / 100,
			0,
		);
		if (currentLine && candidateUnits > maxLineUnits && lineTexts.length === 0) {
			lineTexts.push(currentLine);
			currentLine = word;
		} else {
			currentLine = candidate;
		}
	}
	lineTexts.push(currentLine);
	const characters = Array.from(lineTexts.join("\n"));
	const lines: Array<Array<{ character: string; width: number }>> = [[]];

	for (const character of characters) {
		if (character === "\n") {
			lines.push([]);
			continue;
		}
		const width = getGlyphWidth(character);
		lines.at(-1)?.push({ character, width });
	}

	const lineWidths = lines.map((line) =>
		line.reduce((total, glyph) => total + glyph.width, 0),
	);
	const viewWidth = Math.max(280, Math.max(...lineWidths) + VIEW_PADDING * 2);
	const viewHeight = lines.length * LINE_HEIGHT;
	const seed = hashText(title);
	const drafts: GlyphDraft[] = [];

	lines.forEach((line, lineIndex) => {
		let x = (viewWidth - lineWidths[lineIndex]) / 2;
		const top = lineIndex * LINE_HEIGHT + 4;
		line.forEach(({ character, width }, characterIndex) => {
			if (/\s/u.test(character)) {
				x += width;
				return;
			}
			const random = createRandom(
				seed ^ Math.imul(lineIndex + 1, 2654435761) ^ (characterIndex + 17),
			);
			const strokePaths = isLatinLike(character)
				? [createLatinGlyphPath(x, top, width, random)]
				: createWideGlyphPaths(x, top, width, random);

			drafts.push({
				character,
				x: x + width / 2,
				baseline: top + 101,
				width,
				strokePaths,
			});
			x += width;
		});
	});

	const strokeCount = drafts.reduce(
		(total, glyph) => total + glyph.strokePaths.length,
		0,
	);
	const liftWeight = penLift ? 0.12 : 0;
	const totalWeight = Math.max(
		1,
		strokeCount + Math.max(0, strokeCount - 1) * liftWeight,
	);
	let cursor = 0;

	const glyphs = drafts.map(({ strokePaths, ...glyph }) => ({
		...glyph,
		strokes: strokePaths.map((d, index) => {
			const startRatio = cursor / totalWeight;
			cursor += 1;
			const endRatio = cursor / totalWeight;
			if (penLift && (index < strokePaths.length - 1 || cursor < totalWeight)) {
				cursor += liftWeight;
			}
			return {
				d,
				startRatio,
				endRatio,
				maskWidth: glyph.width >= 90 ? 34 : 28,
			};
		}),
	}));

	const writingLines = lines.map((line, lineIndex) => {
		const baseline = lineIndex * LINE_HEIGHT + 105;
		return {
			text: line.map(({ character }) => character).join(""),
			x: viewWidth / 2,
			baseline,
			width: lineWidths[lineIndex],
			maskId: `page-writing-line-mask-${lineIndex}`,
			strokes: glyphs
				.filter((glyph) => glyph.baseline === baseline)
				.flatMap((glyph) => glyph.strokes),
		};
	});

	return { viewWidth, viewHeight, glyphs, lines: writingLines };
}
