import { PipelineProvider } from '@/shared/domains/pipelines/hooks/pipeline-context'

export default function PipelineLayout({ children }: { children: React.ReactNode }) {
  return <PipelineProvider>{children}</PipelineProvider>
}
