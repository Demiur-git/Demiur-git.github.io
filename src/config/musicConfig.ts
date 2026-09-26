import type {
	MusicLocalTrack,
	MusicLyricOverride,
	MusicPlayerConfig,
} from "../types/musicConfig";
import { selectMusicLibrary } from "../utils/music-library";
import localLibrary from "./musicLibrary.generated.json";
import publicLibrary from "./musicLibrary.public.json";

const musicLibrary = selectMusicLibrary<{ tracks: MusicLocalTrack[] }>(
	import.meta.env.PUBLIC_MUSIC_LIBRARY,
	localLibrary,
	publicLibrary,
);

const generatedPlaylist = musicLibrary.tracks as MusicLocalTrack[];
const generatedLyricOverrides = Object.fromEntries(
	generatedPlaylist.flatMap((track) => {
		if (!track.id || (!track.translationLrc && !track.romajiLrc)) return [];
		return [
			[
				track.id,
				{
					translationLrc: track.translationLrc,
					romajiLrc: track.romajiLrc,
				},
			],
		];
	}),
) as Record<string, MusicLyricOverride>;

export const musicPlayerConfig: MusicPlayerConfig = {
	showInNavbar: false,
	showInSidebar: false,
	// 本地默认读个人曲库；PUBLIC_MUSIC_LIBRARY=public 使用独立公开清单。
	mode: "local",
	volume: 0.7,
	playMode: "list",
	showLyrics: true,
	meting: {
		// 示例：https://music-api.example.com/api?server=:server&type=:type&id=:id&r=:r
		// 请仅填写自托管的 Meting API；Cookie 与密钥应保存在服务端环境变量中。
		api: "",
		server: "netease",
		type: "playlist",
		// 网易云歌单链接中的 id，例如 playlist?id=123456 对应 "123456"。
		id: "",
		fallbackApis: [],
	},
	local: {
		playlist: generatedPlaylist,
	},
	page: {
		title: "音乐馆藏",
		description: "在唱片与歌词之间，收藏想要反复聆听的声音。",
		// 需要译文或罗马音时，以歌曲 ID 为 key 补充 LRC：
		// lyricOverrides: {
		// 	"123456": {
		// 		translationLrc: "/assets/music/lyrics/123456.translation.lrc",
		// 		romajiLrc: "/assets/music/lyrics/123456.romaji.lrc",
		// 	},
		// },
		lyricOverrides: generatedLyricOverrides,
	},
};
