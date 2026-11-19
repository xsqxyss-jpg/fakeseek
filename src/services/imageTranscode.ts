/**
 * 图片归一化：服务端只接受 JPEG / PNG / GIF / WebP，且按真实字节判断格式（不认扩展名与声明的 MIME）。
 * 这里把 BMP / TIFF / AVIF / SVG / ICO 等不受支持的格式，以及尺寸超限的大图，
 * 在上传前统一转成 JPEG；本来就合规的图原样直传，不重编码。
 *
 * 尺寸上限取 4096：服务端单边上限为 8192，但一次请求里图片达到 15 张时会降到 4096，
 * 历史会话一次带很多图很常见，按更严的一档处理才不会在中途被拒。
 */

/** 服务端支持的图片格式，见官方 Vision 指南 */
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

/** 受支持格式且在此体积内直接原样上传：保画质、省电、省时 */
const PASS_THROUGH_MAX_BYTES = 8 * 1024 * 1024

/** 长边像素上限；超出的图在本地缩小后再上传 */
const MAX_SIDE = 4096

const JPEG_QUALITY = 0.85

/** 按文件头判断真实图片格式；无法识别时返回空字符串 */
export const sniffImageType = (bytes: Uint8Array): string => {
  const startsWith = (...prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte)
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, 12))
  if (startsWith(0xff, 0xd8, 0xff)) {
    return 'image/jpeg'
  }
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return 'image/png'
  }
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) {
    return 'image/gif'
  }
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') {
    return 'image/webp'
  }
  if (startsWith(0x42, 0x4d)) {
    return 'image/bmp'
  }
  if (startsWith(0x49, 0x49, 0x2a, 0) || startsWith(0x4d, 0x4d, 0, 0x2a)) {
    return 'image/tiff'
  }
  if (header.slice(4, 8) === 'ftyp' && ['avif', 'avis'].includes(header.slice(8, 12))) {
    return 'image/avif'
  }
  if (startsWith(0x00, 0x00, 0x01, 0x00)) {
    return 'image/x-icon'
  }
  return ''
}

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

/** 从文件头读尺寸，不解码整张图：超大图在这里判断，避免在手机上分配巨量位图内存 */
const readSize = (bytes: Uint8Array, type: string): { width: number; height: number } | null => {
  try {
    const dv = view(bytes)
    if (type === 'image/png') {
      return { width: dv.getUint32(16), height: dv.getUint32(20) }
    }
    if (type === 'image/gif') {
      return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) }
    }
    if (type === 'image/jpeg') {
      let offset = 2
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          return null
        }
        const marker = bytes[offset + 1]
        const length = dv.getUint16(offset + 2)
        // SOF0..SOF15，排除 DHT(C4) / JPG(C8) / DAC(CC)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: dv.getUint16(offset + 5), width: dv.getUint16(offset + 7) }
        }
        offset += 2 + length
      }
      return null
    }
    if (type === 'image/webp') {
      const chunk = new TextDecoder('ascii').decode(bytes.subarray(12, 16))
      if (chunk === 'VP8X') {
        const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16))
        const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
        return { width, height }
      }
      if (chunk === 'VP8 ') {
        return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff }
      }
      if (chunk === 'VP8L') {
        const bits = dv.getUint32(21, true)
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
      }
      return null
    }
  } catch {
    return null
  }
  return null
}

/**
 * SVG 没有字节魔数，只能看文本头。
 * canvas 绘制 SVG 需要 blob 带 image/svg+xml 类型，否则 Image 直接解码失败。
 */
const asSvgBlob = async (blob: Blob): Promise<Blob | null> => {
  const head = new TextDecoder('utf-8').decode(await blob.slice(0, 2048).arrayBuffer())
  return head.includes('<svg') ? new Blob([blob], { type: 'image/svg+xml' }) : null
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image decode failed'))
    image.src = url
  })

/** 缩小到上限：优先 createImageBitmap 的目标尺寸解码，避免先解出整张巨图 */
const renderScaled = async (
  source: Blob,
  width: number,
  height: number
): Promise<{ canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null> => {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }
  // JPEG 无透明通道，先铺白底，透明区域才不会变黑
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, targetWidth, targetHeight)
  const needsScale = scale < 1
  if (needsScale && 'createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(source, {
        resizeWidth: targetWidth,
        resizeHeight: targetHeight,
        resizeQuality: 'high',
      })
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      return { canvas, context }
    } catch {
      // 该格式不支持位图缩放，退回 Image 解码
    }
  }
  const url = URL.createObjectURL(source)
  try {
    const image = await loadImage(url)
    context.drawImage(image, 0, 0, targetWidth, targetHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
  return { canvas, context }
}

/**
 * 解码兜底：头部读不出尺寸（截断/异常元数据），或 SVG 这类服务端不支持的格式走这里。
 * forceEncode=true 时无论尺寸都转 JPEG（SVG 服务端不认，必须转）；
 * 否则尺寸合规就原样返回，超限才缩小转 JPEG。解码失败按原类型返回，让服务端给出准确错误。
 */
const normalizeByDecode = async (source: Blob, forceEncode: boolean): Promise<Blob> => {
  const url = URL.createObjectURL(source)
  try {
    const image = await loadImage(url)
    const oversized = Math.max(image.naturalWidth, image.naturalHeight) > MAX_SIDE
    if (!oversized && !forceEncode) {
      return new Blob([source], { type: source.type })
    }
    const rendered = await renderScaled(source, image.naturalWidth, image.naturalHeight)
    const encoded = await new Promise<Blob | null>((resolve) => {
      rendered?.canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })
    return encoded ?? new Blob([source], { type: source.type })
  } catch {
    return new Blob([source], { type: source.type })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 上传前归一化图片：
 * - GIF 动图尺寸合规时直传（重编码丢动画帧）；超限动图原样上传会被服务端
 *   4096 尺寸上限拒绝且重传无解，取首帧转 JPEG 保住对话；
 * - 服务端支持的格式、体积不超限、单边不超过 MAX_SIDE 时直传；
 * - 其余格式或超限图，解码后转成 JPEG；头部读不出尺寸的完整解码确认；
 * - 解码失败时按识别出的类型原样返回，让服务端给出准确错误，不静默丢附件。
 */
export const normalizeImage = async (blob: Blob): Promise<Blob> => {
  // 只读文件头：魔数在 64B 内，尺寸在 64KB 内，不必把整张图读进内存
  const head = new Uint8Array(await blob.slice(0, 65536).arrayBuffer())
  const detected = sniffImageType(head)
  if (detected === 'image/gif') {
    const size = readSize(head, detected)
    if (!size || Math.max(size.width, size.height) <= MAX_SIDE) {
      return new Blob([blob], { type: detected })
    }
    return normalizeByDecode(new Blob([blob], { type: detected }), false)
  }
  if (SUPPORTED_IMAGE_TYPES.has(detected)) {
    const size = readSize(head, detected)
    const oversized = size !== null && Math.max(size.width, size.height) > MAX_SIDE
    if (!oversized && blob.size <= PASS_THROUGH_MAX_BYTES) {
      return new Blob([blob], { type: detected })
    }
    if (size) {
      const rendered = await renderScaled(blob, size.width, size.height)
      const encoded = await new Promise<Blob | null>((resolve) => {
        rendered?.canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
      })
      return encoded ?? new Blob([blob], { type: detected })
    }
    // 头部读不出尺寸：完整解码确认真实尺寸，合规直传、超限缩小
    return normalizeByDecode(new Blob([blob], { type: detected }), false)
  }
  // SVG 无魔数，补上正确类型后才能绘制；服务端不认 SVG，无论尺寸都转 JPEG
  const source = detected ? new Blob([blob], { type: detected }) : await asSvgBlob(blob)
  if (!source) {
    return new Blob([blob], { type: blob.type })
  }
  return normalizeByDecode(source, true)
}
