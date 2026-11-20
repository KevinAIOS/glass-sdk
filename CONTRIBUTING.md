# 参与贡献

本仓库是 AIOS 第一版 SDK 的公开快照。公开议题、分支策略和发布流程还没有定，先请把问题或补丁说明开在本仓库。不要使用 Mentra 商标作为产品名、包名或品牌，也不要暗示与 Mentra 关联或获其认可（见 NOTICE）。

## 目录

- `packages/glass/` — `@aios/glass`。公开快照里的 `src/` 和 `dist/` 是已经生成好的源码与构建产物。用于从 MentraOS 原文重新生成的上游输入不在本仓库。
- `packages/glass-cli/` — `aios-glass` 命令行（`src/`）与 `create` 模板（`assets/`）。`assets/contacts` 在构建时由 `examples/contacts` 覆盖生成。
- `packages/native-sdk/` — Android Native SDK（Java + AIDL）。构建需要 JDK 17 与 Android SDK，见 `docs/构建.md`。
- `examples/`、`templates/`、`docs/`。

## 提交前

- 让改动保持聚焦。
- 能跑的检查：
  - `packages/glass`：`bun install && bun test ./src`（公开快照可直接测已生成的 `src/`；完整 `bun run build` 需要未纳入本仓库的上游生成输入）
  - `packages/glass-cli`：`bun install && bun run build`，并按 `docs/开发者正路.md` 至少走一遍 `create → build → pack`
- 说明哪些测试需要真机眼镜、Android 设备或可调试 Host，并写清楚你是否实际跑过。
- 不要在 SDK 公共名、包名、模板 id 或产物中引入上游商标标识；CLI 的 `create` / `build` / `pack` 会拒绝含上游标识的 id 与产物。
