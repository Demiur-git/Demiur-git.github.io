export type PageTransitionTiming = {
	cover: number;
	write: number;
	hold: number;
	reveal: number;
};

export type PageTransitionConfig = {
	enable: boolean;
	text?: string;
	timing: PageTransitionTiming;
};
