import { ExternalLinkIcon } from 'lucide-react'

import { COMPANY_INFO, USEFUL_LINKS } from '@/features/agent-settings/constants/company-info'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

export function CompanyInfoSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Info</CardTitle>
        <CardDescription>Tri Pros Remodeling company details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Company</span>
            <span className="font-medium">{COMPANY_INFO.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">License</span>
            <span className="font-medium">{COMPANY_INFO.license}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium">{COMPANY_INFO.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{COMPANY_INFO.email}</span>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Useful Links</p>
          <div className="flex flex-col gap-1.5">
            {USEFUL_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLinkIcon className="size-3.5" />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
