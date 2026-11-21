import { ApiError } from './client.js'

/**
 * 接口失败的统一分类。各调用方按自己的场景给同一种情况配不同文案，
 * 例如余额不足在回答、上传、朗读里措辞不同，所以这里只归类，不生成文案。
 */
export type ApiErrorCondition =
  | 'unauthorized'
  | 'insufficientBalance'
  | 'tooLarge'
  | 'rateLimited'
  | 'serverBusy'
  | 'network'
  | 'other'

/** 按 HTTP 状态码归类；没有状态码（请求没到达服务端）时按网络问题处理 */
export const classifyStatus = (status: number | undefined): ApiErrorCondition => {
  if (status === 401) {
    return 'unauthorized'
  }
  if (status === 402) {
    return 'insufficientBalance'
  }
  if (status === 413) {
    return 'tooLarge'
  }
  if (status === 429) {
    return 'rateLimited'
  }
  if ((status ?? 0) >= 500) {
    return 'serverBusy'
  }
  return 'other'
}

export const classifyApiError = (error: unknown): ApiErrorCondition => {
  if (!(error instanceof ApiError)) {
    return 'other'
  }
  if (error.status === undefined) {
    return error.kind === 'network' ? 'network' : 'other'
  }
  return classifyStatus(error.status)
}

/** 重试可能成功的情况：网络、限流、服务端繁忙；参数或鉴权类错误重试无用 */
export const isRetryableApiError = (error: unknown): boolean => {
  const condition = classifyApiError(error)
  return (
    !(error instanceof ApiError) ||
    condition === 'network' ||
    condition === 'rateLimited' ||
    condition === 'serverBusy'
  )
}

/** 服务端判定附件失效的情况：本地有原件时重新上传即可自愈 */
export type FileErrorCode = 'fileIdMissing' | 'fileDataMissing' | 'invalidFileId'

/** 400 只带 message 文本，按文案前缀区分；顺序无关，互不重叠 */
const FILE_ERROR_PATTERNS: ReadonlyArray<readonly [FileErrorCode, RegExp]> = [
  ['fileIdMissing', /file_ids do not exist or are not created under your account/i],
  ['fileDataMissing', /file data not found for file_id/i],
  ['invalidFileId', /\.source\.file_id: invalid file_id/i],
]

/**
 * 只识别「附件 file_id 失效」这一类 400：服务端查不到文件、文件数据丢失、file_id 格式非法。
 * 其余错误（限流、余额、purpose 不合规等）不在这里处理，保持原有失败提示。
 */
export const getFileErrorCode = (error: unknown): FileErrorCode | null => {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return null
  }
  return FILE_ERROR_PATTERNS.find(([, pattern]) => pattern.test(error.message))?.[0] ?? null
}

/** 从报错文案里取出服务端 file_id，用于只重置真正失效的附件 */
export const extractFileIds = (message: string): string[] => [
  ...new Set(message.match(/file-api-[\w-]+/g) ?? []),
]

/** 上传失败里能识别出具体原因的情况；其余统一按「上传失败」处理 */
export type UploadErrorCode = 'fileCountLimit' | 'storageLimit' | 'parseFailed'

export type UploadErrorInfo = { code: UploadErrorCode; limit?: string }

/** 服务端无法解析文件内容：图片损坏或尺寸过大、格式不受支持、加密、文档解析失败 */
const PARSE_FAILED_PATTERNS = [
  /You have uploaded an (unsupported|invalid) (file|image)/i,
  /The image is too large to process/i,
  /password-protected/i,
  /Failed to recognize the file/i,
]

/**
 * 服务端拒绝消息里某张图片的内容（格式不受支持、损坏、尺寸超限）：
 * file_id 本身有效，重传同一份字节也救不回来，只能把这张图从请求里摘掉。
 * 两类文案都要认：格式/损坏类「You have uploaded an unsupported/invalid image」、
 * 尺寸超限类「The image is too large to process」（单边 >4096px，多来自旧版本
 * 上传的历史大图或超限动图）。漏认任何一类，自动摘图重发路径都不会触发，
 * 用户会永远卡在同一条 messages.N.content.M 报错上。
 * 与 getFileErrorCode 的 file_id 失效区分开。
 */
export const isImageRejectedError = (error: unknown): boolean => {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return false
  }
  return (
    /You have uploaded an (unsupported|invalid) (file|image)/i.test(error.message) ||
    /The image is too large to process/i.test(error.message)
  )
}

/** 上下文超长：服务端拒绝整轮请求，必须裁剪历史后重发 */
export type ContextOverflow = {
  /** 本次请求的 token 数；文案里没有时为空 */
  tokens?: number
  /** 服务端允许的上限；这是当前部署的真实窗口，比任何内置常量都准 */
  limit?: number
}

const OVERFLOW_PATTERNS = [
  /(?:input|prompt)\s+(?:is\s+)?too\s+long/i,
  /exceeds?\s+(?:the\s+)?(?:maximum|max)\s+(?:context|prompt|input)?\s*(?:length|tokens?)/i,
  /context[_\s]length[_\s]exceeded/i,
  /maximum\s+context\s+length/i,
]

/**
 * 识别「历史太长，整轮被拒」的 400。不同网关文案差异很大：
 * 官方是 prompt is too long，自建/中转常见 "user input too long, 248783 tokens exceeds max 32768 tokens"。
 * 命中后由调用方裁剪历史重发，并把上限记下来，避免每次都在同一条报错上撞墙。
 */
/** 取「上限」数值：贴着 max / maximum / limit 关键字的那一个，比按大小猜可靠 */
const LIMIT_PATTERNS = [
  /(?:max|maximum|limit)\s*(?:context\s*length\s*)?(?:is|:|=)?\s*(\d{3,9})/i,
  /(\d{3,9})\s*(?:tokens?\s*)?(?:maximum|max|limit)\b/i,
]

/** 取「实际 token 数」：优先贴着 resulted in / actual 的那一个，其次第一个 "N tokens" */
const TOKENS_PATTERNS = [
  /(?:resulted\s+in|actual(?:ly)?|got|input\s+(?:is|has|contains))\s*[:=]?\s*(\d{3,9})/i,
  /(\d{3,9})\s*tokens?\b/i,
]

const pick = (body: string, patterns: RegExp[]): number | undefined => {
  for (const pattern of patterns) {
    const matched = pattern.exec(body)
    if (matched) {
      return Number(matched[1])
    }
  }
  return undefined
}

export const getContextOverflow = (error: unknown): ContextOverflow | null => {
  if (!(error instanceof ApiError)) {
    return null
  }
  // HTTP 400 = 服务端入口层拒收；status 未定义 = SSE 流内 error 事件（HTTP 200 +
  // 流内报错，中转网关与官方部分场景如此）。后者此前被漏掉，原始报错直接怼给用户。
  if (error.status !== 400 && error.status !== undefined) {
    return null
  }
  const { message } = error
  if (!OVERFLOW_PATTERNS.some((pattern) => pattern.test(message))) {
    return null
  }
  // 先把 request_id 摘掉，避免里面的数字被当成 token 数
  const body = message.replace(/\(request_id:[\s\S]*?\)/gi, '')
  let limit = pick(body, LIMIT_PATTERNS)
  let tokens = pick(body, TOKENS_PATTERNS)
  if (limit === undefined && tokens === undefined) {
    // 文案里没有关键字：按「小的当下限、大的当实际」兜底
    const numbers = [...body.matchAll(/\b(\d{3,9})\b/g)].map((item) => Number(item[1]))
    if (numbers.length >= 2) {
      const sorted = [...numbers].sort((a, b) => a - b)
      limit = sorted[0]
      tokens = sorted[sorted.length - 1]
    } else if (numbers.length === 1) {
      limit = numbers[0]
    }
  }
  return { tokens, limit }
}

/** 报错点名的位置：请求 messages 数组的下标，以及该消息 content 数组的下标 */
export type RejectedImagePath = { messageIndex: number; blockIndex: number }

/**
 * 从报错文案里取出被拒图片的位置。服务端格式为 `messages.<消息下标>.content.<块下标>: ...`，
 * 拿到位置就能定位到具体哪张图，只摘掉那一张，不动其余历史图片。
 * 文案里没有位置时返回 null，调用方不做自动跳过。
 */
export const getRejectedImagePath = (error: unknown): RejectedImagePath | null => {
  if (!isImageRejectedError(error)) {
    return null
  }
  const matched = /messages\.(\d+)\.content\.(\d+)/.exec((error as ApiError).message)
  if (!matched) {
    return null
  }
  return { messageIndex: Number(matched[1]), blockIndex: Number(matched[2]) }
}

/**
 * 识别 Files API 上传的 400。配额类文案带上限数值，单个 Key 与账号合计（across all sub keys）共用同一提示。
 */
export const getUploadErrorInfo = (error: unknown): UploadErrorInfo | null => {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return null
  }
  const { message } = error
  const count = /User file count limit exceeded.*?limit (\d+)/i.exec(message)
  if (count) {
    return { code: 'fileCountLimit', limit: count[1] }
  }
  const storage = /User storage quota exceeded.*?limit ([\d.]+) GB/i.exec(message)
  if (storage) {
    return { code: 'storageLimit', limit: storage[1] }
  }
  if (PARSE_FAILED_PATTERNS.some((pattern) => pattern.test(message))) {
    return { code: 'parseFailed' }
  }
  return null
}
