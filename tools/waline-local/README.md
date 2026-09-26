# Waline 本地试用

## 当前环境状态

已在 Node 24.15.0 / Windows x64 验证真实服务启动及匿名读取留言接口。无需降级 Node、安装 Visual Studio C++ 工具或 Docker。

本目录通过独立 `pnpm-workspace.yaml` 将 `think-model-sqlite` 的旧驱动替换为 `better-sqlite3@13.0.3`，使用包内自带的 Windows Node-API 二进制；禁止 pnpm 为该包隐式运行 `node-gyp`。覆盖仅作用于本地 Waline，不修改网站前端依赖。请保留锁文件并使用 pnpm 安装，不以 npm 安装替代。

兼容检查使用内存数据库验证真实驱动的增删改查，不创建管理员或修改留言。完整提交与后台审核流程仍须另行联调，启动成功不代表全部业务验收完成。

## 安装、启动与停止

在项目根目录执行：

```powershell
pnpm --dir tools/waline-local install
pnpm --dir tools/waline-local check
node tools/waline-local/run.mjs --init
pnpm --dir tools/waline-local start
```

服务仅监听 `http://127.0.0.1:8360`。保持该终端运行，按 `Ctrl+C` 停止；停止不会删除留言。不要开放端口或使用端口转发。

网站根目录的本地 `.env.local`：

```dotenv
PUBLIC_WALINE_SERVER_URL=http://127.0.0.1:8360
```

配置后重启 `pnpm dev`；生产预览需要重新构建。服务端强制审核、60 秒提交间隔、禁用地理信息及 UA 展示。本地试用未配置邮件和第三方登录。

## 注册管理员与审核

真实服务运行后，打开 `http://127.0.0.1:8360/ui`。在尚无用户的空库中自行注册首个账户，该账户会成为管理员；密码和邮箱由你自行填写，不发给助手，不写入源码。

访客无需登录，昵称必填、邮箱选填。新留言在后台处于待审核状态；只有通过后才向其他访客公开。在后台可拒绝/标记垃圾、删除及回复。管理员看到的待审核内容不等同于已公开；请用无登录的另一个浏览器窗口检查。

留言页、每篇文章、每条便签分别存储；文章保留 `comment: false` 和加密限制。友链及赞助没有启用评论。

## 数据与上线注意

`data/waline.sqlite` 存放留言和管理员数据，`.env` 存放首次初始化时自动生成的登录密钥。两者及日志、运行目录均已忽略，不得放入 `public`、上传仓库或复制进网站产物。数据库初始化不会清空已有数据；备份数据库前先停服务。

本轮留下空库，不创建管理员，不留下测试账户或留言。原生驱动问题已解决；完整审核、拒绝、回复、重启持久化测试尚待执行。

`.env.local` 只适用于本机，不能把含 `127.0.0.1` 地址的本地 `dist` 发布给访客。上线需独立部署 Waline 和数据库，设置真实 HTTPS 地址、服务端 `COMMENT_AUDIT=true`、域名白名单、反垃圾及通知选项，重新验证待审核内容不公开。数据库与密钥永远只留在服务端。

官方说明：
- https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.0
- https://waline.js.org/guide/deploy/vps.html
- https://waline.js.org/guide/database.html
- https://waline.js.org/reference/server/env.html
