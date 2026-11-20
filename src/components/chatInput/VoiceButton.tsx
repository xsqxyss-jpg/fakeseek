import { useRef } from 'react'
import clsx from 'clsx'
import { useTranslate } from '../../i18n/index.js'
import { IconMicFill16, IconMicOutline16 } from '../base/icons.js'
import { IconVoiceCircleOutline24 } from '../base/iconsExtra.js'
import { Tooltip } from '../base/Tooltip.js'
import type { VoiceInputStatus } from './useVoiceInput.js'
import styles from './VoiceButton.module.css'

/**
 * 语音输入按钮。
 * 录音中为两层圆：外层半透明光圈 + 内层实心品牌色；
 * 外层先展开、内层随后放大，之后外层按固定节奏呼吸，与音量无关。
 * 按钮左侧显示「录音中 Ns」，窄屏不展示读秒。
 */
export const VoiceButton = ({
  status,
  disabled = false,
  seconds,
  isMobile = false,
  onClick,
  onPressStart,
  onPressEnd,
  onPressCancel,
  onSlideCancelChange,
}: {
  status: VoiceInputStatus
  /** 非安全上下文中按钮置灰，tooltip 提示录音需要 HTTPS */
  disabled?: boolean
  /** 本次录音已录秒数，录音中显示在按钮左侧 */
  seconds: number
  /** 移动端长按录音，桌面端点击切换 */
  isMobile?: boolean
  onClick: () => void
  onPressStart?: () => void
  onPressEnd?: (canceled: boolean) => void
  onPressCancel?: () => void
  onSlideCancelChange?: (canceling: boolean) => void
}) => {
  const t = useTranslate()
  const recording = status === 'recording'

  const startYRef = useRef<number | null>(null)
  const isPressedRef = useRef(false)
  const isCancelingRef = useRef(false)

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isMobile || disabled) {
      return
    }
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    startYRef.current = event.clientY
    isPressedRef.current = true
    isCancelingRef.current = false
    onSlideCancelChange?.(false)
    onPressStart?.()
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isMobile || !isPressedRef.current || startYRef.current === null) {
      return
    }
    event.preventDefault()
    const deltaY = startYRef.current - event.clientY
    const canceling = deltaY > 60
    if (canceling !== isCancelingRef.current) {
      isCancelingRef.current = canceling
      onSlideCancelChange?.(canceling)
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isMobile || !isPressedRef.current) {
      return
    }
    event.preventDefault()
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // ignore
    }
    const wasCanceling = isCancelingRef.current
    isPressedRef.current = false
    startYRef.current = null
    isCancelingRef.current = false
    onSlideCancelChange?.(false)
    onPressEnd?.(wasCanceling)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isMobile || !isPressedRef.current) {
      return
    }
    event.preventDefault()
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // ignore
    }
    isPressedRef.current = false
    startYRef.current = null
    isCancelingRef.current = false
    onSlideCancelChange?.(false)
    onPressCancel?.()
  }

  const handlePointerLeave = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isMobile || !isPressedRef.current) {
      return
    }
    handlePointerCancel(event)
  }

  const label = disabled
    ? t('voiceInputRequiresHttps')
    : recording
      ? isMobile
        ? t('voiceInputReleaseToSend')
        : t('voiceInputStop')
      : status === 'transcribing'
        ? t('voiceInputCancel')
        : isMobile
          ? t('voiceInputPressToTalk')
          : t('voiceInput')

  return (
    <>
      {recording ? <span className={styles.timer}>{t('voiceInputTimer', { seconds })}</span> : null}
      <Tooltip content={label}>
        <button
          type="button"
          className={clsx(
            styles.button,
            recording && styles.recording,
            disabled && styles.disabled
          )}
          style={isMobile ? { touchAction: 'none' } : undefined}
          aria-label={label}
          aria-pressed={recording}
          aria-disabled={disabled}
          onClick={() => {
            if (!disabled && !isMobile) {
              onClick()
            }
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerLeave}
        >
          {recording ? (
            <span className={styles.active}>
              <span className={styles.halo} />
              <span className={styles.core} />
              <span className={styles.outline}>
                <IconMicOutline16 />
              </span>
              <span className={styles.glyph}>
                <IconMicFill16 />
              </span>
            </span>
          ) : status === 'transcribing' ? (
            <span className={styles.loading} />
          ) : (
            <span className={styles.idleCircle}>
              <IconVoiceCircleOutline24 />
            </span>
          )}
        </button>
      </Tooltip>
    </>
  )
}
