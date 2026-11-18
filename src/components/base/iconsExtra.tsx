/** 官方 App 风格复刻用的补充图标：统一 currentColor 描边，尺寸随字号场景用 width/height 覆盖。 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const IconAccountOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <circle cx="10" cy="6.4" r="3.1" />
    <path d="M3.8 16.6c.7-3.2 3.2-4.9 6.2-4.9s5.5 1.7 6.2 4.9" />
  </svg>
)

export const IconFontSizeOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <path d="M2.5 15.5 6 5.5l3.5 10M3.7 12.2h4.6" />
    <path d="M11.5 15.5 14 8.5l2.5 7M12.4 13.2h3.2" />
  </svg>
)

export const IconPersonalizeOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <path d="m10 2.8 1.6 4.1 4.1 1.6-4.1 1.6L10 14.2l-1.6-4.1-4.1-1.6 4.1-1.6Z" />
    <path d="m15.8 12.6.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" />
  </svg>
)

export const IconSpeakerOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <path d="M3 8v4h2.8L10 15.6V4.4L5.8 8H3Z" />
    <path d="M13 7.4a3.6 3.6 0 0 1 0 5.2M15.4 5.2a6.8 6.8 0 0 1 0 9.6" />
  </svg>
)

export const IconSpeakerMuteOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <path d="M3 8v4h2.8L10 15.6V4.4L5.8 8H3Z" />
    <path d="m13.2 8 4 4m0-4-4 4" />
  </svg>
)

export const IconInfoOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M10 9v4.4M10 6.4v.2" />
  </svg>
)

export const IconTermsOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <path d="M5 2.8h7l3 3v11.4H5Z" />
    <path d="M12 2.8v3h3M7.4 9h5.2M7.4 12h5.2M7.4 15h3" />
  </svg>
)

export const IconHelpOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M7.9 7.8A2.2 2.2 0 0 1 10 6.3c1.2 0 2.2.9 2.2 2 0 1.4-1.6 1.7-2.2 2.6v.4M10 13.9v.2" />
  </svg>
)

export const IconBackOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <path d="M12.5 4.5 7 10l5.5 5.5" />
  </svg>
)

export const IconPlusCircleOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M10 6.8v6.4M6.8 10h6.4" />
  </svg>
)

export const IconSortOutline16 = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden {...stroke}>
    <circle cx="4.4" cy="4.4" r="1.7" />
    <path d="M8 4.4h5" />
    <circle cx="4.4" cy="11.6" r="1.7" />
    <path d="M8 11.6h5" />
  </svg>
)

export const IconWaveOutline20 = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden {...stroke}>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M6.6 8.6v2.8M10 6.6v6.8M13.4 8.6v2.8" />
  </svg>
)

/** 官方输入卡右侧语音钮：描边圆内一个点 + 两道声波弧 */
export const IconVoiceCircleOutline24 = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden {...stroke} strokeWidth={1.5}>
    <circle cx="12" cy="12" r="9.2" />
    <circle cx="8.6" cy="12" r="0.9" fill="currentColor" stroke="none" />
    <path d="M11.6 9.4a3.6 3.6 0 0 1 0 5.2" />
    <path d="M14.2 7.6a6.2 6.2 0 0 1 0 8.8" />
  </svg>
)

/** 官方输入卡右侧附件钮：描边圆内加号 */
export const IconAttachCircleOutline24 = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden {...stroke} strokeWidth={1.5}>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M12 7.8v8.4M7.8 12h8.4" />
  </svg>
)

/** 置顶图钉 */
export const IconPinOutline14 = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden {...stroke}>
    <path d="M8.6 1.8 12.2 5.4 9.7 6.4 7.4 9.8 4.2 6.6 7.6 4.3Z" />
    <path d="M4.2 9.8 1.8 12.2" />
  </svg>
)

/** 官方输入卡右侧「更多」钮：描边圆内三点，点开模型切换与用量面板 */
export const IconMoreCircleOutline24 = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden {...stroke} strokeWidth={1.5}>
    <circle cx="12" cy="12" r="9.2" />
    <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
)

/** 首屏问候上方的对话气泡标记：自绘通用图形，不使用官方 Logo。 */
export const GreetingMark = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
    <path
      d="M26 6C14.9 6 6 13.7 6 23.2c0 5.4 2.9 10.2 7.4 13.3-.3 2.6-1.3 5-3 7 3.5-.4 6.6-1.7 9.1-3.6 2 .7 4.2 1.1 6.5 1.1 11.1 0 20-7.7 20-17.8S37.1 6 26 6Z"
      fill="var(--dsw-alias-brand-primary)"
    />
    <circle cx="18" cy="23.5" r="2.4" fill="var(--dsw-alias-label-primary-foreground)" />
    <circle cx="26" cy="23.5" r="2.4" fill="var(--dsw-alias-label-primary-foreground)" />
    <circle cx="34" cy="23.5" r="2.4" fill="var(--dsw-alias-label-primary-foreground)" />
  </svg>
)

/** 24px ⊕ 描边圈：附件面板入口（对齐官方输入卡右上角 ⊕） */
export const IconPlusCircleOutline24 = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden {...stroke}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 8.2v7.6M8.2 12h7.6" />
  </svg>
)

/** 24px ↑ 实心圆发送钮（有文字时替代语音钮） */
export const IconArrowUp24 = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden fill="currentColor">
    <path d="M12 4.6a1 1 0 0 1 .72.31l5.2 5.3a1 1 0 0 1-1.44 1.4L13 8.1V19a1 1 0 1 1-2 0V8.1l-3.48 3.5a1 1 0 0 1-1.44-1.4l5.2-5.3a1 1 0 0 1 .72-.3Z" />
  </svg>
)

/** 拍照：相机轮廓 */
export const IconCameraOutline24 = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden {...stroke}>
    <path d="M3 8.5h3l1.4-2h8.2L17 8.5h4v10H3z" />
    <circle cx="12" cy="13.2" r="3.2" />
  </svg>
)

/** 相册：山与太阳 */
export const IconImageOutline24 = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden {...stroke}>
    <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2.4" />
    <circle cx="8.6" cy="10" r="1.6" />
    <path d="M4 16.4l4.6-4.2 3.4 3 2.6-2.2 5.4 4.6" />
  </svg>
)

/** 文件：回形针 / 文档轮廓 */
export const IconFileOutline24 = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden {...stroke}>
    <path d="M14 3.2H7a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.2z" />
    <path d="M14 3.2v5h5" />
  </svg>
)