<script lang="ts">
	import { onMount } from "svelte";
	import { getUpcomingHolidays } from "@/utils/calendar-holidays";
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
	$: upcomingHolidays = getUpcomingHolidays(importantDates, todayKey);
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

	function dayClass(day: CalendarDay, activeDate: string): string {
		return [
			"calendar-day",
			day.inCurrentMonth ? "" : "outside-month",
			day.isToday ? "today" : "",
			day.dateKey === activeDate ? "selected" : "",
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
	<section class="calendar-panel" aria-label="月历">
		<header class="calendar-toolbar">
			<div>
				<p class="calendar-year">{displayYear}</p>
				<h2>{displayMonth + 1}月</h2>
				<p class="calendar-caption">馆员值日簿 · MONTHLY LEDGER</p>
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
					class={dayClass(day, selectedDate)}
					aria-label={dayAriaLabel(day)}
					aria-pressed={day.dateKey === selectedDate}
					aria-current={day.isToday ? "date" : undefined}
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

	<aside class="side-panel schedule-panel">
		<header class="panel-header">
			<div>
				<p class="panel-kicker">DAILY REGISTER</p>
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

	<aside class="side-panel important-panel">
		<header class="panel-header">
			<div>
				<p class="panel-kicker">HOLIDAY INDEX</p>
				<h2>节日索引</h2>
			</div>
			<span class="panel-count">{upcomingHolidays.length}</span>
		</header>

		<div class="panel-list">
			{#if upcomingHolidays.length > 0}
				{#each upcomingHolidays as item}
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
					<span>暂无后续节假日记录</span>
					<small>请在日历配置中补充未来节假日。</small>
				</div>
			{/if}
		</div>
	</aside>
</div>
<style>
	/* One locally scoped paper system, independent of global glass-card rules. */
	.calendar-workspace {
		--ledger-paper: #f8f3e7;
		--ledger-sheet: #fffcf5;
		--ledger-ink: var(--library-ink);
		--ledger-muted: #706858;
		--ledger-rule: #d7cebb;
		--ledger-moss: #50664d;
		--ledger-button: #4b6048;
		--ledger-red: #92545d;
		--ledger-brass: #846b3f;
		--calendar-holiday: var(--ledger-red);
		--calendar-festival: #4e716a;
		--calendar-anniversary: var(--ledger-brass);
		--calendar-important: var(--ledger-red);
		--calendar-schedule: var(--ledger-moss);
		--calendar-progress: var(--ledger-brass);
		display: grid;
		grid-template-areas: "important calendar schedule";
		grid-template-columns: minmax(11rem, .75fr) minmax(25rem, 1.85fr) minmax(17rem, 1.12fr);
		align-items: start;
		gap: 1.2rem;
		width: 100%;
		min-width: 0;
		color: var(--ledger-ink);
	}
	:global(:root.dark) .calendar-workspace {
		--ledger-paper: #272c27;
		--ledger-sheet: #30342d;
		--ledger-muted: #c0baab;
		--ledger-rule: #505747;
		--ledger-moss: #b2c3a5;
		--ledger-button: #4d6349;
		--ledger-red: #d998a3;
		--ledger-brass: #d5b884;
		--calendar-festival: #a5c8bd;
	}
	.calendar-workspace :is(button, input) { font: inherit; }
	.calendar-workspace button { cursor: pointer; }
	.calendar-workspace :is(button, input):focus-visible {
		outline: 2px solid var(--ledger-moss);
		outline-offset: 3px;
	}
	.side-panel, .calendar-panel {
		position: relative;
		min-width: 0;
		border: 1px solid var(--ledger-rule);
		border-radius: 3px;
		background: var(--ledger-paper);
		box-shadow: 0 5px 16px #251b1414;
	}
	.calendar-panel {
		grid-area: calendar;
		isolation: isolate;
		padding: 1.4rem 1.35rem 1rem 1.9rem;
		background:
			linear-gradient(90deg, #4837200a, transparent 1.65rem),
			var(--ledger-sheet);
		box-shadow: 0 3px 0 -1px var(--ledger-paper), 0 4px 0 var(--ledger-rule),
			0 7px 0 -1px var(--ledger-paper), 0 8px 0 var(--ledger-rule), 0 12px 24px #251b1414;
	}
	.calendar-panel::before {
		content: "";
		position: absolute;
		inset: .85rem auto .85rem .7rem;
		width: 5px;
		border-inline: 1px solid var(--ledger-rule);
		pointer-events: none;
	}
	.important-panel { grid-area: important; }
	.schedule-panel { grid-area: schedule; }
	.panel-header, .calendar-toolbar {
		display: flex; align-items: center; justify-content: space-between; gap: .75rem;
	}
	.panel-header { padding: 1.15rem 1rem .9rem; border-bottom: 1px solid var(--ledger-rule); }
	.panel-kicker, .calendar-year, .calendar-caption, .section-heading p {
		margin: 0 0 .3rem;
		color: var(--ledger-muted);
		font-family: var(--font-code, ui-monospace, monospace);
		font-size: .59rem;
		font-weight: 500;
		letter-spacing: .1em;
		line-height: 1.5;
	}
	.panel-header h2, .calendar-toolbar h2, .section-heading h3 {
		margin: 0;
		color: var(--ledger-ink);
		font-family: var(--font-library-serif);
		font-weight: 650;
		line-height: 1.4;
	}
	.panel-header h2 { font-size: 1.12rem; }
	.panel-count {
		display: grid; min-width: 1.8rem; height: 1.8rem; place-items: center;
		border: 1px solid var(--ledger-rule); border-radius: 2px;
		color: var(--ledger-brass); font: .78rem var(--font-code, monospace);
	}
	.calendar-toolbar { margin-bottom: 1.1rem; }
	.calendar-year { color: var(--ledger-brass); font-size: .7rem; }
	.calendar-toolbar h2 { font-size: clamp(1.7rem, 2.5vw, 2.25rem); line-height: 1.15; }
	.calendar-caption { margin: .4rem 0 0; font-size: .55rem; letter-spacing: .12em; }
	.calendar-actions { display: flex; align-items: center; gap: .35rem; }
	.today-button, .month-button {
		display: grid; min-width: 44px; min-height: 44px; place-items: center;
		border: 1px solid var(--ledger-rule); border-radius: 2px;
		background: transparent; color: var(--ledger-ink);
		transition: background-color 150ms ease, border-color 150ms ease;
	}
	.calendar-actions .today-button { padding: .35rem .65rem; font-size: .78rem; }
	.calendar-actions .month-button { font-family: var(--font-library-serif); font-size: 1.35rem; }
	.today-button:hover, .month-button:hover {
		background: color-mix(in srgb, var(--ledger-moss) 9%, var(--ledger-sheet));
		border-color: var(--ledger-moss);
	}
	.weekday-row, .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
	.weekday-row { border-block: 1px solid var(--ledger-rule); padding: .65rem 0; }
	.weekday-row span { color: var(--ledger-muted); font-size: .7rem; text-align: center; }
	.weekday-row .weekend { color: var(--ledger-red); }
	.calendar-grid { border-left: 1px solid var(--ledger-rule); }
	.calendar-day {
		display: flex; min-width: 0; min-height: 4.55rem; flex-direction: column; gap: .3rem;
		border: 0; border-right: 1px solid var(--ledger-rule); border-bottom: 1px solid var(--ledger-rule);
		border-radius: 0; padding: .45rem .3rem;
		background: transparent; color: var(--ledger-ink); text-align: left;
		transition: background-color 150ms ease;
	}
	.calendar-day:hover { background: color-mix(in srgb, var(--ledger-moss) 6%, var(--ledger-sheet)); }
	.calendar-day.outside-month { color: var(--ledger-muted); }
	.outside-month .day-number { opacity: .6; }
	.calendar-day.selected {
		background: color-mix(in srgb, var(--ledger-moss) 10%, var(--ledger-sheet));
		box-shadow: inset 0 0 0 1px var(--ledger-moss);
	}
	.calendar-day:focus-visible { z-index: 1; outline-offset: -3px; }
	.day-number {
		display: grid; width: 1.65rem; height: 1.65rem; flex: 0 0 auto; place-items: center;
		border: 1px solid transparent; border-radius: 50%;
		font-size: .78rem; font-variant-numeric: tabular-nums;
	}
	.calendar-day.today .day-number { border-color: var(--ledger-red); color: var(--ledger-red); font-weight: 750; }
	.day-markers { display: flex; min-width: 0; flex-direction: column; gap: .16rem; }
	.day-marker {
		overflow: hidden; border-left: 2px solid var(--marker-color, var(--calendar-important));
		background: color-mix(in srgb, var(--marker-color, var(--calendar-important)) 8%, var(--ledger-sheet));
		padding: .12rem .2rem; color: var(--marker-color, var(--calendar-important));
		font-size: .6rem; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap;
	}
	.accent-holiday, .tag-holiday, .marker-holiday { --marker-color: var(--calendar-holiday); }
	.accent-festival, .tag-festival, .marker-festival { --marker-color: var(--calendar-festival); }
	.accent-anniversary, .tag-anniversary, .marker-anniversary { --marker-color: var(--calendar-anniversary); }
	.accent-important, .tag-important, .marker-important { --marker-color: var(--calendar-important); }
	.marker-schedule, .status-planned { --marker-color: var(--calendar-schedule); }
	.status-in-progress { --marker-color: var(--calendar-progress); }
	.status-done { --marker-color: var(--ledger-moss); }
	.more-markers { color: var(--ledger-muted); font-size: .61rem; }
	.calendar-footer { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: .8rem; padding-top: .9rem; }
	.legend { display: flex; flex-wrap: wrap; gap: .65rem; color: var(--ledger-muted); font-size: .62rem; }
	.legend span { display: inline-flex; align-items: center; gap: .3rem; }
	.legend i { display: inline-block; width: .45rem; height: .45rem; border-radius: 50%; }
	.legend-important { background: var(--calendar-important); }
	.legend .legend-schedule { background: var(--calendar-schedule); border-radius: 0; }
	.legend-today { border: 1px solid var(--ledger-red); }
	.selected-summary { display: flex; min-width: 0; flex-direction: column; gap: .2rem; margin-left: auto; text-align: right; }
	.selected-summary strong { font-size: .7rem; font-weight: 600; }
	.selected-summary span { max-width: 17rem; color: var(--ledger-muted); font-size: .67rem; line-height: 1.6; overflow-wrap: anywhere; }
	.panel-list { display: flex; flex-direction: column; gap: .85rem; padding: 1rem .85rem 1.15rem; }
	.date-item { display: flex; min-width: 0; width: 100%; gap: .65rem; color: inherit; text-align: left; }
	.important-panel .date-item {
		position: relative; min-height: 44px; border: 1px solid var(--ledger-rule); border-radius: 2px;
		background: var(--ledger-sheet); padding: .85rem .65rem .8rem;
		box-shadow: 1px 2px 4px #251b140a; transition: border-color 150ms ease, background-color 150ms ease;
	}
	.important-panel .date-item::after {
		content: ""; position: absolute; top: -1px; right: .55rem; width: .9rem; height: .25rem;
		background: color-mix(in srgb, var(--ledger-brass) 40%, var(--ledger-paper)); pointer-events: none;
	}
	.important-panel .date-item:hover, .important-panel .date-item.active {
		border-color: var(--ledger-moss); background: color-mix(in srgb, var(--ledger-moss) 5%, var(--ledger-sheet));
	}
	.date-accent { width: 2px; flex: 0 0 2px; background: var(--marker-color, var(--calendar-important)); }
	.item-content { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: .35rem; }
	.item-content > strong { font-family: var(--font-library-serif); font-size: .9rem; font-weight: 650; line-height: 1.65; overflow-wrap: anywhere; }
	.item-content > small { color: var(--ledger-muted); font-size: .72rem; line-height: 1.6; overflow-wrap: anywhere; }
	.relative-days, .item-content > .relative-days { color: var(--ledger-moss); font-size: .67rem; font-weight: 500; }
	.item-meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .3rem .5rem; color: var(--ledger-muted); font-size: .65rem; }
	.category-tag, .status-tag {
		flex: 0 0 auto; border: 1px solid color-mix(in srgb, var(--marker-color, var(--ledger-moss)) 35%, var(--ledger-rule));
		border-radius: 2px; padding: .06rem .25rem;
		color: var(--marker-color, var(--ledger-moss)); font-size: .6rem; line-height: 1.5;
	}
	.schedule-section { padding: 1rem; }
	.schedule-section + .schedule-section { border-top: 1px solid var(--ledger-rule); }
	.section-heading { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: .35rem .5rem; }
	.section-heading h3 { font-size: .98rem; }
	.section-heading > small { color: var(--ledger-muted); font-size: .65rem; line-height: 1.8; }
	.section-relative { margin: .35rem 0 .8rem; }
	.schedule-list { display: flex; flex-direction: column; }
	.schedule-item { align-items: flex-start; border-top: 1px solid var(--ledger-rule); padding: .75rem 0; cursor: default; }
	.schedule-item:first-child { border-top: 0; padding-top: .2rem; }
	.date-block { display: flex; min-width: 2.1rem; flex-direction: column; align-items: center; border-right: 1px solid var(--ledger-rule); padding-right: .5rem; color: var(--ledger-brass); }
	.date-block strong { font: 1.3rem var(--font-library-serif); line-height: 1.2; }
	.date-block small { font-size: .6rem; margin-top: .2rem; }
	.selected-schedule-list { margin-bottom: .8rem; }
	.compact-empty, .empty-state {
		padding: .8rem .5rem; border-block: 1px dashed var(--ledger-rule);
		color: var(--ledger-muted); font-size: .75rem; line-height: 1.7; text-align: center;
	}
	.empty-state { display: flex; flex-direction: column; gap: .3rem; }
	.empty-state small { font-size: .65rem; }
	.calendar-workspace .delete-schedule {
		display: grid; min-width: 44px; min-height: 44px; flex: 0 0 44px; place-items: center;
		border: 1px solid transparent; border-radius: 2px; background: transparent;
		color: var(--ledger-muted); font-size: 1.2rem; line-height: 1;
	}
	.delete-schedule:hover { border-color: var(--ledger-rule); color: var(--ledger-red); }
	.schedule-form {
		display: flex; flex-direction: column; gap: .6rem; margin-top: .35rem;
		border: 1px solid var(--ledger-rule); border-radius: 2px; padding: .9rem .75rem;
		background:
			repeating-linear-gradient(0deg, transparent 0 1.8rem, color-mix(in srgb, var(--ledger-rule) 35%, transparent) 1.8rem calc(1.8rem + 1px)),
			var(--ledger-sheet);
	}
	.schedule-form label { color: var(--ledger-ink); font-size: .72rem; font-weight: 650; }
	.schedule-form input {
		box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px;
		border: 1px solid var(--ledger-rule); border-radius: 2px;
		background: var(--ledger-paper); padding: .5rem .55rem;
		color: var(--ledger-ink); font-size: .78rem;
	}
	.schedule-form input::placeholder { color: var(--ledger-muted); opacity: 1; }
	.schedule-form input:focus { border-color: var(--ledger-moss); }
	:global(:root.dark) .schedule-form input { color-scheme: dark; }
	.form-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .4rem; }
	.calendar-workspace .form-row button {
		min-height: 44px; border: 1px solid var(--ledger-button); border-radius: 2px;
		background: var(--ledger-button); padding: .5rem .65rem; color: #fffdf5;
		font-size: .74rem; white-space: nowrap; transition: background-color 150ms ease;
	}
	.form-row button:hover { background: color-mix(in srgb, var(--ledger-button) 85%, #151e13); }
	.schedule-form > small { color: var(--ledger-muted); font-size: .63rem; line-height: 1.7; }
	@media (max-width: 1024px) {
		.calendar-workspace { grid-template-areas: "calendar calendar" "important schedule"; grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.calendar-day { min-height: 4.25rem; }
	}
	@media (max-width: 640px) {
		.calendar-workspace { grid-template-areas: "calendar" "schedule" "important"; grid-template-columns: minmax(0, 1fr); gap: 1.2rem; }
		.calendar-panel { padding: 1.1rem .65rem .9rem 1.15rem; }
		.calendar-panel::before { left: .35rem; width: 3px; }
		.calendar-toolbar { gap: .4rem; }
		.calendar-toolbar h2 { font-size: 1.7rem; }
		.calendar-caption { font-size: .5rem; letter-spacing: .04em; }
		.calendar-actions { gap: .2rem; }
		.calendar-day { min-height: 3.65rem; gap: .22rem; padding: .3rem .12rem; }
		.day-number { width: 1.45rem; height: 1.45rem; font-size: .75rem; }
		.day-marker { font-size: .56rem; border-left-width: 1px; padding: .09rem .12rem; }
		.calendar-footer { gap: .65rem; }
		.selected-summary { margin-left: 0; width: 100%; text-align: left; }
		.selected-summary span { max-width: none; }
		.panel-header { padding: 1rem; }
	}
	@media (prefers-reduced-motion: reduce) {
		.calendar-workspace button { transition: none; }
	}
</style>
