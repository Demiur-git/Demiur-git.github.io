import type { BackgroundWallpaperConfig } from "@/types/backgroundWallpaper";

export const backgroundWallpaper: BackgroundWallpaperConfig = {
	mode: "overlay",
	playerEnable: false,
	// 可将自己的图片放进 src/assets/images/backgrounds/，这里填写相对 src 的路径。
	// desktop/mobile 都支持字符串或字符串数组；数组会沿用现有轮播系统。
	src: {
		desktop: "assets/images/library-reading-desk.png",
		mobile: "assets/images/library-reading-desk.png",
	},
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
	overlay: {
		zIndex: -1,
		homeOpacity: 0.28,
		contentOpacity: 0.12,
		homeBlur: 1,
		contentBlur: 5,
		cardOpacity: 0.9,
	},
};
