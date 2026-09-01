import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'

const schema = z.object({
  verificationSource: z
    .string()
    .trim()
    .min(1, 'Verification source is required.')
    .max(80),
})

type Values = z.infer<typeof schema>

export function VerifyInsuranceDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (source: string) => void
  isPending: boolean
  error?: unknown
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { verificationSource: '' },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Verify insurance"
      description="Record the source used to confirm this coverage."
    >
      <form className="space-y-4" onSubmit={handleSubmit((values) => onSubmit(values.verificationSource))}>
        <FormField
          label="Verification source"
          htmlFor="verificationSource"
          error={errors.verificationSource?.message}
          hint="For example, the payer portal or a payer representative."
        >
          <Input id="verificationSource" autoFocus {...register('verificationSource')} />
        </FormField>
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-clinic-danger">
            {getApiErrorMessage(error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-clinic-border pt-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Verifying...' : 'Record verification'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
