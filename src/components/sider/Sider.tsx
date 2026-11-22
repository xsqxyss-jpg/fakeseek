import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCheckOutline16,
  IconCloseOutline16,
  IconEllipsisOutline16,
  IconPanelLeftOutline16,
  IconSearchOutline16,
  IconTrashOutline16,
} from '../base/icons.js'
import { IconAccountOutline20, IconPinOutline14, IconSortOutline16 } from '../base/iconsExtra.js'
import { setSiderCollapsed, useSettings } from '../../services/settings.js'
import { groupSessions } from '../../services/chat/sessionGroups.js'
import * as db from '../../services/chat/db.js'
import { removeSession, useChatStore } from '../../services/chat/store.js'
import { togglePinned, unpinSessions, usePinned } from '../../services/chat/pins.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import {
  closeMobileSider,
  setSiderSearchMode,
  setSiderSelectMode,
  useMobileSider,
} from './mobileSiderState.js'
import { SessionItem } from './SessionItem.js'
import { ContentSearchResults } from './ContentSearch.js'
import styles from './Sider.module.css'

/** Key 掩码显示：sk-abcd…wxyz；没有 Key 时提示去配置 */
const maskKey = (key: string) =>
  key.length <= 10 ? `${key.slice(0, 3)}****` : `${key.slice(0, 6)}****${key.slice(-4)}`

/** 展开的侧边栏（官方 App 风格）：搜索框、按时间分组的纯文字会话列表、底部账号行；移动端放抽屉 */
export const Sider = ({ mobile = false }: { mobile?: boolean }) => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const apiKey = useSettings((state) => state.apiKey)
  const userAvatar = useSettings((state) => state.userAvatar)
  const nickname = useSettings((state) => state.nickname)
  const locale = useSettings((state) => state.locale)
  const [query, setQuery] = useState('')
  /** 内容搜索命中的会话 id；null = 未在搜索。标题匹配即时，内容匹配异步补充。 */
  const [contentHits, setContentHits] = useState<Set<string> | null>(null)
  /** 搜索整页展开态：官方点搜索框后整页铺满，顶部输入 + 结果列表 */
  const searchMode = useMobileSider((state) => state.searchMode)
  /** 多选页：官方是独立一整页盖在侧栏上，不是列表里就地多选 */
  const selectMode = useMobileSider((state) => state.selectMode)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const pinnedIds = usePinned((state) => state.ids)
  const [now, setNow] = useState(Date.now)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return sessions
    }
    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(q) || (contentHits?.has(session.id) ?? false)
    )
  }, [sessions, query, contentHits])

  /** 置顶优先：置顶会话单独排最前，其余按时间分组 */
  const ordered = useMemo(() => {
    if (pinnedIds.length === 0) {
      return filtered
    }
    const pinnedSet = new Set(pinnedIds)
    return [
      ...filtered.filter((session) => pinnedSet.has(session.id)),
      ...filtered.filter((session) => !pinnedSet.has(session.id)),
    ]
  }, [filtered, pinnedIds])

  const groups = useMemo(() => {
    const raw = groupSessions(ordered, now, t)
    // 官方分组写「2025年2月」而不是「2025-02」：把纯月份 key 换成可读文案
    return raw.map((group) => {
      const match = /^(\d{4})-(\d{2})$/.exec(group.key)
      if (!match) {
        return group
      }
      const [, year, month] = match
      return {
        ...group,
        label:
          locale === 'zh-CN'
            ? `${year}年${Number(month)}月`
            : new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }).format(
                new Date(Number(year), Number(month) - 1, 1)
              ),
      }
    })
  }, [ordered, now, t, locale])

  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  // 内容搜索：逐会话读取正文匹配（本机 IndexedDB，量小），输入防抖 300ms。
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      setContentHits(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const hits = new Set<string>()
        for (const summary of useChatStore.getState().sessions) {
          if (cancelled) {
            return
          }
          if (summary.title.toLowerCase().includes(q)) {
            continue
          }
          const session = await db.loadSession(summary.id)
          if (
            session?.messages.some((message) =>
              message.role === 'user'
                ? message.content.toLowerCase().includes(q)
                : message.blocks.some(
                    (block) => block.type === 'text' && block.text.toLowerCase().includes(q)
                  )
            )
          ) {
            hits.add(summary.id)
          }
        }
        if (!cancelled) {
          setContentHits(hits)
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const allIds = groups.flatMap((group) => group.sessions.map((session) => session.id))
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  const openSelectMode = () => {
    setSelected(new Set())
    setSiderSelectMode(true)
  }

  return (
    <div
      className={clsx(styles.sider, mobile && styles.mobile, searchMode && styles.searchFull)}
    >
      <div className={styles.searchRow}>
        {searchMode ? (
          <IconButton
            size="m"
            icon={<IconCloseOutline16 />}
            aria-label={t('siderExitSearch')}
            onClick={() => {
              setSiderSearchMode(false)
              setQuery('')
            }}
          />
        ) : null}
        <div className={styles.searchBox}>
          <IconSearchOutline16 />
          <input
            className={styles.searchInput}
            type="search"
            placeholder={t('siderSearchPlaceholder')}
            value={query}
            onFocus={() => setSiderSearchMode(true)}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {/* 官方抽屉内没有收起按钮：移动端点抽屉外露出的一截收起，桌面端保留收起钮 */}
        {mobile || searchMode ? null : (
          <IconButton
            size="m"
            icon={<IconPanelLeftOutline16 />}
            tooltip={t('collapseSiderbarButton')}
            tooltipPlacement="bottom"
            onClick={() => setSiderCollapsed(true)}
          />
        )}
      </div>
      <div className={styles.listWrap}>
        <div className={styles.list}>
          {groups.map((group, index) => (
            <div key={group.key} className={styles.section}>
              <div className={styles.sectionHeader}>
                <span>{group.label}</span>
                {/* 官方：分组标题右侧的图标点进去是「选择对话」整页，不是就地多选 */}
                {index === 0 ? (
                  <button
                    type="button"
                    className={styles.sectionSort}
                    aria-label={t('siderMultiSelect')}
                    onClick={openSelectMode}
                  >
                    <IconSortOutline16 />
                  </button>
                ) : null}
              </div>
              {group.sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  active={session.id === activeId}
                  pinned={pinnedIds.includes(session.id)}
                  onLongPress={openSelectMode}
                  onDelete={() => setDeleting(session)}
                />
              ))}
            </div>
          ))}
          {query.trim() && groups.length === 0 ? (
            <div className={styles.searchEmpty}>{t('siderSearchEmpty')}</div>
          ) : null}
          {/* 内容搜索结果：标题搜索已把匹配会话列在上面，这里只列正文命中（含摘要与跳转） */}
          {query.trim() ? (
            <ContentSearchResults
              query={query}
              titleHitIds={contentHits === null ? null : new Set(
                sessions
                  .filter((session) => session.title.toLowerCase().includes(query.trim().toLowerCase()))
                  .map((session) => session.id)
              )}
              onOpenSession={closeMobileSider}
            />
          ) : null}
        </div>
      </div>
      <div className={styles.bottom}>
        <button
          type="button"
          className={styles.account}
          onClick={() => {
            openSettings('general')
            closeMobileSider()
          }}
        >
          <span className={styles.accountAvatar}>
            {userAvatar ? <img src={userAvatar} alt="" /> : <IconAccountOutline20 />}
          </span>
          <span className={styles.accountName}>
            {nickname ?? (apiKey ? maskKey(apiKey) : t('settingsAccountUnset'))}
          </span>
          <span className={styles.accountMore}>
            <IconEllipsisOutline16 />
          </span>
        </button>
      </div>
      {/* 官方「选择对话」：独立一整页盖在侧栏之上 */}
      {selectMode ? (
        <div className={styles.selectPage}>
          <div className={styles.selectHeader}>
            <span className={styles.selectTitle}>{t('siderSelectTitle')}</span>
            <button
              type="button"
              className={styles.selectAll}
              onClick={() => setSelected(allSelected ? new Set() : new Set(allIds))}
            >
              {allSelected ? t('siderSelectNone') : t('siderSelectAll')}
            </button>
            <button
              type="button"
              className={styles.selectClose}
              aria-label={t('siderExitMultiSelect')}
              onClick={() => {
                setSiderSelectMode(false)
                setSelected(new Set())
              }}
            >
              <IconCloseOutline16 />
            </button>
          </div>
          <div className={styles.selectList}>
            {groups.map((group) => (
              <div key={group.key} className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span>{group.label}</span>
                </div>
                {group.sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={styles.selectRow}
                    aria-pressed={selected.has(session.id)}
                    onClick={() => toggleSelect(session.id)}
                  >
                    <span
                      className={clsx(styles.check, selected.has(session.id) && styles.checkOn)}
                    >
                      {selected.has(session.id) ? <IconCheckOutline16 /> : null}
                    </span>
                    <span className={styles.selectRowTitle}>
                      {session.title || t('untitledChat')}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className={styles.selectBar}>
            <button
              type="button"
              className={styles.selectAction}
              disabled={selected.size === 0}
              onClick={() => {
                const ids = [...selected]
                const anyUnpinned = ids.some((id) => !pinnedIds.includes(id))
                if (anyUnpinned) {
                  ids.filter((id) => !pinnedIds.includes(id)).forEach(togglePinned)
                } else {
                  ids.forEach(togglePinned)
                }
                setSiderSelectMode(false)
                setSelected(new Set())
              }}
            >
              <IconPinOutline14 />
              {t('siderPin')}
            </button>
            <button
              type="button"
              className={clsx(styles.selectAction, styles.selectDanger)}
              disabled={selected.size === 0}
              onClick={async () => {
                const ids = [...selected]
                setSiderSelectMode(false)
                setSelected(new Set())
                for (const id of ids) {
                  await removeSession(id)
                }
                unpinSessions(ids)
              }}
            >
              <IconTrashOutline16 />
              {t('delete')}
            </button>
          </div>
        </div>
      ) : null}
      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (!deletePending) {
              setDeleting(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={deletePending} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true)
                  try {
                    if (await removeSession(deleting.id)) {
                      setDeleting(null)
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeletePending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionWithFilesDescription')}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉：侧栏垫在底层，主界面整体右移盖在上面（官方层级），点右侧露出的一截收起。 */
export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  if (!open) {
    return null
  }
  return (
    <>
      <div className={styles.mobilePanel}>
        <Sider mobile />
      </div>
      <div className={styles.drawerMask} onClick={closeMobileSider} />
    </>
  )
}
