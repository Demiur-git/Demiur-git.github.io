# 绫相见场景背景

使用内置 imagegen 生成白天图，再以该图为编辑目标制作夜景。PNG 原图为 1672 × 941，保留生成器实际分辨率，不人为放大；同尺寸的网站用 WebP 位于 `public/images/home-entrance`，质量 86。两图仅用于序章相见场景，不替换首页壁纸。角色立绘单独叠加，没有绘入背景。

## 白天生成提示词

Use case: stylized-concept. Asset type: original full-screen Japanese anime visual novel background, landscape 2048x1152 (16:9), no UI. Scene: calm academy library aisle, eye-level straight-on single-point perspective, tall wooden bookshelves on both sides framing a spacious clear center aisle, distant windows and small reading area only far in the background. Foreground is empty floor, absolutely no near desk or tabletop. Center must remain clear for a separately composited standing character; central portrait crop must still read as library. Low saturation, warm neutral wood, muted book colors, refined hand-painted 2D anime background with clean architectural perspective, soft natural daytime window light. Subtle brass wall lamps (unlit in daytime) are part of fixed architecture for future night variant. No people, no characters, no readable writing, no sign, no logo. Avoid photorealistic rendering, dramatic bloom, clutter, fisheye, distorted shelves. Production-quality environment illustration.

## 夜景编辑提示词

Use case: lighting-weather. Image 1 is the exact edit target, a library aisle daytime background. Create its nighttime variant for the same visual novel scene. Change ONLY time of day and illumination. Preserve every bookshelf, book, wall lamp, window pane, arch, distant table and chairs, floorboard, plant, perspective, framing, dimensions, and location EXACTLY. Outside windows dark muted blue night; remove daylight beams and direct sun floor patches; existing brass wall lamps now emit restrained soft warm amber light, green-shaded distant table lamps weak warm light, gentle cool ambient fill, dark low-saturation wood remains legible. Keep refined 2D anime painted background. No people, no text or logo, no extra props, no bright bloom or white flash. Foreground stays empty aisle. Same wide 16:9 composition.
