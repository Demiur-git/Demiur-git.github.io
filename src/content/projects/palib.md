---
title: Palib · 个人图书馆网站
published: 2026-10-01
description: 基于 Astro 与 Firefly 构建的个人图书馆网站，以书库、便签和生活馆藏整理内容，持续探索更有互动感的阅读体验。
image: /images/projects/palib-home.webp
tags: [Astro, Svelte, TypeScript, 个人网站]
status: published
order: 10
draft: false
link:
  - label: 访问网站
    icon: material-symbols:language-rounded
    value: https://demiur-git.github.io/
  - label: GitHub 仓库
    icon: fa7-brands:github
    value: https://github.com/Demiur-git/Demiur-git.github.io
---

## 项目目标

Palib 是一座用于整理个人内容的线上图书馆。它基于 Astro 与 Firefly 模板构建，通过图书馆式导航、纸张排版与昼夜主题，让文章、记录和生活片段拥有各自的馆藏位置。

## 当前馆藏

- **书库**：文章首页、年月归档、分类、标签图谱与文章列表，帮助访客从不同线索开始阅读。
- **便签与相册**：保存短想法和生活影像，与完整文章区分维护。
- **音乐**：通过独立公开曲库播放音乐，支持歌词显示与跨页面控制。
- **读书计划**：以封面书架展示计划阅读、正在阅读和已经读完的书，附 Bangumi 资料、个人评分与评价。
- **留言板**：使用 Waline 接收留言与回复，以纸笺形式展示已公开的留言。

## 设计与交互

网站围绕图书馆视觉展开：书库首页使用公告栏、借书卡和报刊版面，“关于”与留言页延续纸张拼贴的风格。亮暗模式分别对应柔和的昼夜阅读环境。

入场序章与切页过场为阅读加入轻量演出；绫作为网站引导者陪伴访客，环境信息悬浮窗则提供时间、天气等信息。交互兼顾鼠标、键盘和手机触控，并为减少动画设置保留简化体验。

## 技术与维护

页面以 Astro 静态构建为主，Svelte 与 TypeScript 用于交互和配置。网站发布到 GitHub Pages；公开音乐素材由 Cloudflare R2 提供，留言连接部署在 Vercel 的 Waline 服务。

文章与项目使用 Markdown 维护，其他馆藏沿用各自的配置和内容目录。网站已经发布，内容与界面仍会持续调整。

## 收录说明

本项目于 **2026 年 10 月 1 日**加入项目展示；这里的日期是收录日期，不是网站的创建日期。封面为当前首页的本地截图。
