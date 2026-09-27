---
title: 站长指南（一）：维护入口与网站外观
published: 2026-09-25
updated: 2026-09-27
description: 分清内容、配置与浏览器数据，修改站名、首页、导航、背景、字体和序章台词。
tags: [站长指南, 配置, 网站外观]
category: 站长指南
series: Demiur 站长维护指南
seriesOrder: 1
draft: false
---

这组教程写给拥有项目源文件的站长。网站前台不是内容管理后台：文章、便签、相册资料与工具清单，大多需要在本地修改文件，再重新构建并发布。下文以当前 Demiur 项目为准；示例只是操作说明，不会自动加入真实栏目。

## 六篇指南，从哪里开始

1. 本篇：找到维护入口，修改外观与导航。
2. [文章与便签](/posts/guide/02-notes-and-posts/)：创建、编辑、草稿、图片与删除。
3. [相册维护](/posts/guide/05-gallery/)：照片目录、封面、标签与远程图片。
4. [音乐维护](/posts/guide/06-music/)：本地导入、双语歌词、公开清单与 R2。
5. [其他个人馆藏](/posts/guide/03-my-collection/)：日历、项目与读书计划。
6. [工具、交流与发布](/posts/guide/04-customize-and-preview/)：工具导航、友链、留言审核、赞助与上线检查。

## 先分清三类数据

| 数据类型 | 例子 | 如何更新 |
| --- | --- | --- |
| 仓库内容与配置 | 文章、便签、相册资料、友链、工具清单 | 修改文件，构建并发布 |
| 当前浏览器的数据 | 网页中新建的日程、环境窗选城与位置、桌宠位置、序章已播放标记 | 由浏览器保存，不会写回仓库 |
| 外部服务的数据 | Waline 留言、R2 音乐文件 | 在对应服务中管理；必要时同步前端配置或公开清单 |

例如，在日历网页上添加安排，不会成为全体访客都能看到的预设日程；修改音乐清单，也不会替你上传 R2 文件。先确定数据在哪一层，再动手。

## 本地启动

项目要求 Node.js 至少为 `22.23.0`，包管理器使用 pnpm；当前仓库指定 `pnpm@11.22.0`，线上工作流使用 Node.js 24。在已有项目根目录执行：

```powershell
pnpm.cmd install
pnpm.cmd dev
```

本文命令采用 Windows PowerShell 写法。`pnpm.cmd` 可避免误执行被系统策略阻止的 `pnpm.ps1`；其他系统可使用 `pnpm`。开发地址以终端输出为准，通常是 `http://localhost:4321`。

## 常用维护入口

| 想修改的内容 | 文件或目录 |
| --- | --- |
| 站名、描述、正式网址、主题与页面开关 | `src/config/siteConfig.ts` |
| 首页介绍、社交链接、六个馆藏入口 | `src/config/homeIntroConfig.ts` |
| 顶部导航与下拉菜单 | `src/config/navBarConfig.ts` |
| 站名、标题、代码字体 | `src/config/fontConfig.ts` |
| 全站昼夜壁纸 | `src/config/backgroundWallpaper.ts` |
| 本人姓名、头像与简介 | `src/config/profileConfig.ts` |
| 关于网站的正文 | `src/content/spec/about.md` |
| 序章旁白与绫的对话 | `src/config/homeEntranceConfig.ts` |
| 开书目的地英文名 | `src/config/pageTransitionConfig.ts` |
| 绫桌宠名称、图片与短句 | `src/config/pioConfig.ts` |
| 内容集合允许的字段 | `src/content.config.ts` |

修改 TypeScript 配置时，保留原有导入、导出对象与字段名称。通常只改对应值或追加数组条目，不必整份替换文件。

## 站名与首页并非同一字段

`siteConfig.title` 控制站名，目前为 `Demiur`，也用于开书动画左页。正式域名由 `siteConfig.site_url` 提供，当前为 `https://demiur-git.github.io`；更换域名时，还应核对部署和评论服务设置。

首页大标题、介绍与社交入口分别在 `homeIntroConfig.title`、`description`、`links` 中；它们不会因改站名自动变成同一段文字。首页馆藏便签来自 `catalogEntries`：改标题、简介、图标和链接即可，不需要修改便签墙组件。

作者资料在 `profileConfig` 中维护；绫是独立的虚构引导者，不应把作者资料填到角色设定里。

## 修改导航与页面开关

`navBarConfig.links` 是顶部入口数组；有子项时使用 `children`。当前顶栏为主页、工具导航、书库、我的、交流、关于。点击“书库”文字直达总首页，独立箭头展开归档、分类、标签图谱和文章列表四个分区；手机菜单也将链接与展开按钮分开。子页面通过“书库 / 当前分区”返回总入口。便签仍使用 `/dynamic/`，只是放入了“我的”，不需要迁移内容目录。

修改已有链接时，保持它与真实路由一致。给导航填一个新网址不会自动创建页面；真正新增页面要在 `src/pages/` 中实现。

`siteConfig.pages` 控制便签、项目、相册、工具、友链、留言、赞助等已有可选页面。带 `pageKey` 的导航项会跟随开关隐藏；不是所有路由都有独立开关。仅删除导航链接也不能当作访问控制。

## 换背景、字体与角色素材

全站壁纸在 `backgroundWallpaper.src` 与 `darkSrc` 中分别设置白天和夜晚，里面的 `desktop`、`mobile` 可使用不同图片。当前本地壁纸路径相对于 `src/`，例如 `assets/images/library-reading-desk.png`；增加图片时，文件与配置必须一起保存。

首页插画独立由 `homeIntroConfig.heroArtwork` 控制。睁眼后绫相见的背景是独立素材，不会跟随首页轮播；换全站壁纸不会自动替换那张场景图。

站名字体由 `fontConfig.navbarTitleFont` 指向 `fontsList` 中已经定义的字体变量，目前使用 Playpen Sans。换成本地新字体时，要同时添加字体定义、正确的文件路径和许可，不能只写一个不存在的字体变量。

桌宠使用 `ocPetConfig.assets` 的 `idle`、`blink`、`interact` 三张图，位于 `public/images/oc-pet/`。三态应保持相同画布与人物位置，避免眨眼时跳动。正常立绘与桌宠不是同一份素材，平面图片也不能直接当成已完成的 Live2D 模型。

## 修改序章文字，不重做动画

在 `homeEntranceConfig` 中，`dialogue` 对应睁眼前的黑场旁白，`characterDialogue` 对应睁眼后绫的对话。每条都有 `speaker` 与 `text`；将占位台词换成正式内容即可。

```ts
// 某一条台词的写法，替换数组中的对应条目。
{ speaker: "绫", text: "欢迎回来，今天想先翻阅哪一册？" }
```

序章每个标签页只播放一次，开始后即记录 `demiur-home-intro-seen-v1`。测试新台词时可用新的独立标签页；浏览器复制或恢复标签页时可能继承这个会话标记。减少动画模式会直接进入主页。

环境信息窗的位置与手动选城属于访客浏览器数据，不写在配置里；没有选城时不会请求天气。页面时钟来自设备时钟，不是标准授时校准。

下一篇：[发布与维护文章、便签](/posts/guide/02-notes-and-posts/)。
