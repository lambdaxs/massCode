import { describe, expect, it } from 'vitest'
import {
  formatTaskTimerDisplayLine,
  formatTaskTimerElapsed,
} from '../taskTimer'

describe('taskTimer formatting', () => {
  it('formats elapsed time as mm:ss', () => {
    expect(formatTaskTimerElapsed(65_000)).toBe('01:05')
    expect(formatTaskTimerElapsed(3_661_000)).toBe('61:01')
  })

  it('builds display line with title and timer', () => {
    expect(formatTaskTimerDisplayLine('data-access和record发布.', 83_000)).toBe(
      'data-access和record发布. 01:23',
    )
  })

  it('returns only timer when title is empty', () => {
    expect(formatTaskTimerDisplayLine('   ', 65_000)).toBe('01:05')
  })
})
