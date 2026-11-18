import { API_ORIGIN, request } from './client.js'

/**
 * 模型清单：GET /models（不产生费用，与 Key 校验同一端点）。
 * 缓存 7 天，避免每次开面板都请求；失败或无 Key 时回落到内置两项。
 */
export type ModelOption = {
  id: string
  /** 展示名；接口没给就用人读化的 id */
  label: string
  /** 是否是内置兜底项（列表来自缓存/内置时用于提示） */
  builtin?: boolean
}

const CACHE_KEY = 'chat-demo:models-cache'
const CACHE_TTL = 7 * 24 * 3600 * 1000

/** 内置兜底：接口不可用时仍能选（id 与 anthropic 端点一致） */
export const BUILTIN_MODELS: ModelOption[] = [
  { id: 'deepseek-flash', label: 'DeepSeek Flash（快）', builtin: true },
  { id: 'deepseek-v4-pro', label: 'DeepSeek Pro（强）', builtin: true },
]

const humanize = (id: string) =>
  id
    .replace(/^deepseek-/, 'DeepSeek ')
    .replace(/-/g, ' ')
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())

type Cached = { at: number; models: ModelOption[] }

const readCache = (): Cached | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Cached
    if (!Array.isArray(parsed?.models) || typeof parsed?.at !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const writeCache = (models: ModelOption[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), models }))
  } catch {
    // 存不下就只在本次运行内生效
  }
}

/** 已缓存的模型（可能为空，调用方需回落） */
export const cachedModels = (): ModelOption[] => {
  const cache = readCache()
  return cache && Date.now() - cache.at < CACHE_TTL ? cache.models : []
}

/** 拉取模型清单；force 时忽略缓存。失败抛错由调用方回落。 */
export const fetchModels = async (apiKey: string, force = false): Promise<ModelOption[]> => {
  if (!force) {
    const cached = cachedModels()
    if (cached.length > 0) {
      return cached
    }
  }
  const response = await request(`${API_ORIGIN}/models`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const payload: unknown = await response.json().catch(() => null)
  const data =
    typeof payload === 'object' && payload !== null && Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data as unknown[])
      : []
  const models: ModelOption[] = []
  for (const item of data) {
    if (typeof item !== 'object' || item === null) {
      continue
    }
    const id = (item as { id?: unknown }).id
    if (typeof id !== 'string' || !id) {
      continue
    }
    models.push({ id, label: humanize(id) })
  }
  if (models.length > 0) {
    writeCache(models)
  }
  return models
}
