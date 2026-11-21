import clsx from 'clsx'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  IconGlobeLanguageOutline14,
  IconStopFill16,
  IconThinkOutline14,
} from '../base/icons.js'
import { IconPlusCircleOutline24, IconArrowUp24, IconCameraOutline24, IconImageOutline24, IconFileOutline24, IconKeyboardOutline24 } from '../base/iconsExtra.js'
import { setModel, setSearch, setThinking, useSettings, getWallpaperTextColor } from '../../services/settings.js'
import { estimateTokens } from '../../services/api/modelLimits.js'
import { hitRate, useUsage } from '../../services/chat/usage.js'
import { BUILTIN_MODELS, cachedModels, fetchModels, type ModelOption } from '../../services/api/models.js'
import { useIsMobile } from '../../app/viewport.js'
import { sendMessage, stopReply, useChatStore } from '../../services/chat/store.js'
import {
  addDraftFiles,
  EMPTY_DRAFT,
  getDraft,
  prepareDraftMessage,
  removeDraftAttachment,
  retryDraftAttachment,
  setDraftText,
  useDrafts,
} from '../../services/chat/drafts.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import { Tooltip } from '../base/Tooltip.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'
import { DragMask, useFileDrop } from './DragMask.js'
import { showToast } from '../base/toastState.js'
import { ACCEPT, useUploads } from '../../services/attachments.js'
import { DraftAttachments } from './DraftAttachments.js'
import { useVoiceInput } from './useVoiceInput.js'
import { VoiceButton } from './VoiceButton.js'
import { VoiceHoldPanel } from './VoiceHoldPanel.js'
import { Spectrum } from './Spectrum.js'
import { useTranslate } from '../../i18n/index.js'
import { closeMorePanel, useMorePanel } from './morePanelState.js'
import styles from './ChatInput.module.css'

/** 输入框：自适应高度的文本框 + 文件 + 深度思考与智能搜索开关 + 语音输入 + 发送 / 停止 */
export const ChatInput = memo(function ChatInput({ sessionId }: { sessionId: string | null }) {
  // 切换目标时释放录音、转写和 DOM 状态；文字与附件由草稿服务保留。
  return <Input key={sessionId === null ? 'new' : `session:${sessionId}`} sessionId={sessionId} />
})

const Input = ({ sessionId }: { sessionId: string | null }) => {
  const t = useTranslate()
  // 字色订阅：预设变更事件触发重渲染，行内 style 重新求值（本组件不因字色变化自动重渲染）
  const [wpInputColor, setWpInputColor] = useState(
    () => getWallpaperTextColor('input') ?? getWallpaperTextColor('chat')
  )
  useEffect(() => {
    const sync = () => setWpInputColor(getWallpaperTextColor('input') ?? getWallpaperTextColor('chat'))
    window.addEventListener('chat-demo:text-colors-changed', sync)
    return () => window.removeEventListener('chat-demo:text-colors-changed', sync)
  }, [])
  const draft = useDrafts((state) => state.drafts.get(sessionId) ?? EMPTY_DRAFT)
  const { text, attachments } = draft
  const setText = (value: string) => setDraftText(sessionId, value)
  const draftReady = useUploads((state) => prepareDraftMessage(draft, state.tasks) !== null)
  const streaming = useChatStore(
    (state) => sessionId !== null && Object.hasOwn(state.streaming, sessionId)
  )
  const thinking = useSettings((state) => state.thinking)
  const importingHistory = useChatStore((state) => state.importingHistory)
  const isMobile = useIsMobile()
  const search = useSettings((state) => state.search)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const togglesRef = useRef<HTMLDivElement>(null)
  /** 「更多」面板展开状态由顶栏按钮控制，这里只读它决定是否在输入卡上方渲染面板 */
  const morePanelOpen = useMorePanel((state) => state.open)
  /** ⊕ 附件面板展开状态（官方行为：拍照 / 相册 / 文件三选） */
  const [attachOpen, setAttachOpen] = useState(false)
  /** 移动端语音面板：点麦克风进入「按住说话」态（此时尚未录音），再长按才收音 */
  const [voiceMode, setVoiceMode] = useState(false)

  useLayoutEffect(() => {
    const toggles = togglesRef.current
    if (!toggles) {
      return
    }

    const updateLabels = () => {
      // 移动端官方样式胶囊必须带字，永不折叠成纯图标；桌面端空间不足才折叠。
      if (isMobile) {
        toggles.classList.remove(styles.collapsedToggles)
        return
      }
      toggles.classList.remove(styles.collapsedToggles)
      toggles.classList.toggle(styles.collapsedToggles, toggles.scrollWidth > toggles.clientWidth)
    }

    updateLabels()
    const observer = new ResizeObserver(updateLabels)
    observer.observe(toggles)
    return () => observer.disconnect()
  }, [t, isMobile])

  const acceptFiles = (files: File[]) => {
    if (files.length === 0 || useChatStore.getState().importingHistory || !ensureApiKey()) {
      return
    }
    const error = addDraftFiles(sessionId, files, useSettings.getState().apiKey ?? '')
    if (error) {
      showToast(error)
    }
  }
  const retryFile = useCallback(
    (id: string) => {
      if (!useChatStore.getState().importingHistory && ensureApiKey()) {
        retryDraftAttachment(sessionId, id, useSettings.getState().apiKey ?? '')
      }
    },
    [sessionId]
  )
  const removeFile = useCallback(
    (id: string) => {
      if (!useChatStore.getState().importingHistory) {
        removeDraftAttachment(sessionId, id)
      }
    },
    [sessionId]
  )
  const dragging = useFileDrop(acceptFiles)

  /** 转写结果插入到光标处，并把光标移到插入内容之后 */
  const [voiceCanceling, setVoiceCanceling] = useState(false)
  const voice = useVoiceInput((transcript) => {
    const textarea = textareaRef.current
    const current = getDraft(sessionId).text
    const start = textarea?.selectionStart ?? current.length
    const end = textarea?.selectionEnd ?? current.length
    setText(current.slice(0, start) + transcript + current.slice(end))
    requestAnimationFrame(() => {
      textarea?.focus({ preventScroll: true })
      textarea?.setSelectionRange(start + transcript.length, start + transcript.length)
    })
  })

  // 欢迎页导入后会话 ID 不变，不能依赖卸载取消语音；订阅开始事件也覆盖快速完成的导入。
  const cancelVoice = voice.cancel
  useEffect(
    () =>
      useChatStore.subscribe((state, previous) => {
        if (state.importingHistory && !previous.importingHistory) {
          cancelVoice()
        }
      }),
    [cancelVoice]
  )

  // 移动端录音时用频谱替代输入框内容
  const recording = voice.status === 'recording'

  // 排队、上传中或上传失败的附件都留在输入框，全部上传成功后才能发送
  const canSend = !importingHistory && !streaming && voice.status === 'idle' && draftReady
  /** 有文字或有附件时，语音钮换成长按发送钮（官方行为） */
  const hasText = text.trim().length > 0 || attachments.length > 0

  const send = () => {
    if (!canSend) {
      return
    }
    const latestDraft = getDraft(sessionId)
    if (
      useSettings.getState().longInputMode === 'file' &&
      latestDraft.text.trim().length > 0 &&
      estimateTokens(latestDraft.text) > 26000
    ) {
      if (!ensureApiKey()) {
        return
      }
      const txtFile = new File([latestDraft.text], `long-text-${Date.now()}.txt`, {
        type: 'text/plain;charset=utf-8',
      })
      // 先校验再清文本：校验失败（如附件数达上限）时保留原文，避免丢字
      const addError = addDraftFiles(sessionId, [txtFile], useSettings.getState().apiKey ?? '')
      if (addError) {
        showToast(addError)
        return
      }
      setDraftText(sessionId, '')
      showToast({ key: 'longInputConvertedToFile' })
      return
    }
    if (
      useChatStore.getState().importingHistory ||
      voice.status !== 'idle' ||
      !prepareDraftMessage(latestDraft, useUploads.getState().tasks)
    ) {
      return
    }
    // 文本与上传完成态由提交动作读取最新快照，不使用上一次渲染的草稿。
    if (!ensureApiKey() || !sendMessage(sessionId)) {
      return
    }
    stopReadAloud()
    if (isMobile) {
      textareaRef.current?.blur()
    } else {
      textareaRef.current?.focus()
    }
  }

  return (
    <div
      className={clsx(styles.wrapper, sessionId === null ? styles.home : styles.session)}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          textareaRef.current?.focus({ preventScroll: true })
        }
      }}
    >
      <DraftAttachments items={attachments} onRetry={retryFile} onRemove={removeFile} />
      <div className={styles.textareaWrapper}>
        {voiceMode && isMobile ? (
          <VoiceHoldPanel
            recording={recording}
            canceling={voiceCanceling}
            disabled={!voice.available || importingHistory}
            onPressStart={() => {
              if (
                voice.status === 'idle' &&
                !useChatStore.getState().importingHistory &&
                ensureApiKey()
              ) {
                void voice.start()
              }
            }}
            onPressEnd={(canceled) => {
              if (canceled) {
                voice.cancel()
              } else {
                void voice.stop()
              }
            }}
            onPressCancel={() => voice.cancel()}
            onSlideCancelChange={setVoiceCanceling}
          />
        ) : (
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder={t('chatInputPlaceholderChat')}
            rows={2}
            // 移动端不自动聚焦，避免一打开就弹出键盘
            autoFocus={!isMobile}
            disabled={importingHistory}
            value={text}
            // 字色直接写行内 style：变量在部分端上被级联吞掉，行内没有中间层
            style={wpInputColor ? { color: wpInputColor } : undefined}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => {
              closeMorePanel()
              setAttachOpen(false)
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                (event.ctrlKey || event.metaKey) &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                send()
              }
            }}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.files)
              if (files.length > 0) {
                event.preventDefault()
                acceptFiles(files)
              }
            }}
          />
        )}
        {voiceMode && isMobile && recording ? (
          <div className={styles.recordingOverlay}>
            <Spectrum getAnalyser={voice.getAnalyser} />
            <div className={clsx(styles.recordingTip, voiceCanceling && styles.recordingTipCancel)}>
              {t('voiceInputTimer', { seconds: voice.seconds })}
            </div>
          </div>
        ) : null}
        {!voiceMode || !isMobile ? (
          <div className={styles.mirror} aria-hidden>
            {`${text}\n`}
          </div>
        ) : null}
      </div>
      <div className={styles.functionRow}>
        {/* 深度思考 / 智能搜索开关，tooltip 在按钮上方 */}
        <div ref={togglesRef} className={styles.toggles}>
          <Tooltip content={t('deactivatedThinkTooltip')}>
            <button
              type="button"
              className={clsx(styles.toggle, thinking && styles.selected)}
              aria-label={t('thinkingSwitch')}
              aria-pressed={thinking}
              onClick={() => setThinking(!thinking)}
            >
              <IconThinkOutline14 />
              <span className={styles.toggleLabel}>{t('thinkingSwitch')}</span>
            </button>
          </Tooltip>
          <Tooltip content={t('deactivatedSearchTooltip')}>
            <button
              type="button"
              className={clsx(styles.toggle, search && styles.selected)}
              aria-label={t('search')}
              aria-pressed={search}
              onClick={() => setSearch(!search)}
            >
              <IconGlobeLanguageOutline14 />
              <span className={styles.toggleLabel}>{t('search')}</span>
            </button>
          </Tooltip>
        </div>
        <div className={styles.right}>
          {/* 官方布局：⊕ 在前、语音/发送在后，两枚贴右对齐 */}
          <button
            type="button"
            className={clsx(styles.attachButton, attachOpen && styles.attachButtonOpen)}
            aria-label={t('uploadFile')}
            aria-expanded={attachOpen}
            disabled={importingHistory}
            onClick={() => {
              // 附件走官方 Files API，必须先有 Key；没有就提示原因，不闷头跳设置。
              if (!useSettings.getState().apiKey) {
                showToast({ key: 'attachNeedsKey' })
                return
              }
              setAttachOpen(!attachOpen)
            }}
          >
            <IconPlusCircleOutline24 />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept={ACCEPT}
            onChange={(event) => {
              acceptFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
              setAttachOpen(false)
            }}
          />
          {/* 相册专用：accept 固定 image/*，不再手改共享 input 的属性——
              改完靠取消/下次点击还原的写法在取消路径上会把 accept 永久卡死，
              image/* + multiple 组合在部分系统相册里直接打不开 */}
          <input
            ref={galleryInputRef}
            type="file"
            multiple
            hidden
            accept="image/*"
            onChange={(event) => {
              acceptFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
              setAttachOpen(false)
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              acceptFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
              setAttachOpen(false)
            }}
          />
          {streaming && sessionId ? (
            <button
              type="button"
              className={styles.sendButton}
              aria-label={t('chatInputStopButtonTooltip')}
              onClick={() => {
                stopReadAloud()
                stopReply(sessionId)
              }}
            >
              <IconStopFill16 />
            </button>
          ) : hasText ? (
            <button
              type="button"
              className={clsx(styles.sendButton, !canSend && styles.sendButtonDisabled)}
              aria-label={t('send')}
              disabled={!canSend}
              onClick={send}
            >
              <IconArrowUp24 />
            </button>
          ) : voiceMode && isMobile ? (
            /* 语音面板态：点击切回键盘输入，官方行为 */
            <button
              type="button"
              className={styles.attachButton}
              aria-label={t('voiceInputBackToKeyboard')}
              onClick={() => {
                voice.cancel()
                setVoiceMode(false)
              }}
            >
              <IconKeyboardOutline24 />
            </button>
          ) : (
            <VoiceButton
              status={voice.status}
              disabled={!voice.available}
              seconds={voice.seconds}
              onClick={() => {
                // 移动端：点一下进入「按住说话」面板，不直接录音
                if (isMobile) {
                  setVoiceMode(true)
                  closeMorePanel()
                  setAttachOpen(false)
                  return
                }
                if (
                  voice.status !== 'idle' ||
                  (!useChatStore.getState().importingHistory && ensureApiKey())
                ) {
                  void voice.toggle()
                }
              }}
            />
          )}
        </div>
      </div>
      {morePanelOpen && !streaming ? (
        <>
          {/* 点空白收起：透明遮罩盖住面板以外区域 */}
          <div className={styles.panelMask} onClick={closeMorePanel} />
          <MorePanel onClose={closeMorePanel} />
        </>
      ) : null}
      {attachOpen && !streaming ? (
        <>
          <div className={styles.panelMask} onClick={() => setAttachOpen(false)} />
          <AttachPanel
            onCamera={() => cameraInputRef.current?.click()}
            onGallery={() => galleryInputRef.current?.click()}
            onFile={() => fileInputRef.current?.click()}
            onClose={() => setAttachOpen(false)}
          />
        </>
      ) : null}
      {dragging ? <DragMask /> : null}
    </div>
  )
}

/** 官方 ⊕ 面板：拍照 / 相册 / 文件 三入口，点卡片后收起并触发对应选择器 */
const AttachPanel = ({
  onCamera,
  onGallery,
  onFile,
  onClose,
}: {
  onCamera: () => void
  onGallery: () => void
  onFile: () => void
  onClose: () => void
}) => {
  const t = useTranslate()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={styles.attachPanel}>
      <div className={styles.attachPanelRow}>
        <button type="button" className={styles.attachCard} onClick={onCamera}>
          <span className={styles.attachCardIcon}>
            <IconCameraOutline24 />
          </span>
          <span className={styles.attachCardLabel}>{t('attachCamera')}</span>
        </button>
        <button type="button" className={styles.attachCard} onClick={onGallery}>
          <span className={styles.attachCardIcon}>
            <IconImageOutline24 />
          </span>
          <span className={styles.attachCardLabel}>{t('attachGallery')}</span>
        </button>
        <button type="button" className={styles.attachCard} onClick={onFile}>
          <span className={styles.attachCardIcon}>
            <IconFileOutline24 />
          </span>
          <span className={styles.attachCardLabel}>{t('attachFile')}</span>
        </button>
      </div>
    </div>
  )
}

/**
 * 输入卡上方的「更多」面板（可展开/收起）：官方主界面没有这些信息，
 * 所以只在这个折叠层里露出——模型切换 + 累计缓存命中率与 token 用量。
 */
const MorePanel = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslate()
  const model = useSettings((state) => state.model)
  const apiKey = useSettings((state) => state.apiKey)
  const totals = useUsage()
  const rate = hitRate(totals)
  /** 模型清单：先手缓存，有 Key 时再后台刷新一次（7 天缓存，不产生费用） */
  const [models, setModels] = useState<ModelOption[]>(() => {
    const cached = cachedModels()
    return cached.length > 0 ? cached : BUILTIN_MODELS
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!apiKey) {
      return
    }
    let cancelled = false
    setLoading(true)
    fetchModels(apiKey)
      .then((list) => {
        if (!cancelled && list.length > 0) {
          setModels(list)
        }
      })
      .catch(() => {
        // 拉取失败保留现有清单（缓存或内置），不打断对话
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [apiKey])

  return (
    <div className={styles.morePanel} role="group" aria-label={t('moreOptions')}>
      <div className={styles.moreSection}>
        <div className={styles.moreSectionTitle}>
          {t('modelSwitch')}
          {loading ? <span className={styles.moreLoading}> · {t('modelLoading')}</span> : null}
        </div>
        <div className={styles.modelRow}>
          {models.map((item) => (
            <button
              key={item.id}
              type="button"
              className={clsx(styles.modelOption, model === item.id && styles.modelSelected)}
              aria-pressed={model === item.id}
              onClick={() => {
                setModel(item.id)
                onClose()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {apiKey ? null : <div className={styles.moreHint}>{t('modelNeedsKey')}</div>}
      </div>
      <div className={styles.moreDivider} />
      <div className={styles.moreSection}>
        <div className={styles.moreSectionTitle}>{t('cacheHitRate')}</div>
        <div className={styles.moreStats}>
          <span className={styles.moreStatMain}>
            {rate === null ? '—' : `${(rate * 100).toFixed(1)}%`}
          </span>
          <span className={styles.moreStatSub}>
            {t('cacheHitDetail', {
              hit: totals.cacheHit,
              miss: totals.cacheMiss,
              requests: totals.requests,
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
