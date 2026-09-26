---
title: 修改网站外观与本地预览
published: 2026-09-25
description: 从站名、首页和背景入手修改 Demiur，并在发布前检查网站是否正常构建。
tags: [网站指南, 配置, 本地预览]
category: 使用指南
series: 网站使用指南
seriesOrder: 4
draft: false
---

这一篇写给拥有项目源代码的站长。网站的常用内容集中在配置文件和 Markdown 中，不需要每次都去改页面组件。修改前建议保留一份 Git 提交或分支，以便不满意时回到旧版本。

## 先找到对应的入口

| 想改什么 | 从哪里开始 |
| --- | --- |
| 网站名称、描述、语言和基础设置 | `src/config/siteConfig.ts` |
| 首页介绍、社交链接与六个馆藏入口 | `src/config/homeIntroConfig.ts` |
| 顶部栏目和“我的／交流／关于”下拉菜单 | `src/config/navBarConfig.ts` |
| 工具导航的分类与网站清单 | `src/config/booknavConfig.ts` |
| 友链及展示设置 | `src/config/friendsConfig.ts`、`src/content/spec/friends.md` |
| 留言簿介绍及留言服务 | `src/content/spec/guestbook.md`、`src/config/commentConfig.ts` |
| 赞助方式与支持者名单 | `src/config/sponsorConfig.ts` |
| 本人姓名、头像和简介 | `src/config/profileConfig.ts` |
| 关于网站的正文 | `src/content/spec/about.md` |
| 全站昼夜背景 | `src/config/backgroundWallpaper.ts` |
| 左下角绫桌宠及其三态图片 | `src/config/pioConfig.ts`、`public/images/oc-pet/` |

例如，修改 `siteConfig.title` 会改变网站的站名，也会用于切页开书动画的左页；首页大标题则由 `homeIntroConfig.title` 单独控制。“关于本人”读取个人资料配置，“关于网站”读取独立的 Markdown 正文，[“绫”](/about/ling/)则是虚构引导者的独立页面，不会与作者资料混在一起。

## 维护工具与交流页面

工具导航复用 `booknavConfig` 的分组与条目结构，每组包含 `id`、`name` 和 `items`，每项至少填写 `title` 和 `url`，可补充 `desc`、图标及排序权重。`enabled: false` 的分组或条目不会显示；当前清单为空。外部工具链接会在新窗口打开，不需要把工具本身部署到本站。

友链写入 `friendsConfig`，填写标题、网址、头像、简介、权重与 `enabled`，已启用的条目按权重展示。留言页目前没有在线留言服务；必须先在 `commentConfig.ts` 配置项目支持的评论服务，再重新构建才能收集访客留言，不能把当前空页面当作提交表单。赞助需要在 `sponsorConfig.methods` 填入真实且已启用的方式；没有方式时显示“暂未开放”。私人密钥不应写进公开配置。

这四页的访问开关仍在 `siteConfig.pages` 中，分别是 `booknav`、`friends`、`guestbook`、`sponsor`；只修改导航文字不会改变这些路由。

## 更换图片与外观

首页右侧插画在 `homeIntroConfig.heroArtwork` 中设置亮色和暗色图片。全站壁纸在 `backgroundWallpaper` 的 `src` 与 `darkSrc` 中设置桌面和手机图片；本项目默认引用 `src/assets/images/` 中的日夜图。如果增加自己的图片，先把文件放进项目，再将配置路径指向它，避免只修改路径却没有提交对应素材。

桌宠目前使用绫的 Q 版三态立绘。更换时，可把透明图片放入 `public/images/oc-pet/`，再在 `pioConfig.ts` 中修改待机、眨眼、互动图片路径；三张图片要保持相同画布和人物位置。正常比例立绘用于 `/about/ling/` 页面，与桌宠素材分别维护。这些平面图不是 Live2D 分层原画；若以后要做 Live2D，还需另外准备分层素材与模型。若希望改配色或纸张质感，则先查看 `src/styles/library-theme.css`，并同时检查亮色与暗色模式的可读性。

## 在本地启动和检查

项目使用 Node.js 与 pnpm。按 [README 的环境要求](https://github.com/Demiur-git/personal_pages#本地运行)安装后，在项目根目录运行：

```powershell
pnpm.cmd install
pnpm.cmd dev
```

开发服务器默认地址是 `http://localhost:4321`；如果该端口被占用，以终端实际显示的地址为准。Windows PowerShell 若提示禁止运行 `pnpm.ps1`，使用 `pnpm.cmd` 即可，不必为了启动本站放宽系统脚本策略。

修改完成后，依次检查内容和生产构建：

```powershell
pnpm.cmd check
pnpm.cmd type-check
pnpm.cmd build
pnpm.cmd preview
```

用本地预览打开首页、文章、便签和“我的”各页面，再切换亮暗模式并检查手机宽度。站内搜索等构建期功能应以完整构建后的预览为准。

## 发布之前

本仓库目前的公开网址仍是示例配置。正式部署前，应把 `siteConfig.site_url` 改成真正的网站地址，并在所选静态托管平台完成部署设置；不要仅凭 GitHub 仓库存在就认为网站已经上线。

静态构建只会包含构建时能读到、并随发布产物上传的内容。文章、便签、相册图片和音乐文件都要分别检查；本地个人资料、密钥或无权公开的音频不要误传。确认构建产物和链接正常后，再按自己的发布流程提交与部署。

如果想从访客视角重新走一遍网站，可以回到本系列的[首页导览](/posts/guide/01-tour/)。
