import { useRef, useState, type ReactNode } from 'react'
import {
  IconChevronRightOutline14,
  IconDataOutline16,
  IconDownloadOutline16,
  IconGlobeLanguageOutline14,
  IconLightOutline16,
  IconLinkOutline16,
  IconRightUpOutline14,
  IconUploadOutline14,
} from '../base/icons.js'
import {
  GreetingMark,
  IconBackOutline20,
  IconFontSizeOutline20,
  IconHelpOutline20,
  IconInfoOutline20,
  IconPersonalizeOutline20,
  IconSpeakerOutline20,
  IconTermsOutline20,
} from '../base/iconsExtra.js'
import {
  BackupError,
  clearHistory,
  exportHistory,
  importHistory,
  listHistoryArchive,
} from '../../services/chat/backup.js'
import { useChatStore } from '../../services/chat/store.js'
import { isQuotaError } from '../../services/chat/db.js'
import type { ArchiveSessionInfo } from '../../services/chat/history/importArchive.js'
import { regionCodes, getRegionName, provinces } from '../../services/location.js'
import {
  CONTEXT_ROUNDS_OPTIONS,
  FONT_SCALE_PX,
  isChineseBrowser,
  setContextKeepRounds,
  setContextSummary,
  setLocale,
  setLocation,
  setThemePreference,
  setTtsVoice,
  useSettings,
} from '../../services/settings.js'
import { useTranslate, type TranslationKey, type TranslationMessage } from '../../i18n/index.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { Select } from '../base/Select.js'
import { showToast } from '../base/toastState.js'
import { ApiKeyConfirm, ApiKeyField, useApiKeyEditor } from './ApiKeyField.js'
import { AvatarSetting } from './AvatarSetting.js'
import { FontSizeSetting } from './FontSizeSetting.js'
import { SystemPromptSetting } from './SystemPromptSetting.js'
import {
  closeSettings,
  openSettings,
  setSettingsSection,
  useSettingsDialog,
  type SettingsSection,
} from './settingsDialogState.js'
import styles from './Settings.module.css'

const APP_VERSION = '1.0.11 (12)'

/**
 * 设置页（官方 App 风格）：移动端全屏、桌面居中大卡片。
 * 首页为分组卡片导航（账户 / 应用 / 语音 / 关于 / 帮助），点行进入子页，返回箭头回首页。
 */
export const SettingsDialog = () => {
  const open = useSettingsDialog((state) => state.open)
  return open ? <SettingsContent /> : null
}

const sectionTitles: Record<Exclude<SettingsSection, 'general'>, TranslationKey> = {
  data: 'settingsGroupData',
  appearance: 'settingsAppearance',
  fontSize: 'settingsFontSize',
  personalize: 'settingsPersonalize',
  voice: 'settingsTtsVoice',
  terms: 'settingsTerms',
  help: 'settingsHelp',
}

const SettingsContent = () => {
  const t = useTranslate()
  const section = useSettingsDialog((state) => state.section)
  // 子页间切换不丢失正在输入的 API Key 与导入状态
  const apiKeyEditor = useApiKeyEditor()
  const historyImport = useHistoryImport()
  const historyDelete = useHistoryDelete()
  const replacingHistory = useChatStore((state) => state.importingHistory)
  const historyBusy = historyImport.busy || historyDelete.busy || replacingHistory
  return (
    <>
      <Modal
        title={
          <div className={styles.pageTitle}>
            <button
              type="button"
              className={styles.backButton}
              aria-label={t('back')}
              onClick={() => {
                if (section === 'general') {
                  closeSettings()
                } else {
                  setSettingsSection('general')
                }
              }}
            >
              <IconBackOutline20 />
            </button>
            <span className={styles.pageTitleText}>
              {section === 'general' ? t('settings') : t(sectionTitles[section])}
            </span>
          </div>
        }
        className={styles.dialog}
        mainClassName={styles.dialogMain}
        titleClassName={styles.dialogTitle}
        onClose={() => {
          if (!historyDelete.busy) {
            closeSettings()
          }
        }}
      >
        <div className={styles.content}>
          {section === 'general' ? (
            <SettingsHome onNavigate={setSettingsSection} />
          ) : section === 'data' ? (
            <div className={styles.card}>
              <ApiKeyField editor={apiKeyEditor} />
              <ImportHistory historyImport={historyImport} disabled={historyBusy} />
              <ExportHistory disabled={historyBusy} />
              <SettingCell
                label={t('deleteAllSessions')}
                status={null}
                action={
                  <Button
                    variant="dangerOutlined"
                    size="m"
                    className={styles.cellButton}
                    disabled={historyBusy}
                    onClick={historyDelete.open}
                  >
                    {t('delete')}
                  </Button>
                }
              />
              <ApiKeyConfirm editor={apiKeyEditor} />
            </div>
          ) : section === 'appearance' ? (
            <div className={styles.card}>
              <ThemeSetting />
            </div>
          ) : section === 'fontSize' ? (
            <FontSizeSetting />
          ) : section === 'personalize' ? (
            <>
              <div className={styles.card}>
                <AvatarSetting />
              </div>
              <div className={styles.card}>
                <SystemPromptSetting />
              </div>
              <GroupLabel>{t('settingsContextGroup')}</GroupLabel>
              <div className={styles.card}>
                <ContextRoundsSetting />
              </div>
            </>
          ) : section === 'voice' ? (
            <div className={styles.card}>
              <TtsVoiceSetting />
            </div>
          ) : section === 'terms' ? (
            <TermsContent />
          ) : (
            <HelpContent />
          )}
        </div>
      </Modal>
      {/* 确认弹窗：导入进行中（busy 且有进度）也保留渲染，让进度条有地方显示 */}
      {/* 导入弹窗三态：扫描中 / 勾选列表 / 导入进度 */}
      {historyImport.file || historyImport.busy || historyImport.scan ? (
        <ImportConfirm historyImport={historyImport} />
      ) : null}
      {historyDelete.opened ? <DeleteAllConfirm historyDelete={historyDelete} /> : null}
    </>
  )
}

const GroupLabel = ({ children }: { children: ReactNode }) => (
  <div className={styles.groupLabel}>{children}</div>
)

/** 首页导航行：图标 + 标题 + 右侧当前值 + 箭头 */
const NavRow = ({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode
  label: string
  value?: string
  onClick: () => void
}) => (
  <button type="button" className={styles.navRow} onClick={onClick}>
    <span className={styles.navRowIcon}>{icon}</span>
    <span className={styles.navRowLabel}>{label}</span>
    {value ? <span className={styles.navRowValue}>{value}</span> : null}
    <span className={styles.navRowChevron}>
      <IconChevronRightOutline14 />
    </span>
  </button>
)

const SettingsHome = ({ onNavigate }: { onNavigate: (section: SettingsSection) => void }) => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const themePreference = useSettings((state) => state.themePreference)
  const fontScale = useSettings((state) => state.fontScale)
  const fontFollowSystem = useSettings((state) => state.fontFollowSystem)
  const themeLabel = t(
    themePreference === 'light'
      ? 'avatarMenuSettingsDialogThemeSelectLightOption'
      : themePreference === 'dark'
        ? 'avatarMenuSettingsDialogThemeSelectDarkOption'
        : 'avatarMenuSettingsDialogThemeSelectSystemOption'
  )
  const fontLabel = fontFollowSystem
    ? t('fontFollowSystem')
    : fontScale === 2
      ? t('fontStandard')
      : `${FONT_SCALE_PX[fontScale]}px`
  return (
    <>
      <GroupLabel>{t('settingsGroupAccount')}</GroupLabel>
      <div className={styles.card}>
        <NavRow
          icon={<IconDataOutline16 />}
          label={t('settingsGroupData')}
          onClick={() => onNavigate('data')}
        />
      </div>
      <GroupLabel>{t('settingsGroupApp')}</GroupLabel>
      <div className={styles.card}>
        <div className={styles.navRowStatic}>
          <span className={styles.navRowIcon}>
            <IconGlobeLanguageOutline14 />
          </span>
          <span className={styles.navRowLabel}>{t('settingsLocalePreference')}</span>
          <Select
            ariaLabel={t('settingsLocalePreference')}
            className={styles.inlineSelect}
            value={locale}
            options={[
              { value: 'zh-CN', label: t('settingsLocaleZhCN'), lang: 'zh-CN' },
              { value: 'en-US', label: t('settingsLocaleEnUS'), lang: 'en' },
            ]}
            onChange={setLocale}
          />
        </div>
        <NavRow
          icon={<IconLightOutline16 />}
          label={t('settingsAppearance')}
          value={themeLabel}
          onClick={() => onNavigate('appearance')}
        />
        <NavRow
          icon={<IconFontSizeOutline20 />}
          label={t('settingsFontSize')}
          value={fontLabel}
          onClick={() => onNavigate('fontSize')}
        />
        <NavRow
          icon={<IconPersonalizeOutline20 />}
          label={t('settingsPersonalize')}
          onClick={() => onNavigate('personalize')}
        />
      </div>
      <GroupLabel>{t('settingsGroupVoice')}</GroupLabel>
      <div className={styles.card}>
        <NavRow
          icon={<IconSpeakerOutline20 />}
          label={t('settingsTtsVoice')}
          onClick={() => onNavigate('voice')}
        />
      </div>
      <GroupLabel>{t('settingsGroupAbout')}</GroupLabel>
      <div className={styles.card}>
        <NavRow
          icon={<IconInfoOutline20 />}
          label={t('settingsCheckUpdate')}
          value={APP_VERSION}
          onClick={() => showToast({ key: 'settingsLatestVersion' })}
        />
        <NavRow
          icon={<IconTermsOutline20 />}
          label={t('settingsTerms')}
          onClick={() => onNavigate('terms')}
        />
      </div>
      <GroupLabel>{t('settingsLinksGroup')}</GroupLabel>
      <div className={styles.card}>
        <LinkRow
          icon={<IconDownloadOutline16 />}
          label={t('settingsOfficialApp')}
          description={t('settingsOfficialAppDesc')}
          href="https://www.deepseek.com/"
        />
        <LinkRow
          icon={<IconLinkOutline16 />}
          label={t('settingsOpenPlatform')}
          description={t('settingsOpenPlatformDesc')}
          href="https://platform.deepseek.com/"
        />
        <LinkRow
          icon={<IconLinkOutline16 />}
          label={t('settingsOpenSource')}
          description={t('settingsOpenSourceDesc')}
          href="https://github.com/deepseek-ai/chat-demo"
        />
      </div>
      <div className={styles.card}>
        <NavRow
          icon={<IconHelpOutline20 />}
          label={t('settingsHelp')}
          onClick={() => onNavigate('help')}
        />
      </div>
    </>
  )
}

/** 外链行：新窗口打开官方渠道，右侧 ↗ 标记 */
const LinkRow = ({
  icon,
  label,
  description,
  href,
}: {
  icon: ReactNode
  label: string
  description: string
  href: string
}) => (
  <a className={styles.linkRow} href={href} target="_blank" rel="noreferrer">
    <span className={styles.navRowIcon}>{icon}</span>
    <span className={styles.linkRowText}>
      <span className={styles.navRowLabel}>{label}</span>
      <span className={styles.linkRowDesc}>{description}</span>
    </span>
    <span className={styles.navRowChevron}>
      <IconRightUpOutline14 />
    </span>
  </a>
)

/** 服务协议子页：完整免责声明（与首启弹窗同源文案） */
const TermsContent = () => {
  const t = useTranslate()
  return (
    <div className={styles.card}>
      <div className={styles.helpBlock}>
        <div className={styles.helpTitle}>{t('disclaimerTitle')}</div>
        <div className={styles.helpText}>
          <p className={styles.termsPara}>{t('disclaimerP1')}</p>
          <p className={styles.termsPara}>{t('disclaimerP2')}</p>
          <p className={styles.termsPara}>{t('disclaimerP3')}</p>
          <p className={styles.termsPara}>{t('disclaimerP4')}</p>
        </div>
      </div>
    </div>
  )
}

/** 帮助与反馈：配 Key 三步指引 + 数据说明 */
const HelpContent = () => {
  const t = useTranslate()
  return (
    <>
      <div className={styles.helpHero}>
        <GreetingMark />
      </div>
      <div className={styles.card}>
        <div className={styles.helpBlock}>
          <div className={styles.helpTitle}>{t('settingsHelpKeyTitle')}</div>
          <ol className={styles.helpSteps}>
            <li>{t('settingsHelpKeyStep1')}</li>
            <li>{t('settingsHelpKeyStep2')}</li>
            <li>{t('settingsHelpKeyStep3')}</li>
          </ol>
          <Button size="m" onClick={() => openSettings('data')}>
            {t('welcomeApiKeyHintAction')}
          </Button>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.helpBlock}>
          <div className={styles.helpTitle}>{t('settingsHelpDataTitle')}</div>
          <div className={styles.helpText}>{t('settingsHelpDataText')}</div>
        </div>
      </div>
    </>
  )
}

/** 删除确认保留在设置之上；失败可重试，成功只关闭确认弹窗。 */
const DeleteAllConfirm = ({
  historyDelete,
}: {
  historyDelete: ReturnType<typeof useHistoryDelete>
}) => {
  const t = useTranslate()
  return (
    <Modal
      title={t('deleteAllSessionsModalTitle')}
      className={styles.deleteConfirm}
      onClose={historyDelete.cancel}
      footer={
        <div className={styles.deleteActions} aria-busy={historyDelete.busy}>
          <Button
            variant="outlined"
            autoFocus
            disabled={historyDelete.busy}
            onClick={historyDelete.cancel}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={historyDelete.busy}
            onClick={() => void historyDelete.confirm()}
          >
            {t(historyDelete.busy ? 'historyDeleting' : 'deleteAllSessions')}
          </Button>
        </div>
      }
    >
      {t('deleteAllSessionsModalDescription')}
    </Modal>
  )
}

const useHistoryDelete = () => {
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const deleting = useRef(false)

  const confirm = async () => {
    if (deleting.current) {
      return
    }
    deleting.current = true
    setBusy(true)
    try {
      await clearHistory()
      setOpened(false)
      showToast({ key: 'historyDeleted' })
    } catch {
      showToast({ key: 'historyDeleteFailed', type: 'error' })
    } finally {
      deleting.current = false
      setBusy(false)
    }
  }

  return {
    opened,
    busy,
    open: () => setOpened(true),
    cancel: () => {
      if (!deleting.current) {
        setOpened(false)
      }
    },
    confirm,
  }
}

const LocationSetting = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const location = useSettings((state) => state.location)
  const province =
    location?.region === 'CN'
      ? provinces.find((item) => item.code === location.province)
      : undefined

  return (
    <SettingCell
      label={t('settingsLocation')}
      status={null}
      className={styles.locationCell}
      action={
        <div className={styles.locationSelectors}>
          {isChineseBrowser() ? (
            <>
              <Select
                ariaLabel={t('settingsLocationProvince')}
                className={styles.provinceSelect}
                value={province?.code ?? ''}
                placeholder={t('settingsLocationProvince')}
                options={provinces.map((item) => ({ value: item.code, label: item.name }))}
                onChange={(value) => {
                  if (value !== province?.code) {
                    setLocation({ region: 'CN', province: value })
                  }
                }}
              />
              <Select
                ariaLabel={t('settingsLocationCity')}
                className={styles.citySelect}
                value={province ? (location?.city ?? '') : ''}
                disabled={!province?.cities.length}
                placeholder={t('settingsLocationCity')}
                options={
                  province?.cities.map((item) => ({ value: item.code, label: item.name })) ?? []
                }
                onChange={(value) => {
                  if (province) {
                    setLocation({ region: 'CN', province: province.code, city: value })
                  }
                }}
              />
            </>
          ) : (
            <Select
              ariaLabel={t('settingsLocationRegion')}
              className={styles.regionSelect}
              value={location?.region ?? ''}
              placeholder={t('settingsLocationRegion')}
              options={regionCodes
                .map((code) => ({ value: code, label: getRegionName(code, locale) }))
                .sort((a, b) => a.label.localeCompare(b.label, locale))}
              onChange={(value) => setLocation({ region: value })}
            />
          )}
        </div>
      }
    />
  )
}

/** 朗读音色：stella（海星，女声）/ tide（暗潮，男声）；附位置信息（服务端朗读需要）。 */
const TtsVoiceSetting = () => {
  const t = useTranslate()
  const ttsVoice = useSettings((state) => state.ttsVoice)
  return (
    <>
      <SettingCell
        label={t('settingsTtsVoice')}
        status={null}
        action={
          <Select
            ariaLabel={t('settingsTtsVoice')}
            value={ttsVoice}
            options={[
              { value: 'stella', label: t('settingsTtsVoiceStella') },
              { value: 'tide', label: t('settingsTtsVoiceTide') },
            ]}
            onChange={setTtsVoice}
          />
        }
      />
      <LocationSetting />
    </>
  )
}

/** 导入确认弹窗三态：扫描会话列表 → 勾选 → 导入中进度 */
const ImportConfirm = ({
  historyImport,
}: {
  historyImport: ReturnType<typeof useHistoryImport>
}) => {
  const t = useTranslate()
  const importing = historyImport.busy && historyImport.progress !== null
  const scan = historyImport.scan
  const scanning = scan?.scanning ?? false
  const sessions = scan?.sessions ?? []
  const scanProgress = scan?.progress ?? 0
  const checked = historyImport.checked
  const percent = Math.min(99, Math.max(1, Math.round((historyImport.progress ?? 0) * 100)))
  const allChecked = sessions.length > 0 && checked.size === sessions.length

  const toggle = (id: string) => {
    const next = new Set(checked)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    historyImport.setChecked(next)
  }

  return (
    <Modal
      title={t('historyImportConfirmTitle')}
      className={styles.importConfirm}
      onClose={importing ? undefined : historyImport.cancel}
      footer={
        importing ? (
          <div className={styles.importProgressRow} aria-busy="true">
            <progress
              className={styles.importProgressBar}
              value={historyImport.progress ?? 0}
              max={1}
            />
            <span className={styles.importProgressText}>
              {t('historyImportingProgress', { percent: String(percent) })}
            </span>
          </div>
        ) : scanning ? (
          <div className={styles.importProgressRow} aria-busy="true">
            <progress className={styles.importProgressBar} value={scanProgress} max={1} />
            <span className={styles.importProgressText}>
              {t('historyScanningProgress', {
                percent: String(Math.max(1, Math.round(scanProgress * 100))),
              })}
            </span>
          </div>
        ) : (
          <>
            <Button variant="outlined" size="m" autoFocus onClick={historyImport.cancel}>
              {t('cancel')}
            </Button>
            <Button
              variant="dangerOutlined"
              size="m"
              disabled={checked.size === 0}
              onClick={() => void historyImport.confirm()}
            >
              {t('historyImportSelected', { count: String(checked.size) })}
            </Button>
          </>
        )
      }
    >
      {scanning ? (
        <div className={styles.importConfirmText}>{t('historyScanning')}</div>
      ) : (
        <>
          <div className={styles.importConfirmText}>{t('historyImportPickPrompt')}</div>
          <div className={styles.importSessionList}>
            <label className={styles.importSessionRow}>
              <input
                type="checkbox"
                className={styles.importSessionCheck}
                checked={allChecked}
                onChange={() =>
                  historyImport.setChecked(
                    allChecked ? new Set() : new Set(sessions.map((item) => item.id))
                  )
                }
              />
              <span className={styles.importSessionTitle}>{t('historyImportSelectAll')}</span>
            </label>
            {sessions.map((item) => (
              <label key={item.id} className={styles.importSessionRow}>
                <input
                  type="checkbox"
                  className={styles.importSessionCheck}
                  checked={checked.has(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <span className={styles.importSessionTitle}>
                  {item.title || t('untitledChat')}
                </span>
                <span className={styles.importSessionMeta}>
                  {t('historyImportMessageCount', { count: String(item.messageCount) })}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

/** 外观子页：浅色 / 深色 / 跟随系统三个选块。 */
const ThemeSetting = () => {
  const t = useTranslate()
  const themePreference = useSettings((state) => state.themePreference)
  const label = t('avatarMenuSettingsDialogThemeItemLabel')
  const themeOptions = [
    { value: 'light', label: 'avatarMenuSettingsDialogThemeSelectLightOption' },
    { value: 'dark', label: 'avatarMenuSettingsDialogThemeSelectDarkOption' },
    { value: 'system', label: 'avatarMenuSettingsDialogThemeSelectSystemOption' },
  ] as const
  return (
    <div className={styles.theme}>
      {label}
      <div role="radiogroup" aria-label={label} className={styles.themeOptions}>
        {themeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={themePreference === option.value}
            className={`${styles.themeOption} ${themePreference === option.value ? styles.themeOptionSelected : ''}`}
            onClick={() => setThemePreference(option.value)}
          >
            {t(option.label)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** `reason` 为失败原因的文案 key，展示时按当前语言翻译后填入 `message` 参数。 */
type Status = (TranslationMessage & { error?: boolean; reason?: TranslationKey }) | null

/** 导出失败附带原因：预期的错误用对应文案作原因，其他错误用错误信息。 */
const errorStatus = (key: TranslationKey, error: unknown): Status => ({
  key,
  ...(error instanceof BackupError
    ? { reason: error.key }
    : { params: { message: error instanceof Error ? error.message : String(error) } }),
  error: true,
})

const SettingCell = ({
  label,
  description,
  status,
  action,
  className,
}: {
  label: string
  description?: string
  status: Status
  action: ReactNode
  className?: string
}) => {
  const t = useTranslate()
  return (
    <div className={`${styles.cell} ${styles.row} ${className ?? ''}`}>
      <div className={styles.text}>
        <div className={styles.label}>{label}</div>
        {status || description ? (
          <div className={`${styles.description} ${status?.error ? styles.error : ''}`}>
            {status
              ? t(status.key, status.reason ? { message: t(status.reason) } : status.params)
              : description}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/** 上下文保留轮数 + 旧历史摘要开关（个性化子页）。 */
const ContextRoundsSetting = () => {
  const t = useTranslate()
  const contextKeepRounds = useSettings((state) => state.contextKeepRounds)
  const contextSummary = useSettings((state) => state.contextSummary)
  return (
    <>
      <SettingCell
        label={t('settingsContextRounds')}
        description={t('settingsContextRoundsDescription')}
        status={null}
        className={styles.stackCell}
        action={
          <Select
            ariaLabel={t('settingsContextRounds')}
            value={String(contextKeepRounds)}
            options={CONTEXT_ROUNDS_OPTIONS.map((rounds) => ({
              value: String(rounds),
              label:
                rounds === 0
                  ? t('settingsContextRoundsAll')
                  : t('settingsContextRoundsN', { count: rounds }),
            }))}
            onChange={(value) => setContextKeepRounds(Number(value))}
          />
        }
      />
      {contextKeepRounds > 0 ? (
        <SettingCell
          label={t('settingsContextSummary')}
          description={t('settingsContextSummaryDescription')}
          status={null}
          className={styles.stackCell}
          action={
            <Select
              ariaLabel={t('settingsContextSummary')}
              value={contextSummary ? 'on' : 'off'}
              options={[
                { value: 'on', label: t('settingsContextSummaryOn') },
                { value: 'off', label: t('settingsContextSummaryOff') },
              ]}
              onChange={(value) => setContextSummary(value === 'on')}
            />
          }
        />
      ) : null}
    </>
  )
}

/** 选文件后先扫描会话列表供勾选，确认后只导入选中项；任何错误都提示导入失败。 */
const useHistoryImport = () => {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [progress, setProgress] = useState<number | null>(null)
  /** 扫描阶段状态：scanning=true 时弹窗显示扫描进度，完成后 sessions 即勾选列表 */
  const [scan, setScan] = useState<{
    scanning: boolean
    sessions: ArchiveSessionInfo[]
    progress: number
  } | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  /** 导入中的 File 引用要保留到进度结束，避免中途被 GC 影响 slice 读取 */
  const activeFile = useRef<File | null>(null)
  const importing = useRef(false)

  /** 第一步：选了文件 → 流式扫描归档，列出会话供勾选 */
  const startScan = (selected: File) => {
    if (importing.current || busy) {
      return
    }
    setFile(selected)
    setBusy(true)
    setStatus(null)
    setScan({ scanning: true, sessions: [], progress: 0.02 })
    void listHistoryArchive(selected, (value) => {
      setScan((current) => (current ? { ...current, progress: value } : current))
    })
      .then((sessions) => {
        setScan({ scanning: false, sessions, progress: 1 })
        setChecked(new Set(sessions.map((item) => item.id)))
      })
      .catch((error) => {
        setScan(null)
        setBusy(false)
        setFile(null)
        setStatus({
          key: isQuotaError(error) ? 'historyImportNoSpace' : 'historyImportFailed',
          error: true,
        })
      })
  }

  const cancelScan = () => {
    setScan(null)
    setBusy(false)
    setFile(null)
  }

  /** 第二步：按勾选执行导入 */
  const confirm = async () => {
    if (!file || importing.current) {
      return
    }
    importing.current = true
    activeFile.current = file
    setBusy(true)
    setScan(null)
    setStatus(null)
    // 首帧就给一个非零起点，避免大文件解析 manifest 阶段进度条停在 0
    setProgress(0.01)
    // 全选时传 undefined 走「全部导入」；部分勾选才按集合过滤
    const partial = scan && checked.size > 0 && checked.size < scan.sessions.length
    try {
      const count = await importHistory(
        file,
        (value) => setProgress(value),
        partial ? checked : undefined
      )
      setStatus(
        count === 0
          ? { key: 'historyImportedNone' }
          : { key: count === 1 ? 'historyImportedOne' : 'historyImported', params: { count } }
      )
    } catch (error) {
      // 磁盘满/配额超单独提示：这种失败重试也没用，得先清空间
      setStatus({
        key: isQuotaError(error) ? 'historyImportNoSpace' : 'historyImportFailed',
        error: true,
      })
    } finally {
      importing.current = false
      activeFile.current = null
      setBusy(false)
      setProgress(null)
      setFile(null)
    }
  }

  return {
    file,
    busy,
    status,
    progress,
    scan,
    checked,
    setChecked,
    select: startScan,
    cancel: cancelScan,
    confirm,
  }
}

/** 导入 = 新增合并：把文件中的会话追加到本地列表，同 id 去重。 */
const ImportHistory = ({
  historyImport,
  disabled,
}: {
  historyImport: ReturnType<typeof useHistoryImport>
  disabled: boolean
}) => {
  const t = useTranslate()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <SettingCell
      label={t('historyImport')}
      description={t('historyImportDescription')}
      status={historyImport.status}
      action={
        <>
          <Button
            variant="outlined"
            size="m"
            className={`${styles.cellButton} ${styles.uploadButton}`}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <IconUploadOutline14 />
            {t('upload')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) {
                historyImport.select(file)
              }
            }}
          />
        </>
      }
    />
  )
}

/** 将全部会话及图片导出为 ZIP 文件并下载 */
const ExportHistory = ({ disabled }: { disabled: boolean }) => {
  const t = useTranslate()
  const empty = useChatStore((state) => state.sessions.length === 0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const onExport = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const { name, blob } = await exportHistory()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (error) {
      setStatus(errorStatus('historyExportFailed', error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingCell
      label={t('exportAllLabel')}
      description={t('historyExportDescription')}
      status={status}
      action={
        <Button
          variant="outlined"
          size="m"
          className={styles.cellButton}
          disabled={disabled || busy || empty}
          onClick={() => void onExport()}
        >
          <IconDownloadOutline16 />
          {t('exportAllDownload')}
        </Button>
      }
    />
  )
}