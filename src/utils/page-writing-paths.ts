export type PageWritingGlyph = {
	character: string;
	charIndex: number;
	lineIndex: number;
	startRatio: number;
	endRatio: number;
};

export type PageWritingLine = {
	text: string;
	x: number;
	baseline: number;
	width: number;
	glyphs: PageWritingGlyph[];
};

export type PageWritingLayout = {
	viewWidth: number;
	viewHeight: number;
	lines: PageWritingLine[];
	glyphs: PageWritingGlyph[];
};

function glyphWidth(character: string): number {
	if (/\s/u.test(character)) return 34;
	if (/^[\p{Script=Latin}\p{Number}\p{Punctuation}]$/u.test(character))
		return /^[MW@#%&]$/u.test(character) ? 78 : 62;
	return 100;
}

/** Original text proportions and line spacing; no surrogate letter/stroke geometry. */
export function createPageWritingLayout(
	title: string,
	penLift: boolean,
	maxLineUnits: number = 12,
): PageWritingLayout {
	const normalized = title.trim().replace(/\s+/gu, " ");
	const texts: string[] = [];
	let current = "";
	for (const word of normalized.split(" ")) {
		const candidate = current ? `${current} ${word}` : word;
		const units = Array.from(candidate).reduce(
			(sum, c) => sum + glyphWidth(c) / 100,
			0,
		);
		if (current && units > maxLineUnits && texts.length === 0) {
			texts.push(current);
			current = word;
		} else current = candidate;
	}
	texts.push(current);
	const widths = texts.map((text) =>
		Array.from(text).reduce((sum, c) => sum + glyphWidth(c), 0),
	);
	const viewWidth = Math.max(280, ...widths.map((width) => width + 36));
	const count = Array.from(normalized).filter((c) => !/\s/u.test(c)).length;
	const gap = penLift ? 0.12 : 0;
	const total = count + Math.max(0, count - 1) * gap;
	let cursor = 0,
		index = 0;
	const lines = texts.map((text, lineIndex) => ({
		text,
		x: viewWidth / 2,
		baseline: lineIndex * 124 + 105,
		width: widths[lineIndex],
		glyphs: Array.from(text).flatMap((character, charIndex) => {
			if (/\s/u.test(character)) return [];
			const startRatio = cursor / total;
			cursor += 1;
			const endRatio = cursor / total;
			if (++index < count) cursor += gap;
			return [{ character, charIndex, lineIndex, startRatio, endRatio }];
		}),
	}));
	return {
		viewWidth,
		viewHeight: lines.length * 124,
		lines,
		glyphs: lines.flatMap((line) => line.glyphs),
	};
}

/** Monotonic reveal progress shared by the clip edge and nib. */
export function writingGlyphProgress(
	progress: number,
	glyph: PageWritingGlyph,
): number {
	const t = Math.max(
		0,
		Math.min(
			1,
			(progress - glyph.startRatio) / (glyph.endRatio - glyph.startRatio),
		),
	);
	return t * t * (3 - 2 * t);
}
