import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslate } from '../../i18n/index.js'
import { IconCloseOutline16 } from '../base/icons.js'
import { showToast } from '../base/toastState.js'
import styles from './WallpaperCropper.module.css'

/** 裁剪结果：按框比例裁好的 dataURL + 实测平均亮度（暗壁纸切浅字用） */
export type CropResult = { data: string; dark: boolean }

/** 采样裁剪结果的平均亮度（0-1），与上传压缩共用同一套判定阈值 */
const measureLuma = (canvas: HTMLCanvasElement): boolean => {
  const sample = document.createElement('canvas')
  sample.width = 32
  sample.height = 32
  const context = sample.getContext('2d')
  if (!context) {
    return false
  }
  context.drawImage(canvas, 0, 0, 32, 32)
  const { data } = context.getImageData(0, 0, 32, 32)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }
  return sum / (data.length / 4) / 255 < 0.5
}

/**
 * 壁纸裁剪器（全屏浮层）：
 * 选图后进入，图片可双指/滚轮缩放、单指拖动平移；
 * 固定宽高比的框居中显示，框内区域即最终壁纸。
 * 确认后按框裁剪导出 JPEG，最长边不超过 maxOut。
 */
export const WallpaperCropper = ({
  file,
  ratio,
  title,
  maxOut,
  onCancel,
  onDone,
}: {
  file: File
  /** 框的宽高比（width / height），如手机全屏 ≈ 0.46 */
  ratio: number
  title: string
  maxOut: number
  onCancel: () => void
  onDone: (result: CropResult) => void
}) => {
  const t = useTranslate()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  /** 视口尺寸（CSS 像素），布局用 */
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  /** 图片变换状态：scale 为相对“铺满框”基准的倍数 */
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const stageRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  // 读图
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => setImg(image)
    image.onerror = () => showToast({ key: 'settingsAvatarsFailed', type: 'error' })
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // 视口测量
  useEffect(() => {
    const measure = () => {
      const rect = stageRef.current?.getBoundingClientRect()
      if (rect) {
        setViewport({ w: rect.width, h: rect.height })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const frameW = Math.min(viewport.w - 32, (viewport.h - 160) * ratio)
  const frameH = frameW / ratio

  // 图片基准：等比铺满框（cover），scale 是在这个基准上的倍数
  const baseScale = img && frameW > 0 ? Math.max(frameW / img.width, frameH / img.height) : 1
  const drawW = img ? img.width * baseScale * scale : 0
  const drawH = img ? img.height * baseScale * scale : 0

  // 平移夹取：图片边缘不允许离开框
  const clampOffset = (next: { x: number; y: number }, s: number) => {
    if (!img || frameW <= 0) {
      return next
    }
    const w = img.width * baseScale * s
    const h = img.height * baseScale * s
    const maxX = Math.max(0, (w - frameW) / 2)
    const maxY = Math.max(0, (h - frameH) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  // 缩放/拖动后把偏移夹回合法范围
  useEffect(() => {
    setOffset((prev) => clampOffset(prev, scale))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, frameW, frameH])

  const onPointerDown = (event: React.PointerEvent) => {
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
      }
      dragStart.current = null
    } else if (pointers.current.size === 1) {
      dragStart.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
    }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) {
      return
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      setScale(Math.min(4, Math.max(1, pinchStart.current.scale * (dist / pinchStart.current.dist))))
    } else if (pointers.current.size === 1 && dragStart.current) {
      setOffset({
        x: dragStart.current.ox + (event.clientX - dragStart.current.x),
        y: dragStart.current.oy + (event.clientY - dragStart.current.y),
      })
    }
  }

  const onPointerUp = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) {
      pinchStart.current = null
    }
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()]
      dragStart.current = { x: p.x, y: p.y, ox: offset.x, oy: offset.y }
    } else {
      dragStart.current = null
    }
  }

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault()
    setScale((prev) => Math.min(4, Math.max(1, prev * (event.deltaY < 0 ? 1.1 : 0.9))))
  }

  const confirm = () => {
    if (!img || frameW <= 0) {
      return
    }
    // 导出分辨率：框的 CSS 尺寸 × 设备像素比（真机 2-3 倍屏不糊），
    // 同时受原图可提供的分辨率与 maxOut 上限约束。
    const dpr = window.devicePixelRatio || 1
    const targetW = frameW * dpr
    const srcAvailW = (frameW / (baseScale * scale)) * (img.width / img.width) * (img.naturalWidth / frameW) * frameW / frameW // 占位，下面直接算
    void srcAvailW
    // 框内可见的原图像素宽度（缩放后）：
    const visibleSrcW = frameW / (baseScale * scale)
    const outW = Math.round(Math.min(maxOut, Math.max(targetW, Math.min(visibleSrcW, maxOut))))
    const outH = Math.round(outW / ratio)
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    // 把（框内可见的）图片区域映射到输出画布
    const visibleW = frameW / (baseScale * scale)
    const visibleH = frameH / (baseScale * scale)
    const srcX = img.width / 2 - visibleW / 2 - offset.x / (baseScale * scale)
    const srcY = img.height / 2 - visibleH / 2 - offset.y / (baseScale * scale)
    context.imageSmoothingQuality = 'high'
    context.drawImage(img, srcX, srcY, visibleW, visibleH, 0, 0, outW, outH)
    const dark = measureLuma(canvas)
    onDone({ data: canvas.toDataURL('image/jpeg', 0.92), dark })
  }

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <button type="button" className={styles.close} aria-label={t('close')} onClick={onCancel}>
          <IconCloseOutline16 />
        </button>
      </div>
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {img ? (
          <img
            className={styles.image}
            src={img.src}
            alt=""
            draggable={false}
            style={{
              width: drawW,
              height: drawH,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          />
        ) : null}
        <div className={styles.frameLayer}>
          <div className={styles.frame} style={{ width: frameW, height: frameH }} />
        </div>
      </div>
      <div className={styles.hint}>{t('cropHint')}</div>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          {t('cancel')}
        </button>
        <button type="button" className={styles.confirm} disabled={!img} onClick={confirm}>
          {t('cropConfirm')}
        </button>
      </div>
    </div>,
    document.body
  )
}
