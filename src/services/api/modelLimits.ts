/**
 * 模型窗口预算：所有数字都来自服务端或服务端的报错，不写死任何常量当作真相。
 *
 * 两级来源：
 * 1. `GET /models` 返回的 context_window / max_output_tokens（权威，但可能为空）
 * 2. 服务端拒收「输入太长」时文案里给的上限（实测值，按模型持久化，下次直接按它预裁剪）
 *
 * 两类值都落 localStorage：窗口是账号级事实，重启 App 不该忘掉，
 * 否则每次冷启动都要先撞一次 400 才想起来窗口多大。
 */

const STORE_KEY = 'chat-demo:model-limits'

/** 服务端没给 max_output_tokens 时用的输出上限 */
const MAX_OUTPUT_FALLBACK = 8192

/**
 * 单条回复的输出上限，一律不超过这个值。
 * 模型声明的 384K 输出是「极限」，聊天用不满；而 max_tokens 会计入上下文窗口，
 * 报得越大留给输入的位置越少——实测有部署把整轮卡在 32768，报个大输出上限会直接把输入挤死。
 * 8K 输出约 6000 汉字，够任何一次正常回答。
 */
const MAX_OUTPUT_CAP = 8192

type ModelLimit = {
  /** GET /models 声明的上下文窗口 */
  contextWindow?: number
  /** GET /models 声明的输出上限 */
  maxOutputTokens?: number
  /** 服务端报过错长后记下的真实上限，优先于声明的窗口 */
  learned?: number
}

const positive = (value: unknown): number | undefined => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}

const readAll = (): Record<string, ModelLimit> => {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }
    const out: Record<string, ModelLimit> = {}
    for (const [model, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) {
        continue
      }
      const record = value as Record<string, unknown>
      const entry: ModelLimit = {}
      const window = positive(record.contextWindow)
      const output = positive(record.maxOutputTokens)
      const learned = positive(record.learned)
      if (window !== undefined) {
        entry.contextWindow = window
      }
      if (output !== undefined) {
        entry.maxOutputTokens = output
      }
      if (learned !== undefined) {
        entry.learned = learned
      }
      out[model] = entry
    }
    return out
  } catch {
    return {}
  }
}

const update = (model: string, patch: ModelLimit) => {
  if (!model) {
    return
  }
  const all = readAll()
  const merged: ModelLimit = { ...all[model], ...patch }
  all[model] = merged
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(all))
  } catch {
    // 存不下就退化成只靠本次运行内的内存值
    memory.set(model, merged)
  }
}

/** localStorage 不可用时的兜底（隐私模式等） */
const memory = new Map<string, ModelLimit>()

const entryFor = (model: string): ModelLimit => {
  const stored = readAll()[model]
  const cached = memory.get(model)
  return stored ?? cached ?? {}
}

/**
 * 从 GET /models 的原始响应里收下窗口信息。
 * 校验 Key 与刷新模型清单走的是同一个端点，谁先拿到就谁记，不必多打一次请求。
 */
export const absorbModelsPayload = (payload: unknown): void => {
  const data =
    typeof payload === 'object' && payload !== null && Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data as unknown[])
      : []
  for (const item of data) {
    if (typeof item !== 'object' || item === null) {
      continue
    }
    const record = item as { id?: unknown; context_window?: unknown; max_output_tokens?: unknown }
    if (typeof record.id !== 'string' || !record.id) {
      continue
    }
    const patch: ModelLimit = {}
    const window = positive(record.context_window)
    const output = positive(record.max_output_tokens)
    if (window !== undefined) {
      patch.contextWindow = window
    }
    if (output !== undefined) {
      patch.maxOutputTokens = output
    }
    if (Object.keys(patch).length > 0) {
      update(record.id, patch)
    }
  }
}

/** 服务端报过错长后记下真实上限：比任何内置常量都准，下次不再先撞一次 400 */
export const learnContextLimit = (model: string, limit: number) => {
  const value = positive(limit)
  // 低于 2048 的多半是文案解析踩了别的数字（request_id、错误码），别让它把窗口锁死
  if (value === undefined || value < 2048) {
    return
  }
  // 模型换代（如 32K 时代的旧报错残留 → 1M 窗口的新模型）时，旧的 learned 上限
  // 会把大窗口永久锁死成小窗口，白白预裁剪丢上下文。报错上限比 /models 声明的
  // 窗口还大才可信；更小则只作参考，不覆盖声明的窗口。
  const declared = entryFor(model).contextWindow
  if (declared !== undefined && value < declared) {
    return
  }
  update(model, { learned: value })
}

/** 当前模型的上下文预算：实测上限优先，其次 /models 的 context_window，都没有时 undefined（不预裁剪） */
export const contextBudgetFor = (model: string): number | undefined => {
  const entry = entryFor(model)
  // 旧残留防护：learned 比声明的窗口还小，多半是上一个模型代次的报错残留，
  // 此时信声明的窗口（撞墙时服务端报错会再教一次真实上限）。
  if (entry.learned !== undefined && entry.contextWindow !== undefined && entry.learned < entry.contextWindow) {
    return entry.contextWindow
  }
  return entry.learned ?? entry.contextWindow
}

/** 服务端实测放行过的窗口（learned）；没有返回 undefined，用于区分「声明容量」与「实际放行」 */
export const readLearnedLimit = (model: string): number | undefined => entryFor(model).learned

/**
 * 当前模型的输出上限。声明的 max_output_tokens 是模型的极限（flash 报 384K），
 * 聊天用不满，压到 MAX_OUTPUT_CAP；再让它只占窗口的四分之一，
 * 剩下四分之三留给输入——小窗口（32K 这类）下这点尤其重要。
 *
 * 窗口未知时不冒险：max_tokens 本身要计入窗口，窗口若是小的那种（比如 32K），
 * 报个 32K 输出上限等于一个 token 都不给输入留。此时一律用保守的兜底值。
 */
export const maxOutputFor = (model: string): number => {
  const entry = entryFor(model)
  const budget = entry.learned ?? entry.contextWindow
  if (!budget) {
    return MAX_OUTPUT_FALLBACK
  }
  const wanted = Math.min(entry.maxOutputTokens ?? MAX_OUTPUT_FALLBACK, MAX_OUTPUT_CAP)
  return Math.max(1024, Math.min(wanted, Math.floor(budget / 4)))
}

const countWide = (text: string): number => {
  let wide = 0
  for (const char of text) {
    const code = char.codePointAt(0)
    if (code !== undefined && code > 0x7f) {
      wide += 1
    }
  }
  return wide
}

/**
 * 粗估 token 数：ASCII 约 4 字符 1 token，非 ASCII（中文等）约 1 字符 1 token，
 * 每条消息再加少量结构开销。只用于「按预算提前裁剪」，偏差靠 20% 余量吸收。
 */
export const estimateTokens = (text: string): number => {
  const wide = countWide(text)
  const narrow = text.length - wide
  return Math.ceil(narrow / 4) + wide + 8
}
