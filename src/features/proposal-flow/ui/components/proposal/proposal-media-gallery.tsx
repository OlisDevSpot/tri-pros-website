import type { ProposalMediaView } from '@/shared/entities/proposal-media-files/dal/server/queries'
import { FileText } from 'lucide-react'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

/**
 * Homeowner-facing media gallery shown above the SOW. Images + videos render
 * inline; PDFs render as download links. Renders null when there's no media.
 * `media` is already homeowner-visibility-only + public-derived (from getFullView).
 */
export function ProposalMediaGallery({ media }: { media: ProposalMediaView[] }) {
  const visual = media.filter(m => m.mimeType.startsWith('image/') || m.mimeType.startsWith('video/'))
  const pdfs = media.filter(m => m.mimeType === 'application/pdf')

  if (visual.length === 0 && pdfs.length === 0)
    return null

  return (
    <Card>
      <CardHeader className="text-center md:text-start">
        <CardTitle><h2>Project Media</h2></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {visual.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {visual.map(item => (
              <div key={item.id} className="relative aspect-4/3 overflow-hidden rounded-xl bg-muted">
                {item.mimeType.startsWith('video/')
                  ? (
                      <video
                        src={item.url}
                        className="h-full w-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )
                  : (
                      <OptimizedImage
                        file={item}
                        alt={item.name}
                        fill
                        sizes="(max-width: 768px) 45vw, 220px"
                      />
                    )}
              </div>
            ))}
          </div>
        )}

        {pdfs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pdfs.map(item => (
              item.url
                ? (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate max-w-[220px]">{item.name}</span>
                    </a>
                  )
                : null
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
