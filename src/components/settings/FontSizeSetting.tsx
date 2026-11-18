import { useTranslate } from '../../i18n/index.js'
import {
  FONT_SCALE_PX,
  setFontFollowSystem,
  setFontScale,
  useSettings,
} from '../../services/settings.js'
import styles from './FontSizeSetting.module.css'

/**
 * 字体大小（官方 App 风格）：上方实时预览（用户气泡 + 两段说明文字），
 * 底部固定区「跟随系统」开关 + 六档滑块（小 A → 标准 → 大 A）。
 * 字号写入全局 --app-font-size 变量，整页正文即时生效。
 */
export const FontSizeSetting = () => {
  const t = useTranslate()
  const fontScale = useSettings((state) => state.fontScale)
  const fontFollowSystem = useSettings((state) => state.fontFollowSystem)
  const previewPx = FONT_SCALE_PX[fontFollowSystem ? 2 : fontScale]

  return (
    <div className={styles.page}>
      <div className={styles.preview} style={{ fontSize: previewPx }}>
        <div className={styles.previewBubbleRow}>
          <div className={styles.previewBubble}>{t('fontPreviewBubble')}</div>
        </div>
        <p className={styles.previewText}>{t('fontPreviewLine1')}</p>
        <p className={styles.previewText}>{t('fontPreviewLine2')}</p>
      </div>
      <div className={styles.controls}>
        <div className={styles.followRow}>
          <span className={styles.followLabel}>{t('fontFollowSystem')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={fontFollowSystem}
            aria-label={t('fontFollowSystem')}
            className={`${styles.switch} ${fontFollowSystem ? styles.switchOn : ''}`}
            onClick={() => setFontFollowSystem(!fontFollowSystem)}
          >
            <span className={styles.switchKnob} />
          </button>
        </div>
        <div className={`${styles.sliderBlock} ${fontFollowSystem ? styles.sliderDisabled : ''}`}>
          <div className={styles.sliderLabels}>
            <span className={styles.smallA}>A</span>
            <span className={styles.standardLabel}>{t('fontStandard')}</span>
            <span className={styles.bigA}>A</span>
          </div>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={FONT_SCALE_PX.length - 1}
            step={1}
            value={fontFollowSystem ? 2 : fontScale}
            disabled={fontFollowSystem}
            aria-label={t('settingsFontSize')}
            onChange={(event) => setFontScale(Number(event.target.value))}
          />
          <div className={styles.ticks} aria-hidden>
            {FONT_SCALE_PX.map((px, index) => (
              <span
                key={px}
                className={`${styles.tick} ${index === (fontFollowSystem ? 2 : fontScale) ? styles.tickActive : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}