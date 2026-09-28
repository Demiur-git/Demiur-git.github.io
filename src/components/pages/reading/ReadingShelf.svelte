<script lang="ts">
import { onMount, tick } from "svelte";
import type {
	ReadingBookMetadata,
	ReadingPlanItem,
	ReadingStatus,
} from "@/types/readingPlanConfig";

let {
	books,
	metadata,
}: { books: ReadingPlanItem[]; metadata: ReadingBookMetadata[] } = $props();
const shelves: { status: ReadingStatus; title: string; hint: string }[] = [
	{ status: "planned", title: "计划阅读", hint: "等待借出的书" },
	{ status: "reading", title: "正在阅读", hint: "书签暂留在这里" },
	{ status: "finished", title: "已经读完", hint: "读过后留下的书" },
];
const metadataById = new Map(metadata.map((entry) => [entry.subjectId, entry]));
let selected = $state<ReadingPlanItem | null>(null);
let unavailableCovers = $state<number[]>([]);
let detailDialog: HTMLDialogElement;
let opener: HTMLButtonElement | null = null;
const selectedMetadata = $derived(
	selected?.bangumiSubjectId
		? metadataById.get(selected.bangumiSubjectId)
		: undefined,
);
const scoreText = (score: number | undefined) =>
	score === undefined ? "暂无评分" : `${score.toFixed(1)} / 10`;
const coverFor = (book: ReadingPlanItem) => {
	const id = book.bangumiSubjectId;
	return id && !unavailableCovers.includes(id)
		? metadataById.get(id)?.cover
		: undefined;
};

async function openBook(book: ReadingPlanItem, button: HTMLButtonElement) {
	opener = button;
	selected = book;
	await tick();
	if (!detailDialog.open) detailDialog.showModal();
}

function closeBook() {
	if (detailDialog.open) detailDialog.close();
}

function handleClose() {
	selected = null;
	if (opener?.isConnected) opener.focus({ preventScroll: true });
	opener = null;
}

onMount(() => () => {
	opener = null;
	if (detailDialog?.open) detailDialog.close();
});
</script>

<div class="reading-shelf" aria-label="读书计划书架">
	{#if books.length === 0}
		<p class="reading-empty">书架还是空的。可在读书计划配置中添加第一本书。</p>
	{/if}
	{#each shelves as shelf}
		{@const shelfBooks = books.filter((book) => book.status === shelf.status)}
		<section class="reading-shelf-tier" aria-label={shelf.title}>
			<div class="reading-tier-heading"><h3>{shelf.title}</h3><span>{shelfBooks.length} 本</span></div>
			<div class="reading-tier-books">
				{#each shelfBooks as book, index (`${shelf.status}-${book.bangumiSubjectId ?? book.title}-${index}`)}
					{@const entry = book.bangumiSubjectId ? metadataById.get(book.bangumiSubjectId) : undefined}
					<button class="reading-book" type="button" aria-label={`打开《${book.title}》详情`} onclick={(event) => openBook(book, event.currentTarget)}>
						<span class="reading-book-cover">
							{#if coverFor(book)}
								<img src={coverFor(book)} alt="" loading="lazy" onerror={() => { if (book.bangumiSubjectId) unavailableCovers = [...unavailableCovers, book.bangumiSubjectId]; }} />
							{:else}
								<span class="reading-book-blank"><span>{book.title}</span><small>{book.bangumiSubjectId ? "封面暂不可用" : "未关联封面"}</small></span>
							{/if}
							<span class="reading-book-ratings" aria-hidden="true"><span>Bangumi {scoreText(entry?.score)}</span><span>个人 {scoreText(book.personalRating)}</span></span>
						</span>
						<span class="reading-book-name" title={book.title}>{book.title}</span>
					</button>
				{:else}
					<p class="reading-tier-empty">{shelf.hint}</p>
				{/each}
			</div>
		</section>
	{/each}
</div>

<dialog bind:this={detailDialog} class="reading-detail" aria-label={selected ? `《${selected.title}》详情` : "书籍详情"} onclose={handleClose} onclick={(event) => { if (event.target === detailDialog) closeBook(); }}>
	{#if selected}
		<div class="reading-detail-page">
			<button class="reading-detail-close" type="button" aria-label="关闭书籍详情" onclick={closeBook}>×</button>
			<div class="reading-detail-cover">
				{#if coverFor(selected)}<img src={coverFor(selected)} alt={`《${selected.title}》原装封面`} onerror={() => { if (selected?.bangumiSubjectId) unavailableCovers = [...unavailableCovers, selected.bangumiSubjectId]; }} />
				{:else}<span class="reading-book-blank"><span>{selected.title}</span><small>封面暂不可用</small></span>{/if}
			</div>
			<div class="reading-detail-content">
				<p class="reading-detail-kicker">READING LEDGER</p>
				<h3>{selected.title}</h3>
				{#if selected.author}<p class="reading-detail-author">{selected.author}</p>{/if}
				<p class="reading-detail-status">{shelves.find((shelf) => shelf.status === selected?.status)?.title}{selected.progress !== undefined ? ` · ${selected.progress}%` : ""}</p>
				<div class="reading-detail-ratings"><span>Bangumi <strong>{scoreText(selectedMetadata?.score)}</strong></span><span>个人 <strong>{scoreText(selected.personalRating)}</strong></span></div>
				<h4>书籍简介</h4><p class="reading-detail-prose">{selectedMetadata?.summary || "暂无简介"}</p>
				<h4>个人评价</h4><p class="reading-detail-prose">{selected.personalReview || selected.note || "暂无评价"}</p>
				{#if selected.bangumiSubjectId}<a href={`https://bgm.tv/subject/${selected.bangumiSubjectId}`} target="_blank" rel="noopener noreferrer">查看 Bangumi 条目 ↗</a>{/if}
			</div>
		</div>
	{/if}
</dialog>
