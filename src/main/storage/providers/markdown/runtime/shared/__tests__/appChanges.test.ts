import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import { rememberAppFileChange, wasRecentAppFileChange } from '../appChanges'

const tempDirs: string[] = []

function createTempFilePath(): string {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'app-changes-'))
  tempDirs.push(dirPath)
  return path.join(dirPath, 'note.md')
}

afterEach(() => {
  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('app file change echo suppression', () => {
  it('suppresses the echo of the app own write', () => {
    const filePath = createTempFilePath()
    fs.writeFileSync(filePath, 'own content', 'utf8')
    rememberAppFileChange(filePath)

    expect(wasRecentAppFileChange(filePath)).toBe(true)
  })

  it('does not suppress an external edit inside the TTL window', () => {
    const filePath = createTempFilePath()
    fs.writeFileSync(filePath, 'own content', 'utf8')
    rememberAppFileChange(filePath)

    // TTL 窗口内对同一文件的外部修改会改变签名（大小）——
    // 事件应被处理而非当作 echo 吞掉。
    fs.writeFileSync(filePath, 'external content with different size', 'utf8')

    expect(wasRecentAppFileChange(filePath)).toBe(false)
    // 自有变更记录已清除：后续事件也不视为 echo。
    expect(wasRecentAppFileChange(filePath)).toBe(false)
  })

  it('suppresses the echo of the app own deletion', () => {
    const filePath = createTempFilePath()
    fs.writeFileSync(filePath, 'own content', 'utf8')
    fs.removeSync(filePath)
    rememberAppFileChange(filePath)

    expect(wasRecentAppFileChange(filePath)).toBe(true)
  })

  it('does not suppress an external recreation after the app own deletion', () => {
    const filePath = createTempFilePath()
    fs.writeFileSync(filePath, 'own content', 'utf8')
    fs.removeSync(filePath)
    rememberAppFileChange(filePath)

    fs.writeFileSync(filePath, 'recreated externally', 'utf8')

    expect(wasRecentAppFileChange(filePath)).toBe(false)
  })
})
