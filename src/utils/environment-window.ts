import {
	approximatePlace,
	beijingClock,
	constrainPosition,
	type EnvironmentPlace,
	type EnvironmentWeather,
	parseCities,
	parseWeather,
	placeKey,
	REFRESH_COOLDOWN,
	REQUEST_TIMEOUT,
	validPlace,
	WEATHER_INTERVAL,
	weatherDescription,
	weatherURL,
} from "./environment-info";

const POSITION_KEY = "demiur-environment-position-v1";
const CITY_KEY = "demiur-environment-city-v1";
type Battery = EventTarget & { level: number; charging: boolean };

function readStorage(key: string): unknown {
	try {
		return JSON.parse(localStorage.getItem(key) || "null");
	} catch {
		return null;
	}
}
function store(key: string, value: unknown): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* Storage may be disabled; the window still works in memory. */
	}
}

class EnvironmentWindow extends HTMLElement {
	private listeners?: AbortController;
	private observer?: ResizeObserver;
	private expanded = false;
	private position?: { x: number; y: number };
	private drag?: {
		id: number;
		x: number;
		y: number;
		left: number;
		top: number;
	};
	private place?: EnvironmentPlace;
	private weather?: {
		key: string;
		value: EnvironmentWeather;
		fetchedAt: number;
	};
	private weatherRequest?: AbortController;
	private searchRequest?: AbortController;
	private weatherTimer?: number;
	private clockTimer?: number;
	private cooldownTimer?: number;
	private lastAttempt = Number.NEGATIVE_INFINITY;
	private weatherFailed = false;
	private geoGeneration = 0;
	private locating = false;
	private battery?: Battery;
	private batteryAttempted = false;
	private batteryAttached = false;
	private batteryStatus = "正在读取…";

	private element<T extends HTMLElement = HTMLElement>(name: string): T {
		const element = this.querySelector<T>(`[data-env-${name}]`);
		if (!element)
			throw new Error(`Missing environment window element: ${name}`);
		return element;
	}
	private text(name: string, value: string): void {
		this.element(name).textContent = value;
	}
	private active(): boolean {
		return this.expanded && this.isConnected && !document.hidden;
	}

	connectedCallback(): void {
		if (this.listeners) return;
		this.listeners = new AbortController();
		const signal = this.listeners.signal;
		const savedCity = readStorage(CITY_KEY);
		if (validPlace(savedCity) && savedCity.source === "city")
			this.place = savedCity;
		const savedPosition = readStorage(POSITION_KEY) as {
			x?: unknown;
			y?: unknown;
		} | null;
		if (
			savedPosition &&
			typeof savedPosition.x === "number" &&
			typeof savedPosition.y === "number" &&
			Number.isFinite(savedPosition.x) &&
			Number.isFinite(savedPosition.y)
		) {
			this.position = { x: savedPosition.x, y: savedPosition.y };
		}
		this.element("toggle").addEventListener(
			"click",
			() => (this.expanded ? this.close() : this.open()),
			{ signal },
		);
		this.element("close").addEventListener("click", () => this.close(), {
			signal,
		});
		this.element("reset").addEventListener(
			"click",
			() => {
				this.position = undefined;
				store(POSITION_KEY, null);
				this.reposition();
			},
			{ signal },
		);
		this.element("search").addEventListener(
			"submit",
			(event) => {
				event.preventDefault();
				void this.search();
			},
			{ signal },
		);
		this.element("locate").addEventListener("click", () => this.locate(), {
			signal,
		});
		this.element("clear").addEventListener("click", () => this.clearPlace(), {
			signal,
		});
		this.element("refresh").addEventListener(
			"click",
			() => {
				void this.fetchWeather(true);
			},
			{ signal },
		);
		const handle = this.element("handle");
		handle.addEventListener("pointerdown", (event) => this.startDrag(event), {
			signal,
		});
		handle.addEventListener("pointermove", (event) => this.moveDrag(event), {
			signal,
		});
		handle.addEventListener("pointerup", () => this.endDrag(), { signal });
		handle.addEventListener("pointercancel", () => this.endDrag(), { signal });
		handle.addEventListener("lostpointercapture", () => this.endDrag(), {
			signal,
		});
		handle.addEventListener(
			"keydown",
			(event) => this.moveFromKeyboard(event),
			{ signal },
		);
		document.addEventListener(
			"keydown",
			(event) => {
				if (
					event.key === "Escape" &&
					this.expanded &&
					!document.documentElement.hasAttribute("data-home-intro") &&
					!document.documentElement.classList.contains("is-page-transitioning")
				) {
					event.preventDefault();
					this.close();
				}
			},
			{ signal },
		);
		document.addEventListener(
			"visibilitychange",
			() => (document.hidden ? this.pause() : this.resume()),
			{ signal },
		);
		window.addEventListener(
			"resize",
			() => {
				if (this.expanded) {
					this.reposition();
					this.savePosition();
				}
			},
			{ signal },
		);
		window.visualViewport?.addEventListener("resize", () => this.reposition(), {
			signal,
		});
		this.observer = new ResizeObserver(() => this.reposition());
		this.observer.observe(this.element("panel"));
		this.renderPlace();
	}

	disconnectedCallback(): void {
		this.pause();
		this.endDrag();
		this.listeners?.abort();
		this.listeners = undefined;
		this.observer?.disconnect();
		this.expanded = false;
		this.element("panel").hidden = true;
		this.element("toggle").setAttribute("aria-expanded", "false");
	}

	private open(): void {
		this.expanded = true;
		this.element("panel").hidden = false;
		this.element("toggle").setAttribute("aria-expanded", "true");
		this.element("toggle").setAttribute("aria-label", "收起环境信息");
		this.reposition();
		this.element("handle").focus({ preventScroll: true });
		this.resume();
	}
	private close(): void {
		this.expanded = false;
		this.endDrag();
		this.pause();
		this.element("panel").hidden = true;
		this.element("toggle").setAttribute("aria-expanded", "false");
		this.element("toggle").setAttribute("aria-label", "打开环境信息");
		this.element("toggle").focus({ preventScroll: true });
	}
	private resume(): void {
		if (!this.active()) return;
		this.updateClock();
		if (!this.clockTimer)
			this.clockTimer = window.setInterval(() => this.updateClock(), 1000);
		void this.prepareBattery();
		this.attachBattery();
		void this.fetchWeather();
	}
	private pause(): void {
		if (this.weatherRequest)
			this.text(
				"weather-status",
				this.weather
					? "刷新已取消，以下为此前数据"
					: "天气加载已取消，可稍后刷新",
			);
		window.clearInterval(this.clockTimer);
		this.clockTimer = undefined;
		window.clearTimeout(this.weatherTimer);
		this.weatherTimer = undefined;
		window.clearTimeout(this.cooldownTimer);
		this.cooldownTimer = undefined;
		this.weatherRequest?.abort();
		this.weatherRequest = undefined;
		this.searchRequest?.abort();
		this.searchRequest = undefined;
		this.element<HTMLButtonElement>("search-button").disabled = false;
		this.text("search-status", "");
		this.geoGeneration++;
		this.locating = false;
		this.element<HTMLButtonElement>("locate").disabled = false;
		this.text("location-status", "");
		this.detachBattery();
	}
	private updateClock(): void {
		const clock = beijingClock();
		this.text("time", clock.time);
		this.text("date", clock.date);
	}

	private async prepareBattery(): Promise<void> {
		if (this.batteryAttempted) {
			this.renderBattery();
			return;
		}
		this.batteryAttempted = true;
		const getBattery = (
			navigator as Navigator & { getBattery?: () => Promise<Battery> }
		).getBattery;
		if (!getBattery) {
			this.batteryStatus = "浏览器不支持";
			this.renderBattery();
			return;
		}
		try {
			this.battery = await getBattery.call(navigator);
			if (this.active()) this.attachBattery();
		} catch {
			this.batteryStatus = "电量读取失败";
		}
		if (this.isConnected) this.renderBattery();
	}
	private renderBattery = (): void => {
		if (!this.battery) {
			this.text("battery", this.batteryStatus);
			return;
		}
		if (
			!Number.isFinite(this.battery.level) ||
			this.battery.level < 0 ||
			this.battery.level > 1
		) {
			this.text("battery", "电量读取失败");
			return;
		}
		this.text(
			"battery",
			`${Math.round(this.battery.level * 100)}% · ${this.battery.charging ? "正在充电 / 已接电源" : "未充电"}`,
		);
	};
	private attachBattery(): void {
		if (this.battery && !this.batteryAttached && this.active()) {
			this.battery.addEventListener("levelchange", this.renderBattery);
			this.battery.addEventListener("chargingchange", this.renderBattery);
			this.batteryAttached = true;
		}
		this.renderBattery();
	}
	private detachBattery(): void {
		this.battery?.removeEventListener("levelchange", this.renderBattery);
		this.battery?.removeEventListener("chargingchange", this.renderBattery);
		this.batteryAttached = false;
	}

	private reposition(): void {
		if (!this.expanded) return;
		const panel = this.element("panel");
		const rect = panel.getBoundingClientRect();
		const viewport = window.visualViewport;
		const width = viewport?.width ?? innerWidth;
		const height = viewport?.height ?? innerHeight;
		panel.style.maxHeight = `${Math.max(44, height - 24)}px`;
		const start = this.position ?? {
			x: width - rect.width - 80,
			y: Math.max(12, (height - rect.height) / 2),
		};
		const next = constrainPosition(
			start.x,
			start.y,
			rect.width,
			panel.getBoundingClientRect().height,
			width,
			height,
		);
		this.position = next;
		panel.style.left = `${next.x + (viewport?.offsetLeft ?? 0)}px`;
		panel.style.top = `${next.y + (viewport?.offsetTop ?? 0)}px`;
	}
	private savePosition(): void {
		if (this.position) store(POSITION_KEY, this.position);
	}
	private startDrag(event: PointerEvent): void {
		if (!event.isPrimary || event.button !== 0) return;
		event.preventDefault();
		this.reposition();
		this.element("handle").focus({ preventScroll: true });
		const position = this.position;
		if (!position) return;
		this.drag = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			left: position.x,
			top: position.y,
		};
		this.element("handle").setPointerCapture(event.pointerId);
	}
	private moveDrag(event: PointerEvent): void {
		if (!this.drag || event.pointerId !== this.drag.id) return;
		this.position = {
			x: this.drag.left + event.clientX - this.drag.x,
			y: this.drag.top + event.clientY - this.drag.y,
		};
		this.reposition();
	}
	private endDrag(): void {
		if (!this.drag) return;
		const id = this.drag.id;
		this.drag = undefined;
		const handle = this.element("handle");
		if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
		this.savePosition();
	}
	private moveFromKeyboard(event: KeyboardEvent): void {
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1],
		};
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		this.reposition();
		const step = event.shiftKey ? 30 : 10;
		const position = this.position;
		if (!position) return;
		this.position = {
			x: position.x + move[0] * step,
			y: position.y + move[1] * step,
		};
		this.reposition();
		this.savePosition();
	}

	private renderPlace(): void {
		this.text("place", this.place?.name ?? "尚未选择城市");
		this.element("clear").hidden = !this.place;
		this.updateRefreshButton();
	}
	private selectPlace(place: EnvironmentPlace): void {
		this.weatherRequest?.abort();
		this.weatherRequest = undefined;
		window.clearTimeout(this.weatherTimer);
		this.weatherTimer = undefined;
		this.geoGeneration++;
		this.locating = false;
		this.element<HTMLButtonElement>("locate").disabled = false;
		this.place = place;
		this.weather = undefined;
		this.weatherFailed = false;
		this.lastAttempt = Number.NEGATIVE_INFINITY;
		if (place.source === "city") store(CITY_KEY, place);
		this.element("results").replaceChildren();
		this.text("search-status", "");
		this.text("location-status", "");
		this.element("weather").hidden = true;
		this.renderPlace();
		void this.fetchWeather();
	}
	private clearPlace(): void {
		this.weatherRequest?.abort();
		this.weatherRequest = undefined;
		window.clearTimeout(this.weatherTimer);
		this.weatherTimer = undefined;
		this.geoGeneration++;
		this.locating = false;
		this.element<HTMLButtonElement>("locate").disabled = false;
		this.place = undefined;
		this.weather = undefined;
		store(CITY_KEY, null);
		this.element("weather").hidden = true;
		this.text("weather-status", "选择城市或定位后查看天气");
		this.text("location-status", "");
		this.renderPlace();
	}

	private async search(): Promise<void> {
		const query = this.element<HTMLInputElement>("city").value.trim();
		this.searchRequest?.abort();
		this.element("results").replaceChildren();
		if (query.length < 2) {
			this.text("search-status", "请输入至少两个字符的城市名称");
			return;
		}
		const controller = new AbortController();
		this.searchRequest = controller;
		const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
		this.element<HTMLButtonElement>("search-button").disabled = true;
		this.text("search-status", "正在查找城市…");
		try {
			const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
			url.search = new URLSearchParams({
				name: query,
				count: "5",
				language: "zh",
				format: "json",
			}).toString();
			const response = await fetch(url, {
				signal: controller.signal,
				credentials: "omit",
				referrerPolicy: "no-referrer",
			});
			if (!response.ok) throw new Error("City search unavailable");
			const cities = parseCities(await response.json());
			if (this.searchRequest !== controller || !this.active()) return;
			this.text(
				"search-status",
				cities.length
					? "选择所在城市或地区"
					: "未找到城市，请尝试其他名称或拼音",
			);
			for (const city of cities) {
				const item = document.createElement("li");
				const button = document.createElement("button");
				button.type = "button";
				button.textContent = city.name;
				button.addEventListener(
					"click",
					() => {
						this.selectPlace(city);
						this.element("locate").focus({ preventScroll: true });
					},
					{ once: true },
				);
				item.append(button);
				this.element("results").append(item);
			}
		} catch {
			if (this.searchRequest === controller && this.active())
				this.text("search-status", "城市查询失败或超时，请重新查找");
		} finally {
			window.clearTimeout(timer);
			if (this.searchRequest === controller) {
				this.searchRequest = undefined;
				this.element<HTMLButtonElement>("search-button").disabled = false;
			}
		}
	}

	private locate(): void {
		if (this.locating) return;
		if (!navigator.geolocation || !window.isSecureContext) {
			this.text("location-status", "当前环境不支持定位，请手动选择城市");
			return;
		}
		this.searchRequest?.abort();
		this.searchRequest = undefined;
		this.element<HTMLButtonElement>("search-button").disabled = false;
		this.element("results").replaceChildren();
		this.text("search-status", "");
		const generation = ++this.geoGeneration;
		this.locating = true;
		this.element<HTMLButtonElement>("locate").disabled = true;
		this.text("location-status", "正在等待定位授权与结果…");
		navigator.geolocation.getCurrentPosition(
			(position) => {
				if (generation !== this.geoGeneration || !this.active()) return;
				this.locating = false;
				this.element<HTMLButtonElement>("locate").disabled = false;
				try {
					this.selectPlace(
						approximatePlace(
							position.coords.latitude,
							position.coords.longitude,
						),
					);
				} catch {
					this.text("location-status", "定位结果无效，请手动选择城市");
				}
			},
			(error) => {
				if (generation !== this.geoGeneration || !this.active()) return;
				this.locating = false;
				this.element<HTMLButtonElement>("locate").disabled = false;
				this.text(
					"location-status",
					error.code === 1
						? "定位权限被拒绝，可手动选择城市"
						: error.code === 3
							? "定位超时，请重试或选择城市"
							: "暂时无法获取位置，请选择城市",
				);
			},
			{
				enableHighAccuracy: false,
				timeout: REQUEST_TIMEOUT,
				maximumAge: 5 * 60 * 1000,
			},
		);
	}

	private updateRefreshButton(): void {
		this.element<HTMLButtonElement>("refresh").disabled =
			!this.place ||
			!!this.weatherRequest ||
			Date.now() - this.lastAttempt < REFRESH_COOLDOWN;
	}
	private scheduleWeather(): void {
		window.clearTimeout(this.weatherTimer);
		if (!this.active() || !this.weather || this.weatherFailed) return;
		const wait = Math.max(
			1000,
			WEATHER_INTERVAL - (Date.now() - this.weather.fetchedAt),
		);
		this.weatherTimer = window.setTimeout(() => {
			void this.fetchWeather();
		}, wait);
	}
	private renderWeather(): void {
		if (
			!this.weather ||
			!this.place ||
			this.weather.key !== placeKey(this.place)
		)
			return;
		const weather = this.weather.value;
		this.element("weather").hidden = false;
		this.text("temperature", `${weather.temperature.toFixed(1)}°C`);
		this.text("description", weatherDescription(weather.code));
		this.text("apparent", `${weather.apparentTemperature.toFixed(1)}°C`);
		this.text("humidity", `${weather.humidity}%`);
		this.text("wind", `${weather.windSpeed.toFixed(1)} m/s`);
		this.text(
			"weather-time",
			`数据时间 ${weather.time.replace("T", " ")}（北京时间）`,
		);
	}
	private async fetchWeather(force = false): Promise<void> {
		this.updateRefreshButton();
		if (!this.active() || !this.place || this.weatherRequest) return;
		const key = placeKey(this.place);
		const age =
			this.weather?.key === key
				? Date.now() - this.weather.fetchedAt
				: Number.POSITIVE_INFINITY;
		if (!force && age < WEATHER_INTERVAL && !this.weatherFailed) {
			this.renderWeather();
			this.text("weather-status", "");
			this.scheduleWeather();
			return;
		}
		const elapsed = Date.now() - this.lastAttempt;
		if (elapsed < REFRESH_COOLDOWN) {
			window.clearTimeout(this.cooldownTimer);
			this.cooldownTimer = window.setTimeout(
				() => this.updateRefreshButton(),
				REFRESH_COOLDOWN - elapsed,
			);
			return;
		}
		const controller = new AbortController();
		this.weatherRequest = controller;
		this.lastAttempt = Date.now();
		window.clearTimeout(this.weatherTimer);
		this.weatherTimer = undefined;
		this.updateRefreshButton();
		this.text("weather-status", "正在获取天气…");
		const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
		try {
			const response = await fetch(weatherURL(this.place), {
				signal: controller.signal,
				credentials: "omit",
				referrerPolicy: "no-referrer",
			});
			if (!response.ok) throw new Error("Weather unavailable");
			const weather = parseWeather(await response.json());
			if (
				this.weatherRequest !== controller ||
				!this.active() ||
				!this.place ||
				key !== placeKey(this.place)
			)
				return;
			this.weather = { key, value: weather, fetchedAt: Date.now() };
			this.weatherFailed = false;
			this.renderWeather();
			this.text("weather-status", "");
			this.scheduleWeather();
		} catch {
			if (this.weatherRequest === controller && this.active()) {
				this.weatherFailed = true;
				this.text(
					"weather-status",
					this.weather
						? "更新失败，以下为旧数据，请稍后重试"
						: "天气获取失败或超时，请稍后刷新重试",
				);
			}
		} finally {
			window.clearTimeout(timer);
			if (this.weatherRequest === controller) {
				this.weatherRequest = undefined;
				this.updateRefreshButton();
				window.clearTimeout(this.cooldownTimer);
				if (this.active())
					this.cooldownTimer = window.setTimeout(
						() => this.updateRefreshButton(),
						Math.max(0, REFRESH_COOLDOWN - (Date.now() - this.lastAttempt)),
					);
			}
		}
	}
}

if (!customElements.get("environment-info"))
	customElements.define("environment-info", EnvironmentWindow);
