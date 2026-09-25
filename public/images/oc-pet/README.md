# OC 桌宠素材

这里存放网站虚构引导者「绫」的透明背景立绘。桌宠路径在 `src/config/pioConfig.ts` 的 `ocPetConfig.assets` 中配置。

- `idle.webp`：默认待机形象，必选。
- `blink.webp`：眨眼状态，可选；缺失时保持待机形象。
- `interact.webp`：点击互动状态，可选；缺失时保持待机形象。

三张图片应使用相同画布尺寸和人物位置。建议使用透明 WebP 或 PNG，画布比例保持一致。

`ling-portrait-anime-v4.png` 是当前正常比例的高分辨率透明原图，`ling-portrait-anime-v4.webp` 用于角色页。v4 以用户提供的第一张图为底图，仅将用户提供的第二张图的双手像素移植到手部区域，没有重新生成形象。此前的 v3、动画风 v2（`ling-portrait-anime-v2.*`）和初版（`ling-portrait.*`）均保留供回档；若要恢复，只需把角色页的图片路径改回对应 WebP。三张桌宠图片保持不变，它们只是平面状态图；日后若制作 Live2D，需要另外准备分层原画与模型。
