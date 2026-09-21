# 自定义背景图片

将自己的背景图片放在这个目录，然后在 `src/config/backgroundWallpaper.ts` 中填写相对 `src` 的路径，例如：

```ts
src: {
	desktop: "assets/images/backgrounds/library-desktop.webp",
	mobile: "assets/images/backgrounds/library-mobile.webp",
},
```

桌面端和移动端都可以填写图片数组以启用现有轮播功能。建议桌面图片使用 16:9 或更宽的构图，手机图片使用 9:16 构图，并优先选择 WebP 或 AVIF。
