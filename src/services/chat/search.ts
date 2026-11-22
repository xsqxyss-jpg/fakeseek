import { getVisibleMessages } from './branches.js'
import type { Message, Session } from './types.js'

export const CHAT_SEARCH_LIMIT = 80

export const normalizeSearchText = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** 转义正则元字符后构造大小写不敏感的匹配；空串返回 null（不搜索） */
export const createChatSearchPattern = (text: string): RegExp | null => {
  const term = normalizeSearchText(text)
  return term ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu') : null
}

const messageText = (message: Message): string => {
  if (message.role === 'user') {
    return message.content
  }
  return message.blocks
    .flatMap((block) => (block.type === 'text' && !block.isTemplate ? [block.text] : []))
    .join(' ')
}

/** 截取命中位置附近的一段做摘要，前后留出上下文 */
const clipMatch = (text: string, start: number, length: number): string => {
  const from = Math.max(0, start - 28)
  const to = Math.min(text.length, Math.max(from + 115, start + length + 24))
  return `${from ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`
}

export type MessageSearchHit = {
  sessionId: string
  messageId: string
  snippet: string
  time: number
}

export type MessageSearchResult = {
  hits: MessageSearchHit[]
  limited: boolean
}

/**
 * 会话全文搜索：逐会话从 IndexedDB 读正文，命中当前分支可见消息。
 * 逐会话 await 让出主线程（UI 不冻结），onProgress 每扫完一个会话回调一次（边扫边出结果）。
 * 命中数达到 CHAT_SEARCH_LIMIT 即停止（limited 标记结果已截断）。
 */
export const searchChatMessages = async (
  ids: readonly string[],
  pattern: RegExp,
  read: (id: string) => Promise<Session | undefined>,
  signal: AbortSignal,
  onProgress?: (result: MessageSearchResult) => void
): Promise<MessageSearchResult> => {
  const hits: MessageSearchHit[] = []
  for (const id of ids) {
    signal.throwIfAborted()
    const session = await read(id).catch(() => undefined)
    signal.throwIfAborted()
    if (!session) {
      continue
    }
    const previousHitCount = hits.length
    const messages = getVisibleMessages(session)
    // 从最新往回扫：结果天然按新→旧排
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index]
      const text = normalizeSearchText(messageText(message))
      const match = pattern.exec(text)
      if (!match) {
        continue
      }
      if (hits.length === CHAT_SEARCH_LIMIT) {
        return { hits, limited: true }
      }
      hits.push({
        sessionId: id,
        messageId: message.id,
        snippet: clipMatch(text, match.index, match[0].length),
        time: message.createdAt,
      })
    }
    if (hits.length > previousHitCount) {
      onProgress?.({ hits: [...hits], limited: false })
    }
    // 每个会话之间让出到宏任务，避免大会话连续解析时输入框掉帧
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return { hits, limited: false }
}
