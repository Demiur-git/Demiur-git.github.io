---
title: 站长指南（五）：日历、项目与读书计划
published: 2026-09-25
updated: 2026-09-27
description: 填写公开日程、项目档案与阅读记录，区分浏览器中的个人安排和随网站发布的配置。
tags: [站长指南, 日历, 项目, 读书计划]
category: 站长指南
series: Demiur 站长维护指南
seriesOrder: 5
draft: false
---

“我的”里除了[便签](/dynamic/)、[相册](/gallery/)与[音乐](/music/)，还有日历、项目和读书计划。本篇讲的是站长维护公开内容的方法，不是给网页增加后台写入能力。

## 日历：网页操作不等于公共配置

[日历](/calendar/)由两部分组成：`src/config/calendarPageConfig.ts` 中的公开预设，以及访客在网页上新建、保存在当前浏览器的个人日程。页面会把二者一起显示，但个人安排不会上传、同步到其他设备或写回仓库。

要让所有访客看到某个日期标记，在 `importantDates` 数组中追加条目：

```ts
{
  date: "2026-09-27",
  title: "网站纪念日",
  category: "anniversary",
  description: "记录一个值得记住的日子。",
  repeat: "yearly",
}
```

日期使用 `YYYY-MM-DD`。`category` 仅接受 `holiday`、`festival`、`anniversary`、`important`；`repeat: "yearly"` 按公历月日逐年显示，省略则只对应原日期。它不是农历计算器，农历节日应逐年核对日期后录入。

要发布一项公共安排，在 `schedules` 数组中追加：

```ts
{
  date: "2026-09-28",
  time: "19:30",
  title: "整理相册",
  status: "planned",
  description: "压缩照片，补充影像册介绍。",
}
```

状态可为 `planned`、`in-progress`、`done`。公开安排通过改配置并重新构建更新；浏览器里的个人安排则在网页操作。删除一条预设不会清掉某个访客手动添加的相似安排。

## 项目：一份 Markdown 就是一份档案

[项目](/projects/)读取 `src/content/projects/`。当前没有专门的新项目命令，可手动创建稳定的英文文件名，例如 `my-site.md`，然后写入：

```md
---
title: 我的个人网站
published: 2026-09-27
description: 记录网站的设计与实现过程。
tags: [Astro, 网站]
status: developing
order: 10
draft: false
link:
  - label: 访问网站
    icon: material-symbols:language-rounded
    value: https://demiur-git.github.io/
---

## 项目目标

在这里说明目标、进展与实现方法。

## 当前进度

记录已经完成的部分和下一步计划。
```

项目头部必填 `title`、`published`，其余字段按需提供。链接字段是 `link` 数组，地址键名是 `value`，不要照搬工具导航的 `url`。

项目详情网址为 `/projects/my-site/`。当前路由只有一个路径段，项目建议直接放在 `projects/` 根目录，不使用多级子目录。`order` 数字越大越靠前，其后按日期排序；`draft: true` 的项目不进入生产构建。

常用状态为 `planning`、`developing`、`published`、`archived`，分别为计划中、开发中、已发布、已归档；不要照搬日历的状态字段。封面可使用 `image`，例如 `/images/projects/my-site.webp`，但必须先放入真实图片；没有封面就省略。修改项目保持文件名稳定，删除文件并重新发布即可撤下详情，但已公开的图片需另行处理。

## 读书计划：状态与进度

编辑 `src/config/readingPlanConfig.ts` 的 `books` 数组：

```ts
{
  title: "待填写的书名",
  author: "待填写的作者",
  status: "reading",
  progress: 35,
  note: "已读到第三章，准备整理笔记。",
}
```

示例不是现有书目，请替换为真实记录。`title` 与 `status` 必填；状态为 `planned`、`reading`、`finished`，分别表示准备、正在和完成阅读。`progress` 按 0–100 的百分比填写，不是页数；无须填写的作者、进度或备注可以省略。

完成一本书时改为 `finished`，需要时将进度改为 100、补上读后记录。删除某条书目时从数组中移除对应对象；这个栏目没有把访客操作写回配置的后台。

## 如何检查改动是否生效

保存后查看对应栏目，确认日期、状态筛选、排序与详情返回正常，再运行检查和完整构建。如果开发服务器还显示旧信息，先确认编辑的是对应配置或内容文件，而不是已经生成的 `dist/`。

相册与音乐步骤已分别放在[第三篇](/posts/guide/05-gallery/)和[第四篇](/posts/guide/06-music/)。下一篇：[维护工具、交流与发布流程](/posts/guide/04-customize-and-preview/)。
