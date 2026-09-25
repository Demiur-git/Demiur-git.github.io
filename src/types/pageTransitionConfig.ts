export type PageTransitionTiming = {
	enter: number;
	open: number;
	writeMin: number;
	writeMax: number;
	writePerCharacter: number;
	hold: number;
	reveal: number;
};

export type PageTransitionWritingConfig = {
	mode: "auto";
	style: "fountain";
	/** 0-1，控制湿墨边缘的扩散强度。 */
	inkBleed: number;
	/** 换笔画时是否短暂抬起笔尖。 */
	penLift: boolean;
};

export type PageTransitionConfig = {
	enable: boolean;
	timing: PageTransitionTiming;
	writing: PageTransitionWritingConfig;
	destinationLabels: Record<string, string>;
};
