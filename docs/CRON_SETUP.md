# Cron Jobs Setup Guide

This project uses Vercel Cron Jobs to trigger scheduled email notifications and reminders.

## Overview

The following cron jobs are configured in `vercel.json`:

1. **Email Dispatcher** (`/api/email/dispatch`) - Runs every minute to process PENDING notification events
2. **Booking End Reminders** (`/api/cron/booking-end-reminders`) - Sends reminders 5 minutes before booking ends
3. **Booking Reminder 60min** (`/api/cron/booking-reminder-60min`) - Sends reminders 60 minutes before booking starts
4. **Customer Follow-Up** (`/api/cron/customer-follow-up`) - Sends "night of booking" reminder to rebook (default: 6:00-6:30 PM venue local time)

## Required Environment Variables

### CRON_SECRET (Required)

All cron endpoints require authentication via `CRON_SECRET`. This must be set in your Vercel project environment variables.

**To generate a secure secret:**
```bash
openssl rand -base64 32
```

**Vercel Setup:**
1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add `CRON_SECRET` with the generated value
3. Make sure it's set for **Production**, **Preview**, and **Development** environments as needed

## Vercel Cron Configuration

Cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/email/dispatch", "schedule": "* * * * *" },
    { "path": "/api/cron/booking-end-reminders", "schedule": "* * * * *" },
    { "path": "/api/cron/booking-reminder-60min", "schedule": "* * * * *" },
    { "path": "/api/cron/customer-follow-up", "schedule": "* * * * *" }
  ]
}
```

**Note:** All cron jobs run every minute (`* * * * *`). The individual endpoints contain logic to determine if they should execute based on time windows and conditions.

## Customer Follow-Up Email Configuration

The customer follow-up email runs during a specific time window (default: 6:00-6:30 PM in the venue's local timezone).

### Environment Variables (Optional, for testing)

- `CUSTOMER_FOLLOW_UP_HOUR` - Target hour (default: 18, i.e., 6 PM)
- `CUSTOMER_FOLLOW_UP_MINUTE_START` - Start minute (default: 0)
- `CUSTOMER_FOLLOW_UP_MINUTE_END` - End minute (default: 30)

**Example for local testing:**
```bash
# Test during 2 PM hour
CUSTOMER_FOLLOW_UP_HOUR=14
CUSTOMER_FOLLOW_UP_MINUTE_START=0
CUSTOMER_FOLLOW_UP_MINUTE_END=59
```

## How It Works

1. **Vercel triggers the cron endpoint** every minute with an Authorization header containing `CRON_SECRET`
2. **The endpoint validates authentication** and checks if the current time matches the configured window
3. **For customer-follow-up**: It finds active reservations that started "today" in each venue's timezone
4. **Notifications are enqueued** via `enqueueNotification()` which creates `NotificationEvent` records with status `PENDING`
5. **The email dispatcher** (`/api/email/dispatch`) processes PENDING events and sends emails via Resend

## Testing Cron Jobs Locally

### Manual Testing

You can manually trigger cron endpoints using curl:

```bash
# Set your CRON_SECRET
export CRON_SECRET="your-secret-here"

# Test customer follow-up cron
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/customer-follow-up

# Test email dispatcher
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/email/dispatch
```

### Expected Response

```json
{
  "enqueued": 2,
  "skipped": 0,
  "skipReasons": {},
  "venuesProcessed": 5,
  "timestamp": "2025-02-11T18:15:00.000Z"
}
```

## Troubleshooting

### Cron jobs not running

1. **Check Vercel Cron configuration:**
   - Verify `vercel.json` is deployed
   - Check Vercel project → **Settings** → **Cron Jobs** to see if jobs are registered

2. **Verify CRON_SECRET:**
   - Ensure `CRON_SECRET` is set in Vercel environment variables
   - Check logs for "Unauthorized" errors

3. **Check logs:**
   - View Vercel function logs for cron executions
   - Look for `[customer-follow-up]` log entries

### No notifications being created

1. **Check time window:**
   - Verify the current time matches the configured window
   - For customer-follow-up, ensure venue timezone is set correctly

2. **Check reservations:**
   - Verify there are active reservations with `startAt` matching "today" in venue timezone
   - Ensure reservations have associated users with email addresses

3. **Check database:**
   - Query `notification_events` table for `customer_follow_up` type
   - Check if events are being created but not sent (status = PENDING)

### Emails not being sent

1. **Check email dispatcher:**
   - Verify `/api/email/dispatch` is running
   - Check for PENDING notification events in database

2. **Check Resend configuration:**
   - Verify `RESEND_API_KEY` is set
   - Check `RESEND_FROM_EMAIL` or email configuration

3. **Check notification event status:**
   - PENDING = not yet processed
   - SENT = successfully sent
   - FAILED = error occurred (check `error` field)

## Monitoring

All cron endpoints include comprehensive logging:

- Execution timestamp
- Number of venues processed
- Number of notifications enqueued
- Skip reasons for skipped items
- Error messages for failures

Check Vercel function logs or your logging service to monitor cron job execution.
