# 项目文件树与职责说明

这份文档展示当前个人博客的主要目录与开发入口。为保持可读性，文件树省略了大量同类组件、类型文件和静态资源，但保留了日常修改最常用的部分。

## 整体结构

```text
personal_pages/
├── .github/                         # GitHub 配置、Issue 模板与自动化工作流
│   ├── ISSUE_TEMPLATE/
│   └── workflows/                   # 检查、构建与部署流程
├── _archive/                        # 已归档的早期方案，不参与当前网站运行
│   └── editorial-prototype-20260920/
├── docs/                            # 项目说明与原模板参考资料
│   ├── PROJECT_STRUCTURE.md         # 当前文件树说明
│   ├── README.ja.md
│   ├── README.ko.md
│   ├── README.zh-TW.md
│   └── images/                      # 文档图片，不是网站主要内容图片
├── public/                          # 直接复制到网站根目录的静态资源
│   ├── assets/                      # 浏览器直接加载的字体、脚本与样式
│   ├── avatar.svg                   # 默认头像
│   └── favicon.svg                  # 网站图标
├── scripts/                         # 构建与内容生成脚本
│   ├── generate-github-card-data.ts
│   ├── generate-lqips.ts
│   ├── minify-inline-scripts.ts
│   ├── new-post.js                  # 新建文章
│   ├── run-pagefind.ts              # 生成站内搜索索引
│   └── subset-fonts.ts              # 字体子集处理
├── src/                             # 网站主要源代码
│   ├── assets/                      # 由 Astro 优化的图片等源资源
│   │   └── images/                  # 首页插画与内容图片
│   ├── components/                  # 可复用界面组件
│   │   ├── analytics/               # 访问统计接入
│   │   ├── comment/                 # 评论系统接入
│   │   ├── common/                  # 按钮、分页、Markdown 等通用组件
│   │   ├── controls/                # 搜索、主题切换、返回顶部等控制组件
│   │   ├── features/                # 音乐、加密、特效等可选功能
│   │   ├── layout/                  # 导航栏、页脚、首页介绍、文章卡片
│   │   ├── misc/                    # 许可、分享、推荐文章等辅助组件
│   │   ├── pages/                   # 日历、相册、项目、动态等页面专用组件
│   │   └── widget/                  # 日历、分类、标签、个人资料等小组件
│   ├── config/                      # 网站功能和内容配置
│   │   ├── siteConfig.ts            # 站点名称、语言、页面功能开关
│   │   ├── navBarConfig.ts          # 顶部导航与下拉子页面
│   │   ├── calendarPageConfig.ts     # 重要日期、日程与计划数据
│   │   ├── homeIntroConfig.ts       # 首页介绍、馆藏入口、插画及社交链接
│   │   ├── profileConfig.ts         # 本人资料与头像
│   │   ├── readingPlanConfig.ts     # 读书计划数据
│   │   ├── galleryConfig.ts         # 相册设置
│   │   ├── sidebarConfig.ts         # 侧栏布局
│   │   ├── backgroundWallpaper.ts   # 背景与壁纸
│   │   └── index.ts                 # 配置统一出口
│   ├── constants/                   # 常量及构建生成的数据
│   ├── content/                     # Markdown 内容
│   │   ├── dynamic/                 # 笔记/动态
│   │   ├── posts/                   # 正式文章
│   │   ├── projects/                # 项目内容
│   │   └── spec/
│   │       └── about.md             # “关于网站”正文
│   ├── i18n/                        # 多语言文本与翻译映射
│   ├── layouts/                     # 页面骨架
│   │   ├── Layout.astro             # 全站 HTML、资源与全局结构
│   │   └── MainGridLayout.astro     # 页面主体网格布局
│   ├── pages/                       # Astro 文件路由
│   │   ├── [...page].astro          # 主页及文章列表分页
│   │   ├── archive.astro            # 文章归档
│   │   ├── calendar.astro           # 我的 / 日历
│   │   ├── reading.astro            # 我的 / 读书计划
│   │   ├── dynamic/                 # 笔记页面
│   │   ├── gallery/                 # 我的 / 相册
│   │   ├── projects/                # 我的 / 项目
│   │   ├── about/
│   │   │   ├── me.astro             # 关于 / 本人
│   │   │   └── site.astro           # 关于 / 网站
│   │   ├── posts/[...slug].astro     # 单篇文章
│   │   ├── api/                     # 构建时 JSON 接口
│   │   └── og/                      # 社交分享图生成接口
│   ├── plugins/                     # Markdown、Mermaid、PlantUML 等处理插件
│   ├── styles/                      # 全局样式与页面样式
│   │   ├── main.css                 # 全局样式入口
│   │   ├── library-theme.css        # 日系学院图书馆主题变量与通用样式
│   │   ├── navbar.css               # 导航栏样式
│   │   ├── markdown.css             # Markdown 正文样式
│   │   └── pages/                   # 各功能页面专用样式
│   ├── types/                       # 与 config、组件数据对应的 TypeScript 类型
│   ├── utils/                       # 内容、路由、图片、布局等工具函数
│   ├── workers/                     # Web Worker
│   └── content.config.ts            # Astro 内容集合定义
├── .gitignore                       # Git 忽略规则
├── astro.config.mjs                 # Astro 与插件配置
├── biome.json                       # 代码格式与检查规则
├── package.json                     # 依赖及 pnpm 命令
├── pagefind.yml                     # 站内搜索配置
├── pnpm-lock.yaml                   # 依赖锁定文件
├── svelte.config.js                 # Svelte 配置
├── tsconfig.json                    # TypeScript 配置
├── vercel.json                      # Vercel 部署配置
└── wrangler.jsonc                   # Cloudflare 部署配置
```

## 页面生成关系

```text
浏览器访问地址
    ↓
src/pages/ 路由页面
    ↓
src/layouts/ 页面骨架
    ↓
src/components/ 界面组件
    ↓
src/config/ 功能配置  +  src/content/ Markdown 内容
    ↓
src/styles/ 视觉样式  +  src/utils/ 数据处理
```

## 常用修改入口

| 想修改的内容 | 主要文件或目录 |
| --- | --- |
| 网站名称、语言、页面开关 | `src/config/siteConfig.ts` |
| 顶部导航与下拉菜单 | `src/config/navBarConfig.ts` |
| 首页介绍、馆藏入口与社交链接 | `src/config/homeIntroConfig.ts`、`src/components/layout/HomeIntro.astro` |
| 姓名、头像与个人简介 | `src/config/profileConfig.ts` |
| “关于本人”页面 | `src/pages/about/me.astro` |
| “关于网站”页面 | `src/pages/about/site.astro`、`src/content/spec/about.md` |
| 日历页面 | `src/config/calendarPageConfig.ts`、`src/components/pages/calendar/CalendarWorkspace.svelte` |
| 读书计划 | `src/config/readingPlanConfig.ts`、`src/pages/reading.astro` |
| 相册 | `src/config/galleryConfig.ts`、`src/pages/gallery/` |
| 项目 | `src/content/projects/`、`src/pages/projects/` |
| 笔记 | `src/content/dynamic/`、`src/pages/dynamic/` |
| 文章 | `src/content/posts/`、`src/pages/posts/[...slug].astro` |
| 全站颜色与图书馆主题 | `src/styles/main.css`、`src/styles/library-theme.css`、`src/styles/variables.styl` |
| 导航栏视觉效果 | `src/styles/navbar.css`、`src/components/layout/Navbar.astro` |
| 侧栏布局 | `src/config/sidebarConfig.ts`、`src/components/layout/SideBar.astro` |
| 构建与部署 | `package.json`、`astro.config.mjs`、`.github/workflows/` |

## 不需要日常修改的目录

- `.git/`：Git 版本数据，不应手动编辑。
- `.astro/`：Astro 开发缓存，可自动重新生成。
- `dist/`：生产构建结果，由 `pnpm build` 生成。
- `node_modules/`：依赖安装目录，由 `pnpm install` 生成。
- `.tools/`：本地辅助工具，不参与网站运行。
- `_archive/`：历史方案归档，不参与当前网站构建。
- `src/constants/`：部分文件由构建脚本生成，提交前需要确认变更来源。

## 当前开发重点

现阶段最常接触的目录是：

1. `src/config/`：调整站点信息、导航和各页面数据。
2. `src/pages/`：新增或修改页面与路由。
3. `src/content/`：撰写笔记、文章和项目内容。
4. `src/components/layout/`：调整导航、首页和整体页面组成。
5. `src/styles/`：调整视觉表现。

新增带子页面的栏目时，应在 `src/config/navBarConfig.ts` 中使用 `children` 配置，继续沿用桌面端悬停下拉、移动端点击展开的导航方式。
