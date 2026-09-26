export type WalineInstance = {
	destroy(): void;
};

export function init(options: Record<string, unknown>): WalineInstance | null;
