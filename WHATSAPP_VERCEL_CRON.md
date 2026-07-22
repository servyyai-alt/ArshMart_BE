# WhatsApp queue retries on Vercel Hobby

The backend stores WhatsApp notification jobs in MongoDB. Vercel functions do not
run the in-process timer continuously, so an external scheduler must invoke the
secured worker endpoint.

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

Configure a scheduler such as cron-job.org:

- Schedule: every minute
- Method: `POST`
- URL: `https://YOUR-BACKEND.vercel.app/api/internal/whatsapp/process-queue`
- Header name: `Authorization`
- Header value: `Bearer YOUR_CRON_SECRET`

If you also want to keep a custom alias for internal tooling, set `WHATSAPP_QUEUE_CRON_SECRET` to the same value.

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
