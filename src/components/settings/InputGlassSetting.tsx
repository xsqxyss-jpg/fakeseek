import { useEffect, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  getWallpaperTextColor,
  setWallpaperTextColor,
} from '../../services/settings.js'
import { showToast } from '../base/toastState.js'
import styles from './InputGlassSetting.module.css'

/**
 * 输入框磨砂底色：只管输入卡这一块，不碰其他区域。
 * 黑 = 深磨砂白字，白 = 浅磨砂深字，自动 = 跟随壁纸明暗。
 * 各壁纸槽的「壁纸字色」管各自区域的文字颜色，互不相干。
 */
type Preset = 'auto' | 'black' | 'white'

const GLASS: Record<'black' | 'white', string> = {
  black: 'rgba(20, 24, 34, 0.55)',
  white: 'rgba(255, 255, 255, 0.62)',
}

/** 回显从玻璃实际值推导（黑磨砂=黑底、浅磨砂=白底），inputGlass 为空即自动 */
const derivePreset = (): Preset => {
  const glass = getWallpaperTextColor('inputGlass')
  if (glass === 'rgba(20, 24, 34, 0.55)') return 'black'
  if (glass === 'rgba(255, 255, 255, 0.62)') return 'white'
  return 'auto'
}

export const InputGlassSetting = () => {
  const t = useTranslate()
  const [current, setCurrent] = useState<Preset>(derivePreset)

  // 只同步回显，不写存储：任何改动后经事件刷新
  useEffect(() => {
    const sync = () => setCurrent(derivePreset())
    window.addEventListener('chat-demo:text-colors-changed', sync)
    return () => window.removeEventListener('chat-demo:text-colors-changed', sync)
  }, [])

  const pick = (key: Preset) => {
    setCurrent(key)
    setWallpaperTextColor('inputGlass', key === 'auto' ? null : GLASS[key])
    window.dispatchEvent(new Event('chat-demo:text-colors-changed'))
    showToast({ key: 'settingsGlassApplied' })
  }

  const chips: { key: Preset; label: string }[] = [
    { key: 'auto', label: t('settingsPresetAuto') },
    { key: 'black', label: t('settingsPresetBlack') },
    { key: 'white', label: t('settingsPresetWhite') },
  ]

  return (
    <div className={styles.row}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={`${styles.chip} ${current === chip.key ? styles.on : ''}`}
          aria-pressed={current === chip.key}
          onClick={() => pick(chip.key)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}