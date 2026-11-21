import { create } from 'zustand'
import { showToast } from '../components/base/toastState.js'

/**
 * 应用内更新：jsDelivr CDN 托管的 GitHub 仓库 version.json（国内直连可达）→ 原生桥下载 APK → 系统安装器。
 * version.json 格式：{ version, versionCode, url, notes, publishedAt }
 * 检查只在用户点按钮或启动静默检查时发生（各一次），不轮询。
 */

/**
 * 更新清单直链：GitHub Pages 固定文件名（缓存仅 10 分钟）。
 * 每次发版只覆盖 version.json 内容，文件名永不变——老客户端才不会因为换了文件名被永久丢弃。
 * 不要再改回 jsDelivr 的分支地址：它对 @main 缓存 12 小时且 purge 不生效，
 * 发版后用户要等半天才收得到。
 */
const VERSION_JSON_URL = 'https://xsqxyss-jpg.github.io/fakeseek/version.json'

/** 本 App 编译期版本号（与 SettingsDialog 的 APP_VERSION 保持一致） */
const APP_VERSION_CODE = 28

/** 更新信息（检查成功后填充） */
export type UpdateInfo = {
  version: string
  versionCode: number
  url: string
  notes: string
  publishedAt?: string
}

/** 弹窗可见状态：检查结果写入 store，UpdateModal 订阅它实时弹出（修「挂载时读一次」的竞态） */
type UpdateStore = {
  /** 待展示的新版本信息；null = 无 */
  available: UpdateInfo | null
  setAvailable: (info: UpdateInfo | null) => void
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  available: null,
  setAvailable: (available) => set({ available }),
}))

type UpdateListener = ((info: UpdateInfo | null) => void) | null

let checkListener: UpdateListener = null
let installListener: ((event: string, detail: string) => void) | null = null
let checking = false

/** 解析原生桥回调注入的 version payload */
const parseVersionBody = (body: string): UpdateInfo | null => {
  try {
    const raw = JSON.parse(body) as Record<string, unknown>
    const versionCode = Number(raw.versionCode)
    const version = typeof raw.version === 'string' ? raw.version : ''
    const url = typeof raw.url === 'string' ? raw.url : ''
    if (!version || !url || !Number.isFinite(versionCode)) {
      return null
    }
    return {
      version,
      versionCode,
      url,
      notes: typeof raw.notes === 'string' ? raw.notes : '',
      publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : undefined,
    }
  } catch {
    return null
  }
}

/** 原生桥回调入口（UpdateBridge 注入到 window） */
export const bindUpdateBridge = () => {
  const w = window as unknown as {
    __fakeseekUpdate?: { checkVersion: (url: string) => void; download: (url: string, title: string) => void }
    __fakeseekUpdater?: (payload: { event: string; status?: number; body?: string; detail?: string }) => void
  }
  if (!w.__fakeseekUpdate) {
    return false
  }
  w.__fakeseekUpdater = (payload) => {
    if (payload.event === 'version') {
      checking = false
      const info = payload.status === 200 && payload.body ? parseVersionBody(payload.body) : null
      const available = info && info.versionCode > APP_VERSION_CODE ? info : null
      // 写进 store：UpdateModal 订阅，无论挂载先后都能实时弹出
      useUpdateStore.getState().setAvailable(available)
      checkListener?.(available)
      return
    }
    if (payload.event === 'done') {
      installListener?.('done', payload.detail ?? '')
      return
    }
    if (payload.event === 'failed') {
      installListener?.('failed', payload.detail ?? '')
      return
    }
    if (payload.event === 'downloading') {
      installListener?.('downloading', payload.detail ?? '')
    }
  }
  return true
}

/** 静默检查（启动后调）：有新版返回 true 并触发监听器；失败自动重试 3 次（冷启动网络未就绪） */
export const silentCheckForUpdate = async (): Promise<boolean> => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const found = await silentCheckOnce()
    if (found) {
      return true
    }
    // 首次失败不立刻放弃：冷启动 3 秒时 TLS/DNS 可能还没热，间隔 5 秒再试
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
  return false
}

const silentCheckOnce = async (): Promise<boolean> => {
  if (checking) {
    return false
  }
  checking = true
  const w = window as unknown as {
    __fakeseekUpdate?: { checkVersion: (url: string) => void }
    __fakeseekUpdater?: unknown
  }
  if (!w.__fakeseekUpdate) {
    checking = false
    return false
  }
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      checkListener = null
      checking = false
      resolve(false)
    }, 18000)
    checkListener = (info) => {
      clearTimeout(timer)
      checkListener = null
      checking = false
      resolve(Boolean(info))
    }
    w.__fakeseekUpdate?.checkVersion(VERSION_JSON_URL)
  })
}

/** 用户主动检查（关于页按钮）：结果用 toast/弹窗反馈 */
export const checkForUpdate = async (
  onUpdateFound: (info: UpdateInfo) => void
): Promise<void> => {
  const w = window as unknown as {
    __fakeseekUpdate?: { checkVersion: (url: string) => void }
    __fakeseekUpdater?: unknown
  }
  if (!w.__fakeseekUpdate) {
    showToast({ key: 'updateCheckFailed', type: 'error' })
    return
  }
  if (checking) {
    return
  }
  checking = true
  const timer = setTimeout(() => {
    checkListener = null
    checking = false
    showToast({ key: 'updateCheckFailed', type: 'error' })
  }, 12000)
  checkListener = (info) => {
    clearTimeout(timer)
    checkListener = null
    checking = false
    if (info) {
      onUpdateFound(info)
    } else {
      showToast({ key: 'settingsLatestVersion' })
    }
  }
  w.__fakeseekUpdate.checkVersion(VERSION_JSON_URL)
}

/** 开始应用内下载（进度经 onProgress 回调 0-100）并等待安装器拉起；失败 toast */
export const startDownloadAndInstall = (
  info: UpdateInfo,
  onProgress?: (pct: number) => void
): Promise<void> =>
  new Promise((resolve) => {
    const w = window as unknown as {
      __fakeseekUpdate?: { download: (url: string, title: string) => void }
    }
    if (!w.__fakeseekUpdate) {
      showToast({ key: 'updateDownloadFailed', type: 'error' })
      resolve()
      return
    }
    installListener = (event, detail) => {
      if (event === 'done') {
        installListener = null
        resolve()
        return
      }
      if (event === 'failed') {
        installListener = null
        showToast({ key: 'updateDownloadFailed', type: 'error' })
        resolve()
      }
      if (event === 'downloading' && detail !== 'busy') {
        const pct = Number(detail)
        if (Number.isFinite(pct)) {
          onProgress?.(pct)
        }
      }
    }
    w.__fakeseekUpdate.download(info.url, `fakeseek ${info.version}`)
    // 超时兜底：15 分钟还没完成（大文件慢网）就不再等待
    setTimeout(() => {
      if (installListener) {
        installListener = null
        resolve()
      }
    }, 15 * 60 * 1000)
  })

/** 最近一次检查结果在 useUpdateStore.available 里，UI 订阅它即可（本函数保留给非 React 场景） */
export const getLastCheckedUpdate = (): UpdateInfo | null => useUpdateStore.getState().available
