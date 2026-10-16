import type { ReactNode } from 'react'

interface DataViewTitleProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4'
  className?: string
  children: ReactNode
}

export function DataViewTitle({ as: Tag = 'h2', className, children }: DataViewTitleProps) {
  return <Tag className={className}>{children}</Tag>
}
