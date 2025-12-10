import { ViewportHero } from '@/components/viewport-hero'
import { services } from '@/features/landing/data/company/services'

type Service = (typeof services)[number]['slug']

interface Props {
  params: Promise<{
    serviceId: Service
  }>
}

export default async function ServicePage(props: Props) {
  const params = await props.params

  const currentService = services.find(service => service.slug === params.serviceId)!

  return (
    <ViewportHero>
      <div>
        <h1>
          {currentService.title}
        </h1>
      </div>
    </ViewportHero>
  )
}
