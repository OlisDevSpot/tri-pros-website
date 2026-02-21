import { S3Client } from '@aws-sdk/client-s3'
import env from '@/shared/config/server-env'

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/tpr-portfolio-projects`,
  forcePathStyle: false,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
})

export const BUCKET = env.R2_BUCKET_NAME
