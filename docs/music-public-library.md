# 导出公开曲库与 R2 接入

导出只生成歌曲信息和公开文件地址，不上传、不发布、不修改个人曲库。仅选择你有权公开分享的歌曲、曲绘与歌词。

## 选择歌曲与导出

在项目根目录运行：

```powershell
pnpm music:export -- --list
pnpm music:export -- --ids "歌曲ID1,歌曲ID2" --base-url "https://你的音乐域名" --dry-run
pnpm music:export -- --ids "歌曲ID1,歌曲ID2" --base-url "https://你的音乐域名"
```

将示例 ID 替换为 `--list` 输出的真实 ID，地址替换为 R2 自定义域名或测试公开地址。地址必须为 HTTPS，不能含上传密钥、账号密码、查询参数或片段。支持带路径前缀的地址，例如 `https://media.example.com/music`。

导出结果是 `src/config/musicLibrary.public.json`。音频、曲绘、主歌词、译文及罗马音（如果有）均转换为公开地址；选曲顺序仍按本地曲库排列。未知 ID、非法路径或引用文件缺失会停止导出，不产生半份清单。

已有非空公开清单时，先预览，然后添加 `--force` 明确替换。替换只保留本次所选歌曲，不与旧清单合并。`--help` 可查看完整选项。

## 上传对应资源

手动上传所选歌曲目录至 R2，保留以下结构：

```text
library/
  歌曲ID/
    audio.mp3
    cover.webp
    lyrics.lrc
    lyrics.translation.lrc
    lyrics.romaji.lrc
```

文件名以实际导入结果为准，音频也可能是 FLAC、M4A 等；缺省的可选文件无需补造。不要上传整个个人曲库，也不要上传 `lyrics.merged.original.lrc` 备份。

例如本地 `assets/music/library/歌曲ID/audio.mp3` 对应 `https://你的音乐域名/library/歌曲ID/audio.mp3`。若基础地址含 `/music`，R2 对象键相应为 `music/library/歌曲ID/audio.mp3`。确保路径大小写一致。

R2 必须允许公开读取，并配置 CORS 允许 `https://demiur-git.github.io`（本地预览时也允许相应 localhost 来源）。能在地址栏打开歌词不代表网页跨域读取一定成功；应在播放器中验证播放、拖动进度、封面及双语歌词。

## 本地与公开清单切换

本地默认使用 `musicLibrary.generated.json`，不会修改或自动同步公开清单。临时预览公开清单：

```powershell
$env:PUBLIC_MUSIC_LIBRARY = "public"
pnpm dev
# 停止开发服务器后清除临时覆盖
Remove-Item Env:PUBLIC_MUSIC_LIBRARY
```

合法值只有 `local`、`public`；未设置默认 `local`，非法值报错。修改环境变量后重启开发服务器。公开清单为空时显示空曲库，不回退个人曲库。

GitHub Pages 部署流程已固定选择 `public`。上传资源并测试成功后，可单独提交公开清单、推送触发构建。不要提交本地 `musicLibrary.generated.json` 的个人曲库改动或音乐实体。导出命令不会替你执行 Git 操作，也不会验证远程文件已经上传。

注意：本地 Astro 构建仍会将 `public/` 下的本地音乐复制进 `dist/`，选择公开清单不会删除这些文件。因此不要手动上传本地 `dist`；GitHub Actions 从仓库重新构建，未提交的音乐不会随它上线。

## 回归检查

```powershell
node --experimental-strip-types --test scripts/export-music.test.ts
pnpm check
pnpm type-check
pnpm build
```

测试使用临时数据，不触碰真实曲库。上传凭证只用于本机上传工具，不放进公开清单、前端代码或 Git 仓库。
