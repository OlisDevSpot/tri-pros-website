import { motion } from 'motion/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

export function Funding() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Funding Summary</h2>
          </CardTitle>
          <CardDescription>Home improvement, at your own terms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8"></CardContent>
      </Card>
    </motion.div>
  )
}
