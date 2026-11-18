import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'

/** 窄于 768px 按移动端布局 */
const query = window.matchMedia('not all and (min-width: 768px)')

const subscribe = (onChange: () => void) => {
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export const useIsMobile = () => useSyncExternalStore(subscribe, () => query.matches)

const preventPageScroll = (event: TouchEvent) => {
  if (event.touches.length !== 1) {
    return
  }
  for (
    let element = event.target instanceof Element ? event.target : null;
    element && element !== document.body;
    element = element.parentElement
  ) {
    const style = getComputedStyle(element)
    const scrollsY =
      /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight
    const scrollsX =
      /auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth
    if (scrollsY || scrollsX) {
      return
    }
  }
  event.preventDefault()
}

/** 阻止移动端整页滚动，保留内部可滚动区域的滚动和双指缩放。 */
export const usePreventPageScroll = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return
    }
    document.addEventListener('touchmove', preventPageScroll, { passive: false })
    return () => document.removeEventListener('touchmove', preventPageScroll)
  }, [enabled])
}

/** 移动端页面跟随视觉视口，键盘弹出后顶栏和输入框仍留在可见区域。 */
export const useMobileViewport = (enabled: boolean) => {
  const frameRef = useRef<HTMLDivElement>(null)

  // --safe-bottom 保持「底部导航条高度」不变（原生注入，已在真机验证）。
  // 部分机型的 WebView 在键盘弹出时不缩小视觉视口，键盘会盖住输入卡；
  // 这里只在那种情况下补差额，交给 --ime-comp，仅由 .frame 追加，
  // 其他消费点（输入卡、侧栏、设置页）仍只吃 --safe-bottom，不会重复扣。
  // 基准高度用「键盘收起时的 visualViewport.height」实测值，不依赖 window.innerHeight，
  // 因为不同 WebView 是否随键盘缩小布局视口并不一致。
  useEffect(() => {
    if (!enabled) {
      return
    }
    const root = document.documentElement
    const viewport = window.visualViewport
    const read = (name: string) =>
      parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0
    /** 键盘收起时的可视高度；键盘弹出时视口若真的缩小，差额就记在这里 */
    let baseline = viewport?.height ?? window.innerHeight
    const sync = () => {
      const ime = read('--ime-height')
      const nav = read('--nav-bottom')
      const height = viewport?.height ?? window.innerHeight
      if (ime <= 0) {
        // 键盘收起：记住这一屏的可视高度，作为下次判断的基准，同时清掉补偿
        baseline = height
        root.style.setProperty('--ime-comp', '0px')
        return
      }
      // 键盘高度 - 视口已让开的高度 - 导航条已让开的高度 = 还差多少没让开
      const shrunk = Math.max(0, baseline - height)
      const extra = Math.max(0, ime - shrunk - nav)
      root.style.setProperty('--ime-comp', `${extra}px`)
    }
    sync()
    viewport?.addEventListener('resize', sync)
    window.addEventListener('resize', sync)
    return () => {
      viewport?.removeEventListener('resize', sync)
      window.removeEventListener('resize', sync)
      root.style.removeProperty('--ime-comp')
    }
  }, [enabled])

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!enabled || !frame) {
      return
    }
    const viewport = window.visualViewport
    const inputSelector = 'textarea, input:not([type="file"])'
    let animationFrame = 0
    const reset = () => {
      frame.style.removeProperty('--app-viewport-height')
      frame.style.removeProperty('--app-viewport-top')
    }
    const update = () => {
      // 双指缩放由浏览器处理，保持当前布局尺寸。
      if (viewport && viewport.scale !== 1) {
        return
      }
      // 失焦后直接恢复 CSS 的全高布局，不等 Safari 收键盘后的 resize。
      if (!document.activeElement?.matches(inputSelector)) {
        reset()
        return
      }
      frame.style.setProperty(
        '--app-viewport-height',
        `${viewport?.height ?? window.innerHeight}px`
      )
      frame.style.setProperty('--app-viewport-top', `${viewport?.offsetTop ?? 0}px`)
    }
    const scheduleFrame = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(update)
    }
    const schedule = () => {
      // 先同步跟上键盘动画，下一帧再校准 Safari 延迟更新的视口读数。
      update()
      scheduleFrame()
    }
    const onFocusIn = () => {
      if (document.activeElement?.matches(inputSelector)) {
        schedule()
        // 键盘弹起后把输入框滚进可视区：部分机型 WebView 不自动滚，
        // 表现为「键盘弹出来了但输入框还在屏幕外/键盘底下」，再点一次才弹。
        setTimeout(() => {
          document.activeElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }, 350)
      }
    }

    update()
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    document.addEventListener('focusin', onFocusIn)
    // 等点击和焦点切换完成，避免按钮移动、或切换输入框时短暂恢复全高。
    document.addEventListener('focusout', scheduleFrame)
    return () => {
      cancelAnimationFrame(animationFrame)
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', scheduleFrame)
      reset()
    }
  }, [enabled])

  return frameRef
}
