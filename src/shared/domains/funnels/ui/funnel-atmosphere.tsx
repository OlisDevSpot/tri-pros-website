import { Decor } from '@/shared/components/decor/decor'

/**
 * Page-level atmosphere: subtle brand-blue blueprint textures scattered behind
 * the funnel content, alternating sides as you scroll. Decorative only — sits in
 * a `-z-10` layer (the parent must be `relative` + clip overflow) so it never
 * intercepts input or shifts layout. NOT placed inside any block container.
 */
export function FunnelAtmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <Decor placement="free" shape="arc" className="top-[5%] -right-[120px] size-[440px] opacity-50" />
      <Decor placement="free" shape="square" className="top-[30%] -left-[150px] size-[520px] opacity-40" />
      <Decor placement="free" shape="triangle" className="top-[55%] -right-[130px] size-[420px] opacity-45" />
      <Decor placement="free" shape="square" className="top-[80%] -left-[120px] size-[400px] opacity-40" />
    </div>
  )
}
