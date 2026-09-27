import assert from "node:assert/strict";
import test from "node:test";
import {
	approximatePlace,
	beijingClock,
	constrainPosition,
	parseCities,
	parseWeather,
	validPlace,
	weatherDescription,
	weatherURL,
} from "./environment-info.ts";

test("Beijing clock uses UTC+8 regardless of the host timezone", () => {
	assert.equal(beijingClock(new Date("2026-09-26T16:01:02Z")).time, "00:01:02");
	assert.match(
		beijingClock(new Date("2026-09-26T16:01:02Z")).date,
		/2026.*09.*27/,
	);
});
test("location coordinates are rounded before weather requests", () => {
	const place = approximatePlace(39.904234, 116.407394);
	assert.equal(place.latitude, 39.9);
	assert.equal(place.longitude, 116.41);
	const url = new URL(weatherURL(place));
	assert.equal(url.searchParams.get("latitude"), "39.9");
	assert.equal(url.searchParams.get("timezone"), "Asia/Shanghai");
	assert.equal(url.searchParams.get("wind_speed_unit"), "ms");
	assert.throws(() => approximatePlace(Number.NaN, 10));
	assert.throws(() => approximatePlace(100, 10));
});
test("city results contain disambiguating regions, at most five valid entries", () => {
	const city = {
		name: "北京",
		admin1: "北京",
		country: "中国",
		latitude: 39.9,
		longitude: 116.4,
	};
	const cities = parseCities({
		results: [{ name: "Invalid", latitude: 999 }, ...Array(7).fill(city)],
	});
	assert.equal(cities.length, 5);
	assert.equal(cities[0].name, "北京 · 中国");
	assert.ok(validPlace(cities[0]));
	assert.deepEqual(parseCities({}), []);
	assert.equal(validPlace({ ...cities[0], source: "ip" }), false);
});
test("invalid weather is never rendered as a successful reading", () => {
	const value = {
		current: {
			temperature_2m: 21,
			apparent_temperature: 20,
			relative_humidity_2m: 60,
			wind_speed_10m: 2.5,
			weather_code: 3,
			time: "2026-09-27T12:15",
		},
	};
	assert.equal(parseWeather(value).temperature, 21);
	assert.equal(weatherDescription(3), "阴");
	assert.equal(weatherDescription(999), "天气状况未知");
	assert.throws(() =>
		parseWeather({ current: { ...value.current, temperature_2m: null } }),
	);
	assert.throws(() => parseWeather({}));
});
test("window stays within desktop and phone bounds", () => {
	assert.deepEqual(constrainPosition(-200, 900, 320, 600, 390, 844), {
		x: 12,
		y: 232,
	});
	assert.deepEqual(constrainPosition(2000, -50, 320, 500, 1440, 900), {
		x: 1108,
		y: 12,
	});
});
