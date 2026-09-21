export type HomeIntroLink = {
	name: string;
	url: string;
	icon: string;
	external?: boolean;
};

export type HomeIntroConfig = {
	eyebrow: string;
	title: string;
	description: string;
	links: HomeIntroLink[];
};
