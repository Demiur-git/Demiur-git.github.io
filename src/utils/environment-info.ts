export interface EnvironmentPlace {
	name: string;
	latitude: number;
	longitude: number;
	source: "city" | "geolocation";
}

export interface EnvironmentWeather {
	temperature: number;
	apparentTemperature: number;
	humidity: number;
	windSpeed: number;
	code: number;
	time: string;
}

export const WEATHER_INTERVAL: number = 15 * 60 * 1000;
export const REQUEST_TIMEOUT = 10000;
export const REFRESH_COOLDOWN = 10000;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
	timeZone: "Asia/Shanghai",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	weekday: "long",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Asia/Shanghai",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hourCycle: "h23",
});

export function beijingClock(date: Date = new Date()): {
	date: string;
	time: string;
} {
	return { date: dateFormatter.format(date), time: timeFormatter.format(date) };
}

export function validPlace(value: unknown): value is EnvironmentPlace {
	if (!value || typeof value !== "object") return false;
	const place = value as EnvironmentPlace;
	return (
		typeof place.name === "string" &&
		place.name.length > 0 &&
		place.name.length <= 180 &&
		Number.isFinite(place.latitude) &&
		Math.abs(place.latitude) <= 90 &&
		Number.isFinite(place.longitude) &&
		Math.abs(place.longitude) <= 180 &&
		(place.source === "city" || place.source === "geolocation")
	);
}

export function approximatePlace(
	latitude: number,
	longitude: number,
): EnvironmentPlace {
	const lat = Math.round(latitude * 100) / 100;
	const lon = Math.round(longitude * 100) / 100;
	const place: EnvironmentPlace = {
		name: `约 ${Math.abs(lat).toFixed(2)}°${lat < 0 ? "S" : "N"} · ${Math.abs(lon).toFixed(2)}°${lon < 0 ? "W" : "E"}`,
		latitude: lat,
		longitude: lon,
		source: "geolocation",
	};
	if (!validPlace(place)) throw new Error("Invalid coordinates");
	return place;
}

export function placeKey(place: EnvironmentPlace): string {
	return `${place.latitude},${place.longitude}`;
}

export function weatherURL(place: EnvironmentPlace): string {
	if (!validPlace(place)) throw new Error("Invalid location");
	const url = new URL("https://api.open-meteo.com/v1/forecast");
	url.searchParams.set("latitude", String(place.latitude));
	url.searchParams.set("longitude", String(place.longitude));
	url.searchParams.set(
		"current",
		"temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
	);
	url.searchParams.set("timezone", "Asia/Shanghai");
	url.searchParams.set("wind_speed_unit", "ms");
	url.searchParams.set("forecast_days", "1");
	return url.href;
}

export function parseCities(value: unknown): EnvironmentPlace[] {
	const results = (value as { results?: unknown[] } | null)?.results;
	if (!Array.isArray(results)) return [];
	return results
		.flatMap((item) => {
			if (!item || typeof item !== "object") return [];
			const city = item as Record<string, unknown>;
			if (typeof city.name !== "string") return [];
			const name = [
				...new Set(
					[city.name, city.admin1, city.country].filter(
						(part): part is string => typeof part === "string" && !!part,
					),
				),
			].join(" · ");
			const place = {
				name,
				latitude: city.latitude,
				longitude: city.longitude,
				source: "city",
			};
			return validPlace(place) ? [place] : [];
		})
		.slice(0, 5);
}

export function parseWeather(value: unknown): EnvironmentWeather {
	const current = (value as { current?: Record<string, unknown> } | null)
		?.current;
	const fields = [
		"temperature_2m",
		"apparent_temperature",
		"relative_humidity_2m",
		"wind_speed_10m",
		"weather_code",
	];
	if (
		!current ||
		fields.some(
			(field) =>
				typeof current[field] !== "number" || !Number.isFinite(current[field]),
		) ||
		typeof current.time !== "string" ||
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(current.time)
	) {
		throw new Error("Invalid weather response");
	}
	return {
		temperature: current.temperature_2m as number,
		apparentTemperature: current.apparent_temperature as number,
		humidity: current.relative_humidity_2m as number,
		windSpeed: current.wind_speed_10m as number,
		code: current.weather_code as number,
		time: current.time,
	};
}

export function weatherDescription(code: number): string {
	if (code === 0) return "晴";
	if (code === 1) return "大部晴朗";
	if (code === 2) return "局部多云";
	if (code === 3) return "阴";
	if ([45, 48].includes(code)) return "雾";
	if ([51, 53, 55].includes(code)) return "毛毛雨";
	if ([56, 57, 66, 67].includes(code)) return "冻雨";
	if ([61, 63, 65].includes(code)) return "雨";
	if ([71, 73, 75, 77].includes(code)) return "雪";
	if ([80, 81, 82].includes(code)) return "阵雨";
	if ([85, 86].includes(code)) return "阵雪";
	if ([95, 96, 99].includes(code)) return "雷雨";
	return "天气状况未知";
}

export function constrainPosition(
	x: number,
	y: number,
	width: number,
	height: number,
	viewportWidth: number,
	viewportHeight: number,
): { x: number; y: number } {
	const margin = 12;
	return {
		x: Math.min(
			Math.max(margin, x),
			Math.max(margin, viewportWidth - width - margin),
		),
		y: Math.min(
			Math.max(margin, y),
			Math.max(margin, viewportHeight - height - margin),
		),
	};
}
