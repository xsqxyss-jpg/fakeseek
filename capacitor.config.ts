// 修「点图片放大后按返回直接退出软件」：
// Capacitor 的 allowNavigation 让 blob:/data: 这类本地预览 URL 留在同一个 WebView 里导航，
// 而不是被系统当成外链丢出去（丢出去 = 用户回不来，按返回就退出了应用）。
// 网页侧已有 __fakeseekGoBack 桥接系统返回键，留在本 WebView 内的导航会被 history.back() 正常回退。
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.fakeseek.chat',
  appName: 'fakeseek',
  webDir: 'dist',
  server: {
    // blob: 与 data: 是 IndexedDB 图片预览生成的本地 URL，允许在本 WebView 内打开
    allowNavigation: ['blob:*', 'data:*'],
  },
};

export default config;
