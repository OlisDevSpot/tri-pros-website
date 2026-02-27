import { ProcessOverview } from '@/features/landing/ui/components/about/process-overview'
import { CompanySocialButtons } from '@/shared/components/company-social-buttons'
import { LogoLink } from '@/shared/components/logo'
import { PdfViewer } from '@/shared/components/pdf-viewer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Separator } from '@/shared/components/ui/separator'

export function TrustedContractor() {
  return (
    <div className="w-full space-y-20">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Trusted Contractor</h2>
          </CardTitle>
          <CardDescription>
            Tri Pros Remodeling is a trusted contractor for all your home improvement needs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex flex-col md:flex-row items-center gap-8 w-full">
            <div className="w-45 h-12.5 shrink-0">
              <LogoLink />
            </div>
            <CompanySocialButtons className="lg:flex-row mt-3" />
          </div>
          <div className="flex flex-col md:flex-row gap-4 w-full">
            <div className="flex-1">
              <div>
                <div>
                  <h2>Our License</h2>
                  <Separator className="mb-4" />
                </div>
                <PdfViewer
                  url="https://pub-e9f58acecb564416a1d1880ba1a88a7f.r2.dev/tpr-license.pdf"
                />
              </div>
            </div>
            <div className="flex-1">
              <div>
                <div>
                  <h2>Our Insurance</h2>
                  <Separator className="mb-4" />
                </div>
                <PdfViewer
                  url="https://pub-e9f58acecb564416a1d1880ba1a88a7f.r2.dev/tpr-coi-2026.pdf"
                />
              </div>
            </div>
          </div>
          <ProcessOverview className="px-0! lg:px-0! w-full pb-0! lg:pb-0! pt-12! lg:pt-12!" />
        </CardContent>
      </Card>
    </div>
  )
}
