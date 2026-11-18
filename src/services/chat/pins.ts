import { create } from 'zustand'

/**
 * 会话置顶（存 localStorage，不动 IndexedDB 结构，避免数据库版本迁移风险）。
 * 置顶的会话在列表中排在最前，且不受聊天更新时间影响。
 */
const KEY = 'chat-demo:pinned-sessions'

const read = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

const write = (ids: string[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // 存储不可用时只在内存生效
  }
}

export const usePinned = create<{ ids: string[] }>(() => ({ ids: read() }))

export const isPinned = (id: string) => usePinned.getState().ids.includes(id)

export const togglePinned = (id: string) => {
  const current = usePinned.getState().ids
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  usePinned.setState({ ids: next })
  write(next)
}

export const unpinSessions = (ids: string[]) => {
  if (ids.length === 0) {
    return
  }
  const drop = new Set(ids)
  const next = usePinned.getState().ids.filter((id) => !drop.has(id))
  usePinned.setState({ ids: next })
  write(next)
}