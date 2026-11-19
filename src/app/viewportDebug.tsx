import { useEffect, useRef, useState } from 'react'

/**
 * 键盘视口调试面板：长按移动端顶栏 3 秒弹出，实时显示全部视口与键盘变量。
 * 用于远程排障——让出问题的用户长按顶栏后截图发回，一张图拿全所有数值。
 * 所有值都只读，面板不影响任何行为；再长按 3 秒或点关闭即消失。
 */

const readVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '—'

const readStyle = (el: Element | null, prop: string) =>
  el ? getComputedStyle(el).getPropertyValue(prop) : '—'

const round = (value: string) => {
  const n = parseFloat(value)
  return Number.isNaN(n) ? value : `${Math.round(n)}px`
}

const VARS: { label: string; get: () => string }[] = [
  { label: '--ime-height (原生键盘)', get: () => readVar('--ime-height') },
  { label: '--nav-bottom (导航条)', get: () => readVar('--nav-bottom') },
  { label: '--safe-bottom', get: () => readVar('--safe-bottom') },
  { label: '--ime-comp (补偿)', get: () => readVar('--ime-comp') },
  { label: '--vp-baseline (基准高)', get: () => readVar('--vp-baseline') },
]

export const useViewportDebug = () => {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<number>()

  const startPress = () => {
    timerRef.current = window.setTimeout(() => setVisible(true), 3000)
  }
  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = undefined
    }
  }

  useEffect(() => () => cancelPress(), [])

  return {
    debugProps: {
      onPointerDown: startPress,
      onPointerUp: cancelPress,
      onPointerLeave: cancelPress,
      onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
    },
    visible,
    hide: () => setVisible(false),
  }
}

export const ViewportDebugPanel = ({ hide }: { hide: () => void }) => {
  // 300ms 刷新一次，键盘动画过程中数值连续变化也能看清
  const [, force] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => force((n) => n + 1), 300)
    return () => clearInterval(timer)
  }, [])

  const frame = document.querySelector('[class*=frame]')
  const textarea = document.querySelector('textarea')
  const rows: [string, string][] = [
    ...VARS.map(({ label, get }) => [label, get()] as [string, string]),
    ['visualViewport.height', `${Math.round(window.visualViewport?.height ?? 0)}px`],
    ['visualViewport.offsetTop', `${Math.round(window.visualViewport?.offsetTop ?? 0)}px`],
    ['window.innerHeight', `${Math.round(window.innerHeight)}px`],
    ['window.scrollY', `${Math.round(window.scrollY)}px`],
    ['frame 高', round(readStyle(frame, 'height'))],
    ['frame top', round(readStyle(frame, 'top'))],
    ['frame padding-bottom', round(readStyle(frame, 'padding-bottom'))],
    ['frame 底边(y)', `${frame ? Math.round(frame.getBoundingClientRect().bottom) : '—'}`],
    ['输入框底边(y)', `${textarea ? Math.round(textarea.getBoundingClientRect().bottom) : '—'}`],
    ['data-ime-open', document.documentElement.hasAttribute('data-ime-open') ? '是' : '否'],
    ['userAgent', navigator.userAgent.slice(0, 60)],
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        right: 8,
        zIndex: 9999,
        maxHeight: '70vh',
        overflowY: 'auto',
        padding: '10px 12px',
        borderRadius: 14,
        background: 'rgba(15, 23, 42, 0.92)',
        color: '#e2e8f0',
        fontSize: 11,
        lineHeight: '18px',
        fontFamily: 'monospace',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        pointerEvents: 'auto',
      }}
      onClick={hide}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>键盘视口调试（点击任意处关闭）</div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ opacity: 0.75 }}>{label}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
        </div>
      ))}
    </div>
  )
}
