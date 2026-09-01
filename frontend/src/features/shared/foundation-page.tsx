import { PageHeader } from '../../components/app-shell/page-header'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { EmptyState } from '../../components/feedback/empty-state'
import { Card } from '../../components/ui/card'

interface FoundationPageProps {
  title: string
  description: string
  tableTitle?: string
}

const columns: DataTableColumn<{ id: string; status: string }>[] = [
  { key: 'id', header: 'Reference', render: (row) => row.id },
  { key: 'status', header: 'Status', render: (row) => row.status },
]

export function FoundationPage({
  title,
  description,
  tableTitle = 'Foundation table',
}: FoundationPageProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <DataTable
          columns={columns}
          rows={[]}
          getRowKey={(row) => row.id}
          emptyMessage={`${tableTitle} has no records yet.`}
        />
        <Card className="p-4">
          <EmptyState
            title="Workflow not implemented in F01"
            description="This route is available for navigation, authorization, and layout validation only."
          />
        </Card>
      </div>
    </div>
  )
}
