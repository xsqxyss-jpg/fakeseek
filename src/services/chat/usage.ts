import { create } from 'zustand'

/**
 * 本地用量统计（零网络）：从每条回复的 usage 累计输入/输出 token 与缓存命中。
 * 数据只存内存 + localStorage，不上报任何地方；命中率 = 命中 / (命中 + 未命中)。
 */
export type UsageTotals = {
  /** 累计缓存命中的输入 token */
  cacheHit: number
  /** 累计未命中的输入 token */
  cacheMiss: number
  /** 累计输出 token */
  output: number
  /** 累计请求轮数（每条完成的回复算一次） */
  requests: number
}

const EMPTY: UsageTotals = { cacheHit: 0, cacheMiss: 0, output: 0, requests: 0 }
const KEY = 'chat-demo:usage-totals'

const read = (): UsageTotals => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return EMPTY
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return EMPTY
    }
    const p = parsed as Partial<UsageTotals>
    return {
      cacheHit: Number(p.cacheHit) || 0,
      cacheMiss: Number(p.cacheMiss) || 0,
      output: Number(p.output) || 0,
      requests: Number(p.requests) || 0,
    }
  } catch {
    return EMPTY
  }
}

export const useUsage = create<UsageTotals>(() => read())

/**
 * 记一轮用量。同一条回复重复落盘时用 messageId 去重（续写/重发会更新同一 id 的 usage）。
 */
const recorded = new Map<string, UsageTotals>()

export const recordUsage = (
  messageId: string,
  usage: { input: number; cacheRead: number; cacheCreation: number; output: number }
) => {
  const next: UsageTotals = {
    cacheHit: usage.cacheRead || 0,
    cacheMiss: usage.cacheCreation || usage.input || 0,
    output: usage.output || 0,
    requests: 1,
  }
  const previous = recorded.get(messageId)
  recorded.set(messageId, next)
  const totals = useUsage.getState()
  // 同一回复的多次落盘只补差值，避免重复累加。
  const delta: UsageTotals = previous
    ? {
        cacheHit: next.cacheHit - previous.cacheHit,
        cacheMiss: next.cacheMiss - previous.cacheMiss,
        output: next.output - previous.output,
        requests: 0,
      }
    : next
  const merged: UsageTotals = {
    cacheHit: Math.max(0, totals.cacheHit + delta.cacheHit),
    cacheMiss: Math.max(0, totals.cacheMiss + delta.cacheMiss),
    output: Math.max(0, totals.output + delta.output),
    requests: Math.max(0, totals.requests + delta.requests),
  }
  useUsage.setState(merged)
  try {
    localStorage.setItem(KEY, JSON.stringify(merged))
  } catch {
    // 存储不可用时只在内存累计
  }
}

/** 缓存命中率（0-1）；没有数据时为 null，界面显示「—」 */
export const hitRate = (totals: UsageTotals): number | null => {
  const input = totals.cacheHit + totals.cacheMiss
  return input > 0 ? totals.cacheHit / input : null
}

/** 重置累计（设置里提供，方便换 Key 后重新统计） */
export const resetUsage = () => {
  recorded.clear()
  useUsage.setState(EMPTY)
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 忽略
  }
}
