import {
	writingGlyphProgress,
	type PageWritingLayout,
} from "./page-writing-paths";

const NS = "http://www.w3.org/2000/svg";

/** Reveal real font text through cumulative rectangles, never S-shaped stroke masks. */
export function createPageWritingRenderer(
	clips: Element,
	ink: Element,
	wet: Element,
	pen: Element,
	layout: PageWritingLayout,
): (progress: number) => void {
	const lines = layout.lines.map((line, index) => {
		const clip = document.createElementNS(NS, "clipPath");
		clip.id = `book-turn-line-clip-${index}`;
		clip.setAttribute("clipPathUnits", "userSpaceOnUse");
		const rect = document.createElementNS(NS, "rect");
		rect.setAttribute("width", "0");
		clip.append(rect);
		clips.append(clip);
		const text = document.createElementNS(NS, "text");
		text.classList.add("book-turn-glyph");
		for (const [key, value] of Object.entries({
			x: String(line.x),
			y: String(line.baseline),
			"text-anchor": "middle",
			textLength: String(line.width),
			lengthAdjust: "spacingAndGlyphs",
			"clip-path": `url(#${clip.id})`,
		}))
			text.setAttribute(key, value);
		text.textContent = line.text;
		ink.append(text);
		const blur = text.cloneNode(true) as SVGTextElement;
		wet.append(blur);
		const box = text.getBBox();
		const left = Math.min(line.x - line.width / 2, box.x) - 2;
		const right = Math.max(line.x + line.width / 2, box.x + box.width) + 2;
		rect.setAttribute("x", String(left));
		rect.setAttribute("y", String(box.y - 8));
		rect.setAttribute("height", String(box.height + 16));
		// Measure actual font advances so narrow/wide letters and spacing reveal naturally.
		const glyphs = line.glyphs.map((glyph, i) => ({
			glyph,
			left: i === 0 ? left : text.getStartPositionOfChar(glyph.charIndex).x,
			right:
				i === line.glyphs.length - 1
					? right
					: text.getEndPositionOfChar(glyph.charIndex).x,
		}));
		if (
			glyphs.some((g) => !Number.isFinite(g.left + g.right) || g.right < g.left)
		)
			throw new Error("Invalid font text metrics");
		return {
			line,
			rect,
			text,
			blur,
			left,
			right,
			bottom: box.y + box.height + 8,
			glyphs,
		};
	});
	// Descenders retain their original font outline instead of being cut by the old viewBox.
	const svg = ink instanceof SVGElement ? ink.ownerSVGElement : null;
	if (svg)
		svg.setAttribute(
			"viewBox",
			`0 0 ${layout.viewWidth} ${Math.max(layout.viewHeight, ...lines.map((line) => line.bottom))}`,
		);
	return (progress: number) => {
		let active: { x: number; y: number } | undefined;
		for (const item of lines) {
			let edge = item.left;
			for (const { glyph, left, right } of item.glyphs) {
				const local = writingGlyphProgress(progress, glyph);
				if (local > 0) edge = Math.max(edge, left + (right - left) * local);
				if (local > 0 && local < 1)
					active = { x: edge, y: item.line.baseline - 5 };
			}
			const width = Math.max(0, edge - item.left);
			item.rect.setAttribute("width", String(width));
			for (const text of [item.text, item.blur])
				text.style.opacity = width > 0 ? "1" : "0";
		}
		if (active) {
			pen.setAttribute("transform", `translate(${active.x} ${active.y})`);
			pen.setAttribute("data-active", "true");
		} else pen.setAttribute("data-active", "false");
	};
}
