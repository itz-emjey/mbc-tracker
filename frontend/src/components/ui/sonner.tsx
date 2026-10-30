import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Toast host. Mounted once at the application root (Group D).
 * Styled with the approved tokens — no coloured shadows, no washes.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group !rounded-md !border !border-border !bg-surface-3 !font-sans !text-text !shadow-elevated',
          title: '!text-sm !font-medium !text-text',
          description: '!text-sm !text-text-muted',
          actionButton: '!rounded-sm !bg-accent !text-accent-foreground',
          cancelButton: '!rounded-sm !bg-surface-2 !text-text-muted',
          closeButton: '!border-border !bg-surface-2 !text-text-muted',
          success: '!border-accent',
          error: '!border-danger',
          warning: '!border-warning',
          info: '!border-info',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
