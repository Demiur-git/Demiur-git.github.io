# Waline 线上留言服务

网站保持静态架构，留言数据存储于 Vercel 上的 Waline 服务及其数据库。本地开发与 GitHub Pages 使用同一线上服务，因此本地提交的留言也会写入线上数据库。

## 网站配置

项目根目录的 `.env.local` 使用：

```dotenv
PUBLIC_WALINE_SERVER_URL=https://demiur-waline.vercel.app
```

修改后重启 `pnpm dev`；使用 `pnpm preview` 时先重新构建。GitHub Pages 部署工作流设置相同的构建环境变量。服务地址是公开信息，不是密钥；未配置时页面显示留言尚未开放，不请求任何服务，也不回退到本机地址。

留言页、文章和便签分别使用独立的评论路径；本地预览与线上网站的相同页面共享留言。便签弹层仍使用原有稳定标识。客户端 JavaScript 由源码 vendor 目录按需加载，本地 CSS 与许可证保留在 `public/vendor/waline-3.15.2/`，不依赖第三方 CDN。

## 服务端与管理后台

在 Vercel 的 Environment Variables 中设置以下普通配置，类型为 Config，至少应用于 Production；需要预览服务时也勾选 Preview：

| Key | Value |
| --- | --- |
| `COMMENT_AUDIT` | `true` |
| `SITE_NAME` | `Demiur` |
| `SITE_URL` | `https://demiur-git.github.io` |
| `SECURE_DOMAINS` | `demiur-git.github.io,demiur-waline.vercel.app` |
| `DISABLE_USERAGENT` | `true` |
| `DISABLE_REGION` | `true` |
| `IPQPS` | `60` |

保存后 Redeploy，等待 Ready。数据库连接串、密码与登录密钥属于 Secret，不写入网站源码。保留已由 Neon 配置的数据库变量，不用为前端脚本报错修改数据库。

后台地址：<https://demiur-waline.vercel.app/ui>。在空库中首个注册用户会成为管理员，由站长自行注册，切勿公开密码。昵称必填、邮箱选填由前端配置；审核必须由服务端 `COMMENT_AUDIT=true` 实际执行。界面提示不能代替审核设置。

注册 403 时确认进入的是上述固定域名，不是临时预览域名；检查白名单是否包含服务域名、是否误填协议或路径，以及是否已重新部署。若仍失败，检查浏览器 Network 中失败请求的地址、状态与响应，并查看 Vercel 日志；不要分享密码、Cookie 或授权头。

## 验收与故障恢复

先验证留言查询和表单加载，再由站长使用临时留言检查：匿名提交后待审核、另一访客不可见、后台通过后公开。另检查拒绝、回复与删除，验收后删除测试留言。注册及审核未实际通过前，不能仅凭接口返回 200 宣称完成。

服务失败时页面显示错误并提供重新连接；重试只重新连接和查询，不自动重复提交留言。站内跳转销毁旧实例，重新进入时重新挂载，亮暗模式沿用站点主题。

早期 `tools/waline-local` 的受版本控制运行文件已移除。其已有数据库、密钥、日志及依赖缓存留在本机，继续受忽略规则保护，不迁移、不发布；Git 历史可恢复旧运行代码。

参考：[Waline 服务端环境变量](https://waline.js.org/reference/server/env.html)、[Vercel 部署指南](https://waline.js.org/guide/deploy/vercel.html)。
