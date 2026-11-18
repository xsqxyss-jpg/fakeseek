import { completeMessage } from '../api/client.js'
import type { ChatModel } from '../api/types.js'
import { getContextRounds } from './reply.js'
import type { Message } from './types.js'

/**
 * 滚动摘要压缩（agent 式）：超出保留轮数的更早历史不直接丢弃，
 * 而是压成一段摘要随请求携带；摘要只在滑出窗口扩大时增量更新，平时零额外请求。
 * 摘要生成走用户自己的 API Key 与本轮同款模型；失败时降级为纯截断，不阻塞正常聊天。
 */

type SummaryState = {
  /** 已摘要覆盖到的轮次数（按 getContextRounds 的成对轮次计） */
  covered: number
  text: string
  /** 生成中标记，防止并发重复请求；失败后清除以便下轮重试 */
  pending: boolean
}

/** 会话级内存缓存：会话切换/导入后重建（重新生成一次摘要），不落盘避免动存储版本。 */
const states = new Map<string, SummaryState>()

const SUMMARY_SYSTEM =
  '你是对话历史压缩器。把给出的旧对话压缩成中文要点摘要，保留：用户的目标与偏好、已确认的事实与结论、重要决定、未完成事项。省略寒暄与冗余细节。只输出摘要正文，不要任何开场白。'

/** 单条消息压成一行；附件只留占位，思考过程不进摘要。 */
const toLine = (message: Message): string => {
  if (message.role === 'user') {
    const files = message.files.length > 0 ? `[附件×${message.files.length}] ` : ''
    return `用户: ${files}${message.content}`
  }
  const text = message.blocks
    .filter((block) => block.type === 'text' && !block.isTemplate)
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
  return `助手: ${text}`
}

const clip = (text: string, limit: number) =>
  text.length > limit ? `${text.slice(0, limit)}…` : text

/**
 * 取当前会话的历史摘要；无摘要需求或生成失败时返回 undefined。
 * dropped 为本轮被截掉的更早轮次；covered 之前的内容已在上次摘要里，只增量补新滑出的部分。
 */
export const ensureContextSummary = async (
  sessionId: string,
  history: Message[],
  droppedCount: number,
  apiKey: string,
  model: ChatModel,
  signal: AbortSignal
): Promise<string | undefined> => {
  if (droppedCount <= 0 || !apiKey) {
    return undefined
  }
  const state = states.get(sessionId) ?? { covered: 0, text: '', pending: false }
  states.set(sessionId, state)
  // 历史变短（换分支/删除/重新生成）时摘要作废重建。
  const totalRounds = getContextRounds(history).length
  if (state.covered > totalRounds) {
    state.covered = 0
    state.text = ''
  }
  if (state.covered >= droppedCount) {
    return state.text || undefined
  }
  if (state.pending) {
    // 上一次生成还在路上：本轮先用旧摘要（可能为空），不重复请求。
    return state.text || undefined
  }
  state.pending = true
  try {
    const dropped = getContextRounds(history).slice(0, droppedCount)
    const fresh = dropped
      .slice(state.covered)
      .map(([user, reply]) => `${clip(toLine(user), 1500)}\n${clip(toLine(reply), 1500)}`)
      .join('\n\n')
    const prompt = state.text
      ? `已有摘要：\n${state.text}\n\n新增对话：\n${clip(fresh, 12000)}\n\n请把新增对话合并进已有摘要，输出更新后的完整摘要（600字以内）。`
      : `对话记录：\n${clip(fresh, 12000)}\n\n请输出这段对话的要点摘要（600字以内）。`
    const text = await completeMessage(
      apiKey,
      {
        model,
        system: SUMMARY_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        thinking: { type: 'disabled' },
        tools: [],
        safety_check: { level: 'high' },
      },
      signal
    )
    if (text) {
      state.text = clip(text, 2000)
      state.covered = droppedCount
    }
    return state.text || undefined
  } catch {
    // 摘要失败不影响主对话：本轮退回纯截断，下一轮再试。
    return state.text || undefined
  } finally {
    state.pending = false
  }
}

/** 导入/清空历史后丢弃全部摘要缓存。 */
export const resetContextSummaries = () => states.clear()

/** 删除单个会话时丢弃其摘要缓存。 */
export const dropContextSummary = (sessionId: string) => states.delete(sessionId)