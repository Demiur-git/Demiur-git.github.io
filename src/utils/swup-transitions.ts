import { crossesSections } from "./navigation-section";
import {
	expressiveCodeConfig,
	navbarMode,
	pageTransitionConfig,
	siteConfig,
} from "@/config";
import type { WALLPAPER_MODE } from "@/types/config";
import { scheduleContentOverflowEnhancements } from "@/utils/content-overflow-utils";
import { initializeFloatingPanels } from "@/utils/floating-panel-utils";
import {
	syncFullscreenBlur,
	syncFullscreenOverlays,
	updateFullscreenTitleParallax,
} from "@/utils/fullscreen-wallpaper-utils";
import {
	updateMainGridCols,
	updateSidebarComponentsVisibility,
} from "@/utils/grid-layout-utils";
import { scrollFunction } from "@/utils/scroll-utils";
import {
	syncBannerHomeTextVisibility,
	updateNavbarTransparency,
} from "@/utils/setting-utils";
import { isHomePage as isHomePath } from "@/utils/layout-utils";
import { hasSeenHomeEntrance } from "@/utils/home-entrance-session";
import { pathsEqual, url } from "@/utils/url-utils";
import { preserveLiveDevStyles } from "@/utils/swup-dev-styles";
import { isEasterEggPath, resumeEasterEggMusicIfOutside } from "@/utils/easter-egg-session";

let pageTurnActive = false;
let pageTurnReadyAt = 0;
let pageTurnRevealReadyAt = 0;
let pageTurnGeneration = 0;
let activePageTurnVisit: object | null = null;
let activeHomeEntranceVisit: object | null = null;
const pendingPageTurnWaits = new Set<() => void>();

function relativePath(pathname: string): string {
	const base = new URL(url("/"), location.href).pathname;
	return pathname.startsWith(base) ? "/" + pathname.slice(base.length) : pathname;
}

interface MotionVisit {
	from: { url: string };
	to: { url: string };
	history: { popstate: boolean };
	animation: { animate: boolean; selector: string | false; wait: boolean };
}

function destinationLabel(destination: string): string {
	const pathname = new URL(destination, window.location.href).pathname;
	const normalized = "/" + relativePath(pathname).split("/").filter(Boolean).join("/") + "/";
	const labels = pageTransitionConfig.destinationLabels;
	if (labels[normalized]) return labels[normalized];
	if (normalized.startsWith("/posts/")) return "Articles";
	if (normalized.startsWith("/library/posts/")) return "Articles";
	if (normalized.startsWith("/dynamic/")) return "Memos";
	if (normalized.startsWith("/gallery/")) return "Gallery";
	if (normalized.startsWith("/projects/")) return "Projects";
	return "New Page";
}

function shouldTurnPage(destination: string, source: string): boolean {
	if (!pageTransitionConfig.enable) return false;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
		return false;
	try {
		const next = new URL(destination, window.location.href);
		const current = new URL(source, window.location.origin);
		return (
			next.origin === window.location.origin &&
			crossesSections(relativePath(current.pathname), relativePath(next.pathname)) &&
			!isEasterEggPath(next.pathname) &&
			!isEasterEggPath(current.pathname) &&
			!isHomePath(next.pathname) &&
			(next.pathname !== current.pathname || next.search !== current.search)
		);
	} catch {
		return false;
	}
}

function clearPageTurnState(): void {
	pageTurnGeneration++;
	for (const cancel of pendingPageTurnWaits) cancel();
	pendingPageTurnWaits.clear();
	document.dispatchEvent(new Event("firefly:book-transition-reset"));
	document.documentElement.classList.remove(
		"is-page-turning",
		"book-turn-enter",
		"book-turn-reveal",
	);
	pageTurnActive = false;
	activePageTurnVisit = null;
	pageTurnReadyAt = 0;
	pageTurnRevealReadyAt = 0;
}

async function waitUntil(deadline: number): Promise<void> {
	if (!pageTurnActive || deadline <= 0) return;
	const generation = pageTurnGeneration;
	const remaining = Math.max(0, deadline - performance.now());
	if (remaining > 0) {
		await new Promise<void>((resolve) => {
			let timer = 0;
			const finish = () => {
				window.clearTimeout(timer);
				pendingPageTurnWaits.delete(finish);
				resolve();
			};
			pendingPageTurnWaits.add(finish);
			timer = window.setTimeout(finish, remaining);
		});
	}
	if (generation !== pageTurnGeneration) return;
}

function startPageTurn(destination: string, source: string, enabled: boolean): void {
	clearPageTurnState();
	pageTurnActive = enabled && shouldTurnPage(destination, source);
	if (!pageTurnActive) return;
	const { enter, open, writeMin, writeMax, writePerCharacter, hold } =
		pageTransitionConfig.timing;
	const title = destinationLabel(destination);
	const characterCount = Array.from(title.replace(/\s/gu, "")).length;
	const write = Math.max(writeMin, Math.min(writeMax, characterCount * writePerCharacter));
	const startedAt = performance.now();
	pageTurnReadyAt = startedAt + enter + open + write + hold;
	// 连续导航时强制提交清理状态，确保同名 CSS 动画能够从头开始。
	const overlay = document.getElementById("page-turn-overlay");
	document.dispatchEvent(
		new CustomEvent("firefly:book-transition-start", {
			detail: { title, startAt: startedAt + enter + open, duration: write },
		}),
	);
	if (overlay) void overlay.offsetWidth;
	const root = document.documentElement;
	root.classList.add("is-page-turning", "book-turn-enter");
}

function revealPageTurn(): void {
	if (!pageTurnActive) return;
	const root = document.documentElement;
	root.classList.remove("book-turn-enter");
	root.classList.add("book-turn-reveal");
	pageTurnRevealReadyAt =
		performance.now() + pageTransitionConfig.timing.reveal;
}

function finishPageTurn(): void {
	if (!pageTurnActive) return;
	clearPageTurnState();
}

/**
 * 进度条：WAAPI 驱动 transform/opacity（合成线程动画）。
 * 替代原 width 关键帧 + `void offsetWidth` 强制回流方案——后者在大型文章 DOM 上
 * 会触发整棵布局树同步重排，正是切页卡顿来源之一。
 */
function startProgressBar(): void {
	const bar = document.getElementById("progress-bar");
	if (!bar) return;
	bar.getAnimations().forEach((a) => {
		a.cancel();
	});
	bar.animate(
		[
			{ transform: "scaleX(0)", opacity: 1 },
			{ transform: "scaleX(0.95)", opacity: 1 },
		],
		{
			duration: 8000,
			easing: "cubic-bezier(0.1, 0.05, 0.1, 1)",
			fill: "forwards",
		},
	);
}

function finishProgressBar(): void {
	const bar = document.getElementById("progress-bar");
	if (!bar) return;
	bar.getAnimations().forEach((a) => {
		a.cancel();
	});
	bar.animate(
		[
			{ transform: "scaleX(1)", opacity: 1 },
			{ transform: "scaleX(1)", opacity: 0 },
		],
		{ duration: 500, easing: "ease-out", fill: "forwards" },
	);
}

/**
 * Swup 页面切换编排（从 Layout.astro 迁出）。
 * 注册 link:click / content:replace / visit:start / page:view / visit:end 钩子。
 */
function registerSwupHooks(): void {
	const positions = new Map<number, number>();
	let displayedIndex: number = history.state?.index ?? 1;
	history.scrollRestoration = "manual";
	window.swup.hooks.on("content:scroll", (visit: MotionVisit) => {
		displayedIndex = history.state?.index ?? displayedIndex;
		const saved = positions.get(displayedIndex);
		if (visit.history.popstate && saved !== undefined)
			window.scrollTo({ top: saved, behavior: "instant" });
	});
	if (import.meta.env.DEV) {
		// Run before SwupHeadPlugin (priority 0). Cached SSR styles can predate
		// HMR and otherwise replace the live global CSS on the second visit.
		window.swup.hooks.before("content:replace", (visit: { to: { document: Document } }) => {
			preserveLiveDevStyles(document.head, visit.to.document.head);
		}, { priority: -100 });
	}
	// 非首页全屏模式与 overlay 一致（内容在最上面），首页 hero 结构回顶即可，
	// 均无需自定义 swup 回顶行为，保留默认滚动到顶部
	// TODO: temp solution to change the height of the banner
	window.swup.hooks.on(
		"link:click",
		(_visit: unknown, { el }: { el: HTMLAnchorElement }) => {
			// Remove the delay for the first time page load
			document.documentElement.style.setProperty("--content-delay", "0ms");

			// 同页链接点击不需要过渡保护
			const targetHref = el.getAttribute("href") || "";
			const targetPathname = (() => {
				try {
					return new URL(targetHref, window.location.href).pathname;
				} catch {
					return targetHref;
				}
			})();
			const isSamePage = pathsEqual(targetPathname, window.location.pathname);
			if (isSamePage) {
				document.documentElement.classList.remove("is-page-transitioning");
			}
			if (!isSamePage) {
				// 添加页面切换保护，防止导航栏闪烁
				document.documentElement.classList.add("is-page-transitioning");
			}

			const navbar = document.getElementById("navbar-wrapper");
			if (navbar && navbarMode === "dynamic") {
				// 切页时先显示导航栏，避免新页从隐藏态开始；滚动逻辑会随滚动位置重新判断
				navbar.classList.remove("navbar-hidden");
				document.body.classList.remove("dynamic-navbar-hidden");
			} else if (navbar) {
				// fixed / static：切页时先显示导航栏，避免残留上一页（如滚到底部时隐藏）的 navbar-hidden，
				// 否则从其它页面切回首页时导航栏会保持隐藏、不再跨壁纸显示
				navbar.classList.remove("navbar-hidden");
			}
		},
	);
	window.swup.hooks.before("content:replace", async (visit: object) => {
		// 内容就绪后等待右页写完；加载较慢时保持展开的书本。
		if (visit === activePageTurnVisit) await waitUntil(pageTurnReadyAt);
	});
	window.swup.hooks.on("content:replace", (visit: object) => {
		document.body.classList.toggle("is-home", isHomePath(location.pathname));
		if (visit === activePageTurnVisit) revealPageTurn();
		if (visit === activeHomeEntranceVisit)
			document.dispatchEvent(new Event("firefly:home-entrance-ready"));
		initializeFloatingPanels();

		// 侧边栏组件可见性由 page:view 统一更新（含 refreshSidebarStickyState 的
		// offsetHeight 布局读取），content:replace 不重复执行，避免每趟切页强制布局两次

		// 只处理katex元素的容器，使用浏览器原生滚动条
		scheduleContentOverflowEnhancements();

		// 重新初始化图标加载器
		import("@/utils/icon-loader").then(({ initIconLoader }) => {
			initIconLoader();
		});

		// 重新初始化semifull模式的滚动检测
		// （全屏模式跳过：导航栏状态由 updateNavbarTransparency 统一管理，
		//   避免切换页面时 initSemifullScrollDetection 重置 scrolled 导致背景闪烁）
		const navbar = document.getElementById("navbar");
		if (navbar) {
			const transparentMode = navbar.getAttribute("data-transparent-mode");
			const navWallpaperMode = document.documentElement.getAttribute(
				"data-wallpaper-mode",
			);

			if (transparentMode === "semifull" && navWallpaperMode !== "fullscreen") {
				// 重新调用初始化函数来重新绑定滚动事件
				if (typeof window.initSemifullScrollDetection === "function") {
					window.initSemifullScrollDetection();
				}
			}
		}
	});
	window.swup.hooks.on("animation:in:await", async (visit: object) => {
		// 保证揭页完整离场后再结束本次访问，避免遮罩被提前清理。
		if (visit === activePageTurnVisit) await waitUntil(pageTurnRevealReadyAt);
	});
	window.swup.hooks.on("visit:start", (visit: MotionVisit) => {
		// visit:start 同时覆盖普通链接和浏览器前进/后退。
		const destinationPath = new URL(visit.to.url, window.location.href).pathname;
		const sourcePath = new URL(visit.from.url, window.location.href).pathname;
		const enteringHome = isHomePath(destinationPath) && !isHomePath(sourcePath);
		const playHomeEntrance = enteringHome && !isEasterEggPath(sourcePath) && !hasSeenHomeEntrance() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (playHomeEntrance) document.dispatchEvent(new Event("firefly:home-entrance-start"));
		else document.dispatchEvent(new Event("firefly:home-entrance-cancel"));
		activeHomeEntranceVisit = playHomeEntrance ? visit : null;
		positions.set(displayedIndex, window.scrollY);
		const ordinary = !playHomeEntrance && !isEasterEggPath(destinationPath) && !isEasterEggPath(sourcePath);
		if (visit.history.popstate && ordinary) visit.animation.animate = true;
		startPageTurn(visit.to.url, visit.from.url, ordinary && !visit.history.popstate && visit.animation.animate);
		document.documentElement.dataset.navigationMotion = pageTurnActive ? "book" : ordinary ? "fade" : "scene";
		if (ordinary) {
			visit.animation.selector = pageTurnActive ? false : "#swup-container";
			visit.animation.wait = !pageTurnActive;
		}
		activePageTurnVisit = pageTurnActive ? visit : null;
		// Start progress bar（WAAPI 合成线程动画，不强制回流）
		startProgressBar();

		const isHomePage = isHomePath(destinationPath);
		// Control navbar transparency based on page
		const navbar = document.getElementById("navbar");
		if (navbar) {
			navbar.setAttribute("data-is-home", isHomePage.toString());

			// 重新初始化semifull模式的滚动检测
			// （全屏模式跳过：导航栏状态由 updateNavbarTransparency 统一管理，
			//   避免切换页面时 initSemifullScrollDetection 重置 scrolled 导致背景闪烁）
			const transparentMode = navbar.getAttribute("data-transparent-mode");
			const navWallpaperMode = document.documentElement.getAttribute(
				"data-wallpaper-mode",
			);
			if (transparentMode === "semifull" && navWallpaperMode !== "fullscreen") {
				// 重新调用初始化函数来重新绑定滚动事件
				if (typeof window.initSemifullScrollDetection === "function") {
					window.initSemifullScrollDetection();
				}
			}
		}

		// 在移动端禁用文章列表容器的过渡动画，防止与主内容区位置变化冲突
		if (window.innerWidth < 1024) {
			const postListContainer = document.getElementById("post-list-container");
			if (postListContainer) {
				postListContainer.style.transition = "none";
			}
		}
	});
	window.swup.hooks.on("page:view", () => {
		resumeEasterEggMusicIfOutside();
		// 更新网格列数和侧边栏组件可见性
		updateMainGridCols();
		updateSidebarComponentsVisibility();

		// 过渡结束后再量一次，避免顶部组件未就绪时读到 offsetHeight=0 而误删 mb-4
		// (sticky 与 top 组件之间间距只在 refreshSidebarStickyState 里恢复，延迟补偿一次更稳)
		window.setTimeout(() => updateSidebarComponentsVisibility(), 300);

		// 页面切换完成后，同步全屏模式的标题视差位移（Swup 已替换容器内容）
		updateFullscreenTitleParallax();
		syncFullscreenOverlays();
		syncFullscreenBlur();
		// 页面切换后同步首页标题显隐（body.is-home 已更新，按新页面重算 hidden 类）
		syncBannerHomeTextVisibility();
		// 页面切换后按新页面刷新导航栏透明状态（全屏首页动态透明 / 非首页完全透明）
		updateNavbarTransparency(
			document.documentElement.getAttribute(
				"data-wallpaper-mode",
			) as WALLPAPER_MODE,
		);

		// 在移动端恢复文章列表容器的过渡动画（在主内容区位置动画完成后）
		const isMobile = window.innerWidth < 1024;
		if (isMobile) {
			setTimeout(() => {
				const postListContainer = document.getElementById(
					"post-list-container",
				);
				if (postListContainer) {
					postListContainer.style.transition = "";
				}
			}, 600); // 等待主内容区动画完成（0.4s + 0.1s delay + 100ms buffer）
		}

		// 同步主题状态 - 解决从首页进入文章页面时代码块渲染问题
		const storedTheme =
			localStorage.getItem("theme") ||
			siteConfig.themeColor.defaultMode ||
			"light";
		let isDark = false;

		// 处理 system 模式
		if (storedTheme === "system") {
			isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		} else {
			isDark = storedTheme === "dark";
		}

		const expectedTheme = isDark
			? expressiveCodeConfig.darkTheme
			: expressiveCodeConfig.lightTheme;
		const currentTheme = document.documentElement.getAttribute("data-theme");

		// 如果主题不匹配，静默更新（不触发事件，避免重新加载效果）
		if (currentTheme !== expectedTheme) {
			document.documentElement.setAttribute("data-theme", expectedTheme);
		}

		// 检查当前页面是否为文章页面，如果是则触发自定义事件用于初始化评论系统
		setTimeout(() => {
			if (document.getElementById("tcomment")) {
				// 触发自定义事件，通知评论系统页面已完全加载
				const pageLoadedEvent = new CustomEvent("firefly:page:loaded", {
					detail: {
						path: window.location.pathname,
						timestamp: Date.now(),
					},
				});
				document.dispatchEvent(pageLoadedEvent);
				console.log(
					"Layout: 触发 firefly:page:loaded 事件，路径:",
					window.location.pathname,
				);
			}
		}, 300);
	});
	window.swup.hooks.on("visit:end", (visit: { to: { url: string } }) => {
		// Finish progress bar（WAAPI：快速填满后淡出）
		finishProgressBar();
		if (visit === activePageTurnVisit) finishPageTurn();

		setTimeout(() => {
			// Just make the transition looks better
			// 移除页面切换保护，恢复过渡动画
			document.documentElement.classList.remove("is-page-transitioning");
			scrollFunction();
		}, 200);
	});
	window.swup.hooks.on("visit:abort", (visit: object) => {
		if (visit === activePageTurnVisit) clearPageTurnState();
		if (visit === activeHomeEntranceVisit) {
			document.dispatchEvent(new Event("firefly:home-entrance-cancel"));
			activeHomeEntranceVisit = null;
		}
	});
	window.swup.hooks.on("fetch:error", (visit: object) => {
		if (visit === activePageTurnVisit) clearPageTurnState();
		if (visit === activeHomeEntranceVisit) {
			document.dispatchEvent(new Event("firefly:home-entrance-cancel"));
			activeHomeEntranceVisit = null;
		}
	});
}

/** 注册 Swup 钩子（swup 就绪时立即执行，否则等待 swup:enable 事件） */
export function setupSwupTransitions(): void {
	if (window?.swup?.hooks) {
		registerSwupHooks();
	} else {
		document.addEventListener("swup:enable", registerSwupHooks);
	}
}
