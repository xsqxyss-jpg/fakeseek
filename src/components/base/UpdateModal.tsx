import { useState } from 'react'
import { Button } from './Button.js'
import { Modal } from './Modal.js'
import { useTranslate } from '../../i18n/index.js'
import {
  checkForUpdate,
  startDownloadAndInstall,
  useUpdateStore,
} from '../../services/update.js'

/**
 * 发现新版本弹窗：标题=新版本号，正文=version.json 的 notes 更新说明，双按钮（立即更新 / 下次再说）。
 * 启动自动检查命中与关于页手动检查命中共用这一个弹窗。
 */
export const UpdateModal = () => {
  const t = useTranslate()
  // 订阅 store：启动静默检查命中时（Modal 尚未挂载/已挂载均可）实时弹出
  const info = useUpdateStore((state) => state.available)
  const setAvailable = useUpdateStore((state) => state.setAvailable)
  const [busy, setBusy] = useState(false)
  // 应用内下载进度（0-100；null=未在下载）
  const [progress, setProgress] = useState<number | null>(null)

  if (!info) {
    return null
  }

  const close = () => setAvailable(null)

  const install = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    setProgress(0)
    try {
      await startDownloadAndInstall(info, (pct) => setProgress(pct))
    } finally {
      setBusy(false)
      setProgress(null)
      close()
    }
  }

  return (
    <Modal
      title={t('updateAvailableTitle', { version: info.version })}
      onClose={busy ? undefined : close}
      footer={
        <>
          <Button variant="outlined" size="m" disabled={busy} onClick={close}>
            {t('updateLater')}
          </Button>
          <Button size="m" disabled={busy} onClick={() => void install()}>
            {progress != null ? `${t('updateDownloading')} ${progress}%` : t('updateNow')}
          </Button>
        </>
      }
    >
      <div className="update-notes">
        {info.notes
          ? info.notes.split('\n').map((line: string, index: number) => (
              <p key={index} style={{ margin: '0 0 8px', lineHeight: 1.6, fontSize: 14 }}>
                {line}
              </p>
            ))
          : <p style={{ margin: 0, fontSize: 14 }}>{t('updateNoNotes')}</p>}
        {progress != null ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.25)', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', borderRadius: 3, background: 'var(--t3-accent, #4a8dff)', transition: 'width 0.25s ease' }} />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.65, textAlign: 'center' }}>
              {t('updateDownloading')} {progress}%
            </p>
          </div>
        ) : null}
        {info.repoUrl ? (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(128,128,128,0.25)' }}>
            <a
              href={info.repoUrl}
              onClick={(event) => {
                // WebView 里 <a target=_blank> 不可靠，统一走 window.open 交给系统浏览器
                event.preventDefault()
                window.open(info.repoUrl!, '_blank')
              }}
              style={{
                display: 'block',
                color: 'var(--t3-accent, #4a8dff)',
                textDecoration: 'none',
                fontSize: 13,
                wordBreak: 'break-all',
              }}
            >
              {t('updateRepoLink')}
            </a>
            <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.65 }}>
              {t('updateAskStar')}
            </p>
          </div>
        ) : null}
        {info.publishedAt ? (
          <p style={{ margin: '12px 0 0', fontSize: 12, opacity: 0.6 }}>
            {t('updatePublishedAt', { date: info.publishedAt })}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

/** 关于页「检查更新」按钮的 onClick：手动检查命中时直接弹更新窗 */
export const manualCheckUpdate = (onFound: () => void) => {
  void checkForUpdate(() => {
    onFound()
  })
}
