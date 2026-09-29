export interface TraceSegment {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	born: number;
}

export function pulseWaveGeometry(intensity: number): { top: number; height: number; viewportHeight: number; maxHeight: number } {
	const level = Math.max(0, Math.min(1, intensity));
	return {
		top: -300 * level,
		height: 400 + 600 * level,
		viewportHeight: 40 + 36 * level,
		maxHeight: 400 + 400 * level,
	};
}

// Wave geometry is decorative. Randomness is sampled per beat, never per frame.
export class PulseScanner {
	segments: TraceSegment[] = [];
	x = 0;
	y = 200;
	private beatStart = 0;
	private beatDuration = 1000;
	private amplitude = 44;
	private spread = 1;
	private lastTime = 0;
	constructor(private random: () => number = Math.random) {
		this.newBeat();
	}
	private newBeat(intensity = 0): void {
		this.beatDuration = (700 + this.random() * 450) / (1 + intensity * 0.85);
		this.amplitude = (105 + this.random() * 65) * (1 + intensity * 1.7);
		this.spread = 0.8 + this.random() * 0.4;
	}
	step(time: number, width = 1200, intensity = 0): void {
		const elapsed = this.lastTime ? time - this.lastTime : 0;
		if (elapsed <= 0) {
			this.lastTime = time;
			return;
		}
		// Fixed 12ms sampling prevents frame rate from changing wave shape or trail density.
		for (let t = this.lastTime + 12; t <= time; t += 12) {
			if (t - this.beatStart >= this.beatDuration) {
				this.beatStart = t;
				this.newBeat(intensity);
			}
			const phase = (t - this.beatStart) / this.beatDuration;
			const bump = (center: number, radius: number, height: number) =>
				height *
				Math.max(0, 1 - Math.abs(phase - center) / (radius * this.spread));
			const y =
				200 +
				bump(0.22, 0.05, -this.amplitude * 0.12) +
				bump(0.4, 0.022, this.amplitude * 0.15) +
				bump(0.43, 0.018 + intensity * 0.017, -this.amplitude) +
				bump(0.47, 0.026, this.amplitude * 0.62) +
				bump(0.69, 0.09, -this.amplitude * 0.2);
			const next = this.x + (width / 4000) * 12;
			if (next <= width)
				this.segments.push({
					x1: this.x,
					y1: this.y,
					x2: next,
					y2: y,
					born: t,
				});
			this.x = next > width ? 0 : next;
			this.y = y;
			this.lastTime = t;
		}
		this.segments = this.segments.filter(
			(segment) => time - segment.born < 1100,
		);
	}
}

export function staticPulsePath(): string {
	return "M0 200 H150 l18 -20 18 20 h25 l9 20 11 -180 12 255 10 -95 h32 l20 -32 20 32 H520 l15 -18 16 18 h24 l8 18 11 -158 11 227 11 -87 h30 l18 -28 19 28 H910 l20 -23 20 23 h20 l10 22 11 -192 12 275 12 -105 h22 l20 -34 20 34 H1200";
}
