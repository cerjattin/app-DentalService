import { deploymentContext } from '../../app/deployment-context'

export function EnvironmentNotice() {
  const context = deploymentContext(import.meta.env.VITE_APP_ENVIRONMENT, import.meta.env.VITE_APP_VERSION)
  return <aside aria-label="Application environment" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-clinic-border bg-slate-100 px-4 py-1 text-xs text-slate-700">
    <p><strong>{context.label}</strong> · {context.release}</p><p>SVB submission pending · No automatic submission</p>
  </aside>
}
