export interface EchoApertureFrame {
	width: number;
	height: number;
	centerX: number;
	centerY: number;
	seamHalfHeight: number;
	preview: number;
	opening: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** A tapered opening in viewport coordinates; the final frame is exactly opaque. */
export function echoAperturePath(frame: EchoApertureFrame): string {
	const { width, height, centerX, centerY } = frame;
	const preview = clamp01(frame.preview);
	const opening = clamp01(frame.opening);
	if (opening >= 1)
		return `M0 0 H${width.toFixed(2)} V${height.toFixed(2)} H0 Z`;
	if (preview === 0 && opening === 0) return "";

	const ease = opening * opening * (3 - 2 * opening);
	const halfHeight =
		frame.seamHalfHeight +
		ease * (Math.max(width, height) * 3 - frame.seamHalfHeight);
	const halfWidth = preview * 9 + ease * Math.hypot(width, height) * 2;
	const steps = 32;
	const left: string[] = [];
	const right: string[] = [];
	for (let index = 0; index <= steps; index++) {
		const t = (index / steps) * 2 - 1;
		const taper = Math.pow(Math.max(0, 1 - t * t), 0.42);
		const bend = Math.sin(t * Math.PI * 1.4) * (preview * 1.8 + ease * 8);
		const y = centerY + t * halfHeight;
		left.push(`${(centerX - halfWidth * taper + bend).toFixed(2)} ${y.toFixed(2)}`);
		right.push(`${(centerX + halfWidth * taper + bend).toFixed(2)} ${y.toFixed(2)}`);
	}
	return `M${left.join(" L")} L${right.reverse().join(" L")} Z`;
}
