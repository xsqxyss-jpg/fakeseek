import { useEffect, useState } from 'react'
import { getFileViewType, isImage } from '../../services/attachments.js'
import { loadFile } from '../../services/chat/db.js'

const createViewUrl = (original: Blob, type: string) => {
  const blob = original.slice(0, original.size, type || 'application/octet-stream')
  if (type !== 'image/svg+xml') {
    return URL.createObjectURL(blob)
  }
  // SVG 缩略图用 data: 地址，单独打开图片时也与应用隔离。
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** 草稿传 File，已发送的附件传 IndexedDB 原件 ID。 */
export const useFileView = (source: File | string, name: string) => {
  const type = getFileViewType(name)
  const [state, setState] = useState<{ source: File | string; type: string; url: string | null }>()
  useEffect(() => {
    let active = true
    const original = typeof source === 'string' ? loadFile(source) : Promise.resolve(source)
    const pending = original
      .then((blob) => (active && blob ? createViewUrl(blob, type) : null))
      .catch(() => null)
    void pending.then((url) => {
      if (active) {
        setState({ source, type, url })
      }
    })
    return () => {
      active = false
      void pending.then((url) => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [source, type])

  const url = state?.source === source && state.type === type ? state.url : undefined
  const image = isImage(type)
  // PDF 仍走新开页（内置查看层不含滚动阅读）；图片一律 download 属性兜底，
  // 由调用方决定用应用内查看层放大（MessageFile / DraftAttachments），
  // 不再给图片发 target=_blank —— WebView 里开新窗口回不来，按返回直接退出应用。
  const openInTab = type === 'application/pdf'
  const action = openInTab ? { target: '_blank', rel: 'noreferrer' } : { download: name }
  return { url, image, link: url ? { href: url, ...action } : undefined }
}
