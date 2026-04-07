'use client'

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/shared/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'

interface Props {
  page: number
  totalPages: number
  totalFiltered: number
  perPage: '10' | '20'
  onPageChange: (page: number) => void
  onPerPageChange: (value: '10' | '20') => void
  hidePerPageSelector?: boolean
}

export function PortfolioPagination({
  page,
  totalPages,
  totalFiltered,
  perPage,
  onPageChange,
  onPerPageChange,
  hidePerPageSelector = false,
}: Props) {
  if (totalFiltered === 0) {
    return null
  }

  const perPageNum = Number(perPage)
  const start = (page - 1) * perPageNum + 1
  const end = Math.min(page * perPageNum, totalFiltered)

  // Build visible page numbers with ellipsis
  const pages: (number | 'ellipsis')[] = []
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  }
  else {
    pages.push(1)
    if (page > 3) {
      pages.push('ellipsis')
    }
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) {
      pages.push('ellipsis')
    }
    pages.push(totalPages)
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      {/* Results count + per-page selector */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {start}
          –
          {end}
          {' of '}
          {totalFiltered}
          {' projects'}
        </span>
        {!hidePerPageSelector && (
          <Select value={perPage} onValueChange={v => onPerPageChange(v as '10' | '20')}>
            <SelectTrigger className="h-8 w-17.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={(e) => {
                  e.preventDefault()
                  if (page > 1) {
                    onPageChange(page - 1)
                  }
                }}
                aria-disabled={page <= 1}
                className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>

            {pages.map((p, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <PaginationItem key={`${p}-${i}`}>
                {p === 'ellipsis'
                  ? <PaginationEllipsis />
                  : (
                      <PaginationLink
                        isActive={p === page}
                        onClick={(e) => {
                          e.preventDefault()
                          onPageChange(p)
                        }}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                onClick={(e) => {
                  e.preventDefault()
                  if (page < totalPages) {
                    onPageChange(page + 1)
                  }
                }}
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
