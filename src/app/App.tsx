import { useEffect } from 'react'
import { useTranslate } from '../i18n/index.js'
import { FONT_SCALE_PX, useSettings, getWallpaperTextColor, type TextColorArea } from '../services/settings.js'
import { useIsMobile, useMobileViewport, usePreventPageScroll } from './viewport.js'
import clsx from 'clsx'
import { useNativeBackBridge } from './useSwipeBack.js'
import {
  bindChatPersistence,
  initChat,
  retrySaveSessions,
  selectSession,
  useChatStore,
} from '../services/chat/store.js'
import { SearchPanel } from '../components/search/SearchPanel.js'
import { closeSearchPanel } from '../components/search/searchPanelState.js'
import { SessionView } from '../components/session/SessionView.js'
import { MobileHeader } from '../components/session/MobileHeader.js'
import { Welcome } from '../components/session/Welcome.js'
import { SettingsDialog } from '../components/settings/SettingsDialog.js'
import { DisclaimerModal } from '../components/settings/DisclaimerModal.js'
import { Toast } from '../components/base/Toast.js'
import { showToast } from '../components/base/toastState.js'
import { onUploadNotice } from '../services/attachments.js'
import { Button } from '../components/base/Button.js'
import { stopReadAloud } from '../services/speech/readAloud.js'
import { CollapsedSider } from '../components/sider/CollapsedSider.js'
import { closeMobileSider, useMobileSider } from '../components/sider/mobileSiderState.js'
import { MobileSider, Sider } from '../components/sider/Sider.js'
import styles from './App.module.css'

export const App = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const locale = useSettings((state) => state.locale)
  // 移动端侧边栏以独立抽屉管理开合状态
  const siderCollapsed = useSettings((state) => state.siderCollapsed) && !isMobile
  const ready = useChatStore((state) => state.ready)
  const initError = useChatStore((state) => state.initError)
  const saveError = useChatStore((state) => Object.values(state.sessionSaveErrors).some(Boolean))
  const importingHistory = useChatStore((state) => state.importingHistory)
  const session = useChatStore((state) =>
    state.activeId !== null && Object.hasOwn(state.sessionCache, state.activeId)
      ? state.sessionCache[state.activeId]
      : undefined
  )
  const sessionLoadError = useChatStore((state) =>
    state.activeId === null ? false : state.sessionLoadErrors[state.activeId] === true
  )
  const frameRef = useMobileViewport(isMobile)
  const streaming = useChatStore((state) =>
    state.activeId === null ? false : Object.hasOwn(state.streaming, state.activeId)
  )
  const activeId = useChatStore((state) => state.activeId)
  const mobileSiderOpen = useMobileSider((state) => state.open)
  const fontScale = useSettings((state) => state.fontScale)
  const fontFollowSystem = useSettings((state) => state.fontFollowSystem)
  const wallpaper = useSettings((state) => state.wallpaper)
  const siderWallpaper = useSettings((state) => state.siderWallpaper)
  const settingsWallpaper = useSettings((state) => state.settingsWallpaper)

  usePreventPageScroll(isMobile)
  // 安卓返回键 / 边缘滑动统一交给原生层调用 goBack
  useNativeBackBridge()

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  // 字体大小：全局正文字号变量，消息/输入/列表统一引用；跟随系统时回到默认 16px。
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--app-font-size',
      `${FONT_SCALE_PX[fontFollowSystem ? 2 : fontScale]}px`
    )
  }, [fontScale, fontFollowSystem])

  // 三张壁纸分发：聊天区 / 侧栏 / 设置页各自独立，暗亮标记按上传时采样的亮度存。
  // 聊天区→--app-wallpaper + data-app-wallpaper(-dark)
  // 侧栏→--sider-wallpaper + data-sider-wallpaper(-dark)
  // 设置页→--settings-wallpaper + data-settings-wallpaper(-dark)
  useEffect(() => {
    const root = document.documentElement
    const apply = (
      value: string | null,
      cssVar: string,
      attr: string,
      storageKey: string
    ) => {
      if (value) {
        root.style.setProperty(cssVar, `url("${value}")`)
        root.setAttribute(`data-${attr}`, '')
        let dark = false
        try {
          dark = localStorage.getItem(storageKey) === 'true'
        } catch {
          // 存储不可用时按亮壁纸处理
        }
        if (dark) {
          root.setAttribute(`data-${attr}-dark`, '')
        } else {
          root.removeAttribute(`data-${attr}-dark`)
        }
      } else {
        root.style.removeProperty(cssVar)
        root.removeAttribute(`data-${attr}`)
        root.removeAttribute(`data-${attr}-dark`)
      }
    }
    apply(wallpaper, '--app-wallpaper', 'app-wallpaper', 'chat-demo:wallpaper-dark')
    apply(siderWallpaper, '--sider-wallpaper', 'sider-wallpaper', 'chat-demo:wallpaper-sider-dark')
    apply(
      settingsWallpaper,
      '--settings-wallpaper',
      'settings-wallpaper',
      'chat-demo:wallpaper-settings-dark'
    )
    // 壁纸增删后广播字色事件：字色 effect 的监听器会重跑——删壁纸时同步清掉 html 上的
    // 字色变量（否则残留白字落白屏），并重算全部明暗标记（自动档换壁纸标记跟新壁纸走）
    window.dispatchEvent(new Event('chat-demo:text-colors-changed'))
  }, [wallpaper, siderWallpaper, settingsWallpaper])

  // 用户自定义分区字色：注入 CSS 变量，各区域文字消费（null = 回落自动切换）
  useEffect(() => {
    const root = document.documentElement
    const inject = () => {
      const pairs: [string, TextColorArea][] = [
        ['--wp-chat-text', 'chat'],
        ['--wp-user-text', 'user'],
        ['--wp-sider-text', 'sider'],
        ['--wp-settings-text', 'settings'],
        ['--wp-input-text', 'input'],
        ['--wp-input-glass', 'inputGlass'],
      ]
      for (const [cssVar, area] of pairs) {
        const color = getWallpaperTextColor(area)
        if (color) {
          root.style.setProperty(cssVar, color)
        } else {
          root.style.removeProperty(cssVar)
        }
      }
      // 浅玻璃标记按「生效玻璃色」打：用户字色优先于一切——选黑字=浅磨砂、选白字=深磨砂；
      // 只有自动档（无字色预设）才让磨砂面板的显式玻璃值说话，最后跟壁纸明暗。
      const glass = getWallpaperTextColor('inputGlass')
      const chatColor = getWallpaperTextColor('chat')
      let wallDark = false
      try {
        wallDark = localStorage.getItem('chat-demo:wallpaper-dark') === 'true'
      } catch {
        // 存储不可用按亮壁纸
      }
      const glassLight = chatColor
        ? chatColor !== '#ffffff'
        : glass
          ? glass.startsWith('rgba(255')
          : !wallDark
      if (glassLight) {
        root.setAttribute('data-wp-glass-light', '')
      } else {
        root.removeAttribute('data-wp-glass-light')
      }
      // 字色优先标记：用户设了聊天区字色（黑/白）时打上，输入卡玻璃完全跟字色走，
      // 磨砂面板显式值被压制（仅自动档时面板值生效）
      if (chatColor) {
        root.setAttribute('data-wp-user-text-priority', '')
      } else {
        root.removeAttribute('data-wp-user-text-priority')
      }
      // 字色反白标记：用户把某区域字色调成白字时，该区域底色自动切深磨砂，
      // 否则白字落亮壁纸上什么都看不见。设置/侧栏同理（黑字切浅磨砂）。
      for (const [attr, area, darkKey] of [
        ['data-wp-text-light', 'chat', 'chat-demo:wallpaper-dark'],
        ['data-wp-text-light-sider', 'sider', 'chat-demo:wallpaper-sider-dark'],
        ['data-wp-text-light-settings', 'settings', 'chat-demo:wallpaper-settings-dark'],
      ] as const) {
        const color = getWallpaperTextColor(area)
        let dark = false
        try {
          dark = localStorage.getItem(darkKey) === 'true'
        } catch {
          // 存储不可用按亮壁纸
        }
        // 白字 → 标记 light=false（需要深底）；黑字 → light=true（需要浅底）；自动 → 跟壁纸明暗
        const light = color ? color !== '#ffffff' : !dark
        if (light) {
          root.setAttribute(attr, '')
        } else {
          root.removeAttribute(attr)
        }
      }
    }
    inject()
    window.addEventListener('chat-demo:text-colors-changed', inject)
    return () => window.removeEventListener('chat-demo:text-colors-changed', inject)
  }, [])

  // 文件数、存储空间达到上限时，附件上只显示「上传失败」，原因用 toast 说明
  useEffect(() => onUploadNotice(showToast), [])
  useEffect(bindChatPersistence, [])

  // 搜索结果面板只属于当前会话
  useEffect(closeSearchPanel, [activeId])
  // 切换会话时停止朗读
  useEffect(stopReadAloud, [activeId])
  // 移动端选中会话、切换布局后收起抽屉
  useEffect(closeMobileSider, [activeId, isMobile])

  useEffect(() => {
    void initChat()
    // 官方 App 风格：首屏不弹设置，未配 Key 由欢迎页引导卡提示；发送时仍会兜底弹出。
  }, [])

  return (
    <>
      <div ref={frameRef} className={styles.frame}>
        {isMobile ? <MobileSider /> : siderCollapsed ? null : <Sider />}
        <main
          className={clsx(styles.main, isMobile && styles.pushable, mobileSiderOpen && styles.pushOpen)}
        >
          {saveError ? (
            <div className={styles.saveError} role="alert">
              <span>{t('sessionSaveFailed')}</span>
              <Button
                variant="outlined"
                size="s"
                disabled={importingHistory}
                onClick={retrySaveSessions}
              >
                {t('retry')}
              </Button>
            </div>
          ) : null}
          <div className={styles.content}>
            {siderCollapsed ? <CollapsedSider /> : null}
            {!ready || (activeId !== null && !session) ? (
              <div className={styles.loadingView}>
                {isMobile ? <MobileHeader /> : null}
                <div className={styles.loadingState} role="status" aria-live="polite">
                  <span>
                    {(!ready ? initError : sessionLoadError)
                      ? t(!ready ? 'sessionListLoadFailed' : 'sessionLoadFailed')
                      : t('sessionLoading')}
                  </span>
                  {(!ready ? initError : sessionLoadError) ? (
                    <Button
                      variant="outlined"
                      size="m"
                      onClick={() => {
                        if (!ready) {
                          void initChat()
                        } else if (activeId !== null) {
                          selectSession(activeId)
                        }
                      }}
                    >
                      {t('retry')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : session ? (
              <SessionView
                session={session}
                streaming={streaming}
                siderCollapsed={siderCollapsed}
              />
            ) : (
              <Welcome />
            )}
          </div>
        </main>
        <SearchPanel />
      </div>
      <SettingsDialog />
      <DisclaimerModal />
      <Toast />
    </>
  )
}
