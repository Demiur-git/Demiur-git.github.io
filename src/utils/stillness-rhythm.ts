export type RhythmKey = "J" | "K";

export const STILLNESS_BUILDUP_BEATS = 20;
export const STILLNESS_BUILDUP_MS = 11000;
export const STILLNESS_BURST_BEATS = 6;
const BURST_GAP_MS = 360;
const BURST_WINDOW_MS = 1800;
const BURST_ENTRY_GRACE_MS = 1000;

export interface StillnessRhythm {
	beats: number;
	startedAt: number | null;
	lastKey: RhythmKey | null;
	lastAt: number | null;
	updatedAt: number;
	armed: boolean;
	burst: number;
	burstStartedAt: number | null;
}

export function emptyStillnessRhythm(): StillnessRhythm {
	return { beats: 0, startedAt: null, lastKey: null, lastAt: null, updatedAt: 0, armed: false, burst: 0, burstStartedAt: null };
}

export function coolStillnessRhythm(state: StillnessRhythm, now: number): StillnessRhythm {
	if (state.lastAt === null) return { ...state, updatedAt: now };
	const cooling = Math.max(0, now - Math.max(state.updatedAt, state.lastAt + 800));
	const beats = Math.max(0, state.beats - cooling / 500);
	if (beats === 0) return { ...emptyStillnessRhythm(), updatedAt: now };
	return {
		...state,
		beats,
		updatedAt: now,
		armed: state.armed && beats >= STILLNESS_BUILDUP_BEATS,
	};
}

export function stillnessIntensity(state: StillnessRhythm, now: number): number {
	if (state.beats <= 0 || state.startedAt === null) return 0;
	const countProgress = Math.min(1, state.beats / STILLNESS_BUILDUP_BEATS);
	const timeProgress = Math.min(1, Math.max(0, now - state.startedAt) / STILLNESS_BUILDUP_MS);
	return Math.max(0.06, Math.min(countProgress, timeProgress));
}

export function strikeStillnessRhythm(
	current: StillnessRhythm,
	key: RhythmKey,
	now: number,
): { state: StillnessRhythm; zeroed: boolean } {
	const state = coolStillnessRhythm(current, now);
	const gap = state.lastAt === null ? 0 : now - state.lastAt;
	if (state.lastKey === key) {
		const beats = Math.max(0, state.beats - 2);
		return {
			state: { ...state, beats, startedAt: beats > 0 ? state.startedAt : null, lastAt: now, armed: false, burst: 0, burstStartedAt: null },
			zeroed: false,
		};
	}
	if (state.armed) {
		const allowedGap = state.burst === 0 ? BURST_ENTRY_GRACE_MS : BURST_GAP_MS;
		if (gap > allowedGap || (state.burstStartedAt !== null && now - state.burstStartedAt > BURST_WINDOW_MS)) {
			return {
				state: { ...state, beats: STILLNESS_BUILDUP_BEATS - 2, armed: false, lastKey: key, lastAt: now, burst: 0, burstStartedAt: null },
				zeroed: false,
			};
		}
		const burst = state.burst + 1;
		return {
			state: { ...state, lastKey: key, lastAt: now, burst, burstStartedAt: state.burstStartedAt ?? now },
			zeroed: burst >= STILLNESS_BURST_BEATS,
		};
	}
	const startedAt = state.startedAt ?? now;
	const beats = Math.min(STILLNESS_BUILDUP_BEATS, state.beats + 1);
	return {
		state: {
			...state,
			beats,
			startedAt,
			lastKey: key,
			lastAt: now,
			armed: beats >= STILLNESS_BUILDUP_BEATS && now - startedAt >= STILLNESS_BUILDUP_MS,
		},
		zeroed: false,
	};
}
