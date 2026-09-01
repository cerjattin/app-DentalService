import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api'
import { getCurrentUser, login, type LoginCredentials } from '../../auth/auth-api'
import { useAuth } from '../../auth/use-auth'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Input } from '../../components/ui/input'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.').max(256),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const { isAuthenticated, setAccessToken, setUser, clearSession } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const from = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname ?? '/dashboard'
  }, [location.state])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const loginResult = await login(credentials)
      setAccessToken(loginResult.accessToken)

      return queryClient.fetchQuery({
        queryKey: ['auth', 'me'],
        queryFn: getCurrentUser,
        staleTime: 60_000,
      })
    },
    onSuccess: (user) => {
      setUser(user)
      navigate(from, { replace: true })
    },
    onError: (error) => {
      clearSession()
      setAuthError(getApiErrorMessage(error))
    },
  })

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="grid min-h-svh bg-clinic-surface lg:grid-cols-[minmax(420px,520px)_1fr]">
      <section className="hidden items-center justify-center bg-clinic-navy px-8 py-10 text-white lg:flex">
        <div className="max-w-sm">
          <div className="mb-12 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-clinic-blue text-base font-bold">
              OS
            </div>
            <div>
              <div className="font-semibold">Odontho Services</div>
              <div className="font-mono text-xs uppercase tracking-wide text-white/40">
                SVB Billing System
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-semibold leading-snug">
            Clinical billing access for SVB workflows
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/55">
            Internal workspace for patient intake, clinical activity, invoices,
            signatures, and declarations.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <Card className="w-full max-w-md p-7">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use your Odontho Services account to continue.
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              setAuthError(null)
              loginMutation.mutate(values)
            })}
          >
            <FormField
              htmlFor="email"
              label="Email"
              error={form.formState.errors.email?.message}
            >
              <Input
                id="email"
                autoComplete="email"
                autoFocus
                disabled={loginMutation.isPending}
                {...form.register('email')}
              />
            </FormField>

            <FormField
              htmlFor="password"
              label="Password"
              error={form.formState.errors.password?.message}
            >
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-10"
                  disabled={loginMutation.isPending}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinic-blue/30"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={loginMutation.isPending}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>

            {authError ? (
              <div
                role="alert"
                className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                {authError}
              </div>
            ) : null}

            <Button
              className="w-full"
              type="submit"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </section>
    </main>
  )
}
