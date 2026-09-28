import { collectEchoClue } from "@/utils/pulse-puzzle";

class ProjectEchoClue extends HTMLElement {
	private abort?: AbortController;

	connectedCallback(): void {
		this.abort?.abort();
		this.abort = new AbortController();
		this.querySelector("details")?.addEventListener(
			"toggle",
			(event) => {
				if ((event.currentTarget as HTMLDetailsElement).open)
					collectEchoClue();
			},
			{ signal: this.abort.signal },
		);
	}

	disconnectedCallback(): void {
		this.abort?.abort();
	}
}

export function registerProjectEchoClue(): void {
	if (!customElements.get("project-echo-clue"))
		customElements.define("project-echo-clue", ProjectEchoClue);
}
