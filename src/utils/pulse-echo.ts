// A fixed phrase gives the visitor two signals that can actually be aligned.
// The ambient ECG remains random outside the resonance interaction.
import type { TraceSegment } from "./pulse-wave";

export const ECHO_PATH =
	"M0 200 H145 L162 196 L179 200 H199 L214 218 L235 59 L253 337 L272 188 L289 200 H467 L483 196 L501 200 H522 L538 215 L559 78 L578 322 L596 189 L614 200 H795 L813 196 L829 200 H850 L865 220 L888 48 L906 345 L925 187 L942 200 H1200";

export const ECHO_START = { x: 84, y: 44 } as const;
export const ECHO_HOLD_MS = 1200;
export const ECHO_RESIDUE_REVEAL_MS = 13000;
export const ECHO_DRAG_THRESHOLD_PX = 20;

export function echoResidueAvailable(
	clueSeen: boolean,
	elapsedSinceClueMs: number,
	reducedMotion: boolean,
	unlocked: boolean,
): boolean {
	return (
		clueSeen &&
		(unlocked ||
			reducedMotion ||
			elapsedSinceClueMs >= ECHO_RESIDUE_REVEAL_MS)
	);
}

export interface EchoResidue {
	x: number;
	y: number;
	rise: number;
}

export const DEFAULT_ECHO_RESIDUE: EchoResidue = { x: 720, y: 203, rise: 2 };

export function pickEchoResidue(segments: TraceSegment[]): EchoResidue {
	const candidates = segments.filter(
		(segment) => segment.x1 >= 620 && segment.x2 <= 820,
	);
	const chosen = candidates.sort(
		(a, b) =>
			Math.abs((a.y1 + a.y2) / 2 - 200) +
			Math.abs(a.x1 - 720) * 0.05 -
			(Math.abs((b.y1 + b.y2) / 2 - 200) + Math.abs(b.x1 - 720) * 0.05),
	)[0];
	if (!chosen) return { ...DEFAULT_ECHO_RESIDUE };
	return {
		x: (chosen.x1 + chosen.x2) / 2,
		y: (chosen.y1 + chosen.y2) / 2 + 2,
		rise: Math.max(-3, Math.min(3, (chosen.y2 - chosen.y1) * 2)),
	};
}

export function echoResiduePath(
	residue: EchoResidue,
	viewportWidth: number,
): string {
	const span = Math.max(
		18,
		Math.min(92, (1200 * 26) / Math.max(1, viewportWidth)),
	);
	return `M${(residue.x - span / 2).toFixed(1)} ${(residue.y - residue.rise / 2).toFixed(1)} L${(residue.x + span / 2).toFixed(1)} ${(residue.y + residue.rise / 2).toFixed(1)}`;
}

export function draggedEchoResidue(
	startX: number,
	startY: number,
	endX: number,
	endY: number,
): boolean {
	return Math.hypot(endX - startX, endY - startY) >= ECHO_DRAG_THRESHOLD_PX;
}

export function clampEchoOffset(
	x: number,
	y: number,
): { x: number; y: number } {
	return {
		x: Math.max(-180, Math.min(180, x)),
		y: Math.max(-90, Math.min(90, y)),
	};
}

export function echoCloseness(x: number, y: number): number {
	const distance = Math.hypot(x / 115, y / 75);
	return Math.max(0, Math.min(1, 1 - distance));
}

export function echoAligned(x: number, y: number): boolean {
	return Math.abs(x) <= 12 && Math.abs(y) <= 12;
}

export function advanceEchoHold(
	current: number,
	delta: number,
	aligned: boolean,
): number {
	return aligned ? current + delta : Math.max(0, current - delta * 2);
}
