import { AlertCircle, MailCheck } from 'lucide-react'
import * as React from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AuthLayout } from '@/app/layouts/auth-layout'
import { AppLoading } from '@/app/states/app-loading'
import { FormField } from '@/components/shared/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage, signUp } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { registrationSchema, type RegistrationValues } from '@/features/auth/validation'

type FieldErrors = Partial<Record<keyof RegistrationValues, string>>

const EMPTY_VALUES: RegistrationValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export function RegisterPage() {
  const { status, user } = useSession()
  const navigate = useNavigate()
  const [values, setValues] = React.useState<RegistrationValues>(EMPTY_VALUES)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmationSent, setConfirmationSent] = React.useState(false)

  if (status === 'loading') {
    return <AppLoading label="Checking session" />
  }

  if (user) {
    if (user.status === 'pending') {
      return <Navigate to="/pending" replace />
    }

    if (user.status === 'suspended' || user.status === 'deactivated') {
      return <Navigate to="/unauthorized" replace state={{ reason: user.status }} />
    }

    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const parsed = registrationSchema.safeParse(values)

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors
      setFieldErrors({
        fullName: flattened.fullName?.[0],
        email: flattened.email?.[0],
        password: flattened.password?.[0],
        confirmPassword: flattened.confirmPassword?.[0],
      })
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      const result = await signUp(parsed.data.fullName, parsed.data.email, parsed.data.password)

      if (result.needsEmailConfirmation) {
        setConfirmationSent(true)
      } else {
        navigate('/pending', { replace: true })
      }
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmationSent) {
    return (
      <AuthLayout
        title="Check your email"
        description="This project requires email confirmation before the account can finish registering."
      >
        <div className="rounded-md border border-border bg-surface-1 p-5">
          <div className="flex items-start gap-3">
            <MailCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-text">One more step</p>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                Open the confirmation link sent to{' '}
                <span className="font-medium text-text">{values.email}</span>, then sign in. The
                pending registration is created automatically at that point.
              </p>
            </div>
          </div>

          <Button asChild variant="secondary" className="mt-4 w-full">
            <Link to="/sign-in">Go to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create an account"
      description="Register once; a Super Admin reviews the request before club modules open."
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
          <FormField
            id="register-full-name"
            label="Full name"
            description="Use the name the club knows you by."
            error={fieldErrors.fullName}
            required
          >
            {(field) => (
              <Input
                {...field}
                autoComplete="name"
                value={values.fullName}
                onChange={(event) =>
                  setValues((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            )}
          </FormField>

          <FormField id="register-email" label="Email" error={fieldErrors.email} required>
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

          <FormField
            id="register-password"
            label="Password"
            description="At least 8 characters."
            error={fieldErrors.password}
            required
          >
            {(field) => (
              <Input
                {...field}
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(event) =>
                  setValues((current) => ({ ...current, password: event.target.value }))
                }
              />
            )}
          </FormField>

          <FormField
            id="register-confirm-password"
            label="Confirm password"
            error={fieldErrors.confirmPassword}
            required
          >
            {(field) => (
              <Input
                {...field}
                type="password"
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
              />
            )}
          </FormField>
        </div>

        <Button type="submit" className="mt-5 w-full" loading={submitting}>
          Submit registration
        </Button>

        <p className="mt-4 text-center text-sm text-text-muted">
          Already registered?{' '}
          <Link to="/sign-in" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
