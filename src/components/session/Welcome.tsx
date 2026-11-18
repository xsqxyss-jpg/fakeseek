import { useEffect } from 'react'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import { useSettings, getWallpaperTextColor } from '../../services/settings.js'
import { Button } from '../base/Button.js'
import { GreetingMark } from '../base/iconsExtra.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { MobileHeader } from './MobileHeader.js'
import styles from './Welcome.module.css'

/** 按时段问候（官方 App 风格）：早/午/下午/晚/深夜 */
const greetingKey = (): TranslationKey => {
  const hour = new Date().getHours()
  return hour < 5
    ? 'greetingNight'
    : hour < 11
      ? 'greetingMorning'
      : hour < 13
        ? 'greetingNoon'
        : hour < 18
          ? 'greetingAfternoon'
          : hour < 23
            ? 'greetingEvening'
            : 'greetingNight'
}

/** 未配置 API Key 时的首屏引导：说明需自备开放平台 Key，一键直达设置的数据管理页。 */
const ApiKeyHint = () => {
  const t = useTranslate()
  const text = getWallpaperTextColor('chat')
  return (
    <div className={styles.apiKeyHint}>
      <div className={styles.apiKeyHintTitle} style={text ? { color: text } : undefined}>
        {t('welcomeApiKeyHintTitle')}
      </div>
      <div className={styles.apiKeyHintDescription} style={text ? { color: text } : undefined}>
        {t('welcomeApiKeyHintDescription')}
      </div>
      <Button size="m" onClick={() => openSettings('data')}>
        {t('welcomeApiKeyHintAction')}
      </Button>
    </div>
  )
}

/** 新对话：问候语 + 输入框。桌面端居中；移动端输入框吸底 */
export const Welcome = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const hasApiKey = useSettings((state) => !!state.apiKey)
  const textColor = getWallpaperTextColor('chat')
  // 字色直接写行内 style：变量在部分端上不稳定，行内样式没有中间层
  useEffect(() => {
    const apply = () => {
      const color = getWallpaperTextColor('chat')
      for (const el of document.querySelectorAll<HTMLElement>('[data-wp-greeting="1"]')) {
        if (color) el.style.color = color
        else el.style.removeProperty('color')
      }
    }
    apply()
    window.addEventListener('chat-demo:text-colors-changed', apply)
    return () => window.removeEventListener('chat-demo:text-colors-changed', apply)
  }, [])
  return (
    <div className={styles.container}>
      {isMobile ? <MobileHeader /> : null}
      <div className={styles.welcome}>
        <div className={styles.hero}>
          <GreetingMark />
          <div className={styles.greeting} data-wp-greeting="1" style={textColor ? { color: textColor } : undefined}>
            {t(greetingKey())}
          </div>
        </div>
        {hasApiKey ? null : <ApiKeyHint />}
        <div className={styles.inputArea}>
          <ChatInput sessionId={null} />
        </div>
      </div>
    </div>
  )
}