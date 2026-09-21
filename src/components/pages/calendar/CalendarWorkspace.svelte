<script lang="ts">
	import { onMount } from "svelte";
	import type {
		CalendarImportantDate,
		CalendarScheduleItem,
		ImportantDateCategory,
	} from "@/types/calendarPageConfig";

	type CalendarMarker = {
		source: "important" | "schedule";
		category: ImportantDateCategory | "schedule";
		title: string;
		description?: string;
	};

	type CalendarDay = {
		date: Date;
		dateKey: string;
		day: number;
		inCurrentMonth: boolean;
		isToday: boolean;
		markers: CalendarMarker[];
	};

	type ResolvedImportantDate = CalendarImportantDate & {
		resolvedDate: string;
	};

	type ScheduleEntry = CalendarScheduleItem & {
		localId?: string;
	};

	export let importantDates: CalendarImportantDate[] = [];
	export let schedules: CalendarScheduleItem[] = [];

	const storageKey = "personal-page-calendar-schedules";
	const today = new Date();
	const todayKey = toDateKey(today);
	const weekDays = ["一", "二", "三", "四", "五", "六", "日"];
	const importantCategoryLabel: Record<ImportantDateCategory, string> = {
		holiday: "节日",
		festival: "节日",
		anniversary: "纪念日",
		important: "重要",
	};
	const scheduleStatusLabel = {
		planned: "待开始",
		"in-progress": "进行中",
		done: "已完成",
	};

	let displayYear = today.getFullYear();
	let displayMonth = today.getMonth();
	let selectedDate = todayKey;
	let userSchedules: ScheduleEntry[] = [];
	let draftTitle = "";
	let draftTime = "";
	let titleInput: HTMLInputElement;

	$: allSchedules = [...schedules, ...userSchedules].sort(
		(a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
	);
	$: resolvedImportantDates = importantDates
		.map((item) => resolveImportantItem(item, displayYear))
		.sort((a, b) => a.resolvedDate.localeCompare(b.resolvedDate));
	$: nearestHolidays = getNearestHolidays(importantDates);
	$: todaySchedules = allSchedules.filter((item) => item.date === todayKey);
	$: selectedSchedules = allSchedules.filter((item) => item.date === selectedDate);
	$: markerMap = buildMarkerMap(resolvedImportantDates, allSchedules);
	$: calendarDays = buildCalendarDays(displayYear, displayMonth, markerMap);
	$: selectedMarkers = markerMap.get(selectedDate) ?? [];

	onMount(() => {
		try {
			const savedSchedules = localStorage.getItem(storageKey);
			if (savedSchedules) userSchedules = JSON.parse(savedSchedules) as ScheduleEntry[];
		} catch (error) {
			console.warn("无法读取本地日程", error);
		}
	});

	function parseDateKey(dateKey: string): Date {
		const [year, month, day] = dateKey.split("-").map(Number);
		return new Date(year, month - 1, day);
	}

	function toDateKey(date: Date): string {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	}

	function resolveImportantItem(item: CalendarImportantDate, year: number): ResolvedImportantDate {
		const resolvedDate = item.repeat === "yearly" ? `${year}-${item.date.slice(5)}` : item.date;
		return { ...item, resolvedDate };
	}

	function buildMarkerMap(
		important: ResolvedImportantDate[],
		scheduleItems: ScheduleEntry[],
	): Map<string, CalendarMarker[]> {
		const map = new Map<string, CalendarMarker[]>();

		for (const item of important) {
			const markers = map.get(item.resolvedDate) ?? [];
			markers.push({
				source: "important",
				category: item.category,
				title: item.title,
				description: item.description,
			});
			map.set(item.resolvedDate, markers);
		}

		for (const item of scheduleItems) {
			const markers = map.get(item.date) ?? [];
			markers.push({
				source: "schedule",
				category: "schedule",
				title: item.title,
				description: item.description,
			});
			map.set(item.date, markers);
		}

		return map;
	}

	function buildCalendarDays(
		year: number,
		month: number,
		markers: Map<string, CalendarMarker[]>,
	): CalendarDay[] {
		const firstDay = new Date(year, month, 1);
		const mondayOffset = (firstDay.getDay() + 6) % 7;

		return Array.from({ length: 42 }, (_, index) => {
			const date = new Date(year, month, 1 - mondayOffset + index);
			const dateKey = toDateKey(date);
			return {
				date,
				dateKey,
				day: date.getDate(),
				inCurrentMonth: date.getMonth() === month,
				isToday: dateKey === todayKey,
				markers: markers.get(dateKey) ?? [],
			};
		});
	}

	function getNearestHolidays(items: CalendarImportantDate[]): ResolvedImportantDate[] {
		const holidayCandidates = items
			.filter((item) => item.category === "holiday")
			.flatMap((item) => {
				if (item.repeat !== "yearly") return [resolveImportantItem(item, today.getFullYear())];
				return [
					resolveImportantItem(item, today.getFullYear()),
					resolveImportantItem(item, today.getFullYear() + 1),
				];
			});

		return holidayCandidates
			.sort((a, b) => distanceToDate(a.resolvedDate) - distanceToDate(b.resolvedDate))
			.slice(0, 2);
	}

	function distanceToDate(dateKey: string): number {
		const current = parseDateKey(todayKey).getTime();
		return Math.abs(parseDateKey(dateKey).getTime() - current);
	}

	function changeMonth(delta: number): void {
		const nextMonth = new Date(displayYear, displayMonth + delta, 1);
		displayYear = nextMonth.getFullYear();
		displayMonth = nextMonth.getMonth();
		selectedDate = toDateKey(nextMonth);
	}

	function goToToday(): void {
		displayYear = today.getFullYear();
		displayMonth = today.getMonth();
		selectedDate = todayKey;
	}

	function selectDate(dateKey: string, focusForm = false): void {
		const date = parseDateKey(dateKey);
		displayYear = date.getFullYear();
		displayMonth = date.getMonth();
		selectedDate = dateKey;
		if (focusForm) setTimeout(() => titleInput?.focus(), 0);
	}

	function createSchedule(event: SubmitEvent): void {
		event.preventDefault();
		const title = draftTitle.trim();
		if (!title) return;

		const schedule: ScheduleEntry = {
			date: selectedDate,
			title,
			time: draftTime || undefined,
			status: "planned",
			localId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
		};
		userSchedules = [...userSchedules, schedule];
		persistUserSchedules();
		draftTitle = "";
		draftTime = "";
	}

	function removeSchedule(localId: string): void {
		userSchedules = userSchedules.filter((item) => item.localId !== localId);
		persistUserSchedules();
	}

	function persistUserSchedules(): void {
		try {
			localStorage.setItem(storageKey, JSON.stringify(userSchedules));
		} catch (error) {
			console.warn("无法保存本地日程", error);
		}
	}

	function formatSideDate(dateKey: string): string {
		const date = parseDateKey(dateKey);
		const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
		return `${date.getMonth() + 1}月${date.getDate()}日 · 周${weekday}`;
	}

	function relativeDateText(dateKey: string): string {
		const difference = Math.round(
			(parseDateKey(dateKey).getTime() - parseDateKey(todayKey).getTime()) / 86_400_000,
		);
		if (difference === 0) return "就是今天";
		if (difference > 0) return `还有 ${difference} 天`;
		return `已过去 ${Math.abs(difference)} 天`;
	}

	function dayClass(day: CalendarDay): string {
		return [
			"calendar-day",
			day.inCurrentMonth ? "" : "outside-month",
			day.isToday ? "today" : "",
			day.dateKey === selectedDate ? "selected" : "",
		]
			.filter(Boolean)
			.join(" ");
	}

	function markerClass(marker: CalendarMarker): string {
		return `day-marker marker-${marker.category}`;
	}

	function dayAriaLabel(day: CalendarDay): string {
		const markerText = day.markers.map((marker) => marker.title).join("、");
		return `${day.date.getFullYear()}年${day.date.getMonth() + 1}月${day.day}日${markerText ? `，${markerText}` : ""}`;
	}
</script>

<div class="calendar-workspace">
	<aside class="card-base side-panel important-panel">
		<header class="panel-header">
			<div>
				<p class="panel-kicker">UPCOMING HOLIDAYS</p>
				<h2>最近假期</h2>
			</div>
			<span class="panel-count">{nearestHolidays.length}</span>
		</header>

		<div class="panel-list">
			{#if nearestHolidays.length > 0}
				{#each nearestHolidays as item}
					<button
						type="button"
						class:active={selectedDate === item.resolvedDate}
						class="date-item"
						onclick={() => selectDate(item.resolvedDate)}
					>
						<span class={`date-accent accent-${item.category}`} aria-hidden="true"></span>
						<span class="item-content">
							<span class="item-meta">
								<time datetime={item.resolvedDate}>{formatSideDate(item.resolvedDate)}</time>
								<span class={`category-tag tag-${item.category}`}>{importantCategoryLabel[item.category]}</span>
							</span>
							<strong>{item.title}</strong>
							<small class="relative-days">{relativeDateText(item.resolvedDate)}</small>
							{#if item.description}<small>{item.description}</small>{/if}
						</span>
					</button>
				{/each}
			{:else}
				<div class="empty-state">
					<span>暂无假期数据</span>
					<small>可在日历配置中补充。</small>
				</div>
			{/if}
		</div>
	</aside>

	<section class="card-base calendar-panel" aria-label="月历">
		<header class="calendar-toolbar">
			<div>
				<p class="calendar-year">{displayYear}</p>
				<h1>{displayMonth + 1}月</h1>
			</div>
			<div class="calendar-actions">
				<button type="button" class="today-button" onclick={goToToday}>今天</button>
				<button type="button" class="month-button" aria-label="上个月" onclick={() => changeMonth(-1)}>‹</button>
				<button type="button" class="month-button" aria-label="下个月" onclick={() => changeMonth(1)}>›</button>
			</div>
		</header>

		<div class="weekday-row" aria-hidden="true">
			{#each weekDays as weekDay, index}
				<span class:weekend={index > 4}>{weekDay}</span>
			{/each}
		</div>

		<div class="calendar-grid">
			{#each calendarDays as day}
				<button
					type="button"
					class={dayClass(day)}
					aria-label={dayAriaLabel(day)}
					onclick={() => selectDate(day.dateKey, true)}
				>
					<span class="day-number">{day.day}</span>
					<div class="day-markers" aria-hidden="true">
						{#each day.markers.slice(0, 3) as marker}
							<span class={markerClass(marker)} title={marker.title}>{marker.title}</span>
						{/each}
						{#if day.markers.length > 3}
							<span class="more-markers">+{day.markers.length - 3}</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>

		<footer class="calendar-footer">
			<div class="legend" aria-label="日历标记说明">
				<span><i class="legend-important"></i>重要日期</span>
				<span><i class="legend-schedule"></i>日程与计划</span>
				<span><i class="legend-today"></i>今天</span>
			</div>
			<div class="selected-summary">
				<strong>{formatSideDate(selectedDate)}</strong>
				{#if selectedMarkers.length > 0}
					<span>{selectedMarkers.map((marker) => marker.title).join(" · ")}</span>
				{:else}
					<span>这一天暂时没有安排</span>
				{/if}
			</div>
		</footer>
	</section>

	<aside class="card-base side-panel schedule-panel">
		<header class="panel-header">
			<div>
				<p class="panel-kicker">SCHEDULE</p>
				<h2>日程与计划</h2>
			</div>
			<span class="panel-count">{todaySchedules.length}</span>
		</header>

		<div class="schedule-sections">
			<section class="schedule-section today-section">
				<div class="section-heading">
					<div>
						<p>今日</p>
						<h3>今日日程</h3>
					</div>
					<small>{formatSideDate(todayKey)}</small>
				</div>
				<p class="relative-days section-relative">{relativeDateText(todayKey)}</p>

				<div class="schedule-list">
					{#if todaySchedules.length > 0}
						{#each todaySchedules as item}
							<div class="date-item schedule-item">
								<span class="date-block">
									<strong>{parseDateKey(item.date).getDate()}</strong>
									<small>{parseDateKey(item.date).getMonth() + 1}月</small>
								</span>
								<span class="item-content">
									<span class="item-meta">
										{#if item.time}<time datetime={`${item.date}T${item.time}`}>{item.time}</time>{:else}<span>全天</span>{/if}
										<span class={`status-tag status-${item.status}`}>{scheduleStatusLabel[item.status]}</span>
									</span>
									<strong>{item.title}</strong>
									<small class="relative-days">{relativeDateText(item.date)}</small>
									{#if item.description}<small>{item.description}</small>{/if}
								</span>
								{#if item.localId}
									<button type="button" class="delete-schedule" aria-label={`删除日程：${item.title}`} onclick={() => removeSchedule(item.localId!)}>×</button>
								{/if}
							</div>
						{/each}
					{:else}
						<div class="compact-empty">今天还没有日程</div>
					{/if}
				</div>
			</section>

			<section class="schedule-section selected-section">
				<div class="section-heading">
					<div>
						<p>SELECTED DATE</p>
						<h3>{selectedDate === todayKey ? "为今天创建日程" : "选中日期"}</h3>
					</div>
					<small>{formatSideDate(selectedDate)}</small>
				</div>
				<p class="relative-days section-relative">{relativeDateText(selectedDate)}</p>

				{#if selectedDate !== todayKey && selectedSchedules.length > 0}
					<div class="schedule-list selected-schedule-list">
						{#each selectedSchedules as item}
							<div class="date-item schedule-item compact-schedule-item">
								<span class="item-content">
									<span class="item-meta">
										{#if item.time}<time datetime={`${item.date}T${item.time}`}>{item.time}</time>{:else}<span>全天</span>{/if}
										<span class={`status-tag status-${item.status}`}>{scheduleStatusLabel[item.status]}</span>
									</span>
									<strong>{item.title}</strong>
									<small class="relative-days">{relativeDateText(item.date)}</small>
									{#if item.description}<small>{item.description}</small>{/if}
								</span>
								{#if item.localId}
									<button type="button" class="delete-schedule" aria-label={`删除日程：${item.title}`} onclick={() => removeSchedule(item.localId!)}>×</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<form class="schedule-form" onsubmit={createSchedule}>
					<label for="schedule-title">日程名称</label>
					<input
						bind:this={titleInput}
						bind:value={draftTitle}
						id="schedule-title"
						name="schedule-title"
						maxlength="60"
						placeholder="输入准备做的事情"
						required
					/>
					<div class="form-row">
						<input bind:value={draftTime} type="time" aria-label="日程时间" />
						<button type="submit">添加日程</button>
					</div>
					<small>新日程仅保存在当前浏览器中。</small>
				</form>
			</section>
		</div>
	</aside>
</div>

<style>
	.calendar-workspace {
		--calendar-holiday: #ef4444;
		--calendar-progress: #f59e0b;
		--calendar-festival: #14b8a6;
		--calendar-anniversary: #8b5cf6;
		--calendar-important: #ec4899;
		--calendar-schedule: #0ea5e9;
		display: grid;
		grid-template-areas: "important calendar schedule";
		grid-template-columns: minmax(13rem, 0.82fr) minmax(28rem, 1.72fr) minmax(16rem, 1fr);
		gap: 1rem;
		width: 100%;
		min-width: 0;
	}

	.side-panel,
	.calendar-panel {
		min-width: 0;
	}

	.important-panel {
		grid-area: important;
	}

	.calendar-panel {
		grid-area: calendar;
		padding: 1.5rem;
	}

	.schedule-panel {
		grid-area: schedule;
	}

	.side-panel {
		align-self: start;
		overflow: hidden;
	}

	.panel-header,
	.calendar-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.panel-header {
		padding: 1.25rem 1.25rem 1rem;
		border-bottom: 1px solid var(--line-divider);
	}

	.panel-kicker,
	.calendar-year {
		margin: 0 0 0.25rem;
		color: var(--content-meta);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.12em;
	}

	.panel-header h2,
	.calendar-toolbar h1 {
		margin: 0;
		color: rgb(0 0 0 / 88%);
		font-weight: 750;
		line-height: 1.15;
	}

	.panel-header h2 {
		font-size: 1.05rem;
	}

	.panel-count {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border-radius: 999px;
		background: var(--btn-plain-bg-hover);
		color: var(--primary);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.panel-list {
		display: flex;
		max-height: 40rem;
		flex-direction: column;
		gap: 0.65rem;
		overflow-y: auto;
		padding: 1rem;
	}

	.date-item {
		display: flex;
		width: 100%;
		min-width: 0;
		gap: 0.75rem;
		border: 1px solid transparent;
		border-radius: 0.9rem;
		background: transparent;
		padding: 0.75rem;
		color: inherit;
		font: inherit;
		text-align: left;
		transition: 160ms ease;
		cursor: pointer;
	}

	.date-item:hover,
	.date-item.active {
		border-color: var(--line-divider);
		background: var(--btn-plain-bg-hover);
	}

	.date-item.active {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent);
	}

	.date-accent {
		width: 0.3rem;
		min-height: 3.5rem;
		flex: 0 0 0.3rem;
		border-radius: 999px;
		background: var(--calendar-important);
	}

	.accent-holiday,
	.tag-holiday,
	.marker-holiday {
		--marker-color: var(--calendar-holiday);
	}

	.accent-festival,
	.tag-festival,
	.marker-festival {
		--marker-color: var(--calendar-festival);
	}

	.accent-anniversary,
	.tag-anniversary,
	.marker-anniversary {
		--marker-color: var(--calendar-anniversary);
	}

	.accent-important,
	.tag-important,
	.marker-important {
		--marker-color: var(--calendar-important);
	}

	.date-accent {
		background: var(--marker-color, var(--calendar-important));
	}

	.item-content {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.3rem;
	}

	.item-content > strong {
		overflow: hidden;
		color: rgb(0 0 0 / 82%);
		font-size: 0.9rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-content > small,
	.item-time {
		color: var(--content-meta);
		font-size: 0.72rem;
		line-height: 1.55;
	}

	.item-content > .relative-days,
	.relative-days {
		color: var(--primary);
		font-size: 0.66rem;
		font-weight: 700;
	}

	.item-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		color: var(--content-meta);
		font-size: 0.65rem;
	}

	.category-tag,
	.status-tag {
		flex: 0 0 auto;
		border-radius: 999px;
		padding: 0.14rem 0.42rem;
		background: color-mix(in srgb, var(--marker-color, var(--primary)) 14%, transparent);
		color: var(--marker-color, var(--primary));
		font-size: 0.62rem;
		font-weight: 700;
	}

	.date-block {
		display: grid;
		width: 2.65rem;
		height: 2.85rem;
		flex: 0 0 2.65rem;
		place-content: center;
		border-radius: 0.75rem;
		background: color-mix(in srgb, var(--calendar-schedule) 13%, transparent);
		color: var(--calendar-schedule);
		text-align: center;
	}

	.date-block strong {
		font-size: 1.05rem;
		line-height: 1;
	}

	.date-block small {
		margin-top: 0.16rem;
		font-size: 0.58rem;
	}

	.status-planned {
		--marker-color: var(--calendar-schedule);
	}

	.status-in-progress {
		--marker-color: var(--calendar-progress);
	}

	.status-done {
		--marker-color: #22c55e;
	}

	.schedule-sections {
		display: flex;
		flex-direction: column;
	}

	.schedule-section {
		padding: 1rem;
	}

	.schedule-section + .schedule-section {
		border-top: 1px solid var(--line-divider);
	}

	.section-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.section-heading p {
		margin: 0 0 0.2rem;
		color: var(--content-meta);
		font-size: 0.58rem;
		font-weight: 750;
		letter-spacing: 0.1em;
	}

	.section-heading h3 {
		margin: 0;
		color: rgb(0 0 0 / 82%);
		font-size: 0.9rem;
		font-weight: 750;
	}

	.section-heading > small {
		flex: 0 0 auto;
		color: var(--content-meta);
		font-size: 0.62rem;
		line-height: 1.5;
		text-align: right;
	}

	.section-relative {
		margin: 0.35rem 0 0.75rem;
	}

	.schedule-list {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.schedule-list .date-item {
		position: relative;
		border-color: color-mix(in srgb, var(--calendar-schedule) 24%, var(--line-divider));
		background: color-mix(in srgb, var(--calendar-schedule) 7%, transparent);
	}

	.selected-schedule-list {
		margin-bottom: 0.75rem;
	}

	.compact-schedule-item {
		padding: 0.65rem;
	}

	.compact-empty {
		border: 1px dashed var(--line-divider);
		border-radius: 0.75rem;
		padding: 0.85rem;
		color: var(--content-meta);
		font-size: 0.72rem;
		text-align: center;
	}

	.delete-schedule {
		display: grid;
		width: 1.35rem;
		height: 1.35rem;
		flex: 0 0 1.35rem;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--content-meta);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}

	.delete-schedule:hover {
		background: color-mix(in srgb, var(--calendar-holiday) 12%, transparent);
		color: var(--calendar-holiday);
	}

	.schedule-form {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		margin-top: 0.2rem;
		border-radius: 0.85rem;
		background: var(--btn-plain-bg-hover);
		padding: 0.8rem;
	}

	.schedule-form label {
		color: rgb(0 0 0 / 72%);
		font-size: 0.7rem;
		font-weight: 700;
	}

	.schedule-form input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		border: 1px solid var(--line-divider);
		border-radius: 0.6rem;
		outline: none;
		background: color-mix(in srgb, white 78%, transparent);
		padding: 0.55rem 0.65rem;
		color: rgb(0 0 0 / 78%);
		font: inherit;
		font-size: 0.72rem;
	}

	.schedule-form input:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 16%, transparent);
	}

	.form-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.45rem;
	}

	.form-row button {
		border: 0;
		border-radius: 0.6rem;
		background: var(--primary);
		padding: 0.55rem 0.7rem;
		color: white;
		font: inherit;
		font-size: 0.68rem;
		font-weight: 750;
		white-space: nowrap;
		cursor: pointer;
	}

	.schedule-form > small {
		color: var(--content-meta);
		font-size: 0.6rem;
		line-height: 1.4;
	}

	.empty-state {
		display: flex;
		min-height: 8rem;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 0.35rem;
		padding: 1rem;
		color: var(--content-meta);
		text-align: center;
	}

	.empty-state span {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.empty-state small {
		font-size: 0.7rem;
	}

	.calendar-toolbar {
		margin-bottom: 1.25rem;
	}

	.calendar-toolbar h1 {
		font-size: 2rem;
	}

	.calendar-actions {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.today-button,
	.month-button {
		border: 1px solid var(--line-divider);
		background: transparent;
		color: rgb(0 0 0 / 70%);
		font: inherit;
		cursor: pointer;
		transition: 160ms ease;
	}

	.today-button:hover,
	.month-button:hover {
		border-color: color-mix(in srgb, var(--primary) 45%, var(--line-divider));
		background: var(--btn-plain-bg-hover);
		color: var(--primary);
	}

	.today-button {
		border-radius: 0.65rem;
		padding: 0.48rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 650;
	}

	.month-button {
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		place-items: center;
		border-radius: 50%;
		font-size: 1.35rem;
		line-height: 1;
	}

	.weekday-row,
	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}

	.weekday-row {
		margin-bottom: 0.45rem;
		border-bottom: 1px solid var(--line-divider);
		padding-bottom: 0.65rem;
	}

	.weekday-row span {
		color: var(--content-meta);
		font-size: 0.68rem;
		font-weight: 700;
		text-align: center;
	}

	.weekday-row .weekend {
		color: var(--calendar-holiday);
	}

	.calendar-grid {
		gap: 0.35rem;
	}

	.calendar-day {
		display: flex;
		min-width: 0;
		min-height: 5.1rem;
		flex-direction: column;
		gap: 0.38rem;
		border: 1px solid transparent;
		border-radius: 0.75rem;
		background: transparent;
		padding: 0.55rem;
		color: rgb(0 0 0 / 72%);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: 160ms ease;
	}

	.calendar-day:hover {
		background: var(--btn-plain-bg-hover);
	}

	.calendar-day.outside-month {
		opacity: 0.32;
	}

	.calendar-day.today {
		border-color: color-mix(in srgb, var(--primary) 60%, transparent);
	}

	.calendar-day.selected {
		background: color-mix(in srgb, var(--primary) 10%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 50%, transparent);
	}

	.day-number {
		display: grid;
		width: 1.7rem;
		height: 1.7rem;
		place-items: center;
		border-radius: 50%;
		font-size: 0.82rem;
		font-weight: 650;
	}

	.calendar-day.today .day-number {
		background: var(--primary);
		color: white;
	}

	.day-markers {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.22rem;
	}

	.day-marker {
		overflow: hidden;
		border-left: 0.18rem solid var(--marker-color, var(--calendar-important));
		border-radius: 0.28rem;
		background: color-mix(in srgb, var(--marker-color, var(--calendar-important)) 12%, transparent);
		padding: 0.15rem 0.28rem;
		color: var(--marker-color, var(--calendar-important));
		font-size: 0.56rem;
		font-weight: 650;
		line-height: 1.2;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.marker-schedule {
		--marker-color: var(--calendar-schedule);
	}

	.more-markers {
		color: var(--content-meta);
		font-size: 0.56rem;
	}

	.calendar-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1rem;
		border-top: 1px solid var(--line-divider);
		padding-top: 1rem;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		color: var(--content-meta);
		font-size: 0.65rem;
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.legend i {
		display: inline-block;
		width: 0.48rem;
		height: 0.48rem;
		border-radius: 50%;
	}

	.legend-important {
		background: var(--calendar-anniversary);
	}

	.legend-schedule {
		background: var(--calendar-schedule);
	}

	.legend-today {
		border: 1px solid var(--primary);
	}

	.selected-summary {
		display: flex;
		min-width: 0;
		align-items: flex-end;
		flex-direction: column;
		gap: 0.2rem;
		text-align: right;
	}

	.selected-summary strong {
		color: rgb(0 0 0 / 76%);
		font-size: 0.72rem;
	}

	.selected-summary span {
		max-width: 18rem;
		overflow: hidden;
		color: var(--content-meta);
		font-size: 0.65rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(:root.dark) .panel-header h2,
	:global(:root.dark) .calendar-toolbar h1,
	:global(:root.dark) .item-content > strong,
	:global(:root.dark) .section-heading h3,
	:global(:root.dark) .schedule-form label,
	:global(:root.dark) .selected-summary strong {
		color: rgb(255 255 255 / 88%);
	}

	:global(:root.dark) .today-button,
	:global(:root.dark) .month-button,
	:global(:root.dark) .calendar-day {
		color: rgb(255 255 255 / 72%);
	}

	:global(:root.dark) .schedule-form input {
		background: rgb(0 0 0 / 18%);
		color: rgb(255 255 255 / 82%);
	}

	:global(:root.dark) .form-row button {
		color: rgb(0 0 0 / 76%);
	}

	:global(:root.dark) .calendar-day.today .day-number {
		color: rgb(0 0 0 / 75%);
	}

	@media (max-width: 1050px) {
		.calendar-workspace {
			grid-template-areas:
				"calendar calendar"
				"important schedule";
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 680px) {
		.calendar-workspace {
			grid-template-areas:
				"calendar"
				"important"
				"schedule";
			grid-template-columns: minmax(0, 1fr);
			width: calc(100vw - 1rem);
			max-width: calc(100vw - 1rem);
			margin-inline: auto;
			overflow: hidden;
		}

		.side-panel,
		.calendar-panel {
			box-sizing: border-box;
			width: 100%;
			max-width: 100%;
			overflow: hidden;
		}

		.calendar-panel {
			padding: 1rem;
		}

		.calendar-toolbar {
			flex-wrap: wrap;
		}

		.calendar-actions {
			margin-left: auto;
		}

		.item-meta {
			align-items: flex-start;
			flex-wrap: wrap;
		}

		.calendar-toolbar h1 {
			font-size: 1.6rem;
		}

		.calendar-day {
			min-height: 3.55rem;
			gap: 0.2rem;
			padding: 0.32rem;
		}

		.day-marker {
			width: 0.38rem;
			height: 0.38rem;
			align-self: center;
			border: 0;
			border-radius: 50%;
			background: var(--marker-color, var(--calendar-important));
			padding: 0;
			color: transparent;
		}

		.day-markers {
			align-items: center;
			flex-direction: row;
			justify-content: center;
		}

		.more-markers {
			display: none;
		}

		.calendar-footer {
			align-items: flex-start;
			flex-direction: column;
		}

		.selected-summary {
			align-items: flex-start;
			text-align: left;
		}
	}
</style>
