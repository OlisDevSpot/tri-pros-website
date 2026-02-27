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
          New lead inquiry
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
          {data.address && (
            <p>
              Address:
              {' '}
              {data.address.fullAddress}
            </p>
          )}
          <p>
            Description:
            {' '}
            {data.inquiryDescription}
          </p>
        </div>
      </div>
    </Html>
  )
}
