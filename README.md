# AIOS Glass SDK v1

第一版 SDK 与样例：开发者在可调试的 AIOS Host 上写出并侧载一个 Experience。仓库：https://github.com/KevinAIOS/glass-sdk

许可为 [Apache-2.0](LICENSE)。npm 包名是 `@aios/glass`（0.5.0）和 `@aios/glass-cli`（0.2.0，命令 `aios-glass`），当前均为 `private: true`，尚未发布到 npm；请从这个 GitHub 仓库使用。仓库标签 `v0.1.0` 表示第一次公开快照，与这两个包版本号不是一回事。体验编写面契约版本是 **v0.1.0**，对应上述 SDK 0.5.0 与 CLI 0.2.0；契约版本与仓库标签同号但不是同一个东西，见 [体验编写面契约](docs/体验编写面契约.md) 的版本表。

设备契约在单独的公开仓库 [KevinAIOS/glass-contract](https://github.com/KevinAIOS/glass-contract)。Host↔运行时契约在单独的公开仓库 [KevinAIOS/host-runtime-contract](https://github.com/KevinAIOS/host-runtime-contract)（契约版本 v0.1.0，与本仓库标签或体验编写面契约的 v0.1.0 不是同一份）。Reality Runtime 的最小核心实现见 [KevinAIOS/reality-runtime](https://github.com/KevinAIOS/reality-runtime)。

## 这是什么

开发者正路是：

```
aios-glass create DIR --id local.aios.myapp   # 默认 reference 模板
cd DIR && bun install
# 写 src/background/index.ts 里的 registerApp(...) 与 aios.json
aios-glass build
aios-glass pack [--key FILE.pem]
aios-glass sideload packages/<id>-<version>.zip
```

本仓库提供：

- `packages/glass/` — `@aios/glass` 0.5.0，本地应用 SDK
- `packages/glass-cli/` — `@aios/glass-cli` 0.2.0，命令 `aios-glass`
- `packages/native-sdk/` — Android Native SDK 源码（本次公开快照未附带已构建的 AAR）
- `templates/` — `create` 的三个模板：`reference`（默认，也就是计划里说的 Hello）、`compatibility`、`contacts`
- `examples/` — `contacts`（TypeScript / `@aios/glass`）以及 4 个 Native 样例

体验编写面契约已定稿，见 [体验编写面契约](docs/体验编写面契约.md)（契约版本 v0.1.0）。会话处理正路是 `registerApp(handler)`；代码型路径是 `defineExperience`（`@aios/glass/experience`）再 `registerApp(experience)`。主盘点 401 项：拟冻结 284，形状保留不冻 35，明确不进 78，留云调用类型 4。

它**不是**：

- **不是设备契约**：Host ↔ 眼镜怎么说话，见 [glass-contract](https://github.com/KevinAIOS/glass-contract)。
- **不是 Host↔运行时契约**：见 [KevinAIOS/host-runtime-contract](https://github.com/KevinAIOS/host-runtime-contract)。`@aios/runtime-client` 不在本仓库。那份契约的 v0.1.0 与本仓库标签或体验编写面契约的 v0.1.0 不是同一份。
- **不是 Reality Runtime 实现**：见 [KevinAIOS/reality-runtime](https://github.com/KevinAIOS/reality-runtime)。
- **不是 npm 发布**。

## 从本仓库起步

需要 [Bun](https://bun.sh)（CLI 要求 `>= 1.2.0`）。`pack` 需要系统里的 `zip`；`sideload` 需要 `adb`，以及一台装着可调试 AIOS Host（包名 `local.aios.glass`）的 Android 设备或模拟器。

```
git clone https://github.com/KevinAIOS/glass-sdk.git
cd glass-sdk
bun packages/glass-cli/dist/cli.js create ./my-app --id local.aios.myapp
cd my-app && bun install
bun ../packages/glass-cli/dist/cli.js build
```

详情见 [docs/开发者正路.md](docs/开发者正路.md)。体验编写面以 [体验编写面契约](docs/体验编写面契约.md) 为准。稳定面与 v1 限制见 [docs/稳定面与v1空操作.md](docs/稳定面与v1空操作.md)。会话能力见 [docs/会话能力.md](docs/会话能力.md)。

## 来源

冻结自私有仓库 `KevinAIOS/AIOSGlass` 分支 `codex/kele-20261103`、提交 `d5a93a371b3d825b87771ab517c435551948a547`。SDK 源码由 MentraOS 改名生成，致谢与商标限制见 [NOTICE](NOTICE)。本仓库不包含用于重新生成 SDK 的上游原文。

## 文档

- [体验编写面契约](docs/体验编写面契约.md)（契约版本 v0.1.0；对应 `@aios/glass` 0.5.0、`@aios/glass-cli` 0.2.0；与仓库标签 `v0.1.0` 不是一回事）
- [开发者正路](docs/开发者正路.md)
- [稳定面与 v1 空操作](docs/稳定面与v1空操作.md)
- [会话能力](docs/会话能力.md)
- [CLI](docs/CLI.md)
- [Native SDK](docs/Native-SDK.md)
- [构建](docs/构建.md)
