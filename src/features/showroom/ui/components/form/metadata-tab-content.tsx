'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { BasicInfoFields } from './basic-info-fields'
import { HomeownerFields } from './homeowner-fields'
import { StoryContentFields } from './story-content-fields'
import { TradeScopePickerFields } from './trade-scope-picker-fields'

export function MetadataTabContent() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Project title, location, and visibility settings</CardDescription>
        </CardHeader>
        <CardContent>
          <BasicInfoFields />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Story Content</CardTitle>
          <CardDescription>Tell the story of this project from start to finish</CardDescription>
        </CardHeader>
        <CardContent>
          <StoryContentFields />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Homeowner</CardTitle>
          <CardDescription>Homeowner details and testimonial</CardDescription>
        </CardHeader>
        <CardContent>
          <HomeownerFields />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scopes</CardTitle>
          <CardDescription>Select the trades and scopes of work included in this project</CardDescription>
        </CardHeader>
        <CardContent>
          <TradeScopePickerFields />
        </CardContent>
      </Card>
    </div>
  )
}
