---
title: 阅读与发布便签、文章
published: 2026-09-25
description: 了解短便签与正式文章的区别，并学习用 Markdown 在本项目中添加内容。
tags: [网站指南, Markdown, 内容维护]
category: 使用指南
series: 网站使用指南
seriesOrder: 2
draft: false
---

这个网站把短记录放在[便签](/dynamic/)，把经过整理的长文放在[文章](/archive/)。访客只需浏览；下面的“发布”部分是给持有项目源文件的站长看的，网站前台没有公开编辑按钮。

## 浏览便签与文章

便签页可以搜索内容、筛选年份。每条便签有自己的时间和链接，适合分享一段正在形成中的想法。文章归档按年份整理，点击标题进入阅读页；文章可使用标题、列表、链接、引用和代码块，较长文章还可以用目录定位章节。

## 创建一条便签

在项目根目录运行：

```powershell
pnpm.cmd new-dynamic "今天整理了网站的使用说明。"
```

PowerShell 如果阻止执行 `pnpm.ps1`，使用这里的 `pnpm.cmd` 即可。命令会在 `src/content/dynamic/` 创建以日期和时间命名的 Markdown 文件。也可以手动新建 `.md` 文件，保持如下结构：

```md
---
published: 2026-09-25 15:30:00
---

今天记录了一件值得回头看的小事。
```

`published` 决定显示时间。当前本地便签的页面显示沿用生成脚本使用的不带时区格式，手动创建时也请照着示例填写；如需置顶，可在头部增加 `pinned: true`。保存文件后，便签会在下次构建时进入站点内容。默认数据来源是本地 Markdown，不需要另外搭建 Memos 服务。

## 创建一篇文章

先用现有脚本生成骨架：

```powershell
pnpm.cmd new-post my-first-post
```

它会创建 `src/content/posts/my-first-post.md`。打开文件，补上正文，并把标题、摘要、分类和标签改成自己的内容。例如：

```md
---
title: 我的第一篇文章
published: 2026-09-25
description: 这篇文章记录了我开始整理网站内容的过程。
tags: [建站, 记录]
category: 网站日志
draft: false
---

## 为什么写这篇文章

这里是正文。可以加入[站内链接](/dynamic/)、列表与代码块。
```

文章网址由 `src/content/posts/` 下的**文件路径**决定：上例会出现在 `/posts/my-first-post/`。如果把文件放进 `guide/` 子目录，网址也会相应包含 `/guide/`。`draft: true` 的文章可供开发时预览，但不会进入正式构建；准备公开时改为 `false`。本系列另外使用了相同的 `series` 名称和依次递增的 `seriesOrder`，因此文章页可以显示系列阅读顺序。

写完后运行 `pnpm.cmd check` 和 `pnpm.cmd build`，确认内容能被解析并生成页面。静态站点需要重新构建、重新部署，新文章才会出现在公开网站；只在本地保存文件不会自动上线。

下一篇是[日历、相册、音乐等“我的”馆藏指南](/posts/guide/03-my-collection/)。
