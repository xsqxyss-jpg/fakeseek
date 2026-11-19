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

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!enabled || !frame) {
      return
    }
    const root = document.documentElement
    const viewport = window.visualViewport
    const inputSelector = 'textarea, input:not([type="file"])'
    let animationFrame = 0
    const read = (name: string) =>
      parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0
    let baseline = Math.max(window.innerHeight, viewport?.height ?? 0)

    const reset = () => {
      frame.style.removeProperty('--app-viewport-height')
      frame.style.removeProperty('--app-viewport-top')
    }

    const update = () => {
      if (viewport && viewport.scale !== 1) {
        return
      }
      const ime = read('--ime-height')
      const height = viewport?.height ?? window.innerHeight

      if (ime <= 0) {
        baseline = Math.max(baseline, height)
        root.removeAttribute('data-ime-open')
        root.style.setProperty('--ime-comp', '0px')
      } else {
        root.setAttribute('data-ime-open', '')
        // baseline 污染护栏：键盘态下视口反而比基准高，说明基准记小了，重置为当前值
        if (height > baseline) {
          baseline = height
        }
        // 视口已让开的部分直接抵扣：全缩→0，不缩→ime，半缩→差额（连续成立，无阈值跳变）
        const shrunk = Math.max(0, baseline - height)
        const extra = Math.max(0, ime - shrunk)
        root.style.setProperty('--ime-comp', `${extra}px`)
      }

      if (!document.activeElement?.matches(inputSelector)) {
        reset()
        return
      }
      frame.style.setProperty('--app-viewport-height', `${height}px`)
      // 钳制 offsetTop 为 0，防止文档级滚动把 fixed 容器顶走
      frame.style.setProperty('--app-viewport-top', '0px')
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0)
      }
    }

    const scheduleFrame = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(update)
    }
    const schedule = () => {
      update()
      scheduleFrame()
    }
    const onFocusIn = () => {
      if (document.activeElement?.matches(inputSelector)) {
        schedule()
      }
    }

    // 鸿蒙/Android 15+ edge-to-edge：键盘弹出时窗口与视觉视口都不缩、不发 resize，
    // 唯一信号是原生层注入的 --ime-height / --nav-bottom。监听 html 的 style 属性变化，
    // 注入一到位立刻重算补偿，否则输入框会被键盘盖住（focusin 时键盘还没弹起，读到的 ime 是 0）。
    // update() 自己也会写 html.style（--ime-comp / data-ime-open），所以只认 ime/nav 真变了才重算，
    // 避免自触发 60fps 空转。
    let lastInjectedIme = read('--ime-height')
    let lastInjectedNav = read('--nav-bottom')
    const attributeObserver = new MutationObserver(() => {
      const ime = read('--ime-height')
      const nav = read('--nav-bottom')
      if (ime !== lastInjectedIme || nav !== lastInjectedNav) {
        lastInjectedIme = ime
        lastInjectedNav = nav
        schedule()
      }
    })
    attributeObserver.observe(root, { attributes: true, attributeFilter: ['style'] })

    update()
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', scheduleFrame)
    return () => {
      cancelAnimationFrame(animationFrame)
      attributeObserver.disconnect()
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', scheduleFrame)
      root.removeAttribute('data-ime-open')
      root.style.removeProperty('--ime-comp')
      reset()
    }
  }, [enabled])

  return frameRef
}
