# 构建说明

本项目是 [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo) 的轻量化二改版，
把自己打包成 Android APK 的步骤记录在此，方便复现。

## 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | 20+ | 前端构建 |
| pnpm | 8+ | 依赖管理 |
| JDK | 21 | Capacitor 8 要求 |
| Android SDK | compileSdk 36 | 含 build-tools 36.0.0 |
| Gradle | 8.14 | 命令行版即可，无需 wrapper |

## 步骤

```bash
pnpm install
export NODE_ENV=production
npx rspack build -c rspack.config.ts
npx cap sync android
cd android
export JAVA_HOME=/path/to/jdk-21
export ANDROID_HOME=/path/to/Android/Sdk
./gradlew assembleDebug
```

产物在 `android/app/build/outputs/apk/debug/app-debug.apk`。

## 已知坑

1. `pnpm build` 在部分 shell 下失败（`NODE_ENV=production` 前置变量不被识别），改用 `export` + `rspack build`
2. `local.properties` 里的 SDK 路径必须用正斜杠
3. `npx cap add android` 不会生成 `capacitor.settings.gradle`，必须跑一次 `cap sync`
4. `android/app/src/main/res/` 下不能放 `.bak` 等非资源文件，否则 gradle merge 失败
