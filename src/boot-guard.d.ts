// index.html 内联脚本挂载的白屏看门狗解除钩子
interface Window {
  __fakeseekBootOk?: () => void
}
