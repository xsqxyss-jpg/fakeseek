import { useEffect } from 'react'
import { closeSettings, useSettingsDialog } from '../components/settings/settingsDialogState.js'
import { closeMobileSider, useMobileSider } from '../components/sider/mobileSiderState.js'
import { newChat, useChatStore } from '../services/chat/store.js'

/**
 * 返回上一级。返回 true 表示吃掉这次返回，false 表示没得退。
 * 顺序：多选页 → 搜索页 → 抽屉 → 设置子页 → 设置首页 → 会话页回列表 → 无。
 */
export const goBack = (): boolean => {
  if (useMobileSider.getState().open) {
    closeMobileSider()
    return true
  }
  if (useSettingsDialog.getState().open) {
    if (useSettingsDialog.getState().section !== 'general') {
      useSettingsDialog.setState({ section: 'general' })
    } else {
      closeSettings()
    }
    return true
  }
  if (useChatStore.getState().activeId !== null) {
    newChat()
    return true
  }
  return false
}

/**
 * 把 goBack 挂到 window 上，供原生层调用：
 * 安卓系统返回键与边缘滑动手势都由 MainActivity 把「返回」交给这个函数，
 * 它返回 true 就吃掉事件，返回 false 才让系统退出应用。
 */
export const useNativeBackBridge = () => {
  useEffect(() => {
    const bridge = () => goBack()
    ;(window as unknown as { __fakeseekGoBack?: () => boolean }).__fakeseekGoBack = bridge
    return () => {
      delete (window as unknown as { __fakeseekGoBack?: () => boolean }).__fakeseekGoBack
    }
  }, [])
}
