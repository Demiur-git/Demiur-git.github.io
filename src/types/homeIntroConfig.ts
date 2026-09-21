import type { ImageMetadata } from "astro";

export type HomeIntroLink = {
	name: string;
	url: string;
	icon: string;
	external?: boolean;
};

export type HomeCatalogTone = "moss" | "burgundy" | "brass";

export type HomeCatalogEntry = {
	code: string;
	name: string;
	description: string;
	url: string;
	icon: string;
	tone: HomeCatalogTone;
};

export type HomeHeroArtwork = {
	src: ImageMetadata;
	alt: string;
	position?: string;
};

export type HomeIntroConfig = {
	eyebrow: string;
	title: string;
	description: string;
	links: HomeIntroLink[];
	heroArtwork: HomeHeroArtwork;
	catalogEyebrow: string;
	catalogTitle: string;
	catalogDescription: string;
	catalogEntries: HomeCatalogEntry[];
};
