import type { FunnelContext, ProblemBlockContent } from '@/shared/domains/funnels/types'
import { ShieldCheck, TriangleAlert } from 'lucide-react'
import Image from 'next/image'

type PosterPoint = ProblemBlockContent['points'][number] & { image: string }

export function ProblemBlock({ content }: { content: ProblemBlockContent, ctx: FunnelContext }) {
  // When EVERY reason ships a poster (its headline baked into the art), render an
  // editorial gallery wall: the poster is the hero and carries its own title, the
  // body becomes a numbered figure-caption beneath it. Funnels without posters
  // keep the text-card treatment. The type guard narrows `image` to a string so
  // there's no non-null assertion at the call site.
  const posters = content.points.filter((p): p is PosterPoint => Boolean(p.image))
  const asGallery = posters.length > 0 && posters.length === content.points.length

  return (
    <section className="flex flex-col gap-8 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-foreground text-2xl font-semibold">{content.headline}</h2>
        {content.body ? <p className="text-muted-foreground max-w-2xl text-balance">{content.body}</p> : null}
      </div>

      {asGallery
        ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-4 lg:gap-x-5">
              {posters.map((p, i) => (
                <li key={p.title}>
                  <figure className="flex flex-col gap-3">
                    <div className="border-border overflow-hidden rounded-xl border shadow-sm">
                      <Image
                        src={p.image}
                        alt={p.alt ?? p.title}
                        width={880}
                        height={1168}
                        sizes="(max-width: 1024px) 45vw, 240px"
                        className="h-auto w-full"
                      />
                    </div>
                    <figcaption className="flex gap-2.5 px-0.5">
                      <span className="text-primary text-sm font-semibold tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-muted-foreground text-pretty text-sm leading-relaxed">{p.body}</span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          )
        : (
            <div className="grid gap-4 sm:grid-cols-2">
              {content.points.map(p => (
                <div key={p.title} className="border-border bg-card flex flex-col gap-2 rounded-lg border p-5 shadow-sm">
                  <div className="text-foreground flex items-center gap-2.5 font-semibold">
                    <span className="bg-destructive/10 text-destructive flex size-8 shrink-0 items-center justify-center rounded-md">
                      <TriangleAlert className="size-4" aria-hidden="true" />
                    </span>
                    {p.title}
                  </div>
                  <p className="text-muted-foreground text-sm">{p.body}</p>
                </div>
              ))}
            </div>
          )}

      {content.standardLine
        ? (
            <div className="border-border mx-auto flex max-w-2xl flex-col items-center gap-3 border-t pt-8 text-center">
              <span className="text-primary inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em]">
                <ShieldCheck className="size-4" aria-hidden="true" />
                The standard
              </span>
              <p className="text-foreground text-pretty text-base leading-relaxed sm:text-lg">{content.standardLine}</p>
            </div>
          )
        : null}
    </section>
  )
}
