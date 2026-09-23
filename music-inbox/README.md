# 音乐导入收件箱

把你有权在网站中使用的音频文件放在这个目录，然后在项目根目录运行：

```powershell
pnpm.cmd music:import
```

导入器支持 MP3、FLAC、M4A、AAC、OGG、OPUS、WAV 和 WebM，并会：

- 读取音频标签中的歌名、歌手、专辑、内嵌封面和同步歌词；
- 查找与音频同名的 `.lrc`、`.translation.lrc` 和 `.romaji.lrc`；
- 将封面转换为适合网页的 WebP；
- 增量更新网站的静态曲目清单，不删除收件箱中的源文件。

如果没有本地歌词，可显式允许一次在线匹配：

```powershell
pnpm.cmd music:import -- --fetch-lyrics
```

如果文件已经用 MusicBrainz Picard 写入专辑 ID，但没有内嵌封面，还可以运行：

```powershell
pnpm.cmd music:import -- --fetch-cover
```

在线匹配使用 LRCLIB，只在导入时请求；网页访问期间仍然完全静态。匹配结果可能不完整或有误，请在发布前试听并检查歌词。译文和罗马音不会自动生成，可按以下文件名放在歌曲旁边：

```text
歌曲名.mp3
歌曲名.lrc
歌曲名.translation.lrc
歌曲名.romaji.lrc
```

音频、封面与歌词属于公开静态资源。请勿加入无权公开传播的内容。
