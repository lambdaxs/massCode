export type TimestampInputUnit = 'seconds' | 'milliseconds' | 'dateString'

export interface TimestampParseResult {
  date: Date
  unit: TimestampInputUnit
}

export interface TimestampOutputField {
  key: string
  value: string
}

export function parseTimestampInput(
  input: string,
): TimestampParseResult | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d+$/.test(trimmed)) {
    const digits = trimmed.length
    const numeric = Number(trimmed)
    if (!Number.isFinite(numeric)) {
      return null
    }

    if (digits <= 10) {
      return { date: new Date(numeric * 1000), unit: 'seconds' }
    }

    if (digits <= 13) {
      return { date: new Date(numeric), unit: 'milliseconds' }
    }

    if (digits <= 16) {
      return {
        date: new Date(Math.floor(numeric / 1000)),
        unit: 'milliseconds',
      }
    }

    return {
      date: new Date(Math.floor(numeric / 1_000_000)),
      unit: 'milliseconds',
    }
  }

  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) {
    return { date: new Date(parsed), unit: 'dateString' }
  }

  return null
}

export function buildTimestampOutputs(date: Date): TimestampOutputField[] {
  const unixSeconds = Math.floor(date.getTime() / 1000)
  const unixMilliseconds = date.getTime()

  return [
    { key: 'unixSeconds', value: String(unixSeconds) },
    { key: 'unixMilliseconds', value: String(unixMilliseconds) },
    { key: 'iso8601', value: date.toISOString() },
    {
      key: 'utc',
      value: date.toLocaleString(undefined, { timeZone: 'UTC' }),
    },
    { key: 'local', value: date.toLocaleString() },
    {
      key: 'weekday',
      value: date.toLocaleDateString(undefined, { weekday: 'long' }),
    },
  ]
}
