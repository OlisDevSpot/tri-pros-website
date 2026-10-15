import type { ComparisonRow } from '@/features/meeting-flow/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { COMPARISON_COLUMNS } from '@/features/meeting-flow/constants/who-we-are-slides'

export function ComparisonList({ rows }: { rows: ComparisonRow[] }) {
  return (
    <>
      <table className="hidden w-full table-fixed border-collapse text-sm @min-[700px]/proposal:table">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[40%]" />
          <col className="w-[34%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col"><span className="sr-only">Topic</span></th>
            <th scope="col" className="bg-(--presentation-ground) px-4 py-3 font-bold text-on-media">{COMPARISON_COLUMNS.triPros}</th>
            <th scope="col" className="px-4 py-3 font-semibold text-muted-foreground">{COMPARISON_COLUMNS.others}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-b border-border align-top">
              <th scope="row" className="px-4 py-3 text-left font-bold">{row.label}</th>
              <td className="bg-band px-4 py-3">
                <CheckIcon className="mr-2 inline size-4 text-status-success-fg" />
                {row.triPros}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <XIcon className="mr-2 inline size-4" />
                {row.others}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="grid gap-3 @min-[700px]/proposal:hidden">
        {rows.map(row => (
          <li key={row.label} className="overflow-hidden rounded-lg border border-border bg-card">
            <h3 className="px-4 pt-3 text-sm font-bold">{row.label}</h3>
            <p className="px-4 pt-2 text-sm">
              <CheckIcon className="mr-2 inline size-4 text-status-success-fg" />
              <b>
                {COMPARISON_COLUMNS.triPros}
                :
                {' '}
              </b>
              {row.triPros}
            </p>
            <p className="px-4 pb-3 pt-1 text-sm text-muted-foreground">
              <XIcon className="mr-2 inline size-4" />
              {`${COMPARISON_COLUMNS.others}: ${row.others}`}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
