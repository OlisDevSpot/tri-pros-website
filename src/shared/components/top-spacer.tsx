export function TopSpacer({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full pt-[calc(var(--navbar-height)+16px)] w-full">
      {children}
    </div>
  )
}
