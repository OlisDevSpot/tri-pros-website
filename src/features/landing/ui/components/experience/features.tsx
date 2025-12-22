import { TextWithLine } from '@/components/text-with-line'

interface Feature {
  name: string
  description: string
  image: string
}

export const experienceFeatures = [
  {
    name: 'MODERN COMMUNICATION FITTING OF 2026',
    description: 'Our unique & proprietary customer success flows allow our clients to interact with their projects real time',
    image: '/hero-photos/modern-house-1.png',
  },
  {
    name: 'Feature 2',
    description: 'Description 2',
    image: '/hero-photos/modern-house-1.png',
  },
  {
    name: 'Feature 3',
    description: 'Description 3',
    image: '/hero-photos/modern-house-1.png',
  },
] as const satisfies Feature[]

export function ExperienceFeatures() {
  return (
    <section className="container">
      <div className="space-y-12">
        <TextWithLine text="Proprietary Customer Success Flows" />
        <div className="flex flex-col gap-4">
          {experienceFeatures.map(feature => (
            <ExperienceFeature
              key={feature.name}
              feature={feature}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

interface FeatureProps {
  feature: Feature
}

export function ExperienceFeature({ feature }: FeatureProps) {
  return (
    <div className="flex gap-8 w-full rounded-4xl border shadow-md min-h-[700px] p-8">
      <div className="flex flex-col gap-4">
        <h3 className="text-2xl font-bold">{feature.name}</h3>
        <p>{feature.description}</p>
      </div>
    </div>
  )
}
