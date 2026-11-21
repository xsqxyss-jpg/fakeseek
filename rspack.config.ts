import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@rspack/cli'
import { rspack, type Configuration } from '@rspack/core'

const dev = process.env.NODE_ENV !== 'production'
// JS 语法转译目标：Android System WebView 官方下限 Chrome 60（Capacitor 文档），
// 国产 ROM 的 WebView 长期不更新，必须按 60 转译，否则可选链等语法直接 SyntaxError 白屏。
const jsTargets = ['chrome >= 60', 'edge >= 105', 'safari >= 16', 'firefox >= 110']
// CSS 目标保持 87：lightningcss 按目标删规则，降到 60 会把 :has/color-mix 等在构建期删掉，
// 新设备上样式反而坏掉。老 WebView 上 CSS 只降级不改名（布局退化，不白屏）。
const cssTargets = ['chrome >= 87', 'edge >= 105', 'safari >= 16', 'firefox >= 110']
const root = path.dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string }

const cssLoader = {
  loader: 'builtin:lightningcss-loader',
  options: { targets: cssTargets },
}

type ConfigOptions = {
  /** 公开 API 的地址，注入为 __API_ORIGIN__ */
  apiOrigin?: string
  /** 开发服务器配置，支持本地接口代理 */
  devServer?: Configuration['devServer']
}

/** 创建构建配置，支持自定义 API 地址和开发服务器选项 */
export const createConfig = ({
  apiOrigin = 'https://api.deepseek.com',
  devServer,
}: ConfigOptions = {}): Configuration => ({
  mode: dev ? 'development' : 'production',
  entry: './src/main.tsx',
  output: {
    path: path.resolve(root, 'dist'),
    // 运行时按当前脚本地址推导资源路径，file:// 下异步 chunk、字体都按相对位置加载
    publicPath: 'auto',
    filename: 'static/js/[name].[contenthash:8].js',
    chunkFilename: 'static/js/async/[name].[contenthash:8].js',
    cssFilename: 'static/css/[name].[contenthash:8].css',
    cssChunkFilename: 'static/css/async/[name].[contenthash:8].css',
    assetModuleFilename: 'static/media/[name].[contenthash:8][ext]',
    clean: true,
  },
  devtool: dev ? 'cheap-module-source-map' : false,
  // 开发模式预编译异步模块，保持首次加载代码高亮和公式时的页面状态
  lazyCompilation: false,
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    // 将 .js 导入路径解析到同名 .ts、.tsx 或 .js 文件
    extensionAlias: { '.js': ['.ts', '.tsx', '.js'] },
  },
  module: {
    // CSS Modules 使用默认导出：`import styles from './x.module.css'`
    parser: { 'css/module': { namedExports: false } },
    generator: { 'css/module': { localIdentName: '[local]-[hash:6]' } },
    rules: [
      { test: /\.module\.css$/, type: 'css/module', use: [cssLoader] },
      { test: /\.css$/, exclude: /\.module\.css$/, type: 'css', use: [cssLoader] },
      {
        // 业务 TS/TSX：转译到老 WebView 兼容语法
        test: /\.(ts|tsx)$/,
        exclude: /[\\/]node_modules[\\/]/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic', development: dev } },
            externalHelpers: true,
          },
          env: { targets: jsTargets },
        },
        type: 'javascript/auto',
      },
      {
        // 第三方依赖与纯 JS：同样过 swc。依赖包发布的是未转译产物（含 ?. ?? 等），
        // 不转译的话 Chrome 60~86 的 WebView 解析 bundle 直接 SyntaxError = 纯白屏。
        test: /\.(js|mjs|cjs)$/,
        type: 'javascript/auto',
        resolve: { fullySpecified: false },
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'ecmascript' },
            externalHelpers: true,
          },
          env: { targets: jsTargets },
        },
      },
      { test: /\.(woff2?|ttf)$/, type: 'asset/resource' },
    ],
  },
  plugins: [
    // 经典 defer 脚本支持 file:// 页面的资源加载
    new rspack.HtmlRspackPlugin({
      template: './src/index.html',
      scriptLoading: 'defer',
      meta: { 'application-version': version },
    }),
    new rspack.DefinePlugin({ __API_ORIGIN__: JSON.stringify(apiOrigin) }),
    new rspack.CopyRspackPlugin({
      patterns: [{ from: path.resolve(root, 'LICENSE'), to: 'LICENSE', toType: 'file' }],
    }),
  ],
  performance: { hints: false },
  devServer: { port: 8090, ...devServer },
})

// eslint-disable-next-line import/no-default-export
export default defineConfig(createConfig())
