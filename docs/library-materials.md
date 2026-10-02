# 图书馆实体阅览材质与许可

四组纹理均采用 CC0 1.0。本地处理版位于 `public/assets/library-3d/materials/`，不请求素材站 CDN，不包含原始 ZIP。来源核对日期：2026-10-02。

| 用途 | 指定资产 | 来源 | 网站处理 |
| --- | --- | --- | --- |
| 家具 | Wood049 | [ambientCG 原页](https://ambientcg.com/view?id=Wood049) | Color、NormalGL、Roughness；材质调为深暖木色 |
| 地板 | wood_floor | [Poly Haven 原页](https://polyhaven.com/a/wood_floor) | Diffuse、nor_gl、Rough；按米制尺度重复 |
| 墙面 | Plaster001 | [ambientCG 原页](https://ambientcg.com/view?id=Plaster001) | Color、NormalGL、Roughness；暖灰抹灰 |
| 布艺 | Fabric026 | [ambientCG 原页](https://ambientcg.com/view?id=Fabric026) | 颜色去色并染为灰绿；保留 NormalGL、Roughness |

许可：[ambientCG CC0](https://docs.ambientcg.com/license/)、[Poly Haven CC0](https://polyhaven.com/license)、[CC0 1.0 全文](https://creativecommons.org/publicdomain/zero/1.0/legalcode)。来源记录用于维护追溯，CC0 不要求署名。不对原素材声称独占权利。

## 重制本地 WebP

运行 `node scripts/prepare-library-materials.mjs`，需可访问两家素材站，并使用现有 `sharp`。Windows 使用原生 PowerShell 下载、系统 `tar.exe` 解压；不新增依赖。下载目录自动建在系统临时目录，脚本不删除原始下载、不将其放进仓库。可以用 `node scripts/prepare-library-materials.mjs "原来的临时目录"` 继续处理中断的下载。

每组输出 `color / normal / roughness` 的 `1024 / 512` WebP，共 24 个文件；颜色有损压缩，法线与粗糙度使用无损压缩。全部压缩资源约 10.55 MiB（不是 GPU 内存）。一次加载只选择一组分辨率：桌面 1K，触屏或 600px 以下 512px。

颜色贴图采用 sRGB；法线与粗糙度采用线性数据，法线为 OpenGL 方向。额外程序材质提供金属、玻璃、纸张与低饱和书封，不下载模型或 HDR 环境图。材质加载错误保留对应基础材质并提示，不显示破图。

`LibraryTextures.dispose()` 释放 GPU 纹理并关闭 ImageBitmap；取消加载时丢弃过期结果。此处源码、来源和许可可公开；私有对话文件、曲库和临时原始压缩包不属于这些资产。
