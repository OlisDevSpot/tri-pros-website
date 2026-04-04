import { PipelineProvider } from '@/shared/pipelines/hooks/pipeline-context'

export default function PipelineLayout({ children }: { children: React.ReactNode }) {
  return <PipelineProvider>{children}</PipelineProvider>
}
