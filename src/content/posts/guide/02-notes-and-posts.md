---
title: 站长指南（二）：发布与维护文章、便签
published: 2026-09-25
updated: 2026-09-27
description: 用现有命令创建 Markdown，设置文章元信息、草稿和系列，维护短动态及其评论标识。
tags: [站长指南, Markdown, 文章, 便签]
category: 站长指南
series: Palib 站长维护指南
seriesOrder: 2
draft: false
---

[书库](/library/)存放较完整的文章；[便签](/dynamic/)存放短记录，也就是原来的动态。它们都从本地 Markdown 生成，没有对访客开放的发布后台。

## 维护书库首页与推荐阅读

书库首页是文章区的总入口：馆藏公告栏合并统计与推荐阅读，四张借书卡进入子分区，下方报刊展示最多六篇最近更新。统计分别是公开文章数、主分类数，以及排除与所属分类同名项后按名称去重的小标签数。最近更新优先使用 `updated`，没有时使用 `published`；网站主页不再重复展示这份列表。

推荐阅读在 `src/config/libraryConfig.ts` 中维护，填写最多三个文章标识，不带 `.md` 扩展名。例如：

```ts
export const libraryConfig = {
  recommendedPostIds: ["guide/01-tour", "guide/02-notes-and-posts"],
};
```

这是填写方式示例，当前推荐清单仍为空。顺序就是展示顺序；不存在、重复或草稿标识会在构建时给出诊断，不会作为推荐展示。

[文章列表](/library/posts/)沿用卡片、布局切换和分页，置顶文章优先；[归档](/archive/)不受置顶影响，按发表日期倒序分成年份与月份，并统计总文章数、今年文章数和年进度。年进度按网站时区在访问时计算。

[分类](/categories/)与[标签图谱](/tags/)由文章的 `category`、`tags` 自动生成。每篇文章只有一个主分类（`category`），缺省归入“未分类”；`tags` 是小标签，不需要新增字段。图谱默认只显示主分类，选中后展开该分类的小标签，一次只展开一个分类。小标签仅连接所属主节点，与主分类同名的小标签不重复绘制；跨分类同名标签分别计数。点击“阅读此分类”按分类筛选，点击小标签则同时筛选分类与标签；搜索结果会显示所属分类，并提供展开入口。图谱与文字索引均自动更新，无需手工绘制连线。

## 新建文章

在项目根目录运行：

```powershell
pnpm.cmd new-post my-first-post
```

生成文件为 `src/content/posts/my-first-post.md`。也可以使用子目录，如 `pnpm.cmd new-post notes/my-first-post`。脚本遇到同名文件会停止，不会替你覆盖已有文章。

将生成的标题与正文改成自己的内容。以下是一个完整的写作模板：

```md
---
title: 我的第一篇文章
published: 2026-09-27
description: 记录一次实践的过程、结果和收获。
tags: [建站, 实践]
category: 网站日志
draft: false
comment: true
---

## 这次做了什么

在这里写正文。

## 有哪些收获

可以加入[站内链接](/dynamic/)、列表、引用和代码块。
```

头尾两条 `---` 之间称为 frontmatter，是页面元信息；之后才是正文。日期按示例填写，`draft`、`comment` 等布尔值不要写成带引号的字符串。

## 常用字段如何填写

| 字段 | 用途 |
| --- | --- |
| `title` | 文章标题，必填 |
| `published` | 发布日期，必填；影响归档与时间排序 |
| `updated` | 修改日期，编辑旧文时可补充 |
| `description` | 列表与搜索摘要 |
| `tags`、`category` | 标签数组与分类名称 |
| `image` | 可选封面路径；没有图就留空 |
| `draft` | `true` 为草稿，生产构建不发布 |
| `pinned` | 是否置顶，默认 `false` |
| `comment` | 是否显示本篇评论，默认 `true` |
| `series`、`seriesOrder` | 同名系列与系列内顺序，数字越小越靠前 |

只保留需要的字段即可，完整定义在 `src/content.config.ts`。草稿可以在开发模式查看，但不要把草稿文件中的私人信息当作安全隔离：如果提交到公开仓库，源文件仍可被阅读。

## 网址、修改与删除

当前文章路由由内容集合的文件 ID 生成。建议使用稳定的英文小写文件名：`src/content/posts/my-first-post.md` 对应 `/posts/my-first-post/`，子目录也会进入网址。

生成脚本会写入 `slug` 字段，但当前文章路由没有用它来覆盖文件 ID；不能只改 `slug` 就期待网址改变。修改正文或 `title` 通常不需要改文件名。

编辑旧文章时可增加 `updated: 2026-09-27`，保留原 `published`。删除文章文件后，下一次正式构建便不再生成它；重命名文件会改变网址，可能使旧链接与评论关联失效，发布前应处理相关引用。

## 文章里的图片

把可公开的图片放到 `public/images/posts/`，正文用网站根路径引用：

```md
![图片的替代说明](/images/posts/my-example.webp)
```

这里需要先真实放入 `my-example.webp`，不是仅写一条链接。浏览器路径里不包含 `public`。封面 `image` 也可使用这样的路径；首次维护建议先使用清楚的公共路径。

图片会公开发布，上传前去掉不希望公开的定位或个人信息，并确认使用授权。

## 新建一条便签动态

```powershell
pnpm.cmd new-dynamic "今天完成了文章整理，记下一个值得继续研究的问题。"
```

命令在 `src/content/dynamic/` 中生成日期时间文件名，读取网站配置的时区。打开生成的文件可以继续编辑 Markdown；也可手动新建，例如 `2026-09-27-103000.md`：

```md
---
published: 2026-09-27 10:30:00
pinned: false
location: 图书馆
---

今天记录一个短想法。

可以在这里补充后续进展。
```

`published` 必填，`pinned` 与 `location` 可省略。便签不使用文章的 `title`、`series` 字段，也没有本地 `draft` 开关；不准备公开的便签不要放进这个集合。图片同样可使用已存在的公共图片路径。

## 便签设置与清空

`src/config/dynamicConfig.ts` 控制页头、每页数量和评论开关。当前数据来源是本地 `/api/dynamic.json`，`memos.enable` 为 `false`；新增文件后无需维护另一份手写 JSON，也无需搭建 Memos。

删除不需要的 `.md` 后重新构建即可清空或减少列表。没有记录时，便签栏目仍存在并显示空状态，不需要关闭 `siteConfig.pages.dynamic`。

如果删掉最后一条后，本地预览仍显示旧记录，当前内容加载器可能保留了空目录的旧缓存。先停止开发预览，清理并同步生成的内容缓存，再完整构建：

```powershell
pnpm.cmd astro sync --force
pnpm.cmd build
```

该同步命令处理内容缓存，不会替你删除原始音频、照片或 Waline 留言。构建后可检查 `/api/dynamic.json` 是否为空数组 `[]`，不要用隐藏列表来代替真正清空内容。

便签文件 ID 同时参与链接和评论定位，编辑内容时尽量保留文件名。删除内容文件不会替你删除 Waline 数据库中的已有评论；如需清理留言，要在评论后台另行操作。

## 发布前确认

运行 `pnpm.cmd check`、`pnpm.cmd type-check` 与 `pnpm.cmd build`，再用 `pnpm.cmd preview` 检查归档、正文、目录、图片和链接。生产搜索索引由完整构建生成，开发模式搜不到新文不代表文章没保存。

本地保存不等于上线；提交与部署步骤见[工具、交流与发布指南](/posts/guide/04-customize-and-preview/)。下一篇是[相册维护](/posts/guide/05-gallery/)。
