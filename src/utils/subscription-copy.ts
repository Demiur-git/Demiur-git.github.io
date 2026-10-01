class SubscriptionCopy extends HTMLElement {
	private timers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
	private generation = 0;

	connectedCallback(): void {
		this.generation++;
		this.addEventListener("click", this.handleClick);
	}

	disconnectedCallback(): void {
		this.generation++;
		this.removeEventListener("click", this.handleClick);
		for (const timer of this.timers.values()) clearTimeout(timer);
		this.timers.clear();
		for (const button of this.querySelectorAll<HTMLButtonElement>(
			"[data-subscription-copy]",
		))
			button.disabled = false;
		for (const status of this.querySelectorAll("[data-copy-status]"))
			status.textContent = "";
	}

	private handleClick = (event: Event): void => {
		if (!(event.target instanceof Element)) return;
		const button = event.target.closest<HTMLButtonElement>(
			"[data-subscription-copy]",
		);
		if (!button || !this.contains(button) || button.disabled) return;
		void this.copy(button);
	};

	private async copy(button: HTMLButtonElement): Promise<void> {
		const address = button.dataset.subscriptionCopy;
		const status = button
			.closest("article")
			?.querySelector<HTMLElement>("[data-copy-status]");
		if (!address || !status) return;
		const generation = this.generation;
		clearTimeout(this.timers.get(button));
		this.timers.delete(button);
		button.disabled = true;
		let message: string;
		try {
			await navigator.clipboard.writeText(address);
			message = "地址已复制，请添加到你的阅读器。";
		} catch {
			message = "复制失败，请选中上方地址手动复制。";
		}
		if (!this.isConnected || generation !== this.generation) return;
		button.disabled = false;
		status.textContent = message;
		this.timers.set(
			button,
			setTimeout(() => {
				status.textContent = "";
				this.timers.delete(button);
			}, 5000),
		);
	}
}

export function registerSubscriptionCopy(): void {
	if (!customElements.get("subscription-copy"))
		customElements.define("subscription-copy", SubscriptionCopy);
}
