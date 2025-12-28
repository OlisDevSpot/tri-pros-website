import { CompanySocialButtons } from '@/components/company-social-buttons'
import { Logo } from '@/components/logo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProcessOverview } from '@/features/landing/ui/components/about/process-overview'

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
            <Logo />
          </div>
          <CompanySocialButtons className="lg:flex-row" />
        </CardContent>
      </Card>
      <ProcessOverview />
    </div>
  )
}
