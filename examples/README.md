# 样例

| 样例 | 面 | 构建 |
|---|---|---|
| `contacts` | `@aios/glass`（TS），`registerApp` + `session.actions.handle` + `user-data` 权限 | `bun install && aios-glass build && aios-glass pack`（依赖 `file:../../packages/glass`）；`packages/` 下是冻结时的签名包 |
| `native-reference` | Native SDK：会话、订阅（`device.battery` / `device.connection` / `input.action`）、`present` 显示 | `build.py`，需 Android SDK、SDK AAR、Host 证书、签名库 |
| `audio-reference` | Native SDK：麦克风事件、`speak`、音频流；另有位置、设置、blob、通知等 `request` 调用 | 同上 |
| `bluetooth-audio-reference` | Native SDK：麦克风采集 + `openAudioStream` / `speak` 的蓝牙音频时序 | 同上 |
| `camera-reference` | Native SDK：`takePhoto` / `readPhoto` | 同上 |

`runtime-client` **不在本仓库**：它是 Host↔运行时客户端，不属于第一版 SDK 的开发者面。
