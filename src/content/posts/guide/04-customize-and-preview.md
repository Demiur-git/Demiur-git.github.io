---
title: 站长指南（六）：工具导航、友链、留言与发布
published: 2026-09-25
updated: 2026-09-27
description: 维护工具分类、官方图标和友链，管理 Waline 留言及赞助内容，完成本地检查和 GitHub Pages 发布。
tags: [站长指南, 工具导航, 友链, Waline, 发布]
category: 站长指南
series: Palib 站长维护指南
seriesOrder: 6
draft: false
---

[工具导航](/booknav/)与“交流”下的[友链](/friends/)、[留言](/guestbook/)、[赞助](/sponsor/)都有独立维护入口。前台入口名称不会改变它们的路由，本篇继续按当前项目字段说明。

## 工具导航：分类与条目

配置位于 `src/config/booknavConfig.ts`。`booknavPageConfig` 控制页头和可选 favicon 服务；`booknavConfig` 是分类数组，分类里的 `items` 是网站数组。目前已收录 AI 助手、模型与本地 AI、开发与开源、算法与练习四组真实工具。

下面是分组结构示例，维护时应改已有组或追加唯一 ID 的新组，不要重复添加同名 ID：

```ts
{
  id: "development",
  name: "开发工具",
  icon: "material-symbols:code-rounded",
  desc: "代码托管与协作",
  weight: 20,
  enabled: true,
  items: [
    {
      title: "GitHub",
      url: "https://github.com/",
      desc: "代码托管与开源协作。",
      icon: "/images/tool-icons/github.png",
      weight: 10,
      enabled: true,
    },
  ],
}
```

分组必填 `id`、`name`、`items`；网站条目必填 `title`、`url`。权重越大越靠前，分组与组内条目分别排序。`enabled` 默认启用，设置为 `false` 可暂时隐藏，删掉对象则彻底从配置移除。

搜索可匹配名称、简介和域名。分类 ID 用于锚点跳转，避免重复或频繁改名。外链应填完整 HTTPS 地址，链接会在新窗口打开。

## 给工具配官方图标

当前已收录工具使用 `public/images/tool-icons/` 中的本地图标。新增工具时，准备有权使用的官方标识文件，并将条目 `icon` 指向 `/images/tool-icons/文件名`；浏览器路径不带 `public`。

`icon` 也支持图片 URL 或站内可用的 Iconify 图标名。`booknavPageConfig.favicon.enabled` 当前为 `false`，不要以为不填图标就必然会自动抓取官方图标；若以后启用外部 favicon 服务，要自行确认服务可用性和请求行为。

不要从不明站点随意复制 Logo，也不要填写不存在的本地文件。改完检查图标失败回退、名称与域名搜索、无结果状态和手机布局。

## 友链：与工具的字段不一样

编辑 `src/config/friendsConfig.ts`。站点列表在 `friendsConfig` 中，页头、自定义正文和排序选项在 `friendsPageConfig` 中。以当前已收录的框架文档为例：

```ts
{
  title: "Firefly 文档",
  imgurl: "/images/friends/firefly.png",
  desc: "本站使用的 Firefly 模板中文文档。",
  siteurl: "https://docs-firefly.cuteleaf.cn/zh/",
  tags: ["框架来源", "Astro", "文档"],
  weight: 10,
  enabled: true,
}
```

友链网址使用 `siteurl`，头像使用 `imgurl`，不是工具的 `url`、`icon`。除可选 `tags` 外，示例中的字段都应填写；头像文件与配置一起发布。

只有 `enabled: true` 的友链展示，正常按 `weight` 从大到小排序。`friendsPageConfig.randomizeSort` 开启后随机排列，不再按权重呈现。修改介绍正文用 `src/content/spec/friends.md`，并开启 `showCustomContent`；当前该开关关闭，单改 Markdown 不会显示。

友链页不再显示分类筛选或卡片标签；`tags` 可以继续维护，搜索仍可匹配名称、简介与这些标签。

删除或隐藏友链不会通知对方，互换链接等外部沟通需自行处理。不要将教程示例当成新的真实友链申请。

## 留言与文章、便签评论

网站已经使用线上 Waline，前端配置在 `src/config/commentConfig.ts`，服务地址通过 `PUBLIC_WALINE_SERVER_URL` 提供。本地 `.env.local` 可填写：

```dotenv
PUBLIC_WALINE_SERVER_URL=https://demiur-waline.vercel.app
```

服务地址是公开信息；数据库密码、Cookie 与管理密钥不应放在 `PUBLIC_` 环境变量、公开配置或文章中。环境变量修改后重启开发服务；生产预览则需重新构建。未配置地址时页面显示尚未开放，不连接旧本机服务。

`src/content/spec/guestbook.md` 是留言页介绍。文章通过头部 `comment` 控制自己的评论，便签通过 `dynamicConfig.showComment` 控制弹层评论。三类内容使用独立路径，不要为改标题随意改文件 ID 或评论路径。

留言页采用纸笺留言板：上方信纸填写留言，下方展示已经公开的留言与回复。它仍使用 Waline 和原来的 `/guestbook/` 标识，换样式不会迁移或清空留言；文章与便签保留原评论样式。

本地预览与线上使用同一个服务地址及页面路径，因此本地真实提交也会写入线上数据库；测试时不要公开私人邮箱或留下未清理的样本。

## 审核必须在服务端完成

站长管理入口是 [Waline 后台](https://demiur-waline.vercel.app/ui)。审核留言、回复、拒绝和删除都在后台执行，不是修改网站 Markdown。客户端提示“审核后公开”本身不能实现审核：服务端需启用 `COMMENT_AUDIT=true`，保存后重新部署服务，并实际测试提交后不可见、审核通过后公开的流程。

前端昵称必填、邮箱选填，隐藏邮箱展示。注册 403、数据库连接或域名白名单问题属于服务端排查；脚本加载成功或查询返回 200，并不代表管理员注册和审核已完成。不要为了测试把审核关掉或清空现有数据库。

服务端详细维护说明在仓库的 [Waline 说明](https://github.com/Demiur-git/Demiur-git.github.io/blob/main/docs/waline-online.md)，与网站更新分开管理。

## 赞助内容

`src/config/sponsorConfig.ts` 的 `methods` 保存收款方式，`sponsors` 保存获准公开的支持者信息。当前没有真实收款方式，页面会显示暂未开放。

确有需要时再填真实 `name`、`enabled`，并按实际情况提供 `qrCode` 公共图片路径或 `link`。二维码文件放在 `public/` 的对应目录，不把本机文件路径写到网页。`showSponsorsList` 控制名单展示，`showButtonInPost` 控制文章底部入口。

不要发布测试收款码、虚构金额或未经同意的支持者姓名；这篇教程不会替你启用任何收款渠道。

## 本地检查与生产预览

在项目根目录运行：

```powershell
pnpm.cmd check
pnpm.cmd type-check
pnpm.cmd build
pnpm.cmd preview
```

完整构建会处理内容路由、图片、字体和 Pagefind 搜索索引。不要直接编辑 `dist/`，下次构建会覆盖它。查看预览时用终端显示的地址，核对文章、便签空状态、相册图片、工具外链、友链和评论加载。

也要在亮暗模式和手机宽度检查长标题、表格和代码块；音乐继续播放、前进后退、序章首次播放及环境信息窗不能因内容更新失效。

## 提交与 GitHub Pages 发布

当前仓库为 [Demiur-git.github.io](https://github.com/Demiur-git/Demiur-git.github.io)，公开站点为 [Palib](https://demiur-git.github.io/)。推送 `main` 后，`.github/workflows/deploy.yml` 会执行检查、构建并部署 GitHub Pages，不需要手动把本地 `dist` 提交到仓库。

以下只演示发布一篇文章，路径必须替换成真实修改的文件：

```powershell
git status --short
git diff
git add -- src/content/posts/my-first-post.md
git diff --cached --stat
git commit -m "docs: 更新文章内容"
git push origin main
```

涉及图片、配置或删除文件时，也要逐项暂存相应改动，再核对暂存清单。不要盲目 `git add .`：个人音乐清单仍是已跟踪文件，忽略规则不会自动保护其本地修改；音乐实体、上传凭证和 `.env.local` 也不应发布。

推送后查看仓库 Actions，等部署任务成功，再检查公开页面。修改 Waline 服务变量需部署 Waline；更新 R2 资源需上传 R2；这两件事不会因推送网站仓库自动完成。

遇到构建失败，应保留错误输出并先解决失败原因，而不是跳过检查。需要回顾外观配置时，返回[第一篇维护入口指南](/posts/guide/01-tour/)。
