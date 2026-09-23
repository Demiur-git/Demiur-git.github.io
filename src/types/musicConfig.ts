export type MusicLyricOverride = {
	// 与主歌词时间轴一致的译文 LRC，可填写 public 路径或完整 LRC 文本
	translationLrc?: string;
	// 与主歌词时间轴一致的罗马音 LRC，可填写 public 路径或完整 LRC 文本
	romajiLrc?: string;
};

export type MusicLocalTrack = {
	id?: string;
	name: string;
	artist: string;
	url: string;
	cover?: string;
	lrc?: string;
	translationLrc?: string;
	romajiLrc?: string;
	album?: string;
	duration?: number;
};

export type MusicPageConfig = {
	title?: string;
	description?: string;
	// key 为歌曲 ID；仅为需要双语或罗马音的曲目补充即可
	lyricOverrides?: Record<string, MusicLyricOverride>;
};

// 音乐播放器配置
export type MusicPlayerConfig = {
	// 使用方式：'meting' 或 'local'
	mode?: "meting" | "local"; // "meting" 使用 Meting API，"local" 使用本地音乐列表

	// 默认音量 (0-1)
	volume?: number;

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode?: "list" | "one" | "random";

	// 是否显示歌词
	showLyrics?: boolean;

	// 是否在导航栏显示音乐播放器
	showInNavbar?: boolean;

	// 是否在侧边栏显示音乐播放器组件
	showInSidebar?: boolean;

	// 专属音乐馆藏页配置
	page?: MusicPageConfig;

	// Meting API 配置
	meting?: {
		// Meting API 地址
		api?: string;

		// 音乐平台：netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
		server?: "netease" | "tencent" | "kugou" | "xiami" | "baidu";

		// 类型：song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家
		type?: "song" | "playlist" | "album" | "search" | "artist";

		// 歌单/专辑/单曲 ID 或搜索关键词
		id?: string;

		// 认证 token（可选）
		auth?: string;

		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis?: string[];
	};

	// 本地音乐配置（当 mode 为 'local' 时使用）
	local?: {
		playlist?: MusicLocalTrack[];
	};
};
