export const BUSINESS_TIME_ZONE = 'America/Curacao'

export function formatBusinessDateTime(
  value: Date | string,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = typeof value === 'string' ? new Date(value) : value

  return new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date)
}

export function formatBusinessDate(
  value: Date | string,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = typeof value === 'string' ? new Date(value) : value

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(date)
}

export function formatBusinessTime(
  value: Date | string,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = typeof value === 'string' ? new Date(value) : value

  return new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date)
}

export function formatBusinessDateTimeInput(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

export function businessDateTimeInputToIso(value: string) {
  return new Date(`${value}:00-04:00`).toISOString()
}
