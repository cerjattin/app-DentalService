import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import type { Patient, PatientWriteDto } from '../../types/patient'

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .refine((value) => value === '' || z.email().safeParse(value).success, {
    message: 'Enter a valid email address.',
  })

const patientFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(120),
  middleName: z.string().trim().max(120),
  lastName: z.string().trim().min(1, 'Last name is required.').max(120),
  secondLastName: z.string().trim().max(120),
  dateOfBirth: z.string(),
  sex: z.enum(['', 'FEMALE', 'MALE', 'OTHER', 'UNKNOWN']),
  documentType: z.string().trim().max(50),
  documentNumber: z.string().trim().max(80),
  email: optionalEmail,
  phone: z.string().trim().max(40),
  mobilePhone: z.string().trim().max(40),
  addressLine1: z.string().trim().max(255),
  addressLine2: z.string().trim().max(255),
  city: z.string().trim().max(120),
  countryCode: z
    .string()
    .trim()
    .refine((value) => value === '' || value.length === 2, {
      message: 'Use a two-letter country code.',
    }),
})

type PatientFormValues = z.infer<typeof patientFormSchema>

const emptyValues: PatientFormValues = {
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  dateOfBirth: '',
  sex: '',
  documentType: '',
  documentNumber: '',
  email: '',
  phone: '',
  mobilePhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  countryCode: '',
}

function valuesForPatient(patient?: Patient): PatientFormValues {
  if (!patient) return emptyValues
  return {
    firstName: patient.firstName,
    middleName: patient.middleName ?? '',
    lastName: patient.lastName,
    secondLastName: patient.secondLastName ?? '',
    dateOfBirth: patient.dateOfBirth ?? '',
    sex: patient.sex ?? '',
    documentType: patient.documentType ?? '',
    documentNumber: patient.documentNumber ?? '',
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    mobilePhone: patient.mobilePhone ?? '',
    addressLine1: patient.addressLine1 ?? '',
    addressLine2: patient.addressLine2 ?? '',
    city: patient.city ?? '',
    countryCode: patient.countryCode ?? '',
  }
}

function nullable(value: string) {
  return value || null
}

function toDto(values: PatientFormValues): PatientWriteDto {
  return {
    firstName: values.firstName,
    middleName: nullable(values.middleName),
    lastName: values.lastName,
    secondLastName: nullable(values.secondLastName),
    dateOfBirth: nullable(values.dateOfBirth),
    sex: values.sex || null,
    documentType: nullable(values.documentType),
    documentNumber: nullable(values.documentNumber),
    email: nullable(values.email),
    phone: nullable(values.phone),
    mobilePhone: nullable(values.mobilePhone),
    addressLine1: nullable(values.addressLine1),
    addressLine2: nullable(values.addressLine2),
    city: nullable(values.city),
    countryCode: values.countryCode ? values.countryCode.toUpperCase() : null,
  }
}

export function PatientFormDialog({
  open,
  onOpenChange,
  patient,
  onSubmit,
  isPending,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient?: Patient
  onSubmit: (values: PatientWriteDto) => void
  isPending: boolean
  error?: unknown
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: valuesForPatient(patient),
  })

  useEffect(() => {
    if (open) reset(valuesForPatient(patient))
  }, [open, patient, reset])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={patient ? 'Edit patient' : 'Create patient'}
      description="Enter only information confirmed by the patient."
      size="wide"
    >
      <form className="space-y-5" onSubmit={handleSubmit((values) => onSubmit(toDto(values)))}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message}>
            <Input id="firstName" autoFocus {...register('firstName')} />
          </FormField>
          <FormField label="Middle name" htmlFor="middleName" error={errors.middleName?.message}>
            <Input id="middleName" {...register('middleName')} />
          </FormField>
          <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
            <Input id="lastName" {...register('lastName')} />
          </FormField>
          <FormField label="Second last name" htmlFor="secondLastName" error={errors.secondLastName?.message}>
            <Input id="secondLastName" {...register('secondLastName')} />
          </FormField>
          <FormField label="Date of birth" htmlFor="dateOfBirth" error={errors.dateOfBirth?.message}>
            <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
          </FormField>
          <FormField label="Sex" htmlFor="sex" error={errors.sex?.message}>
            <Select id="sex" {...register('sex')}>
              <option value="">Not provided</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
              <option value="UNKNOWN">Unknown</option>
            </Select>
          </FormField>
          <FormField label="Document type" htmlFor="documentType" error={errors.documentType?.message}>
            <Input id="documentType" {...register('documentType')} />
          </FormField>
          <FormField label="Document number" htmlFor="documentNumber" error={errors.documentNumber?.message}>
            <Input id="documentNumber" {...register('documentNumber')} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </FormField>
          <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" {...register('phone')} />
          </FormField>
          <FormField label="Mobile phone" htmlFor="mobilePhone" error={errors.mobilePhone?.message}>
            <Input id="mobilePhone" type="tel" {...register('mobilePhone')} />
          </FormField>
          <FormField label="City" htmlFor="city" error={errors.city?.message}>
            <Input id="city" {...register('city')} />
          </FormField>
          <FormField label="Address line 1" htmlFor="addressLine1" error={errors.addressLine1?.message}>
            <Input id="addressLine1" {...register('addressLine1')} />
          </FormField>
          <FormField label="Address line 2" htmlFor="addressLine2" error={errors.addressLine2?.message}>
            <Input id="addressLine2" {...register('addressLine2')} />
          </FormField>
          <FormField label="Country code" htmlFor="countryCode" error={errors.countryCode?.message} hint="Two-letter code, for example CW.">
            <Input id="countryCode" maxLength={2} className="uppercase" {...register('countryCode')} />
          </FormField>
        </div>
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
            {isPending ? 'Saving...' : patient ? 'Save changes' : 'Create patient'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
