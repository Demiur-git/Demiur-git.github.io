<div align="center">

# personal_pages

> 基于 Astro 的个人博客与内容整理空间

![Node.js >= 22.23](https://img.shields.io/badge/Node.js-%3E%3D22.23-brightgreen)
![pnpm 11](https://img.shields.io/badge/pnpm-11-f69220)
![Astro 7](https://img.shields.io/badge/Astro-7-ff5d01)
![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178c6)

</div>

---

这是我的个人博客项目，用于长期整理笔记、文章、项目、照片与阅读计划。网站目前仍在持续调整，内容和个人信息会逐步补充。

## 页面结构

- **主页**：网站介绍与常用社交链接。
- **笔记**：记录短想法、过程和暂时没有结论的线索。
- **文章**：保存经过整理、适合长期阅读的完整内容。
- **我的**：通过导航栏下拉菜单进入日历、相册、项目和读书计划。
- **关于**：通过导航栏下拉菜单分别查看本人介绍和网站说明。

## 技术栈

- [Astro](https://astro.build/)
- [Svelte](https://svelte.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Pagefind](https://pagefind.app/)

## 本地运行

### 环境要求

- Node.js ≥ 22.23
- pnpm 11

### 安装与启动

```bash
git clone https://github.com/Demiur-git/personal_pages.git
cd personal_pages
pnpm install
pnpm dev
```

开发服务器默认运行在 `http://localhost:4321`。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动本地开发服务器 |
| `pnpm check` | 检查 Astro 页面与组件 |
| `pnpm type-check` | 执行 TypeScript 类型检查 |
| `pnpm build` | 生成生产版本 |
| `pnpm preview` | 本地预览生产版本 |
| `pnpm new-post <filename>` | 创建新文章 |

## 内容与配置

- [项目文件树与职责说明](./docs/PROJECT_STRUCTURE.md)
- 网站配置位于 `src/config/`。
- 页面路由位于 `src/pages/`。
- 文章、笔记等内容位于 `src/content/`。
- 直接公开的静态资源位于 `public/`。

带有多个子页面的栏目统一使用导航栏下拉菜单：桌面端悬停展开，移动端点击展开。

## 模板来源与版权说明

> [!IMPORTANT]
>
> 本项目以 [CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly) 为基础模板进行个人化修改，部分布局、组件设计和相关代码来自 Firefly。
>
> **如果你参考或使用了 Firefly 的组件设计和相关代码，请注明来自 Firefly**

Firefly 基于 [saicaca/fuwari](https://github.com/saicaca/fuwari) 继续开发。感谢原作者与相关贡献者的工作。

## 许可协议

本项目沿用 [MIT License](./LICENSE)。原项目版权声明与许可文本保留在 `LICENSE` 文件中。
