import type {
	Live2DWidgetConfig,
	OcPetConfig,
	SpineModelConfig,
} from "../types/pioConfig";

export const ocPetConfig: OcPetConfig = {
	enable: true,
	name: "绫",
	position: "bottom-left",
	size: {
		desktop: 168,
		mobile: 112,
	},
	assets: {
		idle: "/images/oc-pet/idle.webp",
		blink: "/images/oc-pet/blink.webp",
		interact: "/images/oc-pet/interact.webp",
	},
	messages: [
		"嘘——这里的故事正在慢慢醒来。",
		"今天想从哪一排书架开始？",
		"别忘了把喜欢的那一页夹上书签。",
		"窗边的位置还空着，请坐。",
		"每一次记录，都会成为新的馆藏。",
	],
	messageDuration: 3200,
	blinkInterval: {
		min: 4500,
		max: 9000,
	},
	storageKey: "personal-library-oc-pet",
	zIndex: 980,
};

export const spineModelConfig: SpineModelConfig = {
	enable: false,
	model: { path: "" },
	position: { corner: "bottom-left" },
	size: {},
};

export const live2dWidgetConfig: Live2DWidgetConfig = {
	enable: false,
	model: { path: "" },
};
