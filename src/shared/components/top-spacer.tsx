export function TopSpacer({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full pt-[calc(var(--navbar-bottom,var(--navbar-height,80px))+16px)] w-full">
      {children}
    </div>
  )
}
