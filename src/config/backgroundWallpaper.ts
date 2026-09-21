import type { BackgroundWallpaperConfig } from "@/types/backgroundWallpaper";

export const backgroundWallpaper: BackgroundWallpaperConfig = {
	mode: "none",
	playerEnable: false,
	src: [],
	common: {
		homeText: {
			enable: false,
		},
		waves: {
			enable: {
				desktop: false,
				mobile: false,
			},
		},
		gradient: {
			enable: {
				desktop: false,
				mobile: false,
			},
		},
	},
};
