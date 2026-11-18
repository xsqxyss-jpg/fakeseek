import { create } from 'zustand'

/** 「更多」面板（模型切换 + 缓存命中率）的展开状态：按钮在顶栏中间，面板浮在顶栏下方 */
type MorePanelState = { open: boolean }

export const useMorePanel = create<MorePanelState>(() => ({ open: false }))

export const toggleMorePanel = () => useMorePanel.setState((state) => ({ open: !state.open }))

export const closeMorePanel = () => useMorePanel.setState({ open: false })
