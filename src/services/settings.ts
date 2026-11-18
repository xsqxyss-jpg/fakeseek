import { create } from 'zustand'
import type { TtsVoice } from './api/speech.js'
import type { ChatModel } from './api/types.js'
import { normalizeLocation, type UserLocation } from './location.js'

export type Locale = 'zh-CN' | 'en-US'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** 本机设置，存 localStorage：API Key、语言、主题、位置、朗读音色、深度思考与智能搜索开关、侧边栏收起状态、上下文保留轮数 */
type Settings = {
  apiKey: string | null
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  ttsVoice: TtsVoice
  thinking: boolean
  search: boolean
  siderCollapsed: boolean
  /** 请求上下文保留的最近对话轮数；0 = 不限制（全量历史） */
  contextKeepRounds: number
  /** 超出保留轮数的历史是否压缩成摘要随请求携带（关闭则直接省略） */
  contextSummary: boolean
  /** 自定义头像（dataURL，压缩到 96px）；null = 默认字母头像 */
  userAvatar: string | null
  assistantAvatar: string | null
  /** 全局朗读静音：开启后消息的朗读按钮不出声 */
  voiceMuted: boolean
  /** 正文字号档位 0-5（对应 14/15/16/17/18/20px）；2 = 标准 */
  fontScale: number
  /** 字号跟随系统：开启时忽略 fontScale，使用默认 16px */
  fontFollowSystem: boolean
  /** 聊天区壁纸（dataURL，压缩到 1280px JPEG）；null = 默认底色 */
  wallpaper: string | null
  /** 侧栏壁纸（dataURL，压缩到 640px）；null = 默认底色 */
  siderWallpaper: string | null
  /** 设置页壁纸（dataURL，压缩到 1280px）；null = 默认底色 */
  settingsWallpaper: string | null
  /** 首次启动免责声明已同意 */
  disclaimerAccepted: boolean
  /** 系统提示词：null = 使用默认中性助手描述；随每次请求发送 */
  systemPrompt: string | null
  /** 默认对话模型；新会话与新消息使用，历史消息沿用自身记录 */
  model: ChatModel
  /** 昵称：显示在侧栏底部账号行；null = 用默认文案 */
  nickname: string | null
}

/** 默认系统提示词：中性助手，不冒充官方人设 */
export const DEFAULT_SYSTEM_PROMPT =
  '你是一个乐于助人的 AI 助手。回答准确、简洁、有条理；不确定时如实说明，不要编造。默认使用用户提问的语言回复。'

/** 字号档位对应的正文字号（px），下标即档位 */
export const FONT_SCALE_PX = [14, 15, 16, 17, 18, 20] as const

/** 上下文保留轮数的合法档位：0 不限制，其余为最近 N 轮问答 */
export const CONTEXT_ROUNDS_OPTIONS = [0, 5, 10, 20, 50] as const

const KEYS = {
  apiKey: 'chat-demo:api-key',
  locale: 'chat-demo:locale',
  location: 'chat-demo:location',
  themePreference: 'chat-demo:theme-preference',
  ttsVoice: 'chat-demo:tts-voice',
  thinking: 'chat-demo:thinking',
  search: 'chat-demo:search',
  siderCollapsed: 'chat-demo:sider-collapsed',
  contextKeepRounds: 'chat-demo:context-keep-rounds',
  contextSummary: 'chat-demo:context-summary',
  userAvatar: 'chat-demo:user-avatar',
  assistantAvatar: 'chat-demo:assistant-avatar',
  voiceMuted: 'chat-demo:voice-muted',
  fontScale: 'chat-demo:font-scale',
  fontFollowSystem: 'chat-demo:font-follow-system',
  wallpaper: 'chat-demo:wallpaper',
  siderWallpaper: 'chat-demo:wallpaper-sider',
  settingsWallpaper: 'chat-demo:wallpaper-settings',
  disclaimerAccepted: 'chat-demo:disclaimer-accepted',
  systemPrompt: 'chat-demo:system-prompt',
  model: 'chat-demo:model',
  nickname: 'chat-demo:nickname',
} as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 位置选择模式跟随浏览器语言，与应用内选择的界面语言无关。 */
export const isChineseBrowser = (): boolean =>
  (typeof navigator === 'undefined' ? 'zh' : navigator.language).toLowerCase().startsWith('zh')

const initialLocale = (): Locale => {
  const saved = read(KEYS.locale)
  if (saved === 'zh-CN' || saved === 'en-US') {
    return saved
  }
  return isChineseBrowser() ? 'zh-CN' : 'en-US'
}

const initialLocation = (): UserLocation | null => {
  try {
    const location = normalizeLocation(JSON.parse(read(KEYS.location) ?? 'null'))
    if (!location) {
      return null
    }
    return isChineseBrowser()
      ? location.region === 'CN' && location.province
        ? location
        : null
      : { region: location.region }
  } catch {
    return null
  }
}

/** 未保存过时跟随系统 */
const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

/** 未保存过时使用服务端默认音色 stella（海星） */
const initialTtsVoice = (): TtsVoice => (read(KEYS.ttsVoice) === 'tide' ? 'tide' : 'stella')

/** 未保存或存了非法值时回到 0（不限制），与官方默认行为一致 */
const initialContextKeepRounds = (): number => {
  const saved = Number(read(KEYS.contextKeepRounds))
  return (CONTEXT_ROUNDS_OPTIONS as readonly number[]).includes(saved) ? saved : 0
}

export const useSettings = create<Settings>(() => ({
  apiKey: read(KEYS.apiKey),
  locale: initialLocale(),
  location: initialLocation(),
  themePreference: initialThemePreference(),
  ttsVoice: initialTtsVoice(),
  thinking: read(KEYS.thinking) === 'true',
  search: read(KEYS.search) === 'true',
  siderCollapsed: read(KEYS.siderCollapsed) === 'true',
  contextKeepRounds: initialContextKeepRounds(),
  // 未保存过时默认开启：选了保留轮数后旧历史压成摘要，不静默失忆。
  contextSummary: read(KEYS.contextSummary) !== 'false',
  userAvatar: read(KEYS.userAvatar),
  assistantAvatar: read(KEYS.assistantAvatar),
  voiceMuted: read(KEYS.voiceMuted) === 'true',
  fontScale: (() => {
    const saved = Number(read(KEYS.fontScale))
    return Number.isInteger(saved) && saved >= 0 && saved < FONT_SCALE_PX.length ? saved : 2
  })(),
  fontFollowSystem: read(KEYS.fontFollowSystem) !== 'false',
  wallpaper: read(KEYS.wallpaper),
  siderWallpaper: read(KEYS.siderWallpaper),
  settingsWallpaper: read(KEYS.settingsWallpaper),
  disclaimerAccepted: read(KEYS.disclaimerAccepted) === 'true',
  systemPrompt: read(KEYS.systemPrompt),
  model: read(KEYS.model) ?? 'deepseek-flash',
  nickname: read(KEYS.nickname),
}))

export const setLocale = (locale: Locale) => {
  write(KEYS.locale, locale)
  useSettings.setState({ locale })
}

export const setLocation = (value: UserLocation | null) => {
  const location = normalizeLocation(value)
  write(KEYS.location, location ? JSON.stringify(location) : null)
  useSettings.setState({ location })
}

export const setThemePreference = (themePreference: ThemePreference) => {
  write(KEYS.themePreference, themePreference)
  useSettings.setState({ themePreference })
}

export const setTtsVoice = (ttsVoice: TtsVoice) => {
  write(KEYS.ttsVoice, ttsVoice)
  useSettings.setState({ ttsVoice })
}

export const setApiKey = (apiKey: string | null) => {
  write(KEYS.apiKey, apiKey)
  useSettings.setState({ apiKey })
}

export const setThinking = (thinking: boolean) => {
  write(KEYS.thinking, String(thinking))
  useSettings.setState({ thinking })
}

export const setSearch = (search: boolean) => {
  write(KEYS.search, String(search))
  useSettings.setState({ search })
}

export const setSiderCollapsed = (siderCollapsed: boolean) => {
  write(KEYS.siderCollapsed, String(siderCollapsed))
  useSettings.setState({ siderCollapsed })
}

export const setContextKeepRounds = (contextKeepRounds: number) => {
  if (!(CONTEXT_ROUNDS_OPTIONS as readonly number[]).includes(contextKeepRounds)) {
    return
  }
  write(KEYS.contextKeepRounds, String(contextKeepRounds))
  useSettings.setState({ contextKeepRounds })
}

export const setContextSummary = (contextSummary: boolean) => {
  write(KEYS.contextSummary, String(contextSummary))
  useSettings.setState({ contextSummary })
}

export const setUserAvatar = (userAvatar: string | null) => {
  write(KEYS.userAvatar, userAvatar)
  useSettings.setState({ userAvatar })
}

export const setAssistantAvatar = (assistantAvatar: string | null) => {
  write(KEYS.assistantAvatar, assistantAvatar)
  useSettings.setState({ assistantAvatar })
}

export const setVoiceMuted = (voiceMuted: boolean) => {
  write(KEYS.voiceMuted, String(voiceMuted))
  useSettings.setState({ voiceMuted })
}

export const setFontScale = (fontScale: number) => {
  if (!Number.isInteger(fontScale) || fontScale < 0 || fontScale >= FONT_SCALE_PX.length) {
    return
  }
  write(KEYS.fontScale, String(fontScale))
  useSettings.setState({ fontScale })
}

export const setFontFollowSystem = (fontFollowSystem: boolean) => {
  write(KEYS.fontFollowSystem, String(fontFollowSystem))
  useSettings.setState({ fontFollowSystem })
}

export const setWallpaper = (wallpaper: string | null) => {
  write(KEYS.wallpaper, wallpaper)
  useSettings.setState({ wallpaper })
}

export const setSiderWallpaper = (siderWallpaper: string | null) => {
  write(KEYS.siderWallpaper, siderWallpaper)
  useSettings.setState({ siderWallpaper })
}

export const setSettingsWallpaper = (settingsWallpaper: string | null) => {
  write(KEYS.settingsWallpaper, settingsWallpaper)
  useSettings.setState({ settingsWallpaper })
}

export const acceptDisclaimer = () => {
  write(KEYS.disclaimerAccepted, 'true')
  useSettings.setState({ disclaimerAccepted: true })
}

/** 空串/纯空白视为恢复默认（存 null）；上限 4000 字符防止挤爆上下文 */
export const setSystemPrompt = (systemPrompt: string | null) => {
  const trimmed = systemPrompt?.trim() ? systemPrompt.trim().slice(0, 4000) : null
  write(KEYS.systemPrompt, trimmed)
  useSettings.setState({ systemPrompt: trimmed })
}

export const setModel = (model: ChatModel) => {
  write(KEYS.model, model)
  useSettings.setState({ model })
}

/** 空串视为清除，回到默认文案；上限 24 字符 */
export const setNickname = (nickname: string | null) => {
  const trimmed = nickname?.trim() ? nickname.trim().slice(0, 24) : null
  write(KEYS.nickname, trimmed)
  useSettings.setState({ nickname: trimmed })
}

/** 壁纸模式下的自定义字色（每区域独立；null = 跟随默认自动切换） */
export type WallpaperTextColors = {
  chat: string | null
  user: string | null
  sider: string | null
  settings: string | null
  input: string | null
}

const TEXT_KEYS = {
  chat: 'chat-demo:wp-text-chat',
  user: 'chat-demo:wp-text-user',
  sider: 'chat-demo:wp-text-sider',
  settings: 'chat-demo:wp-text-settings',
  input: 'chat-demo:wp-text-input',
  /** 输入卡玻璃底色（rgba 字符串），null = 跟随明暗自动 */
  inputGlass: 'chat-demo:wp-glass-input',
} as const

export type TextColorArea = keyof typeof TEXT_KEYS

export const getWallpaperTextColor = (area: TextColorArea): string | null => {
  try {
    return localStorage.getItem(TEXT_KEYS[area])
  } catch {
    return null
  }
}

export const setWallpaperTextColor = (area: TextColorArea, color: string | null) => {
  try {
    if (color) {
      localStorage.setItem(TEXT_KEYS[area], color)
    } else {
      localStorage.removeItem(TEXT_KEYS[area])
    }
  } catch {
    // 忽略
  }
}
