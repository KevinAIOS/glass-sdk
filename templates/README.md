# create 模板

`aios-glass create` 只认这三个模板（`packages/glass-cli/src/commands.ts`：`["reference", "compatibility", "contacts"]`），默认 `reference`。它们与 `packages/glass-cli/assets/<name>/` 逐字节相同（CLI 从 `assets/` 读取；本目录是便于查看的副本）。

| 模板 | 内容 | 来源 |
|---|---|---|
| `reference`（默认，即计划里的 "Hello 模板"） | 后台 `registerApp` + `session.ui.handle("counter")` + `session.storage`；UI 计数按钮；类型化 `Channels` | 冻结 `assets/reference` |
| `compatibility` | `input.onButtonPress` / `onTouch` 与按能力决定的 `display` 显示；`aios.input`、`aios.display` 为可选能力 | 派生自上游 Kawaii miniapp，见 `compatibility/NOTICE` 与 `packages/glass-cli/compatibility-origin.json` |
| `contacts` | 声明 `user-data` 权限与一个 `about` action | CLI 构建时由 `examples/contacts` 复制 |
