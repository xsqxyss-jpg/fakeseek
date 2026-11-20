import clsx from 'clsx'
import { useRef } from 'react'
import { useTranslate } from '../../i18n/index.js'
import styles from './VoiceHoldPanel.module.css'

/**
 * 移动端「按住说话」面板（官方两步交互的第二步）：
 * 点麦克风进入本面板 → 按住中间的按住说话开始录音 → 松手转写，按住后上滑 60px 取消。
 * 用 pointer events + setPointerCapture，避免触摸滚动与长按选中干扰。
 */
export const VoiceHoldPanel = ({
  recording,
  canceling,
  disabled = false,
  onPressStart,
  onPressEnd,
  onPressCancel,
  onSlideCancelChange,
}: {
  /** 正在录音 */
  recording: boolean
  /** 已上滑到取消阈值 */
  canceling: boolean
  disabled?: boolean
  onPressStart: () => void
  /** canceled = 松手时处于取消区间 */
  onPressEnd: (canceled: boolean) => void
  onPressCancel: () => void
  onSlideCancelChange: (canceling: boolean) => void
}) => {
  const t = useTranslate()
  const startYRef = useRef<number | null>(null)
  const pressedRef = useRef(false)
  const cancelingRef = useRef(false)

  const reset = () => {
    pressedRef.current = false
    startYRef.current = null
    cancelingRef.current = false
    onSlideCancelChange(false)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) {
      return
    }
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 部分 WebView 不支持指针捕获，退化为普通事件流
    }
    startYRef.current = event.clientY
    pressedRef.current = true
    cancelingRef.current = false
    onSlideCancelChange(false)
    onPressStart()
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pressedRef.current || startYRef.current === null) {
      return
    }
    event.preventDefault()
    const canceling = startYRef.current - event.clientY > 60
    if (canceling !== cancelingRef.current) {
      cancelingRef.current = canceling
      onSlideCancelChange(canceling)
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pressedRef.current) {
      return
    }
    event.preventDefault()
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // 忽略释放失败
    }
    const wasCanceling = cancelingRef.current
    reset()
    onPressEnd(wasCanceling)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pressedRef.current) {
      return
    }
    event.preventDefault()
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // 忽略释放失败
    }
    reset()
    onPressCancel()
  }

  const hint = !recording
    ? t('voiceInputPressToTalk')
    : canceling
      ? t('voiceInputReleaseToCancel')
      : t('voiceInputReleaseToSend')

  return (
    <button
      type="button"
      className={clsx(
        styles.hold,
        recording && styles.active,
        canceling && styles.canceling,
        disabled && styles.disabled
      )}
      aria-label={hint}
      aria-pressed={recording}
      aria-disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className={styles.label}>{hint}</span>
    </button>
  )
}
