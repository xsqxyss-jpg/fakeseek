import { useEffect, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  DEFAULT_SYSTEM_PROMPT,
  setSystemPrompt,
  useSettings,
} from '../../services/settings.js'
import { showToast } from '../base/toastState.js'
import styles from './SystemPromptSetting.module.css'

/**
 * 系统提示词（个性化子页）：多行编辑，失焦/点保存生效，空内容=恢复默认。
 * 每次对话请求随 system 字段发送；修改不影响服务端内容审查。
 */
export const SystemPromptSetting = () => {
  const t = useTranslate()
  const systemPrompt = useSettings((state) => state.systemPrompt)
  const [draft, setDraft] = useState(systemPrompt ?? DEFAULT_SYSTEM_PROMPT)
  const [editing, setEditing] = useState(false)

  // 外部恢复默认时同步草稿
  useEffect(() => {
    if (!editing) {
      setDraft(systemPrompt ?? DEFAULT_SYSTEM_PROMPT)
    }
  }, [systemPrompt, editing])

  const customized = systemPrompt !== null
  const dirty = draft.trim() !== (systemPrompt ?? DEFAULT_SYSTEM_PROMPT)

  const save = () => {
    setSystemPrompt(draft)
    setEditing(false)
    showToast({ key: 'settingsPromptSaved' })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.label}>{t('settingsPrompt')}</div>
        <span className={`${styles.badge} ${customized ? styles.badgeCustom : ''}`}>
          {t(customized ? 'settingsPromptCustom' : 'settingsPromptDefault')}
        </span>
      </div>
      <div className={styles.description}>{t('settingsPromptDescription')}</div>
      <textarea
        className={styles.textarea}
        rows={5}
        maxLength={4000}
        value={draft}
        aria-label={t('settingsPrompt')}
        onFocus={() => setEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (dirty) {
            save()
          } else {
            setEditing(false)
          }
        }}
      />
      <div className={styles.footer}>
        <span className={styles.counter}>{draft.length} / 4000</span>
        <div className={styles.actions}>
          {customized ? (
            <button
              type="button"
              className={styles.reset}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setSystemPrompt(null)
                setDraft(DEFAULT_SYSTEM_PROMPT)
                setEditing(false)
                showToast({ key: 'settingsPromptResetDone' })
              }}
            >
              {t('settingsPromptReset')}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.save}
            disabled={!dirty}
            onMouseDown={(event) => event.preventDefault()}
            onClick={save}
          >
            {t('settingsPromptSave')}
          </button>
        </div>
      </div>
      <div className={styles.notice}>{t('settingsPromptNotice')}</div>
    </div>
  )
}