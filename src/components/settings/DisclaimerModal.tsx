import { useTranslate } from '../../i18n/index.js'
import { acceptDisclaimer, useSettings } from '../../services/settings.js'
import { GreetingMark } from '../base/iconsExtra.js'
import styles from './DisclaimerModal.module.css'

/**
 * 首次启动免责声明：个人学习作品、非官方、Key 与费用自理、数据仅存本机。
 * 同意后写入 localStorage 不再弹出；未同意前不可关闭（无遮罩关闭/Esc 关闭）。
 * 完整条款可在 设置 → 服务协议 随时回看。
 */
export const DisclaimerModal = () => {
  const t = useTranslate()
  const accepted = useSettings((state) => state.disclaimerAccepted)
  if (accepted) {
    return null
  }
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('disclaimerTitle')}>
      <div className={styles.card}>
        <div className={styles.hero}>
          <GreetingMark />
        </div>
        <div className={styles.title}>{t('disclaimerTitle')}</div>
        <div className={styles.body}>
          <p>{t('disclaimerP1')}</p>
          <p>{t('disclaimerP2')}</p>
          <p>{t('disclaimerP3')}</p>
          <p>{t('disclaimerP4')}</p>
        </div>
        <button type="button" className={styles.agree} onClick={acceptDisclaimer}>
          {t('disclaimerAgree')}
        </button>
        <div className={styles.footnote}>{t('disclaimerFootnote')}</div>
      </div>
    </div>
  )
}