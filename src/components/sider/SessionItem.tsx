import clsx from 'clsx'
import { memo, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconEditOutline16, IconEllipsisOutline16, IconTrashOutline16 } from '../base/icons.js'
import { IconPinOutline14 } from '../base/iconsExtra.js'
import { renameSession, selectSession } from '../../services/chat/store.js'
import { togglePinned } from '../../services/chat/pins.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { IconButton } from '../base/IconButton.js'
import { Menu } from '../base/Menu.js'
import { closeMobileSider } from './mobileSiderState.js'
import styles from './SessionItem.module.css'

export const SessionItem = memo(function SessionItem({
  session,
  active,
  pinned = false,
  onLongPress,
  onDelete,
}: {
  session: SessionSummary
  active: boolean
  pinned?: boolean
  /** 长按进入「选择对话」整页 */
  onLongPress?: () => void
  onDelete: () => void
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  const displayTitle = session.title || t('untitledChat')

  if (editing) {
    const finish = (title: string) => {
      setEditing(false)
      if (title.trim() && title.trim() !== displayTitle) {
        renameSession(session.id, title.trim())
      }
    }
    return (
      <input
        className={styles.renameInput}
        defaultValue={displayTitle}
        autoFocus
        onFocus={(event) => event.target.select()}
        onBlur={(event) => finish(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            finish(event.currentTarget.value)
          } else if (event.key === 'Escape') {
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <div
      className={clsx(styles.item, active && styles.active)}
      onClick={() => {
        selectSession(session.id)
        closeMobileSider()
      }}
      // 长按进入「选择对话」整页（官方手势）：400ms 触发
      onTouchStart={(event) => {
        if (!onLongPress) {
          return
        }
        const timer = setTimeout(onLongPress, 400)
        const clear = () => {
          clearTimeout(timer)
          event.currentTarget.removeEventListener('touchend', clear)
          event.currentTarget.removeEventListener('touchmove', clear)
          event.currentTarget.removeEventListener('touchcancel', clear)
        }
        event.currentTarget.addEventListener('touchend', clear)
        event.currentTarget.addEventListener('touchmove', clear)
        event.currentTarget.addEventListener('touchcancel', clear)
      }}
    >
      <div className={styles.title}>{displayTitle}</div>
      {pinned ? (
        <span className={styles.pinMark} aria-label={t('siderPinned')}>
          <IconPinOutline14 />
        </span>
      ) : null}
      <div
        className={styles.action}
        onClick={(event) => event.stopPropagation()}
        // 触屏下只有当前会话行显示操作入口，与官方列表一致
        aria-hidden={!active}
      >
        <Menu
          options={[
            {
              key: 'pin',
              label: t(pinned ? 'siderUnpin' : 'siderPin'),
              icon: <IconPinOutline14 />,
              onSelect: () => togglePinned(session.id),
            },
            {
              key: 'rename',
              label: t('sessionItemMenuRenameOption'),
              icon: <IconEditOutline16 />,
              onSelect: () => setEditing(true),
            },
            {
              key: 'delete',
              label: t('delete'),
              icon: <IconTrashOutline16 />,
              danger: true,
              onSelect: onDelete,
            },
          ]}
        >
          {({ toggle }) => (
            <IconButton icon={<IconEllipsisOutline16 />} aria-label={t('more')} onClick={toggle} />
          )}
        </Menu>
      </div>
    </div>
  )
})