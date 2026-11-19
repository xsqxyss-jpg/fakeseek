import { create } from 'zustand'

/** 移动端侧边栏抽屉：顶栏菜单按钮打开，点遮罩、切换会话或开启新对话后关闭 */
export const useMobileSider = create(() => ({
  open: false,
  searchMode: false,
  selectMode: false,
}))

export const openMobileSider = () => useMobileSider.setState({ open: true })

export const closeMobileSider = () =>
  useMobileSider.setState({ open: false, searchMode: false, selectMode: false })

export const setSiderSearchMode = (searchMode: boolean) =>
  useMobileSider.setState({ searchMode })

export const setSiderSelectMode = (selectMode: boolean) =>
  useMobileSider.setState({ selectMode })
