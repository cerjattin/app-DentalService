import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StatusBadge } from '../../../components/feedback/status-badge'
import { Button } from '../../../components/ui/button'

export function ActiveBadge({ active }: { active: boolean }) {
  return <StatusBadge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</StatusBadge>
}
export function Pagination({ page, totalPages, busy, onChange }: { page: number; totalPages: number; busy: boolean; onChange: (page: number) => void }) {
  return <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-sm">
    <Button variant="secondary" aria-label="Previous page" disabled={page <= 1 || busy} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></Button>
    <span>Page {page} of {Math.max(1, totalPages)}</span>
    <Button variant="secondary" aria-label="Next page" disabled={page >= totalPages || busy} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></Button>
  </div>
}
