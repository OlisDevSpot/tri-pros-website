import { ProcessOverview } from '@/features/landing/ui/components/about/process-overview'
import { CompanySocialButtons } from '@/shared/components/company-social-buttons'
import { LogoLink } from '@/shared/components/logo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

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
        <CardContent>
          <div className="w-[180px] h-[50px] shrink-0">
            <LogoLink />
          </div>
          <CompanySocialButtons className="lg:flex-row" />
        </CardContent>
      </Card>
      <ProcessOverview className="px-0! lg:px-0! w-full" />
    </div>
  )
}
