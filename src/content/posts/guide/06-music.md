---
title: 站长指南（四）：音乐导入、双语歌词与 R2 发布
published: 2026-09-27
description: 整理音频、曲绘与歌词，区分个人和公开曲库，用明确选曲导出 R2 清单，并检查跨域与实际播放。
tags: [站长指南, 音乐, LRC, R2]
category: 站长指南
series: Demiur 站长维护指南
seriesOrder: 4
draft: false
---

[音乐馆藏](/music/)复用全站播放器，首页音乐栏和悬浮唱片控制的是同一个音频实例。站长维护曲库时，先分清三件事：本地导入、远程上传、公开清单发布；任一步都不能替代另外两步。

## 两份清单，各管各的

| 内容 | 位置 | 当前用途 |
| --- | --- | --- |
| 导入收件箱 | `music-inbox/` | 放待整理的本地素材 |
| 本地音乐资源 | `public/assets/music/library/` | 个人预览用的音频、封面与歌词 |
| 个人清单 | `src/config/musicLibrary.generated.json` | 本地默认读取 |
| 公开清单 | `src/config/musicLibrary.public.json` | GitHub Pages 读取，地址指向公开资源 |
| 播放器设置 | `src/config/musicConfig.ts` | 音量、模式、歌词和页面文案 |

当前播放器使用静态清单，不需要把网易云 Cookie 或其他凭证写到网页。只处理你有权使用并公开传播的音频、曲绘与歌词；付费下载不自动等于公开传播授权。

## 第一步：准备歌曲与同名附件

```text
music-inbox/
  示例歌曲.mp3
  示例歌曲.webp
  示例歌曲.lrc
  示例歌曲.translation.lrc
  示例歌曲.romaji.lrc
```

同一首的附件放在音频旁，基本文件名保持一致。封面、主歌词和辅助歌词都可缺省，不需要为缺失内容伪造文件。

导入器读取音频标签中的歌名、歌手、专辑和时长；有内嵌封面或歌词时也会尝试读取。建议先把音频标签写准确，避免出现未知歌手或错误的歌曲 ID。支持常见 MP3、FLAC、M4A、AAC、OGG、OPUS、WAV、WebM 等音频；网易云 `.ncm` 或其他加密文件不在支持范围内，本工具不负责解密。

## 第二步：先预览，再导入

```powershell
pnpm.cmd music:import -- --dry-run
pnpm.cmd music:import
```

导入把音频、WebP 曲绘和歌词整理到各歌曲 ID 的目录，增量更新个人清单；不会删除收件箱的源文件，也不会修改公开清单。重复 ID 会更新相应条目，不会把旧曲库全部替换为本次收件箱内容。

没有附件时可显式尝试匹配，但结果需要人工检查：

```powershell
pnpm.cmd music:import -- --fetch-lyrics
pnpm.cmd music:import -- --fetch-cover
```

歌词匹配使用 LRCLIB；封面匹配需音频已有 MusicBrainz 专辑 ID。这两项是导入时的可选请求，不保证匹配成功，也不会自动生成译文或罗马音。

## 双语 LRC 如何整理

独立原文、译文最好使用一致时间戳，例如：

```text
# 示例歌曲.lrc
[00:12.000]An example line.

# 示例歌曲.translation.lrc
[00:12.000]这是一句示例歌词。
```

文件里的 `#` 说明只是这里展示用途的注释，实际 LRC 可只保留相应时间行。导入器也能自动识别稳定的“同时间戳原文在前、中文在后”结构，拆出原文与译文；证据不足或异常多行会报告并跳过，不猜测语言。已有 `.translation.lrc` 优先，不会被自动结果替换；罗马音需单独提供。

对已经导入的合并歌词，可以不依赖收件箱直接修复：

```powershell
pnpm.cmd music:import -- --repair-library --dry-run
pnpm.cmd music:import -- --repair-library
```

先核对预览报告。正式修复保留 `lyrics.merged.original.lrc` 原歌词备份，并更新个人清单的 `translationLrc`；它不重新复制音频，也不自动上传修复后的歌词到 R2。发布时不要上传这个备份文件。

## 第三步：选择公开曲目并导出

```powershell
pnpm.cmd music:export -- --list
pnpm.cmd music:export -- --ids "歌曲ID1,歌曲ID2" --base-url "https://你的音乐域名" --dry-run
```

用 `--list` 中的真实 ID 替换示例，基础地址使用自己的 HTTPS 公开域名或 R2 公开地址，不含账号密码、查询参数或片段。预览无误后执行正式导出：

```powershell
pnpm.cmd music:export -- --ids "歌曲ID1,歌曲ID2" --base-url "https://你的音乐域名"
```

当前公开清单已有内容；要替换必须追加 `--force`。**替换结果只保留本次选中的歌曲，不会自动与旧公开清单合并。** 想保留旧曲目时，要把旧曲目 ID 一并选入。导出按个人曲库顺序排列，并保留已有歌词变体。

导出只生成 `musicLibrary.public.json`，不上传音乐、不发布网页。地址编码由工具处理，不要手动把中文或空格改成与真实对象键不一致的名称。

## 第四步：上传 R2 文件并核对地址

上传所选曲目的实际目录，保持对象键结构：

```text
library/
  歌曲ID/
    audio.mp3
    cover.webp
    lyrics.lrc
    lyrics.translation.lrc
    lyrics.romaji.lrc
```

文件名和扩展名以导入结果为准，可选文件不存在就不上传。不要上传整个个人收件箱、原合并歌词备份或上传凭证。

本地 `assets/music/library/歌曲ID/audio.mp3` 对应 `https://你的音乐域名/library/歌曲ID/audio.mp3`；如果基础地址带前缀，上传对象键也要对应这个前缀。先在浏览器验证音频与歌词地址，再确认 R2 公开读取及 CORS 设置允许实际网站来源，必要时加入本地预览来源。

地址栏能打开 LRC，不代表网页跨域读取就一定成功。必须在播放器中检查封面、原文、译文、拖动进度和连续切歌。

## 本地测试公开清单

本地未设置 `PUBLIC_MUSIC_LIBRARY` 时使用 `local`；GitHub Pages 工作流使用 `public`。在 PowerShell 中临时切换：

```powershell
$env:PUBLIC_MUSIC_LIBRARY = "public"
pnpm.cmd dev
# 停止这次开发预览后，移除临时覆盖
Remove-Item Env:PUBLIC_MUSIC_LIBRARY
```

环境变量变化后需重启开发服务。公开清单为空时不回退到个人曲库；非法值也不会被默默接受。

## 发布与删除的边界

试听通过后，提交公开清单，推送并等待部署。`music-inbox/` 的个人文件与 `public/assets/music/` 已受忽略规则保护；个人清单本身仍是受版本控制的文件，其本地改动不能靠 `.gitignore` 自动排除。不要使用未经核对的 `git add .`。

本地构建仍会把 `public/` 下的音乐复制进 `dist/`，选用公开清单不会删除它们。不要把含个人音乐的本地 `dist` 整包上传；当前 GitHub Actions 从仓库重新构建，未提交的个人音频不会因此上线。

取消公开某首歌时，重导出其余曲目并发布新公开清单。清单下架不等于删除 R2 文件；如需撤回直接地址访问，另行删除对应远程资源。仅从收件箱移走音频，也不会自动从已经导入的清单中移除歌曲。

下一篇：[维护日历、项目与读书计划](/posts/guide/03-my-collection/)。
