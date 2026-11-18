import clsx from 'clsx'
import { useSettings } from '../../services/settings.js'
import styles from './Avatar.module.css'

/** 消息头像：优先显示设置里上传的自定义图片，未设置时用默认字母。装饰性元素，对屏幕阅读器隐藏。 */
export function Avatar({ role }: { role: 'user' | 'assistant' }) {
  const isUser = role === 'user'
  const custom = useSettings((state) => (isUser ? state.userAvatar : state.assistantAvatar))
  return (
    <div
      className={clsx(styles.avatar, isUser ? styles.user : styles.assistant)}
      aria-hidden="true"
    >
      {custom ? <img className={styles.image} src={custom} alt="" /> : isUser ? '你' : 'D'}
    </div>
  )
}