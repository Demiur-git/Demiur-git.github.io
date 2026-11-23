import type { PuzzleProgress } from "./pulse-puzzle";

export const DEBUG_STORAGE_KEY = "palib-pulse-debug-v1";
/** Separate session storage; never reads, migrates or writes real localStorage. */
export class DebugProgressStore {
	private memory: PuzzleProgress | null = null;
	private loaded = false;
	constructor(
		private storage: () => Pick<Storage, "getItem" | "setItem" | "removeItem">,
	) {}
	read(): PuzzleProgress | null {
		if (!this.loaded) {
			this.loaded = true;
			try {
				const saved = JSON.parse(
					this.storage().getItem(DEBUG_STORAGE_KEY) || "null",
				);
				if (
					saved?.version === 1 &&
					saved.progress &&
					typeof saved.progress === "object"
				)
					this.memory = saved.progress;
			} catch {
				/* An unavailable store uses the current document's memory. */
			}
		}
		return this.memory ? structuredClone(this.memory) : null;
	}
	write(progress: PuzzleProgress): void {
		this.loaded = true;
		this.memory = structuredClone(progress);
		try {
			this.storage().setItem(
				DEBUG_STORAGE_KEY,
				JSON.stringify({ version: 1, progress: this.memory }),
			);
		} catch {
			/* Memory still works. */
		}
	}
	clear(): void {
		this.loaded = true;
		this.memory = null;
		try {
			this.storage().removeItem(DEBUG_STORAGE_KEY);
		} catch {
			/* Memory still works. */
		}
	}
}
export const debugProgress: DebugProgressStore =
	/* @__PURE__ */ new DebugProgressStore(() => window.sessionStorage);
