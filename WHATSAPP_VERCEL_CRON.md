# WhatsApp queue retries on Vercel Hobby

The backend stores WhatsApp notification jobs in MongoDB. Vercel Hobby cannot
run frequent built-in cron jobs, so an external scheduler must invoke the
secured worker endpoint.

For non-Vercel Node deployments, the backend also starts a local worker that
checks the queue every 60 seconds. On Vercel, rely on the external scheduler.

## Environment variable

Add this in the backend Vercel project settings:

```env
CRON_SECRET=replace_with_a_random_secret_of_at_least_32_characters
```

Do not commit the real value. Generate one in PowerShell with:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## External scheduler

Use any scheduler that can make an authenticated HTTP request. `cron-job.org`
works well and the setup is:

1. Create a new cron job.
2. Set the method to `POST`.
3. Set the URL to:

   ```text
   https://YOUR-BACKEND.vercel.app/api/internal/whatsapp/process-queue
   ```

4. Add this request header:

   ```text
   Authorization: Bearer YOUR_CRON_SECRET
   ```

5. Set the schedule to every minute.

If you want to use a custom value for internal tooling, set
`WHATSAPP_QUEUE_CRON_SECRET` to the same secret as `CRON_SECRET`.

The endpoint processes one due job per call to stay within conservative free
function limits. A successful response contains counts only and never returns
customer data or credentials.

Example response:

```json
{
  "success": true,
  "busy": false,
  "processed": 1,
  "sent": 1,
  "rescheduled": 0,
  "failed": 0
}
```

Temporary failures (timeouts, HTTP 429, and server errors) are rescheduled with
backoff. Permanent validation and Meta HTTP 4xx errors are marked failed.

## Route Notes

- `POST /api/internal/whatsapp/process-queue` is the main secured worker
  endpoint.
- `GET /api/internal/cron/whatsapp` is an alias for simple schedulers or manual
  checks.
- Both routes require `Authorization: Bearer <secret>`.

## Quick checklist

- `CRON_SECRET` is set in the backend Vercel environment variables.
- The external scheduler sends `POST` requests to the worker endpoint.
- The `Authorization` header uses the exact same secret value.
- The old Vercel `crons` block stays removed from `vercel.json`.
