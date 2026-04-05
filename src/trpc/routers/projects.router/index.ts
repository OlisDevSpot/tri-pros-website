import { createTRPCRouter } from '../../init'
import { businessRouter } from './business.router'
import { googleDriveRouter } from './google-drive.router'
import { mediaRouter } from './media.router'
import { portfolioCrudRouter } from './portfolio-crud.router'
import { portfolioRouter } from './portfolio.router'

export const projectsRouter = createTRPCRouter({
  portfolio: portfolioRouter,
  portfolioCrud: portfolioCrudRouter,
  business: businessRouter,
  media: mediaRouter,
  googleDrive: googleDriveRouter,
})
