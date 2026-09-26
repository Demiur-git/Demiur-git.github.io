type WalineInstance = { destroy(): void };
type WalineModule = { init(options: Record<string, unknown>): WalineInstance | null };
let clientPromise: Promise<WalineModule> | undefined;

function loadClient(): Promise<WalineModule> {
	if (!clientPromise) {
		const moduleURL = "/vendor/waline-3.15.2/waline.js";
		clientPromise = import(/* @vite-ignore */ moduleURL).catch((error: unknown) => {
			clientPromise = undefined;
			throw error;
		});
	}
	return clientPromise;
}

class WalineComments extends HTMLElement {
	private instance: WalineInstance | null = null;
	private controller?: AbortController;
	private generation = 0;
	private pending = false;
	connectedCallback(): void {
		this.addEventListener("click", this.handleClick);
		void this.connect();
	}
	disconnectedCallback(): void {
		this.generation++;
		this.controller?.abort();
		this.instance?.destroy();
		this.instance = null;
		this.pending = false;
		this.removeEventListener("click", this.handleClick);
	}
	private handleClick = (event: Event): void => {
		if ((event.target as Element).closest("[data-waline-retry]")) void this.connect();
	};
	private setStatus(message: string, retry = false): void {
		const status = this.querySelector<HTMLElement>("[data-waline-status]");
		const button = this.querySelector<HTMLButtonElement>("[data-waline-retry]");
		if (status) status.textContent = message;
		if (button) { button.hidden = !retry; button.disabled = this.pending; }
	}
	private async connect(): Promise<void> {
		if (this.pending) return;
		const config = JSON.parse(this.dataset.config || "{}") as Record<string, unknown>;
		const serverURL = String(config.serverURL || "").trim();
		if (!serverURL) { this.setStatus("留言尚未开放：尚未配置 Waline 服务地址。"); return; }
		this.pending = true;
		this.instance?.destroy();
		this.instance = null;
		this.setStatus("正在连接留言服务…");
		const generation = ++this.generation;
		this.controller?.abort();
		const controller = new AbortController();
		this.controller = controller;
		const timeout = window.setTimeout(() => controller.abort(), 8000);
		try {
			// Only the memo embed may select a memo path; normal pages ignore ?path=.
			if (window.location.pathname === "/dynamic/comments/") {
				const requested = new URLSearchParams(window.location.search).get("path");
				if (requested && /^\/dynamic\/[^/?#]+\/$/.test(requested)) config.path = requested;
			}
			const endpoint = new URL(`${serverURL.replace(/\/$/, "")}/api/comment`);
			endpoint.searchParams.set("path", String(config.path));
			const response = await fetch(endpoint, { signal: controller.signal });
			if (!response.ok) throw new Error("Service unavailable");
			const result = await response.json() as { errno?: number };
			if (result.errno !== 0) throw new Error("Invalid service response");
			const client = await loadClient();
			if (!this.isConnected || generation !== this.generation) return;
			const mount = this.querySelector<HTMLElement>("[data-waline-mount]");
			if (!mount) return;
			this.instance = client.init({ ...config, el: mount });
			if (!this.instance) throw new Error("Client unavailable");
			this.pending = false;
			this.setStatus("", true);
		} catch {
			if (!this.isConnected || generation !== this.generation) return;
			this.pending = false;
			this.setStatus("留言服务暂时无法连接，请稍后重试。未自动提交任何留言。", true);
		} finally {
			window.clearTimeout(timeout);
			if (generation === this.generation) this.pending = false;
		}
	}
}
if (!customElements.get("waline-comments")) customElements.define("waline-comments", WalineComments);
