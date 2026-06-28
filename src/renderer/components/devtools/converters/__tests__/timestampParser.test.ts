import { describe, expect, it } from 'vitest'
import { buildTimestampOutputs, parseTimestampInput } from '../timestampParser'

describe('parseTimestampInput', () => {
  it('parses 10-digit unix seconds', () => {
    const result = parseTimestampInput('1577836800')
    expect(result?.unit).toBe('seconds')
    expect(result?.date.toISOString()).toBe('2020-01-01T00:00:00.000Z')
  })

  it('parses 13-digit unix milliseconds', () => {
    const result = parseTimestampInput('1577836800000')
    expect(result?.unit).toBe('milliseconds')
    expect(result?.date.toISOString()).toBe('2020-01-01T00:00:00.000Z')
  })

  it('parses iso date strings', () => {
    const result = parseTimestampInput('2020-01-01T00:00:00.000Z')
    expect(result?.unit).toBe('dateString')
    expect(result?.date.toISOString()).toBe('2020-01-01T00:00:00.000Z')
  })

  it('returns null for invalid input', () => {
    expect(parseTimestampInput('not-a-date')).toBeNull()
    expect(parseTimestampInput('')).toBeNull()
  })
})

describe('buildTimestampOutputs', () => {
  it('includes unix seconds and milliseconds', () => {
    const date = new Date('2020-01-01T00:00:00.000Z')
    const outputs = buildTimestampOutputs(date)
    expect(outputs.find(item => item.key === 'unixSeconds')?.value).toBe(
      '1577836800',
    )
    expect(outputs.find(item => item.key === 'unixMilliseconds')?.value).toBe(
      '1577836800000',
    )
  })
})
