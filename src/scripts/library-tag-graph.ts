import { layoutTagGraph, type TagGraphData } from "@/utils/library-data";

interface LinkedGroup {
	name: string;
	count: number;
	href: string;
	tags: { name: string; count: number; href: string }[];
}
const namespace = "http://www.w3.org/2000/svg";
function svgElement<K extends keyof SVGElementTagNameMap>(
	name: K,
	attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
	const element = document.createElementNS(namespace, name);
	for (const [key, value] of Object.entries(attributes))
		element.setAttribute(key, String(value));
	return element;
}
class TagGraph extends HTMLElement {
	private abort?: AbortController;
	connectedCallback() {
		this.abort?.abort();
		this.abort = new AbortController();
		const signal = this.abort.signal;
		const viewport = this.querySelector<HTMLElement>(".graph-viewport");
		const svg = this.querySelector<SVGSVGElement>("svg");
		const scene = this.querySelector<SVGGElement>("[data-scene]");
		if (!viewport || !svg || !scene) return;
		const groups: LinkedGroup[] = JSON.parse(this.dataset.graph || "[]");
		const data: TagGraphData = {
			groups,
			secondaryCount: new Set(groups.flatMap((g) => g.tags.map((t) => t.name)))
				.size,
		};
		let expanded: string | undefined;
		const initialScale = viewport.clientWidth < 500 ? 3 : 1;
		let scale = initialScale,
			x = (Number(svg.dataset.width) / 2) * (1 - scale),
			y = (Number(svg.dataset.height) / 2) * (1 - scale),
			moved = false,
			dragDistance = 0;
		const pointers = new Map<number, { x: number; y: number }>();
		const update = () => {
			scene.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
		};
		update();
		const zoom = (value: number) => {
			const next = Math.min(4, Math.max(0.65, value));
			const cx = Number(svg.dataset.width) / 2,
				cy = Number(svg.dataset.height) / 2;
			x = cx - ((cx - x) * next) / scale;
			y = cy - ((cy - y) * next) / scale;
			scale = next;
			update();
		};
		this.querySelectorAll<HTMLElement>("[data-zoom]").forEach((button) =>
			button.addEventListener(
				"click",
				() => {
					if (button.dataset.zoom === "reset") {
						scale = initialScale;
						x = (Number(svg.dataset.width) / 2) * (1 - scale);
						y = (Number(svg.dataset.height) / 2) * (1 - scale);
						update();
					} else zoom(scale * (button.dataset.zoom === "in" ? 1.25 : 0.8));
				},
				{ signal },
			),
		);
		const pan = this.querySelector<HTMLButtonElement>(".pan-switch")!;
		pan.addEventListener(
			"click",
			() => {
				const enabled = pan.getAttribute("aria-pressed") !== "true";
				pan.setAttribute("aria-pressed", String(enabled));
				viewport.dataset.pan = String(enabled);
			},
			{ signal },
		);
		viewport.addEventListener(
			"keydown",
			(event) => {
				if (event.target !== viewport) return;
				const delta: Record<string, [number, number]> = {
					ArrowLeft: [25, 0],
					ArrowRight: [-25, 0],
					ArrowUp: [0, 25],
					ArrowDown: [0, -25],
				};
				if (delta[event.key]) {
					event.preventDefault();
					x += delta[event.key][0];
					y += delta[event.key][1];
					update();
				}
			},
			{ signal },
		);
		viewport.addEventListener(
			"pointerdown",
			(event) => {
				if (event.button !== 0) return;
				moved = false;
				dragDistance = 0;
				pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			},
			{ signal },
		);
		viewport.addEventListener(
			"pointermove",
			(event) => {
				const previous = pointers.get(event.pointerId);
				if (!previous) return;
				const next = { x: event.clientX, y: event.clientY };
				if (pointers.size === 2) {
					if (event.pointerType === "touch") return;
					const other = [...pointers.entries()].find(
						([id]) => id !== event.pointerId,
					)![1];
					const before = Math.hypot(previous.x - other.x, previous.y - other.y);
					const after = Math.hypot(next.x - other.x, next.y - other.y);
					if (before > 0) zoom((scale * after) / before);
					moved = true;
				} else if (viewport.dataset.pan === "true") {
					const box = svg.getBoundingClientRect();
					const ratio = Math.min(
						box.width / Number(svg.dataset.width),
						box.height / Number(svg.dataset.height),
					);
					x += (next.x - previous.x) / ratio;
					y += (next.y - previous.y) / ratio;
					dragDistance += Math.hypot(next.x - previous.x, next.y - previous.y);
					moved ||= dragDistance > 5;
					// Capture only an actual drag; capturing a tap redirects its click
					// away from the node and prevents category selection.
					if (moved && !viewport.hasPointerCapture(event.pointerId))
						viewport.setPointerCapture(event.pointerId);
					update();
				}
				pointers.set(event.pointerId, next);
			},
			{ signal },
		);
		let touchDistance = 0;
		viewport.addEventListener(
			"touchstart",
			(event) => {
				if (event.touches.length === 2) {
					event.preventDefault();
					touchDistance = Math.hypot(
						event.touches[0].clientX - event.touches[1].clientX,
						event.touches[0].clientY - event.touches[1].clientY,
					);
				}
			},
			{ signal, passive: false },
		);
		viewport.addEventListener(
			"touchmove",
			(event) => {
				if (event.touches.length !== 2) return;
				event.preventDefault();
				moved = true;
				const distance = Math.hypot(
					event.touches[0].clientX - event.touches[1].clientX,
					event.touches[0].clientY - event.touches[1].clientY,
				);
				if (touchDistance > 0) zoom((scale * distance) / touchDistance);
				touchDistance = distance;
			},
			{ signal, passive: false },
		);
		viewport.addEventListener(
			"touchend",
			() => {
				touchDistance = 0;
			},
			{ signal },
		);
		for (const name of ["pointerup", "pointercancel", "pointerleave"] as const)
			viewport.addEventListener(
				name,
				(event) => pointers.delete(event.pointerId),
				{ signal },
			);
		viewport.addEventListener(
			"click",
			(event) => {
				if (moved) {
					event.preventDefault();
					moved = false;
				}
			},
			{ signal, capture: true },
		);

		const info = this.querySelector<HTMLElement>(".graph-info")!;
		const input = this.querySelector<HTMLInputElement>("input")!;
		const results = this.querySelector<HTMLElement>(".graph-search-results")!;
		const reading = this.querySelector<HTMLAnchorElement>(".category-reading")!;
		const indexGroups =
			this.querySelectorAll<HTMLDetailsElement>(".index-group");
		const query = () => input.value.trim().toLocaleLowerCase();
		const highlight = () => {
			const term = query();
			this.querySelectorAll<SVGElement>(".graph-node").forEach((node) => {
				const category = node.dataset.category || "";
				const group = groups.find((g) => g.name === category);
				const direct = (node.dataset.name || "")
					.toLocaleLowerCase()
					.includes(term);
				const childMatch =
					node.dataset.primary === "true" &&
					group?.tags.some((t) => t.name.toLocaleLowerCase().includes(term));
				node.dataset.muted = String(!!term && !direct && !childMatch);
				node.dataset.highlight = String(!!term && (direct || !!childMatch));
			});
		};
		const render = (focusCategory?: string) => {
			const layout = layoutTagGraph(data, expanded);
			svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
			svg.dataset.width = String(layout.width);
			svg.dataset.height = String(layout.height);
			scene.replaceChildren();
			const byId = new Map(layout.nodes.map((n) => [n.id, n]));
			for (const edge of layout.edges) {
				const from = byId.get(edge.source)!,
					to = byId.get(edge.target)!;
				scene.append(
					svgElement("path", {
						class: "graph-edge",
						d: `M${from.x} ${from.y} L${to.x} ${to.y}`,
						"stroke-width": Math.min(3, 0.8 + edge.count * 0.3),
						"aria-hidden": "true",
					}),
				);
			}
			for (const node of layout.nodes) {
				const group = groups.find((g) => g.name === node.category)!;
				const description = `${node.category}${node.primary ? "" : " / " + node.name} · ${node.count} 篇文章`;
				const element = node.primary
					? svgElement("g", {
							role: "button",
							tabindex: 0,
							"aria-expanded": String(expanded === node.category),
						})
					: svgElement("a", {
							href: group.tags.find((t) => t.name === node.name)!.href,
						});
				element.setAttribute(
					"class",
					"graph-node" + (node.primary ? " primary-node" : ""),
				);
				element.dataset.name = node.name;
				element.dataset.category = node.category;
				element.dataset.primary = String(node.primary);
				element.setAttribute(
					"aria-label",
					description +
						(node.primary ? "，展开或收起小标签" : "，阅读筛选后的文章"),
				);
				const title = svgElement("title", {});
				title.textContent = description;
				element.append(title);
				element.append(
					svgElement("circle", { cx: node.x, cy: node.y, r: node.radius }),
				);
				const count = svgElement("text", {
					x: node.x,
					y: node.y + 5,
					class: "node-count",
				});
				count.textContent = String(node.count);
				element.append(count);
				const label = svgElement("text", {
					x: node.x,
					y: node.y + node.radius + 24,
					class: "node-label",
				});
				const letters = [...node.name];
				label.textContent =
					letters.length > 12 ? letters.slice(0, 12).join("") + "…" : node.name;
				element.append(label);
				element.dataset.info = description;
				scene.append(element);
			}
			scale = initialScale;
			x = (layout.width / 2) * (1 - scale);
			y = (layout.height / 2) * (1 - scale);
			update();
			const active = groups.find((g) => g.name === expanded);
			reading.hidden = !active;
			if (active) {
				reading.href = active.href;
				reading.textContent = `阅读此分类：${active.name} →`;
			}
			indexGroups.forEach((detail) => {
				detail.open = detail.dataset.category === expanded;
			});
			info.textContent = active
				? `${active.name} · ${active.count} 篇文章 / ${active.tags.length} 个小标签${active.tags.length ? "" : "；此分类暂无小标签。"}`
				: "选中一个主分类，展开它的小标签。";
			highlight();
			if (focusCategory)
				scene.querySelectorAll<SVGElement>(".primary-node").forEach((n) => {
					if (n.dataset.category === focusCategory) n.focus();
				});
		};
		const select = (category: string, toggle = true, focus = false) => {
			expanded = toggle && expanded === category ? undefined : category;
			render(focus ? category : undefined);
		};
		// Delegate only to primary nodes; secondary anchors remain real Swup links.
		for (const eventName of ["pointerover", "focusin"])
			scene.addEventListener(
				eventName,
				(event) => {
					if (!(event.target instanceof Element)) return;
					const node = event.target.closest<SVGElement>(".graph-node");
					if (node) info.textContent = node.dataset.info || "";
				},
				{ signal },
			);
		this.addEventListener(
			"click",
			(event) => {
				if (event.defaultPrevented || !(event.target instanceof Element))
					return;
				const primary = event.target.closest<SVGElement>(".primary-node");
				const expand = event.target.closest<HTMLElement>("[data-expand]");
				if (primary) {
					event.preventDefault();
					select(primary.dataset.category!, true, true);
				} else if (expand) select(expand.dataset.expand!, false);
			},
			{ signal },
		);
		scene.addEventListener(
			"keydown",
			(event) => {
				if (!(event.target instanceof Element)) return;
				const primary = event.target.closest<SVGElement>(".primary-node");
				if (primary && (event.key === "Enter" || event.key === " ")) {
					event.preventDefault();
					select(primary.dataset.category!, true, true);
				}
			},
			{ signal },
		);
		input.addEventListener(
			"input",
			() => {
				const term = query();
				results.replaceChildren();
				results.hidden = !term;
				let found = 0;
				for (const group of groups) {
					const categoryHit = group.name.toLocaleLowerCase().includes(term);
					const tags = group.tags.filter((t) =>
						t.name.toLocaleLowerCase().includes(term),
					);
					const matches = categoryHit
						? [
								{ name: group.name, count: group.count, href: group.href },
								...tags,
							]
						: tags;
					for (const match of matches) {
						if (!term) continue;
						found++;
						const row = document.createElement("div");
						row.className = "search-result";
						const label = document.createElement("span");
						label.textContent = `${group.name} / ${match.name}（${match.count} 篇）`;
						const expand = document.createElement("button");
						expand.type = "button";
						expand.dataset.expand = group.name;
						expand.textContent = "展开分类";
						const link = document.createElement("a");
						link.href = match.href;
						link.textContent = "阅读";
						row.append(label, expand, link);
						results.append(row);
					}
				}
				indexGroups.forEach((detail) => {
					const group = groups.find((g) => g.name === detail.dataset.category)!;
					detail.hidden =
						!!term &&
						!group.name.toLocaleLowerCase().includes(term) &&
						!group.tags.some((t) => t.name.toLocaleLowerCase().includes(term));
				});
				if (term && !found) results.textContent = "没有匹配的主分类或小标签。";
				highlight();
				info.textContent = term
					? `找到 ${found} 个匹配标签；小标签结果标明所属分类。`
					: "选中一个主分类，展开它的小标签。";
			},
			{ signal },
		);
		render();
	}
	disconnectedCallback() {
		this.abort?.abort();
	}
}
if (!customElements.get("tag-graph"))
	customElements.define("tag-graph", TagGraph);
