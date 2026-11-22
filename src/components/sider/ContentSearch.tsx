import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import * as db from '../../services/chat/db.js'
import {
  CHAT_SEARCH_LIMIT,
  createChatSearchPattern,
  normalizeSearchText,
  searchChatMessages,
  type MessageSearchHit,
} from '../../services/chat/search.js'
import { selectSession, useChatStore } from '../../services/chat/store.js'
import { IconSearchOutline16 } from '../base/icons.js'
import styles from './Sider.module.css'

const hitTime = (value: number): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const sameYear = date.getFullYear() === new Date().getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return sameYear ? `${month}-${day} ${time}` : `${date.getFullYear()}-${month}-${day}`
}

/**
 * 会话全文搜索结果列表：输入防抖 300ms 后逐会话扫正文（IndexedDB），
 * 边扫边出结果；每条显示命中会话标题 + 摘要片段（关键词高亮）+ 时间。
 * 点击结果：切到该会话并滚动定位到命中消息（data-message-id 锚点）。
 */
export const ContentSearchResults = ({
  query,
  titleHitIds,
  onOpenSession,
}: {
  query: string
  /** 标题已命中的会话：内容搜索跳过它们，避免同一会话重复出现 */
  titleHitIds: Set<string> | null
  onOpenSession: () => void
}) => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const [hits, setHits] = useState<MessageSearchHit[]>([])
  const [scanning, setScanning] = useState(false)
  const [limited, setLimited] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const resultRefs = useRef(new Map<string, HTMLElement>())

  const pattern = useMemo(() => createChatSearchPattern(query), [query])

  useEffect(() => {
    if (!pattern) {
      setHits([])
      setLimited(false)
      setScanning(false)
      return
    }
    const controller = new AbortController()
    setScanning(true)
    setHits([])
    setLimited(false)
    const timer = setTimeout(() => {
      const ids = useChatStore
        .getState()
        .sessions.filter((session) => !(titleHitIds?.has(session.id) ?? false))
        .map((session) => session.id)
      void searchChatMessages(ids, pattern, db.loadSession, controller.signal, (result) => {
        setHits(result.hits)
      })
        .then((result) => {
          if (controller.signal.aborted) {
            return
          }
          setHits(result.hits)
          setLimited(result.limited)
          setScanning(false)
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setScanning(false)
          }
        })
    }, 300)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [pattern, titleHitIds])

  /** 点击结果：切会话 → 等消息渲染 → 滚动到命中消息并短暂高亮 */
  const openHit = (hit: MessageSearchHit) => {
    selectSession(hit.sessionId)
    setActiveId(hit.messageId)
    onOpenSession()
    setTimeout(() => {
      const el = resultRefs.current.get(hit.messageId)
      const root = document.querySelector<HTMLElement>('[data-chat-scroll]')
      if (el && root) {
        root.scrollTop +=
          el.getBoundingClientRect().top - root.getBoundingClientRect().top - 80
      }
    }, 120)
  }

  /** 消息正文里给关键词包高亮（snippet 是纯文本切片） */
  const highlight = (snippet: string): React.ReactNode => {
    if (!pattern) {
      return snippet
    }
    const parts: React.ReactNode[] = []
    let last = 0
    const escaped = normalizeSearchText(snippet)
    const re = new RegExp(pattern.source, 'iu')
    let match: RegExpExecArray | null
    let key = 0
    while ((match = re.exec(escaped)) !== null) {
      parts.push(escaped.slice(last, match.index))
      parts.push(
        <mark key={key++} className={styles.searchHitMark}>
          {match[0]}
        </mark>
      )
      last = match.index + match[0].length
      if (match[0].length === 0) {
        break
      }
    }
    parts.push(escaped.slice(last))
    return parts
  }

  const sessionTitle = (id: string) =>
    sessions.find((session) => session.id === id)?.title || t('untitledChat')

  // 命中消息渲染出来后挂到 resultRefs，供跳转定位（活跃命中短暂高亮）
  useEffect(() => {
    if (!activeId) {
      return undefined
    }
    const el = document.querySelector(`[data-message-id="${CSS.escape(activeId)}"]`)
    if (!el) {
      return undefined
    }
    resultRefs.current.set(activeId, el as HTMLElement)
    el.classList.add('search-hit-flash')
    const timer = setTimeout(() => el.classList.remove('search-hit-flash'), 1600)
    return () => clearTimeout(timer)
  }, [activeId, sessions])

  if (!pattern) {
    return null
  }

  return (
    <div className={styles.contentSearch}>
      <div className={styles.contentSearchHeader}>
        <IconSearchOutline16 />
        <span>
          {scanning
            ? t('siderContentSearching')
            : hits.length === 0
              ? t('siderContentSearchEmpty')
              : t('siderContentSearchCount', { count: String(hits.length) })}
          {limited ? ` · ${t('siderContentSearchLimited', { limit: String(CHAT_SEARCH_LIMIT) })}` : ''}
        </span>
      </div>
      {hits.map((hit) => (
        <button
          key={`${hit.sessionId}:${hit.messageId}`}
          type="button"
          className={clsx(styles.contentSearchItem, activeId === hit.messageId && styles.searchHitActive)}
          onClick={() => openHit(hit)}
        >
          <span className={styles.contentSearchTitle}>{sessionTitle(hit.sessionId)}</span>
          <span className={styles.contentSearchSnippet}>{highlight(hit.snippet)}</span>
          <span className={styles.contentSearchTime}>{hitTime(hit.time)}</span>
        </button>
      ))}
    </div>
  )
}
