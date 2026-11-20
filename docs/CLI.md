# aios-glass CLI（`@aios/glass-cli` 0.2.0）

源码：`packages/glass-cli/src/{cli,commands,catalog}.ts`（冻结源，未改）。产物：`packages/glass-cli/dist/cli.js`（`bin.aios-glass`），需要 Bun 运行。

## 命令（10 个，按 `--help` 与 `main()` 逐一核对）

| # | 命令 | 作用 | 正路 |
|---|---|---|---|
| 1 | `create DIR --id ID [--template reference\|compatibility\|contacts]` | 从模板建项目（默认 `reference`） | ✅（⚠️ 当前运行时下 EEXIST，见下） |
| 2 | `build` | 严格类型检查 + 打包到 `dist/` | ✅ |
| 3 | `keygen FILE.pem` | 生成 Ed25519 签名私钥（0600，独占创建） | 可选 |
| 4 | `pack [--key FILE.pem]` | 打 zip；带 key 时签名并写 `.release.json` | ✅ |
| 5 | `sideload FILE.zip [--device SERIAL] [--wait SECONDS]` | adb 送到可调试 Host 并等待启动回执 | ✅ |
| 6 | `account register --server URL --username NAME` | 目录服务注册（密码只从 `AIOS_GLASS_PASSWORD` 环境变量读） | 否 |
| 7 | `account login --server URL --username NAME` | 目录服务登录；凭据存 `~/.aios-glass/catalog-session.json`（0600，可用 `AIOS_GLASS_CLI_HOME` 改目录） | 否 |
| 8 | `account logout` | 删除本地凭据并登出 | 否 |
| 9 | `publish FILE.zip [--project DIR] [--description TEXT]` | 向目录服务建应用并上传版本 | 否 |
| 10 | `catalog` | 打印目录 | 否 |

6–10 连接**另行部署**的目录服务（`CatalogClient`，源文件在 `build-inputs/glass-contract-src/catalog-client.ts`，会拒绝 `BLOCKED_SERVICE_DOMAINS` 中的主机）。本步没有运行这些命令，也没有连接任何目录服务。

环境变量：`AIOS_ADB`（adb 路径）、`AIOS_GLASS_PASSWORD`、`AIOS_GLASS_CLI_HOME`。

## 说明

本仓库里的 `create` 已包含一行兼容补丁：先 `mkdir` 再拷模板时 `errorOnExist` 为 `false`，避免在 Bun 1.4 / Node 24 下因目标目录刚被创建而报 `ERR_FS_CP_EEXIST`。目录仍由 `mkdir` 独占创建，`force: false` 仍不覆盖已有文件。`@aios/glass-cli` 版本仍是 0.2.0。尚未单独验证 Bun 1.2.x（`engines` 下限）的行为。
