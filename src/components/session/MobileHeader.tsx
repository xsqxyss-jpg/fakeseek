import clsx from 'clsx'
import { useTranslate } from '../../i18n/index.js'
import { newChat } from '../../services/chat/store.js'
import { setVoiceMuted, useSettings } from '../../services/settings.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import { IconMenuOutline20 } from '../base/icons.js'
import {
  IconMoreCircleOutline24,
  IconPlusCircleOutline20,
  IconSpeakerMuteOutline20,
  IconSpeakerOutline20,
} from '../base/iconsExtra.js'
import { IconButton } from '../base/IconButton.js'
import { showToast } from '../base/toastState.js'
import { closeMorePanel, toggleMorePanel, useMorePanel } from '../chatInput/morePanelState.js'
import { openMobileSider } from '../sider/mobileSiderState.js'
import styles from './MobileHeader.module.css'

/** 移动端顶栏（官方 App 风格）：左菜单；中间「更多」入口（模型/用量）；右侧朗读静音 + 新建会话。 */
export const MobileHeader = ({ title }: { title?: string }) => {
  const t = useTranslate()
  const voiceMuted = useSettings((state) => state.voiceMuted)
  const moreOpen = useMorePanel((state) => state.open)
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
      <div className={styles.spacer} />
      <div className={styles.centerSlot}>
        {/* 顶栏正中空白处：模型切换与用量入口（原先挤在输入卡里） */}
        <button
          type="button"
          className={clsx(styles.centerMore, moreOpen && styles.centerMoreOpen)}
          aria-label={t('moreOptions')}
          aria-expanded={moreOpen}
          onClick={() => {
            closeMorePanel()
            toggleMorePanel()
          }}
        >
          <IconMoreCircleOutline24 />
        </button>
      </div>
      {title === undefined ? (
        <>
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