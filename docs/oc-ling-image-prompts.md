# 绫 / Ling 立绘生成记录

本组素材使用 Codex 内置 imagegen 生成，透明 PNG 与 WebP 见 `public/images/oc-pet/`。WebP 仅作格式压缩，不改变构图。正常立绘当前使用 `ling-portrait-anime-v4.*`：以用户此次提供的第一张图为底图，将此次提供的第二张图中的双手按像素移植到手部区域，未使用生成模型重绘。v3、动画风 v2 与初版均保留，方便回档。Q 版三态均以上一张图像作为身份参考，未随正常立绘改动。

## 正常比例全身像

> Create a single original anime-style full-body transparent PNG character cutout for a website. Ling is a fictional library guide: straight shoulder-length black hair with simple bangs, black-brown eyes, white collared blouse, long black skirt, black leather shoes. Low-saturation Japanese anime illustration, clean readable line art, subtle shading. Standing at a slight three-quarter angle. Both hands raised at chest: each of five fingertips touches its corresponding opposite fingertip to form a downward-pointed steeple, with natural correct ten-finger anatomy. Gentle smile, mouth just slightly open as if speaking. Full head, complete skirt, both shoes visible with generous transparent margin. No other character, no book, no scenery, no lettering, no watermark. Genuinely transparent alpha background.

## Q 版待机（以上述立绘为角色参考，再压缩头身比）

> Edit this Ling character into a MUCH MORE CHIBI website mascot while preserving her identity. Keep the same black shoulder-length straight hair/bangs, brown-black eyes, white collared blouse, plain black long skirt, black leather shoes, and small closed book in hand. New proportions must be unmistakably 2-heads-tall: head occupies roughly 48% of her full height, torso short, tiny hands and feet, round soft silhouette, joyful but gentle large eyes, subtle open-mouth smile. Entire character centered in a square canvas with generous transparent outer space, feet visible. The current image is too tall and adult-proportioned; redraw it as a compact original anime super-deformed chibi while preserving hair and clothing design. Idle pose, eyes OPEN, quietly looking toward visitor. No background, no white/black backdrop, genuinely transparent alpha; no extra objects, no letters or watermark.

## Q 版眨眼（以待机图为参考）

> Edit this EXACT chibi character sprite to create a blink animation frame. Change ONLY her two open eyes into naturally closed curved smiling eyes; retain the same expression otherwise. Keep EVERYTHING ELSE pixel-position consistent: exact same square canvas, head/hair silhouette, white blouse, book held in both tiny hands, long black skirt, black shoes, colors, lighting, pose, size, and location. Keep genuine transparent alpha background. No background, no text, no watermark. This is one frame in a three-state website desktop pet sprite set and must align with the source idle sprite.

## Q 版互动（以待机图为参考）

> Create the INTERACT frame for the exact same Ling chibi website desktop pet sprite. Keep her square canvas and the body, head, hair and shoes at the same scale and position as the input idle image; maintain the same straight black shoulder-length hair, dark brown eyes, white blouse and long black skirt, muted anime style and genuine transparent alpha. Only change expression and arms: a slightly wider warm open-mouth smile, her LEFT hand still holding the small closed book at her chest, her RIGHT arm raised beside her face for a small friendly wave with one natural five-finger hand. Full silhouette within canvas including hand and both shoes. No new accessories, background, lettering, watermark, or second character. Ensure she reads clearly at 112 pixels.

## 正常立绘动画风改稿 v2（已保留）

初次改稿以上述 Q 版待机图为身份参考、旧正常立绘为姿势参考，最终采用以下提示词绘制更强的二维动画风。

> Use case: stylized-concept. Create a NEW original full-body Ling character illustration for an anime website, transparent alpha. Image 1 is the approved chibi Ling and is the primary guide for her recognizable face, dark brown anime eyes, straight black shoulder-length hair and fringe, white blouse, ankle-length black skirt, black leather shoes. Image 2 is ONLY a pose/clothing reference; do NOT inherit its semi-realistic rendering, anatomical facial proportions, realistic folds, or gloss. Transform her into an unmistakable hand-drawn 2D TV-anime/manga key visual at normal (not chibi) proportions: moderately enlarged eyes, tiny simple nose, rounded youthful anime face, simplified limbs and hands, crisp dark ink contours, restrained flat cel-shading with just one shadow shape per surface, graphic hair highlights, clean silhouettes, low saturation. Full standing body including shoes, slight three-quarter turn, quiet smile with mouth slightly open as if speaking. Both hands at chest in a deliberate mirrored fingertip-to-fingertip gesture forming a downward-pointing triangular steeple; show five separate fingers on EACH hand, all five matching fingertip pairs contacting, no hidden/fused/extra fingers, hand shape clear enough to inspect. No book in this full-size portrait. Isolated transparent background, generous margins, no halo/backdrop, no text or watermark. Avoid realism, semi-realistic painterly shading, photographic skin, 3D.

为了精修手势，另生成 `docs/oc-ling-hand-reference.png` 作为五组指尖配对的近景参考：

> Use case: stylized-concept. Draw ONLY a close-up pair of elegant anime-style human hands from a front view, cropped at wrists, against genuinely transparent background, for an anatomical pose reference. The two palms face one another in mirror symmetry at chest height. There are exactly TWO hands and exactly TEN fingers, all visible and countable: left thumb to right thumb, left index to right index, left middle to right middle, left ring to right ring, left pinky to right pinky. Each of these five fingertip pairs touches lightly at the vertical centerline at five distinct heights. The fingers are fanned and separated with thin gaps, creating a downward-pointed diamond or steeple silhouette. Show no fused, missing, extra, crossing, or interlaced fingers. Clean black manga line art with limited peach cel color and only light shadow. No face, no sleeves, no props, no text, no watermark.

最后用全身动画风改稿作为编辑目标、手势近景作为参考，仅修正双手：

> Use case: precise-object-edit. Image 1 is the approved anime-style full-body Ling portrait and is the edit target. Image 2 is ONLY an exact anatomical reference for the ten-finger gesture. Change ONLY Ling's two hands and, if necessary, the last few centimeters of her wrists in Image 1 so that they reproduce the five fingertip pairs clearly depicted in Image 2, scaled naturally to chest size: five distinct visible fingers per hand, each matching fingertip pair contacting one-to-one (thumb, index, middle, ring, little). Keep the fingers mirrored and the hand gesture a downward-pointed diamond/steeple. Carefully preserve ALL other aspects of Image 1—anime face and expression, black shoulder-length hair, eye color, white blouse folds, black skirt, shoes, body pose, image dimensions, framing, cel shading and genuine transparent alpha. No added limbs, no fused fingers, no text, no background. This is a surgical hand correction, not a redesign.

近景参考图能明确看到五组指尖。缩小到全身图后，部分手指仍可能因重叠不够清楚；如果将来制作正式设定稿或 Live2D，建议画师以近景参考再次人工核对手部。

## 正常立绘比例精修 v3（已保留）

以 v2 为编辑目标，只收敛头部与面部的幼态感，手部姿势保持原样：

> Use case: precise-object-edit. Image 1 is the current full-body Ling portrait and is the edit target. Refine ONLY her head and facial proportions to make her look like a young adult anime character rather than a child, while keeping the same unmistakable 2D manga/cel-shaded style. Reduce the head size about 8–10% relative to the shoulders and full body; make the face a little less round and the jaw subtly longer, eyes slightly smaller and calmer, expression still a gentle smile with lips a little parted. Keep her hair straight, black, and shoulder-length with the same bangs and silhouette, adjusted naturally around the slightly smaller head. IMPORTANT invariants: preserve the existing chest-level fingertip pose EXACTLY as it is, including every hand/finger contour and wrist position; do not redraw, move, simplify, or obscure either hand. Preserve body pose, shoulder width, white shirt, black long skirt, black shoes, colors, line weight, full-body crop, canvas dimensions, genuine transparent alpha, and no background. Do not make her photorealistic or semi-realistic; retain crisp anime linework and flat muted cel shading. No text, extra objects, or watermark.
