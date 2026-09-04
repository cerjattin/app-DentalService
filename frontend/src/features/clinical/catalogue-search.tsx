import { useQuery } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { FormField } from '../../components/forms/form-field'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { LoadingState } from '../../components/feedback/loading-state'
import {
  catalogueKeys,
  searchDiagnoses,
  searchProcedures,
} from './clinical-api'
import { MutationError, Pager } from './clinical-ui'
import { useSearch } from './clinical-model'
import type { ApiResult } from '../../api/client'
import type { PaginationMeta } from '../../types/patient'
import type { DiagnosisCode, SvbProcedure } from '../../types/clinical'

export function CatalogueSearch({
  kind,
  serviceDate,
  onSelect,
}: {
  kind: 'diagnosis' | 'procedure'
  serviceDate: string
  onSelect: (row: DiagnosisCode | SvbProcedure) => void
}) {
  const search = useSearch()
  const query = useQuery<
    ApiResult<(DiagnosisCode | SvbProcedure)[], PaginationMeta>
  >({
    queryKey:
      kind === 'diagnosis'
        ? catalogueKeys.diagnoses(search.q, search.page)
        : catalogueKeys.procedures(search.q, search.page, serviceDate),
    queryFn: ({ signal }) =>
      kind === 'diagnosis'
        ? searchDiagnoses(search.q, search.page, signal)
        : searchProcedures(search.q, search.page, serviceDate, signal),
  })
  const label =
    kind === 'diagnosis' ? 'Search diagnosis codes' : 'Search SVB procedures'
  return (
    <div className="space-y-3">
      <FormField label={label} htmlFor={`${kind}-search`}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <Input
            id={`${kind}-search`}
            className="pl-9"
            maxLength={120}
            value={search.text}
            onChange={(event) => search.setText(event.target.value)}
          />
        </div>
      </FormField>
      {query.isPending ? (
        <LoadingState label="Loading catalogue" />
      ) : query.isError ? (
        <>
          <MutationError error={query.error} />
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </>
      ) : (
        <>
          <ul className="divide-y divide-clinic-border">
            {query.data.data.map((row) => (
              <li key={row.id}>
                <Button
                  variant="ghost"
                  aria-label={`${row.code} ${row.description}`}
                  className="h-auto min-h-11 w-full justify-start whitespace-normal py-3 text-left"
                  disabled={search.settling || query.isFetching}
                  onClick={() => onSelect(row)}
                >
                  <Check size={16} className="shrink-0" />
                  <span>
                    <span className="mr-2 font-mono text-clinic-blue">
                      {row.code}
                    </span>
                    {row.description}
                    {'requiresAuthorization' in row &&
                    row.requiresAuthorization ? (
                      <span className="ml-2 text-xs text-amber-700">
                        Authorization required
                      </span>
                    ) : null}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          {query.data.data.length === 0 ? (
            <p className="text-sm text-slate-500">No matching codes found.</p>
          ) : null}
          <Pager
            page={search.page}
            meta={query.data.meta}
            onChange={search.setPage}
            disabled={search.settling || query.isFetching}
          />
        </>
      )}
    </div>
  )
}
