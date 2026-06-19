import { cn } from '@/lib/utils'

export function AppShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto flex min-h-dvh w-full max-w-lg flex-col', className)}>
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
      {message}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-red-200">
      {message}
    </div>
  )
}
