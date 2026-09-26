# Node 24 本地兼容性排查

已在 Windows x64 / Node 24.15.0 验证 `pnpm check`、`pnpm type-check` 和完整 `pnpm build`。不需要全局降级 Node。

## 不同故障的处理

- `uv_os_get_passwd ENOMEM`：本机在受限执行环境内调用 `os.userInfo()` 时失败，同一 Node 在正常权限下成功，并非实际内存不足。不要修改 Node、tsx 或伪造用户名；在正常 PowerShell 中运行构建。可用 `node -e "require('node:os').userInfo(); console.log('OK')"` 验证，命令不输出个人信息。
- `ERR_UNKNOWN_FILE_EXTENSION .png`：纯 Node 构建脚本不能加载 Astro 图片。构建脚本和翻译工具已改为直接导入所需配置文件，避免配置总入口间接引入图片。后续新增 Node 脚本时也应避免导入 `src/config/index.ts`。
- Waline 留言：当前使用 Vercel 线上服务，网站不再运行本机 SQLite 服务，无需安装原生数据库驱动。配置与后台操作见 [线上留言服务说明](waline-online.md)。前端脚本加载错误与 Node 或数据库驱动无关。

## 验证命令

在项目根目录的正常 PowerShell 中运行：

```powershell
node --version
pnpm check
pnpm type-check
pnpm build
```

构建成功不代表线上留言已经完成验收：本地 `.env.local` 和部署工作流均应通过 `PUBLIC_WALINE_SERVER_URL` 使用正式服务地址，更新环境变量后须重启开发服务或重新构建。生成的 `dist` 和旧本地数据库、密钥不提交；音乐曲库仍按原有忽略规则管理。

空项目集合、包体积较大及 npx 对 pnpm 配置项的提示不属于 Node 24 崩溃；当前可与成功构建同时出现。
