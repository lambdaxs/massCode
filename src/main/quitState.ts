// 应用真正退出的全局标志。macOS 上 'close' 处理会隐藏窗口而非退出，
// 因此更新安装路径（quitAndInstall）须在关窗前设置标志，否则退出会被阻塞。
let quitting = false

export function setQuitting(value: boolean) {
  quitting = value
}

export function isQuitting() {
  return quitting
}
