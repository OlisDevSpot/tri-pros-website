import { createTRPCRouter } from '../../init'
import { businessRouter } from './business.router'
import { crudRouter } from './crud.router'
import { googleDriveRouter } from './google-drive.router'
import { mediaRouter } from './media.router'
import { showroomDisplayRouter } from './showroom-display.router'

export const projectsRouter = createTRPCRouter({
  showroomDisplay: showroomDisplayRouter,
  crud: crudRouter,
  business: businessRouter,
  media: mediaRouter,
  googleDrive: googleDriveRouter,
})
