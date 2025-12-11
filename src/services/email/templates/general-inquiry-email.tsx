import type { inferInput } from '@trpc/tanstack-react-query'
import type { trpc } from '@/trpc/server'
import { Html } from '@react-email/components'
import * as React from 'react'

type InputData = inferInput<typeof trpc.landingRouter.generalInquiry>

interface EmailTemplateProps {
  data: InputData
}

export function GeneralInquiryEmail({ data }: EmailTemplateProps) {
  return (
    <Html>
      <div>
        <h1>
          General Inquiry form filled!
        </h1>
        <div>
          <p>
            Name:
            {' '}
            {data.name}
          </p>
          <p>
            Email:
            {' '}
            {data.email}
          </p>
          <p>
            Phone:
            {' '}
            {data.phone}
          </p>
          <p>
            Description:
            {' '}
            {data.projectDescription}
          </p>
        </div>
      </div>
    </Html>
  )
}
