import { useEffect, useState } from 'react'
import { z } from 'zod'

export const entityIdSchema = z.string().regex(/^[1-9]\d*$/, 'Select a record.')
export const quantitySchema = z
  .string()
  .trim()
  .regex(
    /^(0|[1-9]\d*)(\.\d{1,2})?$/,
    'Enter a decimal with up to two decimal places.',
  )
export const positiveQuantitySchema = quantitySchema.refine(
  (value) => /[1-9]/.test(value),
  'Enter a quantity greater than zero.',
)
export const optionalDateSchema = z.union([z.literal(''), z.iso.date()])
export const notesSchema = z
  .string()
  .max(65535, 'Use at most 65535 characters.')
export const clinicalLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (c) => c.toUpperCase())

export function useSearch() {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(text.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [text])
  return { text, setText, q, page, setPage, settling: text.trim() !== q }
}
