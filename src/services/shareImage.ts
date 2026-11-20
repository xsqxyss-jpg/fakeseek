import { getVisibleMessages } from './chat/branches.js'
import { loadSession } from './chat/db.js'
import { useChatStore } from './chat/store.js'
import type { Session } from './chat/types.js'
import { showToast } from '../components/base/toastState.js'

const CANVAS_WIDTH = 750
const MAX_CANVAS_HEIGHT = 20000
const PADDING_X = 28
const MAX_BUBBLE_WIDTH = 580
const BUBBLE_PADDING_X = 16
const BUBBLE_PADDING_Y = 12
const LINE_HEIGHT = 26
const CODE_LINE_HEIGHT = 22

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) {
    r = w / 2
  }
  if (h < 2 * r) {
    r = h / 2
  }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const result: string[] = []
  const paragraphs = text.split('\n')
  for (const para of paragraphs) {
    if (para === '') {
      result.push('')
      continue
    }
    let currentLine = ''
    for (let i = 0; i < para.length; i++) {
      const char = para[i]
      const testLine = currentLine + char
      if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
        result.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) {
      result.push(currentLine)
    }
  }
  return result
}

type TextSection =
  | { type: 'text'; lines: string[] }
  | { type: 'code'; lines: string[]; lang?: string }

function parseContentToSections(
  ctx: CanvasRenderingContext2D,
  rawContent: string,
  maxWidth: number
): { sections: TextSection[]; height: number } {
  const sections: TextSection[] = []
  const lines = rawContent.split('\n')
  let currentTextLines: string[] = []
  let inCodeBlock = false
  let codeBlockLines: string[] = []
  let codeLang = ''

  const flushText = () => {
    if (currentTextLines.length > 0) {
      const full = currentTextLines.join('\n')
      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      const wrapped = wrapText(ctx, full, maxWidth)
      sections.push({ type: 'text', lines: wrapped })
      currentTextLines = []
    }
  }

  const flushCode = () => {
    if (codeBlockLines.length > 0) {
      ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      const wrapped: string[] = []
      for (const line of codeBlockLines) {
        const parts = wrapText(ctx, line, maxWidth - 24)
        wrapped.push(...parts)
      }
      sections.push({ type: 'code', lines: wrapped, lang: codeLang })
      codeBlockLines = []
      codeLang = ''
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCode()
        inCodeBlock = false
      } else {
        flushText()
        inCodeBlock = true
        codeLang = trimmed.slice(3).trim()
      }
    } else if (inCodeBlock) {
      codeBlockLines.push(line)
    } else {
      currentTextLines.push(line)
    }
  }

  if (inCodeBlock) {
    flushCode()
  } else {
    flushText()
  }

  let totalHeight = 0
  for (const sec of sections) {
    if (sec.type === 'text') {
      totalHeight += sec.lines.length * LINE_HEIGHT
    } else {
      totalHeight += sec.lines.length * CODE_LINE_HEIGHT + 24
    }
  }

  return { sections, height: totalHeight }
}

type PreparedMessage = {
  role: 'user' | 'assistant'
  sections: TextSection[]
  imageCount: number
  bubbleWidth: number
  bubbleHeight: number
}

export const renderSessionImage = async (
  session: Session
): Promise<Blob> => {
  const isDark =
    typeof document !== 'undefined' &&
    (document.body.classList.contains('dark') ||
      document.body.getAttribute('data-ds-dark-theme') === 'dark')

  const bgColor = isDark ? '#171922' : '#ffffff'
  const textColor = isDark ? '#e6edf3' : '#1f2328'
  const secondaryTextColor = isDark ? '#8b949e' : '#656d76'
  const dividerColor = isDark ? '#30363d' : '#e1e4e8'
  const userBubbleBg = isDark ? '#1e3860' : '#dbeafe'
  const userTextColor = isDark ? '#f0f6fc' : '#1e3a8a'
  const assistantBubbleBg = isDark ? '#21262d' : '#f6f8fa'
  const assistantTextColor = isDark ? '#e6edf3' : '#24292f'
  const codeBg = isDark ? '#161b22' : '#edf2f7'
  const codeTextColor = isDark ? '#e6edf3' : '#1f2328'

  // Measure offscreen
  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = CANVAS_WIDTH
  measureCanvas.height = 100
  const mctx = measureCanvas.getContext('2d')
  if (!mctx) {
    throw new Error('Canvas 2D context not available')
  }

  const visibleMessages = getVisibleMessages(session)
  const preparedMessages: PreparedMessage[] = []

  let accumulatedHeight = 120 // Header height
  let truncated = false

  for (const msg of visibleMessages) {
    let rawText = ''
    let imageCount = 0

    if (msg.role === 'user') {
      rawText = msg.content || ''
      if (msg.files && msg.files.length > 0) {
        for (const file of msg.files) {
          if (file.isImage) {
            imageCount++
          } else {
            rawText = rawText ? `${rawText}\n[文件: ${file.name}]` : `[文件: ${file.name}]`
          }
        }
      }
    } else {
      if (msg.blocks) {
        for (const block of msg.blocks) {
          if (block.type === 'text') {
            rawText = rawText ? `${rawText}\n${block.text}` : block.text
          }
        }
      }
    }

    if (!rawText.trim() && imageCount === 0) {
      continue
    }

    const { sections, height: contentHeight } = parseContentToSections(
      mctx,
      rawText,
      MAX_BUBBLE_WIDTH - BUBBLE_PADDING_X * 2
    )

    let totalContentHeight = contentHeight
    if (imageCount > 0) {
      totalContentHeight += imageCount * 24
    }

    // Determine bubble width
    let maxLineWidth = 0
    mctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    for (const sec of sections) {
      if (sec.type === 'text') {
        for (const l of sec.lines) {
          maxLineWidth = Math.max(maxLineWidth, mctx.measureText(l).width)
        }
      } else {
        mctx.font = '14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        for (const l of sec.lines) {
          maxLineWidth = Math.max(maxLineWidth, mctx.measureText(l).width + 24)
        }
        mctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }
    }

    if (imageCount > 0) {
      maxLineWidth = Math.max(maxLineWidth, 80)
    }

    const bubbleWidth = Math.min(
      MAX_BUBBLE_WIDTH,
      Math.max(60, Math.ceil(maxLineWidth) + BUBBLE_PADDING_X * 2)
    )
    const bubbleHeight = totalContentHeight + BUBBLE_PADDING_Y * 2

    const itemTotalHeight = bubbleHeight + 20 // spacing

    if (accumulatedHeight + itemTotalHeight > MAX_CANVAS_HEIGHT - 60) {
      truncated = true
      break
    }

    accumulatedHeight += itemTotalHeight
    preparedMessages.push({
      role: msg.role,
      sections,
      imageCount,
      bubbleWidth,
      bubbleHeight,
    })
  }

  const finalHeight = Math.min(MAX_CANVAS_HEIGHT, Math.max(240, accumulatedHeight + 40))

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = finalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context not available')
  }

  // Draw background
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, CANVAS_WIDTH, finalHeight)

  // Draw Header
  const title = session.title || '对话记录'
  const dateStr = new Date(session.updatedAt || session.createdAt || Date.now()).toLocaleString()

  ctx.fillStyle = textColor
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(title, PADDING_X, 48)

  ctx.fillStyle = secondaryTextColor
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(dateStr, PADDING_X, 74)

  ctx.strokeStyle = dividerColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING_X, 96)
  ctx.lineTo(CANVAS_WIDTH - PADDING_X, 96)
  ctx.stroke()

  // Draw Messages
  let currentY = 120

  for (const msg of preparedMessages) {
    const isUser = msg.role === 'user'
    const bubbleX = isUser
      ? CANVAS_WIDTH - PADDING_X - msg.bubbleWidth
      : PADDING_X

    // Draw bubble background
    ctx.fillStyle = isUser ? userBubbleBg : assistantBubbleBg
    drawRoundRect(ctx, bubbleX, currentY, msg.bubbleWidth, msg.bubbleHeight, 16)
    ctx.fill()

    let textY = currentY + BUBBLE_PADDING_Y + 18
    const textX = bubbleX + BUBBLE_PADDING_X

    // Draw images placeholder if user had images
    if (msg.imageCount > 0) {
      ctx.fillStyle = isUser ? userTextColor : assistantTextColor
      ctx.font = 'italic 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      for (let i = 0; i < msg.imageCount; i++) {
        ctx.fillText('[图片]', textX, textY)
        textY += 24
      }
    }

    // Draw sections
    for (const sec of msg.sections) {
      if (sec.type === 'text') {
        ctx.fillStyle = isUser ? userTextColor : assistantTextColor
        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        for (const line of sec.lines) {
          ctx.fillText(line, textX, textY)
          textY += LINE_HEIGHT
        }
      } else {
        // Draw code box
        const codeBoxHeight = sec.lines.length * CODE_LINE_HEIGHT + 16
        const codeBoxWidth = msg.bubbleWidth - BUBBLE_PADDING_X * 2
        ctx.fillStyle = codeBg
        drawRoundRect(ctx, textX, textY - 14, codeBoxWidth, codeBoxHeight, 8)
        ctx.fill()

        ctx.fillStyle = codeTextColor
        ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        let codeY = textY + 6
        for (const line of sec.lines) {
          ctx.fillText(line, textX + 12, codeY)
          codeY += CODE_LINE_HEIGHT
        }
        textY += codeBoxHeight + 8
      }
    }

    currentY += msg.bubbleHeight + 20
  }

  if (truncated) {
    ctx.fillStyle = secondaryTextColor
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('—— 会话过长，已截取前部分内容 ——', CANVAS_WIDTH / 2, finalHeight - 20)
    ctx.textAlign = 'start'
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })

  if (!blob) {
    throw new Error('Failed to create image blob')
  }

  if (truncated) {
    showToast({ key: 'shareImageTooLong' })
  }

  return blob
}

export const saveSessionAsImage = async (sessionId: string): Promise<void> => {
  try {
    const store = useChatStore.getState()
    const session =
      store.sessionCache[sessionId] ?? (await loadSession(sessionId))

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const blob = await renderSessionImage(session)
    const fileName = `${session.title || 'chat'}-${new Date().toISOString().slice(0, 10)}.png`
    const url = URL.createObjectURL(blob)

    try {
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    }

    showToast({ key: 'shareImageSuccess' })
  } catch (error) {
    console.error('saveSessionAsImage failed:', error)
    showToast({ key: 'shareImageFailed' })
    throw error
  }
}
