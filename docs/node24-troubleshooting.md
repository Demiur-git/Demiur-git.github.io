# Node 24 本地兼容性排查

已在 Windows x64 / Node 24.15.0 验证 `pnpm check`、`pnpm type-check` 和完整 `pnpm build`。不需要全局降级 Node。

## 三类不同故障

- `uv_os_get_passwd ENOMEM`：本机在受限执行环境内调用 `os.userInfo()` 时失败，同一 Node 在正常权限下成功，并非实际内存不足。不要修改 Node、tsx 或伪造用户名；在正常 PowerShell 中运行构建。可用 `node -e "require('node:os').userInfo(); console.log('OK')"` 验证，命令不输出个人信息。
- `ERR_UNKNOWN_FILE_EXTENSION .png`：纯 Node 构建脚本不能加载 Astro 图片。构建脚本和翻译工具已改为直接导入所需配置文件，避免配置总入口间接引入图片。后续新增 Node 脚本时也应避免导入 `src/config/index.ts`。
- Waline 原生 SQLite 驱动缺失：旧 `better-sqlite3@11.10.0` 在当前 Node 24 环境无法加载。本地服务已使用独立覆盖锁定到含 Windows 二进制的 13.0.3，详见 [本地服务说明](../tools/waline-local/README.md)。不安装系统编译器。

## 验证命令

在项目根目录的正常 PowerShell 中运行：

```powershell
node --version
pnpm check
pnpm type-check
pnpm build
pnpm --dir tools/waline-local install --frozen-lockfile
pnpm --dir tools/waline-local check
```

构建成功不代表可以直接上线：本地 `.env.local` 的 Waline 地址指向本机，部署时必须重新配置正式服务并重建。生成的 `dist` 和本地数据库、密钥不提交；音乐曲库仍按原有忽略规则管理。

空项目集合、包体积较大及 npx 对 pnpm 配置项的提示不属于 Node 24 崩溃；当前可与成功构建同时出现。
