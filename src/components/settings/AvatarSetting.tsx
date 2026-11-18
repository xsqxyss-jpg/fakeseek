import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  setAssistantAvatar,
  setNickname,
  setSettingsWallpaper,
  setSiderWallpaper,
  setUserAvatar,
  setWallpaper,
  setWallpaperTextColor,
  getWallpaperTextColor,
  useSettings,
  type TextColorArea,
} from '../../services/settings.js'
import { showToast } from '../base/toastState.js'
import { InputGlassSetting } from './InputGlassSetting.js'
import { WallpaperCropper } from './WallpaperCropper.js'
import styles from './AvatarSetting.module.css'

/** 读取头像图片并居中裁剪压缩为 96px JPEG dataURL。 */
const fileToAvatar = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const size = 96
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('canvas unavailable'))
        return
      }
      const side = Math.min(image.width, image.height)
      context.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      )
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image decode failed'))
    }
    image.src = url
  })

/** 单个壁纸槽位：预览图 + 更换（经裁剪器）+ 恢复默认 + 本区域字色（自动/黑/白）。 */
const WallpaperSlot = ({
  label,
  description,
  value,
  darkStorageKey,
  ratio,
  maxOut,
  textArea,
  onChange,
}: {
  label: string
  description: string
  value: string | null
  darkStorageKey: string
  /** 裁剪框宽高比（width / height） */
  ratio: number
  /** 导出图最长边上限 */
  maxOut: number
  /** 本区域字色存储键；输入卡区域同时控制玻璃底色 */
  textArea: TextColorArea
  onChange: (value: string | null) => void
}) => {
  const t = useTranslate()
  const inputRef = useRef<HTMLInputElement>(null)
  /** 待裁剪的图片文件；非空时渲染裁剪器浮层 */
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // 回显从实际字色值推导：本行语义是「字色」，黑=黑字、白=白字
  const derivePreset = (): 'auto' | 'black' | 'white' => {
    const v = getWallpaperTextColor(textArea)
    return v === '#0b1220' ? 'black' : v === '#ffffff' ? 'white' : 'auto'
  }
  const [textPreset, setTextPreset] = useState<'auto' | 'black' | 'white'>(derivePreset)
  useEffect(() => {
    const sync = () => setTextPreset(derivePreset())
    window.addEventListener('chat-demo:text-colors-changed', sync)
    return () => window.removeEventListener('chat-demo:text-colors-changed', sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textArea])

  const pickText = (key: 'auto' | 'black' | 'white') => {
    setTextPreset(key)
    // 字色语义：黑=黑字、白=白字（与全局「磨砂底色」面板语义相反，各自独立）
    const TEXT: Record<'black' | 'white', string> = {
      black: '#0b1220',
      white: '#ffffff',
    }
    setWallpaperTextColor(textArea, key === 'auto' ? null : TEXT[key])
    // 用户气泡与输入卡同属聊天区：槽位字色联动写 user/input；
    // 玻璃底色只在选黑/白时写（黑字=浅磨砂、白字=深磨砂），切回「自动」时保留磨砂面板的显式值
    if (textArea === 'chat') {
      setWallpaperTextColor('user', key === 'auto' ? null : TEXT[key])
      setWallpaperTextColor('input', key === 'auto' ? null : TEXT[key])
      if (key !== 'auto') {
        setWallpaperTextColor(
          'inputGlass',
          key === 'black'
            ? 'rgba(255, 255, 255, 0.62)'
            : 'rgba(20, 24, 34, 0.55)'
        )
      }
    }
    window.dispatchEvent(new Event('chat-demo:text-colors-changed'))
    showToast({ key: 'settingsGlassApplied' })
  }

  return (
    <div className={styles.wallpaperBlock}>
      <div className={styles.wallpaperLabel}>{label}</div>
      <div className={styles.description}>{description}</div>
      <button
        type="button"
        className={styles.wpPreview}
        style={value ? { backgroundImage: `url("${value}")` } : undefined}
        aria-label={t('settingsWallpaperChange')}
        onClick={() => inputRef.current?.click()}
      >
        {value ? null : (
          <span className={styles.previewEmpty}>{t('settingsWallpaperNone')}</span>
        )}
        <span className={styles.previewAction}>{t('settingsWallpaperChange')}</span>
      </button>
      <div className={styles.slotTextRow}>
        <span className={styles.slotTextLabel}>{t('settingsTextPreset')}</span>
        <div className={styles.slotChips}>
          {(['auto', 'black', 'white'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.slotChip} ${textPreset === key ? styles.slotChipOn : ''}`}
              aria-pressed={textPreset === key}
              onClick={() => pickText(key)}
            >
              {t(
                key === 'auto'
                  ? 'settingsPresetAuto'
                  : key === 'black'
                    ? 'settingsPresetBlack'
                    : 'settingsPresetWhite'
              )}
            </button>
          ))}
        </div>
      </div>
      {value ? (
        <button
          type="button"
          className={styles.reset}
          onClick={() => {
            onChange(null)
            try {
              localStorage.removeItem(darkStorageKey)
            } catch {
              // 忽略
            }
            // 恢复默认=回到无壁纸状态：本区字色预设一并清掉，
            // 否则行内 style（问候语/输入框）白字落白底隐身
            setWallpaperTextColor(textArea, null)
            if (textArea === 'chat') {
              setWallpaperTextColor('user', null)
              setWallpaperTextColor('input', null)
            }
            window.dispatchEvent(new Event('chat-demo:text-colors-changed'))
          }}
        >
          {t('settingsWallpaperReset')}
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) {
            setPendingFile(file)
          }
        }}
      />
      {pendingFile ? (
        <WallpaperCropper
          file={pendingFile}
          ratio={ratio}
          title={label}
          maxOut={maxOut}
          onCancel={() => setPendingFile(null)}
          onDone={({ data, dark }) => {
            setPendingFile(null)
            try {
              localStorage.setItem(darkStorageKey, String(dark))
            } catch {
              // 忽略
            }
            onChange(data)
            showToast({ key: 'settingsWallpaperApplied' })
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * 个性化：昵称、双方头像、三张壁纸（聊天区 / 侧栏 / 设置页）。
 * 每张壁纸独立上传独立恢复；字色随各自壁纸明暗自动切换。
 */
const AvatarSlot = ({
  label,
  value,
  fallback,
  fallbackClass,
  onChange,
}: {
  label: string
  value: string | null
  fallback: string
  fallbackClass: string
  onChange: (value: string | null) => void
}) => {
  const t = useTranslate()
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className={styles.slot}>
      <button
        type="button"
        className={`${styles.preview} ${fallbackClass}`}
        aria-label={label}
        title={t('settingsAvatarsChange')}
        onClick={() => inputRef.current?.click()}
      >
        {value ? <img className={styles.image} src={value} alt="" /> : fallback}
      </button>
      <div className={styles.slotLabel}>{label}</div>
      {value ? (
        <button type="button" className={styles.reset} onClick={() => onChange(null)}>
          {t('settingsAvatarsReset')}
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) {
            return
          }
          fileToAvatar(file).then(onChange, () => showToast({ key: 'settingsAvatarsFailed', type: 'error' }))
        }}
      />
    </div>
  )
}

export const AvatarSetting = () => {
  const t = useTranslate()
  const userAvatar = useSettings((state) => state.userAvatar)
  const assistantAvatar = useSettings((state) => state.assistantAvatar)
  const nickname = useSettings((state) => state.nickname)
  const wallpaper = useSettings((state) => state.wallpaper)
  const siderWallpaper = useSettings((state) => state.siderWallpaper)
  const settingsWallpaper = useSettings((state) => state.settingsWallpaper)
  const [draft, setDraft] = useState(nickname ?? '')
  return (
    <div className={styles.container}>
      <div className={styles.label}>{t('settingsNickname')}</div>
      <div className={styles.description}>{t('settingsNicknameDescription')}</div>
      <input
        className={styles.nicknameInput}
        type="text"
        maxLength={24}
        value={draft}
        placeholder={t('settingsNicknamePlaceholder')}
        aria-label={t('settingsNickname')}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft.trim() !== (nickname ?? '')) {
            setNickname(draft)
            showToast({ key: 'settingsNicknameSaved' })
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.currentTarget.blur()
          }
        }}
      />
      <div className={styles.label}>{t('settingsAvatars')}</div>
      <div className={styles.description}>{t('settingsAvatarsDescription')}</div>
      <div className={styles.slots}>
        <AvatarSlot
          label={t('settingsAvatarsUser')}
          value={userAvatar}
          fallback="你"
          fallbackClass={styles.userFallback}
          onChange={setUserAvatar}
        />
        <AvatarSlot
          label={t('settingsAvatarsAssistant')}
          value={assistantAvatar}
          fallback="D"
          fallbackClass={styles.assistantFallback}
          onChange={setAssistantAvatar}
        />
      </div>
      <div className={styles.label}>{t('settingsWallpaperGroup')}</div>
      <WallpaperSlot
        label={t('settingsWallpaper')}
        description={t('settingsWallpaperDescription')}
        value={wallpaper}
        darkStorageKey="chat-demo:wallpaper-dark"
        ratio={390 / 844}
        maxOut={1280}
        textArea="chat"
        onChange={setWallpaper}
      />
      <WallpaperSlot
        label={t('settingsSiderWallpaper')}
        description={t('settingsSiderWallpaperDescription')}
        value={siderWallpaper}
        darkStorageKey="chat-demo:wallpaper-sider-dark"
        ratio={330 / 844}
        maxOut={1280}
        textArea="sider"
        onChange={setSiderWallpaper}
      />
      <WallpaperSlot
        label={t('settingsPageWallpaper')}
        description={t('settingsPageWallpaperDescription')}
        value={settingsWallpaper}
        darkStorageKey="chat-demo:wallpaper-settings-dark"
        ratio={390 / 844}
        maxOut={1280}
        textArea="settings"
        onChange={setSettingsWallpaper}
      />
      <div className={styles.wallpaperBlock}>
        <div className={styles.wallpaperLabel}>{t('settingsInputGlass')}</div>
        <div className={styles.description}>{t('settingsInputGlassDescription')}</div>
        <InputGlassSetting />
      </div>
    </div>
  )
}
