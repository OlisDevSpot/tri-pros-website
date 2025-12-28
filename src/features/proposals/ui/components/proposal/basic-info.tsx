import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { homeownerInfoFields } from '@/features/proposals/constants/homeowner-info'
import { Heading } from './heading'

export function BasicInfo() {
  return (
    <div className="space-y-20">
      <Heading />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Homeowner Info</h2>
          </CardTitle>
          <CardDescription>Ensure your information matches with our records</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-8 w-full">
          {homeownerInfoFields.map(field => (
            <div
              key={field.name}
              className="flex items-center gap-2"
            >
              <field.Icon className="w-5 h-5 text-muted-foreground" />
              <p className="">{field.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
