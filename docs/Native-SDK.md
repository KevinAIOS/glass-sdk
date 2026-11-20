# Native SDK（`packages/native-sdk`）

Android 原生应用接入 AIOS Host 的 SDK，Java 8 字节码 + AIDL，输出 `dist/aios-native-sdk-1.0.0.aar`（`build.py` 默认输出名；本抽出没有 npm 包名）。冻结源，未改。

## 公共面

| 类 / 接口 | 成员 |
|---|---|
| `AIOSAppService`（继承它实现你的服务） | 抽象：`trustedHostPackage()`、`trustedHostCertificate()`、`onAIOSReady(session, state)`、`onAIOSEvent(session, event)`；可覆盖：`onAIOSStopped(reason)`、`onAIOSError(error)`、`supportedProtocol()` |
| `AIOSSession` | `getId`、`isActive`、`request(operation, payload)`、`subscribe(events...)`、`subscribeActions`、`subscribeTranscription`、`present(text)`、`present(AIOSPresentation)`、`clearPresentation`、`takePhoto`、`readPhoto`、`startRecording`（2 个重载）、`stopRecording`、`cancelRecording`、`readMedia`、`startStream`、`stopStream`、`speak`、`play`、`stopAudio`、`openAudioStream`、`writeAudioStream`、`closeAudioStream`、`abortAudioStream`、`getLocation`、`getStorage`、`setStorage`、`getSetting`、`setSetting`；静态工具 `fields`、`json` |
| `AIOSPresentation` | 构造 `(id, mode)`，`content`、`duration`、`urgent`、`text`、`image`、`rect`、`toJSON` |
| `AIOSIdentity` | 静态 `certificate(context, packageName)`、`verify(context, uid, packageName, certificate)` |
| AIDL `IAIOSAppService` | `connect(hello, host)`、`onEvent(sessionId, eventJson)`、`stop(sessionId, reason)` |
| AIDL `IAIOSHost` | `request(sessionId, requestId, operation, payloadJson)` |

计数：`AIOSSession` 公开实例方法 30 个（28 个不同名字）；全部公开 / 受保护成员合计约 49 个；AIDL 方法 4 个。见 `RESULT.md` 计数一节。

## 构建

需要 JDK 17（`javac`、`jar`）与 Android SDK（`build-tools/36.0.0` 的 `aidl`，`platforms/android-35`）：

```
python3 build.py --sdk $ANDROID_HOME
```

本次公开快照只包含 Native SDK 源码，未附带已构建的 AAR；构建需要 JDK 17 与 Android SDK。

## 样例

`examples/native-reference`、`audio-reference`、`bluetooth-audio-reference`、`camera-reference` 都用 `build.py --aios-sdk <AAR> --host-certificate <Host 签名证书 SHA-256> --keystore <你的签名库>` 构建 APK，同样需要 Android SDK，本机未构建。
