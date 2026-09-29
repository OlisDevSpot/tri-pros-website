import env from '@/shared/config/server-env'
import { sendMeetingRemindersJob } from '@/shared/services/providers/upstash/jobs/send-meeting-reminders'

// Vercel Cron entry point. Vercel is only the clock: the batch itself runs as a QStash job so
// it keeps retries, the 60 s maxDuration on /api/qstash-jobs, and one code path with the
// QStash-scheduled variant. Vercel sends `Authorization: Bearer $CRON_SECRET` on cron hits;
// the same header lets an admin curl this route to run tomorrow's batch on demand.
//
// vercel.json (UTC only; 6 pm Pacific is 01:00 UTC in PDT and 02:00 UTC in PST):
//   { "crons": [{ "path": "/api/cron/meeting-reminders", "schedule": "0 1 * * *" }] }

export async function GET(req: Request): Promise<Response> {
  const secret = env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const dayKey = new URL(req.url).searchParams.get('day') ?? undefined
  await sendMeetingRemindersJob.dispatchOrThrow(dayKey ? { dayKey } : {})

  return Response.json({ ok: true, enqueued: 'send-meeting-reminders', dayKey: dayKey ?? 'tomorrow' })
}
