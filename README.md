# fakeseek

> 基于 [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo)（MIT 协议）的**轻量化二改版**。
> **本项目不是 DeepSeek 官方产品，与官方无任何隶属关系**；官方商标与 Logo 均未使用。
> 仅对前端交互、外观与本地打包流程做了个人化的轻量调整，核心能力仍来自官方公开的开源代码。

一个可自行打包的 DeepSeek 对话客户端：填入你自己的 API Key 后即可在 Android 上使用。
**不自带任何账号或额度**，Key 仅保存在本机，费用由你自己的开放平台账号承担。

## 与上游的差异（轻量化二改点）

- **壁纸系统**：聊天区 / 侧栏 / 设置页三处独立壁纸，支持裁剪、明暗自适应
- **分区字色**：每个区域可单独指定「自动 / 黑 / 白」，优先级 用户字色 > 磨砂面板 > 壁纸明暗
- **输入卡**：磨砂玻璃质感、字号全局可调、语音输入与朗读
- **移动端交互**：抽屉式侧栏 push 动效、边缘手势返回、沉浸式状态栏
- **会话**：本地 IndexedDB 存储、官方导出包导入（合并去重）、导出备份
- **Android 打包**：Capacitor 壳 + Gradle 编译，一条命令重出 APK

## 自行构建

需要 Node 20+、pnpm、JDK 21、Android SDK（compileSdk 36）、Gradle 8.14。详见 `docs/BUILD.md`。

```bash
pnpm install
npx rspack build -c rspack.config.ts
npx cap sync android
cd android && ./gradlew assembleDebug
```

## 许可证

MIT。上游版权归 DeepSeek 所有，二改部分同样以 MIT 发布。
**不得使用"DeepSeek"名称或官方 Logo 作为本应用身份标识。**

## 免责

- 本项目仅供个人学习与技术研究使用
- API 费用、账号封禁等风险由使用者自行承担
- 与 DeepSeek 官方无任何关联，官方不对本项目提供任何支持或担保
