import { AlertCircle } from 'lucide-react'
import * as React from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { AuthLayout } from '@/app/layouts/auth-layout'
import { AppLoading } from '@/app/states/app-loading'
import { FormField } from '@/components/shared/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage, signIn } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { signInSchema, type SignInValues } from '@/features/auth/validation'

interface SignInLocationState {
  from?: string
}

type FieldErrors = Partial<Record<keyof SignInValues, string>>

export function SignInPage() {
  const { status, user } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = React.useState<SignInValues>({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  if (status === 'loading') {
    return <AppLoading label="Checking session" />
  }

  const from = (location.state as SignInLocationState | null)?.from ?? '/'

  if (user) {
    if (user.status === 'pending') {
      return <Navigate to="/pending" replace />
    }

    if (user.status === 'suspended' || user.status === 'deactivated') {
      return <Navigate to="/unauthorized" replace state={{ reason: user.status }} />
    }

    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const parsed = signInSchema.safeParse(values)

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors
      setFieldErrors({
        email: flattened.email?.[0],
        password: flattened.password?.[0],
      })
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      await signIn(parsed.data.email, parsed.data.password)
      navigate(from, { replace: true })
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in to MBC Arena"
      description="Use the email and password attached to your approved club account."
    >
      <form className="rounded-md border border-border bg-surface-1 p-5" onSubmit={handleSubmit}>
        {formError ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-sm border border-danger-soft bg-danger-soft px-3 py-2.5"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <p className="text-sm text-text-muted">{formError}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <FormField id="sign-in-email" label="Email" error={fieldErrors.email} required>
            {(field) => (
              <Input
                {...field}
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={(event) =>
                  setValues((current) => ({ ...current, email: event.target.value }))
                }
              />
            )}
          </FormField>

          <FormField id="sign-in-password" label="Password" error={fieldErrors.password} required>
            {(field) => (
              <Input
                {...field}
                type="password"
                autoComplete="current-password"
                value={values.password}
                onChange={(event) =>
                  setValues((current) => ({ ...current, password: event.target.value }))
                }
              />
            )}
          </FormField>
        </div>

        <Button type="submit" className="mt-5 w-full" loading={submitting}>
          Sign in
        </Button>

        <p className="mt-4 text-center text-sm text-text-muted">
          New member?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
