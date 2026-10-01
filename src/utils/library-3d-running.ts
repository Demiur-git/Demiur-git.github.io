export interface RunningReminder {
	running: number;
	idle: number;
	cooldown: number;
	visible: number;
}
export const freshRunningReminder = (): RunningReminder => ({
	running: 0,
	idle: 0,
	cooldown: 0,
	visible: 0,
});
/** Time is supplied only by foreground frames; blocked movement is not running. */
export function advanceRunningReminder(
	state: RunningReminder,
	seconds: number,
	actuallyRunning: boolean,
): RunningReminder {
	const dt = Math.max(0, Math.min(0.5, seconds));
	const next = {
		...state,
		cooldown: Math.max(0, state.cooldown - dt),
		visible: Math.max(0, state.visible - dt),
	};
	if (actuallyRunning) {
		next.running += dt;
		next.idle = 0;
	} else {
		next.idle += dt;
		if (next.idle >= 2) next.running = 0;
	}
	if (next.running >= 12 && next.cooldown <= 0 && next.visible <= 0) {
		next.visible = 5;
		next.cooldown = 45;
		next.running = 0;
	}
	return next;
}
