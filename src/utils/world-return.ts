import {
	acquireEasterEggMusic,
	releaseEasterEggMusic,
} from "./easter-egg-session";
import { url } from "./url-utils";

function visibleAnimation(
	duration: number,
	render: (progress: number) => void,
	signal: AbortSignal,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let frame = 0,
			last = 0,
			elapsed = 0;
		const clear = () => {
			cancelAnimationFrame(frame);
			document.removeEventListener("visibilitychange", visibility);
			signal.removeEventListener("abort", abort);
		};
		const abort = () => {
			clear();
			reject(new DOMException("Cancelled", "AbortError"));
		};
		const tick = (time: number) => {
			if (document.hidden) {
				last = 0;
				return;
			}
			elapsed += last ? Math.min(60, time - last) : 0;
			last = time;
			render(Math.min(1, elapsed / duration));
			if (elapsed >= duration) {
				clear();
				resolve();
			} else frame = requestAnimationFrame(tick);
		};
		const visibility = () => {
			cancelAnimationFrame(frame);
			last = 0;
			if (!document.hidden) frame = requestAnimationFrame(tick);
		};
		signal.addEventListener("abort", abort, { once: true });
		document.addEventListener("visibilitychange", visibility);
		if (signal.aborted) abort();
		else {
			render(0);
			visibility();
		}
	});
}

/** The modal belongs to the document, so it survives replacement of the world page. */
export async function returnHomeThroughWhite(
	source: HTMLElement,
	reduced: boolean,
	parentSignal: AbortSignal,
): Promise<boolean> {
	const controller = new AbortController(),
		signal = controller.signal,
		owner = {};
	const modal = document.createElement("dialog"),
		style = document.createElement("style");
	modal.className = "world-departure";
	modal.tabIndex = -1;
	modal.setAttribute("aria-label", "正在返回主页");
	style.textContent =
		".world-departure{position:fixed!important;inset:0!important;margin:0!important;padding:0!important;border:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;overflow:hidden!important;background:transparent;color:transparent;touch-action:none;outline:0!important}.world-departure::backdrop{background:transparent!important}";
	modal.append(style);
	document.body.append(modal);
	modal.showModal();
	modal.focus();
	acquireEasterEggMusic(owner);
	let navigating = false;
	const abort = () => controller.abort();
	const sourceAbort = () => {
		if (!navigating) abort();
	};
	parentSignal.addEventListener("abort", sourceAbort, { once: true });
	window.addEventListener("pagehide", abort, { once: true });
	modal.addEventListener("cancel", (event) => event.preventDefault(), {
		signal,
	});
	modal.addEventListener("keydown", (event) => event.preventDefault(), {
		signal,
	});
	modal.addEventListener("wheel", (event) => event.preventDefault(), {
		signal,
		passive: false,
	});
	try {
		await visibleAnimation(
			reduced ? 60 : 500,
			(progress) => {
				if (reduced) {
					modal.style.background = "#f2f2ef";
					modal.style.opacity = String(progress);
					return;
				}
				const radius =
					(Math.hypot(innerWidth, innerHeight) / 2 + 36) * progress;
				modal.style.background = `radial-gradient(circle at 50% 50%,#f2f2ef 0px,#f2f2ef ${Math.max(0, radius - 24)}px,rgba(242,242,239,0) ${Math.max(1, radius)}px)`;
			},
			signal,
		);
		modal.style.background = "#f2f2ef";
		modal.style.opacity = "1";
		const home = url("/"),
			swup = window.swup;
		if (!swup) throw new Error("Navigation unavailable");
		// Validate before committing navigation; a failed request must leave the throne intact.
		const response = await fetch(home, {
			headers: { "X-Requested-With": "swup" },
			signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
		});
		if (!response.ok) throw new Error("Home request failed");
		const html = await response.text(),
			parsed = new DOMParser().parseFromString(html, "text/html");
		if (
			!(swup.options.containers as string[]).every((selector) =>
				parsed.querySelector(selector),
			)
		)
			throw new Error("Incomplete homepage");
		signal.throwIfAborted();
		swup.cache.set(home, { url: home, html });
		navigating = true;
		await new Promise<void>((resolve, reject) => {
			const token = {};
			let timer = 0;
			type Visit = { to: { url: string }; meta?: { worldReturn?: object } };
			const clear = () => {
				clearTimeout(timer);
				swup.hooks.off("visit:end", end);
				swup.hooks.off("visit:abort", failed);
				swup.hooks.off("visit:start", start);
				signal.removeEventListener("abort", cancel);
			};
			const cancel = () => {
				clear();
				reject(new DOMException("Cancelled", "AbortError"));
			};
			const failed = (visit: Visit) => {
				if (visit.meta?.worldReturn === token) {
					clear();
					reject(new Error("Navigation interrupted"));
				}
			};
			const start = (visit: Visit) => {
				if (visit.meta?.worldReturn !== token) cancel();
			};
			const end = (visit: Visit) => {
				if (visit.meta?.worldReturn === token) {
					clear();
					resolve();
				}
			};
			swup.hooks.on("visit:end", end);
			swup.hooks.on("visit:abort", failed);
			swup.hooks.on("visit:start", start);
			signal.addEventListener("abort", cancel, { once: true });
			timer = window.setTimeout(() => {
				clear();
				reject(new Error("Navigation timeout"));
			}, 15000);
			try {
				swup.navigate(home, {
					animate: false,
					cache: { read: true },
					meta: { worldReturn: token },
				});
			} catch (error) {
				clear();
				reject(error);
			}
		});
		await visibleAnimation(
			reduced ? 60 : 250,
			(progress) => {
				modal.style.opacity = String(1 - progress);
			},
			signal,
		);
		return true;
	} catch {
		if (source.isConnected && !signal.aborted)
			await visibleAnimation(
				120,
				(progress) => {
					modal.style.opacity = String(1 - progress);
				},
				signal,
			).catch(() => {});
		return false;
	} finally {
		parentSignal.removeEventListener("abort", sourceAbort);
		window.removeEventListener("pagehide", abort);
		controller.abort();
		modal.close();
		modal.remove();
		releaseEasterEggMusic(owner);
		if (!source.isConnected) {
			const main = document.querySelector<HTMLElement>("main");
			main?.setAttribute("tabindex", "-1");
			main?.focus({ preventScroll: true });
		}
	}
}
