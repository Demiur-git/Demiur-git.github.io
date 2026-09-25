/** Keep Vite's live style nodes when Swup merges a cached SSR document in dev. */
export function preserveLiveDevStyles(currentHead: HTMLHeadElement, nextHead: HTMLHeadElement): void {
	const selector = "style[data-vite-dev-id]";
	const incoming = new Map<string, HTMLStyleElement[]>();
	for (const style of nextHead.querySelectorAll<HTMLStyleElement>(selector)) {
		const id = style.dataset.viteDevId!;
		incoming.set(id, [...(incoming.get(id) ?? []), style]);
	}
	// An island can briefly have an SSR style followed by Vite's injected copy.
	// The last copy is the live one and owns subsequent HMR updates.
	const liveStyles = new Map<string, HTMLStyleElement>();
	for (const style of currentHead.querySelectorAll<HTMLStyleElement>(selector)) {
		liveStyles.set(style.dataset.viteDevId!, style);
	}
	for (const live of liveStyles.values()) {
		const matches = incoming.get(live.dataset.viteDevId!);
		const copy = live.cloneNode(true);
		if (matches?.length) {
			matches[0].replaceWith(copy);
			for (const duplicate of matches.slice(1)) duplicate.remove();
		} else {
			// Vite retains references to these nodes for HMR, including styles of
			// previously visited islands. Removing them breaks later live updates.
			nextHead.append(copy);
		}
	}
}
