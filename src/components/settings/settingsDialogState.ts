import { create } from 'zustand'
import { useSettings } from '../../services/settings.js'

/** 设置页分组：通用（首页）/ 数据管理 / 外观 / 字体大小 / 个性化 / 朗读音色 / 服务协议 / 帮助与反馈 */
export type SettingsSection =
  | 'general'
  | 'data'
  | 'appearance'
  | 'fontSize'
  | 'personalize'
  | 'voice'
  | 'terms'
  | 'help'

/** 设置弹窗：侧边栏底部、没有 API Key 时的操作与 401 提示都可以打开；section 为打开时选中的分组 */
export const useSettingsDialog = create(() => ({
  open: false,
  section: 'general' as SettingsSection,
}))

export const openSettings = (section: SettingsSection) =>
  useSettingsDialog.setState({ open: true, section })

export const closeSettings = () => useSettingsDialog.setState({ open: false })

/** 没有 API Key 时打开设置并选中 API Key 所在的「数据管理」，返回是否已有 Key */
export const ensureApiKey = () => {
  if (useSettings.getState().apiKey) {
    return true
  }
  openSettings('data')
  return false
}
