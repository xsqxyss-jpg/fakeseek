import { useTranslate } from '../../i18n/index.js'
import { newChat } from '../../services/chat/store.js'
import { setVoiceMuted, useSettings } from '../../services/settings.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import { IconMenuOutline20 } from '../base/icons.js'
import { IconPlusCircleOutline20, IconSpeakerMuteOutline20, IconSpeakerOutline20 } from '../base/iconsExtra.js'
import { IconButton } from '../base/IconButton.js'
import { showToast } from '../base/toastState.js'
import { openMobileSider } from '../sider/mobileSiderState.js'
import styles from './MobileHeader.module.css'

/** 移动端顶栏（官方 App 风格）：左菜单；新对话页右侧朗读静音 + 新建会话，会话页中间标题。 */
export const MobileHeader = ({ title }: { title?: string }) => {
  const t = useTranslate()
  const voiceMuted = useSettings((state) => state.voiceMuted)
  const toggleMute = () => {
    const next = !voiceMuted
    if (next) {
      stopReadAloud()
    }
    setVoiceMuted(next)
    showToast({ key: next ? 'voiceMuteOn' : 'voiceMuteOff' })
  }
  return (
    <div className={styles.header}>
      <IconButton
        size="xl"
        tone="primary"
        icon={<IconMenuOutline20 />}
        aria-label={t('expandSiderbarButton')}
        onClick={openMobileSider}
      />
      {title === undefined ? (
        <>
          <div className={styles.spacer} />
          <IconButton
            size="xl"
            tone="primary"
            icon={voiceMuted ? <IconSpeakerMuteOutline20 /> : <IconSpeakerOutline20 />}
            aria-label={t(voiceMuted ? 'voiceMuteOn' : 'voiceMuteOff')}
            onClick={toggleMute}
          />
          <IconButton
            size="xl"
            tone="primary"
            icon={<IconPlusCircleOutline20 />}
            aria-label={t('newChat')}
            onClick={newChat}
          />
        </>
      ) : (
        <>
          <div className={styles.title}>{title}</div>
          <IconButton
            size="xl"
            tone="primary"
            icon={voiceMuted ? <IconSpeakerMuteOutline20 /> : <IconSpeakerOutline20 />}
            aria-label={t(voiceMuted ? 'voiceMuteOn' : 'voiceMuteOff')}
            onClick={toggleMute}
          />
          <IconButton
            size="xl"
            tone="primary"
            icon={<IconPlusCircleOutline20 />}
            aria-label={t('newChat')}
            onClick={newChat}
          />
        </>
      )}
    </div>
  )
}