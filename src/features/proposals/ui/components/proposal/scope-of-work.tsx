import { motion } from 'motion/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ScopeOfWork() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Scope of Work</h2>
          </CardTitle>
          <CardDescription>Ensure your information matches with our records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h3>
              SCOPE OF WORK
            </h3>
          </div>
          <div>
            <div>
              <h3>
                OPTIONAL SCOPE OF WORK
              </h3>
              <p>These go well with the scope of work you have selected. Often, fixed costs will be deducted for combining projects</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
