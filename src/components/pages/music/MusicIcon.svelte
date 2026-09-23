<script lang="ts">
	export type MusicIconName =
		| "album"
		| "lyrics"
		| "music-note"
		| "next"
		| "pause"
		| "play"
		| "prev"
		| "repeat"
		| "repeat-one"
		| "settings"
		| "shuffle"
		| "spinner"
		| "volume-off"
		| "volume-up";

	export let name: MusicIconName;
	export let className = "";
</script>

<svg
	class={className}
	viewBox="0 0 24 24"
	fill="currentColor"
	aria-hidden="true"
	focusable="false"
>
	{#if name === "play"}
		<path d="M8 5v14l11-7z" />
	{:else if name === "pause"}
		<path d="M6 5h4v14H6zm8 0h4v14h-4z" />
	{:else if name === "prev"}
		<path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
	{:else if name === "next"}
		<path d="M16 6h2v12h-2zm-10 0v12l8.5-6z" />
	{:else if name === "repeat"}
		<path d="M7 7h9.2l-1.6-1.6L16 4l4 4-4 4-1.4-1.4L16.2 9H7a3 3 0 0 0-3 3H2a5 5 0 0 1 5-5m10 10H7.8l1.6 1.6L8 20l-4-4 4-4 1.4 1.4L7.8 15H17a3 3 0 0 0 3-3h2a5 5 0 0 1-5 5" />
	{:else if name === "repeat-one"}
		<path d="M7 7h9.2l-1.6-1.6L16 4l4 4-4 4-1.4-1.4L16.2 9H7a3 3 0 0 0-3 3H2a5 5 0 0 1 5-5m10 10H7.8l1.6 1.6L8 20l-4-4 4-4 1.4 1.4L7.8 15H17a3 3 0 0 0 3-3h2a5 5 0 0 1-5 5m-4-7v6h-1.5v-4.4l-1 .6-.7-1.1 2-1.1z" />
	{:else if name === "shuffle"}
		<path d="M16 3h5v5h-2V6.4l-3.8 3.8-1.4-1.4L17.6 5H16zM3 6h3.6l10.8 10.6V15H19v5h-5v-2h1.6L5.8 8H3zm7 5.8 1.4 1.4L6.6 18H3v-2h2.8z" />
	{:else if name === "volume-up"}
		<path d="M3 9v6h4l5 4V5L7 9zm11.5-.5a5 5 0 0 1 0 7l1.4 1.4a7 7 0 0 0 0-9.8zm2.8-2.8a9 9 0 0 1 0 12.6l1.4 1.4a11 11 0 0 0 0-15.4z" />
	{:else if name === "volume-off"}
		<path d="m4.3 3 16.7 16.7-1.3 1.3-5.2-5.2a7 7 0 0 1-1.1.6V14a5 5 0 0 0-.5.2L12 13.3V19l-5-4H3V9h2.2L3 6.3zm7.7 2v4.5L9.1 6.6zm5.6 3.1a7 7 0 0 1 .8 8.3L17 15a5 5 0 0 0-.8-5.5zm-3.1.4a5 5 0 0 1 1.8 4.6l-1.9-1.9a3 3 0 0 0-1.1-1.5z" />
	{:else if name === "music-note"}
		<path d="M12 3v10.6a4 4 0 1 0 2 3.4V8h5V3zm-2 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0" />
	{:else if name === "lyrics"}
		<path d="M4 4h16v12H7l-3 3zm3 3v2h10V7zm0 4v2h7v-2z" />
	{:else if name === "settings"}
		<path d="M4 6h10v2H4zm14-2h2v6h-2zM4 16h4v2H4zm8-2h2v6h-2zm4 2h4v2h-4zM10 5h2v4h-2z" />
	{:else if name === "album"}
		<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 2a8 8 0 0 1 7.7 6H15a4 4 0 0 0-5.8-1.8L6 5.1A8 8 0 0 1 12 4m0 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4m0 10a8 8 0 0 1-7.7-6H9a4 4 0 0 0 5.8 1.8l3.2 3.1A8 8 0 0 1 12 20" />
	{:else if name === "spinner"}
		<path d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8z">
			<animateTransform attributeName="transform" dur="0.8s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12" />
		</path>
	{/if}
</svg>

<style>
	svg {
		display: inline-block;
		width: 1em;
		height: 1em;
		flex: 0 0 auto;
	}
</style>
