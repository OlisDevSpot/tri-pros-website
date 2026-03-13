'use client'

import { MapPinIcon, QuoteIcon } from 'lucide-react'
import { resultColorMap, stories } from '@/features/meetings/constants/step-content'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Separator } from '@/shared/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { cn } from '@/shared/lib/utils'

export function StoriesStep() {
  return (
    <Tabs className="flex flex-col gap-3" defaultValue="ramirez">
      <TabsList className="w-full">
        <TabsTrigger className="flex-1 text-xs" value="ramirez">Ramirez</TabsTrigger>
        <TabsTrigger className="flex-1 text-xs" value="gutierrez">Gutierrez</TabsTrigger>
        <TabsTrigger className="flex-1 text-xs" value="kim">Kim</TabsTrigger>
      </TabsList>

      {stories.map(story => (
        <TabsContent key={story.id} value={story.id}>
          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b bg-muted/20 px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold">{story.family}</CardTitle>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPinIcon className="size-3 shrink-0" />
                    <span>{story.location}</span>
                  </div>
                </div>
                <Badge className="shrink-0 text-xs" variant="outline">
                  {story.scope}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-5 py-4">
              <p className="text-sm italic text-muted-foreground">{story.context}</p>

              <div className="flex flex-col gap-2">
                {story.results.map(result => (
                  <div
                    className={cn('rounded-lg border px-3 py-2 text-xs font-medium', resultColorMap[result.color])}
                    key={result.label}
                  >
                    {result.label}
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex gap-2">
                <QuoteIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-sm italic leading-relaxed text-muted-foreground">{story.quote}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  )
}
