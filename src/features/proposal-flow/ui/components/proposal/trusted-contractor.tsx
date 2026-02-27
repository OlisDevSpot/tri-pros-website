import Image from 'next/image'
import { ProcessOverview } from '@/features/landing/ui/components/about/process-overview'
import { CompanySocialButtons } from '@/shared/components/company-social-buttons'
import { LogoLink } from '@/shared/components/logo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Separator } from '@/shared/components/ui/separator'

const DOCS = {
  license: {
    title: 'License',
    subtitle: 'Verified and current',
    src: 'https://pub-e9f58acecb564416a1d1880ba1a88a7f.r2.dev/tpr-license.jpg',
    alt: 'Tri Pros Remodeling contractor license',
  },
  insurance: {
    title: 'Insurance',
    subtitle: 'Liability coverage on file',
    src: 'https://pub-e9f58acecb564416a1d1880ba1a88a7f.r2.dev/tpr-coi-2026.jpg',
    alt: 'Tri Pros Remodeling certificate of insurance',
  },
} as const

export function TrustedContractor() {
  return (
    <div className="w-full space-y-20">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle><h2>Trusted Contractor</h2></CardTitle>
          <CardDescription>
            Licensed and insured. Clear scope, clean work, and professional communication from start to finish.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-10">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:items-center">
            <div className="h-12.5 w-45 shrink-0">
              <LogoLink />
            </div>
            <CompanySocialButtons className="lg:flex-row" />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Credentials</h3>
              <Separator className="mt-2" />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {(Object.values(DOCS) as Array<(typeof DOCS)[keyof typeof DOCS]>).map(doc => (
                <section key={doc.title} className="min-w-0 space-y-3">
                  <header>
                    <div className="flex items-baseline justify-between gap-3">
                      <h4 className="text-base font-semibold">{doc.title}</h4>
                      <span className="text-xs text-muted-foreground">{doc.subtitle}</span>
                    </div>
                  </header>

                  <div className="overflow-hidden rounded-xl bg-muted ring-1 ring-black/10">
                    <Image
                      src={doc.src}
                      alt={doc.alt}
                      width={1200}
                      height={1600}
                      className="h-auto w-full"
                      priority={doc.title === 'License'}
                    />
                  </div>
                </section>
              ))}
            </div>
          </div>

          <ProcessOverview className="w-full px-0! pb-0! pt-12! lg:px-0! lg:pb-0! lg:pt-12!" />
        </CardContent>
      </Card>
    </div>
  )
}
