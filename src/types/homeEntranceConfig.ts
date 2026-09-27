export interface HomeEntranceDialogueLine {
	speaker: string;
	text: string;
}

export interface HomeEntranceConfig {
	dialogue: HomeEntranceDialogueLine[];
	characterDialogue: HomeEntranceDialogueLine[];
	characterChoices: {
		label: string;
		dialogue: HomeEntranceDialogueLine[];
	}[];
}
