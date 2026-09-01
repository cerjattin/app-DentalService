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
