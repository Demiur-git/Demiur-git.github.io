import { pulsePuzzle } from "../config/pulsePuzzle";
import { debugProgress } from "./pulse-debug-store";
import { emptyProgress, type PuzzleProgress } from "./pulse-puzzle";
import { pulseScenePath } from "./pulse-route";
import { url } from "./url-utils";

let installed = false;
type Item = {
	label: string;
	path?: string;
	scene?: string;
	stage?: string;
	preset?: "echo" | "rhythm";
};
const items: Item[] = [
	{ label: "心电图", scene: "pulse-scene" },
	{ label: "王座", path: "/newworld/", scene: "new-world-scene" },
	{ label: "星空", path: "/starfield/", scene: "starfield-scene" },
	{ label: "裂缝", path: "/echo/", scene: "echo-scene" },
	{ label: "白色空间", path: "/echo/white/", scene: "echo-white-scene" },
	{ label: "静止空间", path: "/stillness/", scene: "stillness-scene" },
	{ label: "立即显示灰痕", stage: "residue", preset: "echo" },
	{ label: "共振初始状态", stage: "resonance", preset: "echo" },
	{ label: "空白摩斯面板", stage: "morse" },
	{ label: "准备 J／K 前置", stage: "rhythm", preset: "rhythm" },
	{ label: "重播王座入场", stage: "entry-newworld" },
	{ label: "重播星空入场", stage: "entry-starfield" },
	{ label: "重播裂缝入场", stage: "entry-echo" },
	{ label: "两轮灰化扫线", stage: "flatline", preset: "rhythm" },
	{
		label: "王座对白起点",
		path: "/newworld/",
		scene: "new-world-scene",
		stage: "dialogue",
	},
];

export function initPulseDebug(): void {
	if (!import.meta.env.DEV || installed) return;
	installed = true;
	const style = document.createElement("style");
	style.textContent = `
	[data-pulse-debug-toggle]{position:fixed;left:12px;top:12px;z-index:2147483647;padding:9px 12px;min-height:44px;background:#222;color:#eee;border:1px solid #888;border-radius:4px;font:12px system-ui;cursor:pointer;}
	[data-pulse-debug-panel]{margin:auto;max-width:min(640px,calc(100vw - 28px));width:640px;max-height:calc(100dvh - 36px);overflow:auto;padding:22px;background:#f5f3ee;color:#222;border:1px solid #777;border-radius:8px;font:14px/1.6 system-ui;}
	[data-pulse-debug-panel]::backdrop{background:#0008;}[data-pulse-debug-panel] h2{font-size:20px;margin:0 0 8px;}[data-pulse-debug-panel] p{margin:8px 0 14px;}
	[data-pulse-debug-panel] .debug-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}[data-pulse-debug-panel] button{padding:9px;min-height:44px;background:#fff;border:1px solid #aaa;border-radius:4px;color:#222;cursor:pointer;font:inherit;}
	[data-pulse-debug-panel] button:disabled{opacity:.5;cursor:wait;}[data-pulse-debug-panel] button:focus-visible,[data-pulse-debug-toggle]:focus-visible{outline:3px solid #a75260;outline-offset:2px;}[data-pulse-debug-panel] footer{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;}
	@media(max-width:480px){[data-pulse-debug-panel]{padding:16px;}[data-pulse-debug-panel] .debug-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
	`;
	// Swup replaces head styles; keep this development UI outside the page container.
	document.body.append(style);
	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.dataset.pulseDebugToggle = "";
	const panel = document.createElement("dialog");
	panel.dataset.pulseDebugPanel = "";
	panel.setAttribute("aria-label", "本地彩蛋调试台");
	panel.innerHTML =
		'<h2>彩蛋调试台 · 仅本地开发</h2><p>选择测试项后启用独立临时进度。关闭面板继续测试；退出调试恢复真实记录。</p><div class="debug-grid"></div><p data-debug-status role="status"></p><footer><button data-debug-reset>重置调试进度</button><button data-debug-exit>退出调试</button><button data-debug-close>关闭面板</button></footer>';
	document.body.append(panel);
	const grid = panel.querySelector<HTMLElement>(".debug-grid")!;
	const status = panel.querySelector<HTMLElement>("[data-debug-status]")!;
	let busy = false;
	const label = () => {
		toggle.textContent = debugProgress.read()
			? "本地调试中 · 彩蛋"
			: "彩蛋调试";
	};
	const relocate = () => {
		const host =
			document.querySelector("dialog[open]:not([data-pulse-debug-panel])") ||
			document.body;
		if (toggle.parentElement !== host) host.append(toggle);
	};
	const observer = new MutationObserver(relocate);
	observer.observe(document.body, { childList: true, subtree: true });
	relocate();
	label();
	const close = () => {
		if (busy) return;
		panel.close();
		delete document.documentElement.dataset.pulseDebugOpen;
		if (toggle.isConnected) toggle.focus({ preventScroll: true });
	};
	const open = () => {
		if (panel.open) {
			close();
			return;
		}
		window.dispatchEvent(new Event("palib:debug-pause"));
		document.documentElement.dataset.pulseDebugOpen = "";
		panel.showModal();
		panel.querySelector<HTMLButtonElement>("[data-debug-close]")!.focus();
	};
	toggle.addEventListener("click", open);
	panel.addEventListener("cancel", (e) => {
		e.preventDefault();
		close();
	});
	window.addEventListener(
		"keydown",
		(e) => {
			if (e.ctrlKey && e.altKey && e.code === "KeyD") {
				e.preventDefault();
				e.stopImmediatePropagation();
				open();
			} else if (panel.open && e.key === "Escape") {
				e.preventDefault();
				e.stopImmediatePropagation();
				close();
			}
		},
		true,
	);
	panel.querySelector("[data-debug-close]")!.addEventListener("click", close);
	const notify = () => {
		label();
		window.dispatchEvent(new Event("pulse:progress"));
	};
	const navigate = async (path: string, selector: string): Promise<Element> => {
		if (!window.swup) throw new Error("站内切页尚未就绪，请稍后重试。");
		const old = document.querySelector(selector);
		// A fresh URL also reloads the current scene after a browser refresh.
		window.swup.navigate(`${path}?__pulse_debug=${Date.now()}`, {
			animate: false,
		});
		const started = performance.now();
		while (performance.now() - started < 10000) {
			const next = document.querySelector(selector);
			if (
				location.pathname.replace(/\/+$/, "") === path.replace(/\/+$/, "") &&
				next &&
				next !== old &&
				(!selector.endsWith("-scene") ||
					(next as HTMLElement).dataset.ready === "true")
			) {
				history.replaceState(history.state, "", path);
				return next;
			}
			await new Promise((resolve) => setTimeout(resolve, 40));
		}
		throw new Error("页面未能就绪，临时进度仍保留，请重试。");
	};
	const run = async (operation: () => Promise<void>) => {
		if (busy) return;
		busy = true;
		status.textContent = "正在准备测试场景……";
		panel.querySelectorAll("button").forEach((b) => (b.disabled = true));
		try {
			await operation();
			status.textContent = "";
			busy = false;
			close();
		} catch (error) {
			status.textContent =
				error instanceof Error ? error.message : "无法打开，请重试。";
		} finally {
			busy = false;
			panel.querySelectorAll("button").forEach((b) => (b.disabled = false));
			label();
		}
	};
	const preset = (item: Item): PuzzleProgress => ({
		...emptyProgress(),
		started: true,
		collected: pulsePuzzle.clues.map((c) => c.id),
		scraps: pulsePuzzle.scraps.map((s) => s.id),
		unlocked: true,
		worldUnlocked: true,
		starfieldUnlocked: true,
		echoClueSeen: true,
		echoUnlocked: item.preset !== "echo",
		stillnessUnlocked: !item.preset,
	});
	for (const item of items) {
		const button = document.createElement("button");
		button.textContent = item.label;
		button.type = "button";
		button.addEventListener(
			"click",
			() =>
				void run(async () => {
					debugProgress.write(preset(item));
					label();
					const scene = await navigate(
						item.path ? url(item.path) : pulseScenePath(),
						item.scene || "pulse-scene",
					);
					if (item.stage)
						scene.dispatchEvent(
							new CustomEvent("palib:debug-stage", { detail: item.stage }),
						);
				}),
		);
		grid.append(button);
	}
	panel.querySelector("[data-debug-reset]")!.addEventListener(
		"click",
		() =>
			void run(async () => {
				await navigate(url("/music/"), "#swup-container");
				debugProgress.write(emptyProgress());
				notify();
			}),
	);
	panel.querySelector("[data-debug-exit]")!.addEventListener(
		"click",
		() =>
			void run(async () => {
				// Keep the sandbox until all old scenes have unmounted, so late writes stay isolated.
				await navigate(url("/music/"), "#swup-container");
				debugProgress.clear();
				notify();
			}),
	);
}
