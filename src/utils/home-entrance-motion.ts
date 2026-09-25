export const ENTRANCE_TIMING = { approach: 1600, open: 650, walk: 1000, black: 180, wake: 1800 } as const;

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function sampleGateWalk(progress: number, from: number, to: number, amplitude: number): { distance: number; offsetPx: number } {
	const t = clamp(progress);
	return {
		distance: from + (to - from) * smooth(t),
		offsetPx: Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI) ** 2 * amplitude,
	};
}

export function sampleEyeReveal(elapsed: number): { openness: number; blur: number; shade: number } {
	const t = Math.max(0, elapsed);
	let openness = 0;
	if (t < 300) openness = .1 * smooth(t / 300);
	else if (t < 450) openness = .1;
	else if (t < 630) openness = .1 * (1 - smooth((t - 450) / 180));
	else if (t >= 750) openness = smooth((t - 750) / 700);
	const focus = smooth((t - 750) / 1050);
	return { openness, blur: 14 * (1 - focus), shade: .28 * (1 - focus) };
}
