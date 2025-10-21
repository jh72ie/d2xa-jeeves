# Jeeves Email Notifications

## Overview

Jeeves automatically sends email notifications to team members when discoveries are made. The email system is built as a separate, asynchronous process that runs independently from notification generation to ensure reliability and respect API rate limits.

## Architecture

### Three-Stage Process

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: Discovery & Notification Generation (300s timeout)     │
│                                                                  │
│  Discovery Completed                                            │
│         ↓                                                        │
│  Generate Persona Notification                                  │
│         ↓                                                        │
│  (Optional) Generate Dashboard                                  │
│         ↓                                                        │
│  Save to Database                                               │
│         ↓                                                        │
│  Emit 'notification.send-email' event                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: Email Handler (independent, rate-limited)              │
│                                                                  │
│  Receive 'notification.send-email' event                        │
│         ↓                                                        │
│  Load persona email settings                                    │
│         ↓                                                        │
│  Check if email should be sent                                  │
│         ↓                                                        │
│  Send email (respects 2 req/sec rate limit)                     │
│         ↓                                                        │
│  Log result to Activity Log                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: Email Delivery (Resend API)                            │
│                                                                  │
│  Resend API processes email                                     │
│         ↓                                                        │
│  Email delivered to recipient                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Notification Generation (`processPersonaNotification`)

**File:** `lib/inngest/functions/process-notifications.ts`

**Timeout:** 300 seconds (5 minutes)

**Responsibilities:**
- Generate personalized notification based on persona preferences
- Optionally create custom v0 dashboard
- Save notification to database
- Emit email event for separate processing

**Code:**
```typescript
export const processPersonaNotification = inngest.createFunction(
  {
    id: "process-persona-notification",
    name: "Process Single Persona Notification",
    maxDuration: 300, // 5 minutes for complex dashboard generation
  },
  { event: "persona.notify" },
  async ({ event, step }) => {
    // Generate notification...

    // Save to database
    const notification = await step.run("save-notification", async () => {
      return await createNotification({ /* ... */ });
    });

    // Trigger email separately
    await step.run("trigger-email", async () => {
      await inngest.send({
        name: "notification.send-email",
        data: {
          notificationId: notification.id,
          personaName: recipient.personaName,
          subject: personaNotif.subject,
          bodyHtml: personaNotif.bodyHtml,
          bodyText: personaNotif.bodyText,
          executionId,
        }
      });
    });
  }
);
```

### 2. Email Handler (`sendNotificationEmail`)

**File:** `lib/inngest/functions/process-notifications.ts`

**Rate Limit:** 2 requests per second (Resend free tier)

**Responsibilities:**
- Load persona email settings from database
- Validate email should be sent
- Send email via Resend API
- Handle rate limiting automatically
- Log all outcomes

**Code:**
```typescript
export const sendNotificationEmail = inngest.createFunction(
  {
    id: "send-notification-email",
    name: "Send Notification Email",
    rateLimit: {
      limit: 2,
      period: "1s", // Respect Resend free tier
    },
  },
  { event: "notification.send-email" },
  async ({ event, step }) => {
    // Get persona settings
    const personaData = await step.run("get-persona-data", async () => {
      // Load from database
    });

    // Validate
    if (!personaData?.email || !personaData.sendNotification) {
      return { skipped: true };
    }

    // Send email
    const emailSent = await step.run("send-email", async () => {
      return await sendEmail({
        to: personaData.email,
        personaName: personaData.name,
        subject,
        bodyHtml,
        bodyText,
        notificationUrl,
      });
    });
  }
);
```

### 3. Email Service (`sendEmail`)

**File:** `lib/email/service.ts`

**Provider:** Resend API

**Responsibilities:**
- Format email with Jeeves branding
- Send via Resend API
- Handle errors and logging

**Email Template:**
```html
<div style="font-family: sans-serif; max-width: 600px;">
  <div style="background: #f3f4f6; padding: 20px;">
    <h2>🎩 Jeeves Alert for {personaName}</h2>
  </div>

  <div style="padding: 20px;">
    {notification content}
  </div>

  <div style="text-align: center; padding: 20px;">
    <a href="{notificationUrl}" style="background: #3b82f6; color: white; padding: 12px 24px;">
      View Full Notification
    </a>
  </div>
</div>
```

## Configuration

### Environment Variables

**Required:**
- `RESEND_API_KEY` - API key from Resend (configured in Vercel)

**Optional:**
- `EMAIL_FROM` - Sender email address (defaults to `Jeeves <notifications@jeeves.app>`)
- `VERCEL_URL` - Auto-populated by Vercel for notification links
- `NEXT_PUBLIC_APP_URL` - Fallback URL for notification links

### Persona Settings

Each persona (team member) has two settings:

1. **Email** (`persona.email`)
   - Email address where notifications should be sent
   - Optional - if not set, no emails are sent

2. **Send Notification** (`persona.sendNotification`)
   - Boolean flag to enable/disable email notifications
   - Default: `false`
   - Must be explicitly enabled for emails to be sent

**Database Schema:**
```sql
ALTER TABLE "Persona"
  ADD COLUMN "email" text,
  ADD COLUMN "sendNotification" boolean NOT NULL DEFAULT false;
```

## Email Decision Logic

The email handler checks the following conditions before sending:

```typescript
// 1. Persona exists in database
if (!personaData) {
  return { skipped: true, reason: "persona_not_found" };
}

// 2. Email is configured
if (!personaData.email) {
  return { skipped: true, reason: "no_email" };
}

// 3. Notifications are enabled
if (!personaData.sendNotification) {
  return { skipped: true, reason: "notifications_disabled" };
}

// All checks passed - send email
```

## Rate Limiting

### Resend Free Tier Limits
- **2 requests per second**
- 100 emails per day
- 1 verified domain

### Implementation
Inngest's built-in rate limiting handles this automatically:

```typescript
rateLimit: {
  limit: 2,      // Max 2 emails
  period: "1s",  // Per second
}
```

**Benefits:**
- Emails are automatically queued
- No manual delays needed
- Prevents API 429 errors
- Works across multiple notifications

## Error Handling

### Notification Generation Timeout
- **Timeout:** 300 seconds
- **Behavior:** Inngest automatically retries failed functions
- **Result:** Notification is eventually saved, email event is emitted

### Email Send Failure
- **Retry:** Inngest automatically retries on failure
- **Logging:** All failures logged to Jeeves Activity Log
- **Skip Reasons:** Logged for debugging (no email, disabled, etc.)

### Resend API Errors
- **429 Rate Limit:** Handled by Inngest rate limiting (queued automatically)
- **4xx Errors:** Logged and returned (e.g., invalid email format)
- **5xx Errors:** Retried by Inngest
- **Network Errors:** Retried by Inngest

## Logging

### Email Service Logs
```
[Email] 📧 Attempting to send email to user@example.com for Alice-DevOps
[Email] Subject: 🚨 CRITICAL: Sensor Offline
[Email] Notification URL: https://app.vercel.app/jeeves#notification-abc123
[Email] ✅ RESEND_API_KEY is configured
[Email] Response status: 200
[Email] ✅ Successfully sent to user@example.com - Email ID: re_abc123xyz
```

### Email Handler Logs
```
[Email Handler] 📧 Processing email for Alice-DevOps, notification abc123
[Email Handler] 📋 Persona data: {
  email: 'alice@example.com',
  sendNotification: true,
  name: 'Alice-DevOps'
}
[Email Handler] 📬 Sending to alice@example.com
[Email Handler] ✅ Email sent to alice@example.com
```

### Activity Log Integration
All email events are logged to Jeeves Activity Log:
```
✅ Email sent to Alice-DevOps (alice@example.com)
⏭️ Email skipped: Bob-Backend has no email
❌ Email failed for Charlie-Frontend (charlie@example.com)
```

## User Experience

### Persona Card UI
Team members can configure email settings directly on their persona card:

1. **Email Input**
   - Text input for email address
   - Placeholder: `team@example.com`
   - Auto-saves on change

2. **Send Notifications Toggle**
   - Switch component (on/off)
   - Label: "Send notifications"
   - Auto-saves on change

### Email Content
Recipients receive:

1. **Subject:** `[Jeeves] {discovery title}`
2. **Header:** Jeeves branding with persona name
3. **Body:** Full notification content (HTML formatted)
4. **CTA Button:** "View Full Notification" → Links to Jeeves Console
5. **Footer:** Info about managing preferences

### Notification Link
Format: `https://{app-url}/jeeves#notification-{id}`

Clicking the link:
- Opens Jeeves Console
- Scrolls to the specific notification
- Marks notification as viewed (future enhancement)

## Testing

### Local Testing
1. Set `RESEND_API_KEY` in `.env.local`
2. Configure a test persona with email and `sendNotification: true`
3. Trigger a discovery
4. Check logs for email flow

### Production Testing
1. Add your email to a persona in Vercel database
2. Enable notifications for that persona
3. Trigger Jeeves analysis
4. Verify email delivery

### Debugging Checklist
- ✅ Is `RESEND_API_KEY` set in Vercel?
- ✅ Does persona have an email configured?
- ✅ Is `sendNotification` enabled for persona?
- ✅ Check Vercel logs for email handler execution
- ✅ Check Resend dashboard for delivery status
- ✅ Check spam folder for delivered emails

## Performance Characteristics

### Notification Generation
- **Duration:** 10-300 seconds (depends on dashboard complexity)
- **Concurrency:** Multiple personas processed in parallel
- **Timeout:** 300 seconds per persona

### Email Sending
- **Duration:** ~500ms per email
- **Rate:** Maximum 2 emails per second
- **Queue:** Unlimited (handled by Inngest)

### Example Timeline
For 5 team members with email enabled:

```
T+0s:    Discovery completed
T+0s:    Fan out to 5 persona handlers (parallel)
T+30s:   First notification saved → Email event emitted
T+30s:   Email handler picks up event (rate-limited)
T+30.5s: First email sent
T+31s:   Second email sent (0.5s later, rate limit)
T+31.5s: Third email sent
T+32s:   Fourth email sent
T+32.5s: Fifth email sent
```

## Future Enhancements

### Planned Features
- [ ] Email templates per notification format
- [ ] Digest mode (daily summary instead of per-discovery)
- [ ] Email preferences (frequency, severity filter)
- [ ] Mark notification as viewed when email link clicked
- [ ] Unsubscribe link in email footer
- [ ] Email delivery status tracking

### Upgrade Paths
- **Resend Pro:** Higher rate limits, more domains
- **Email Analytics:** Track open rates, click rates
- **Rich Email Content:** Embed charts/graphs in email
- **SMS Notifications:** For critical alerts
- **Slack Integration:** Alternative to email

## Troubleshooting

### Emails Not Sending

**Check 1: Environment Variables**
```bash
# Verify in Vercel dashboard
RESEND_API_KEY=re_...
```

**Check 2: Persona Settings**
```sql
SELECT name, email, "sendNotification"
FROM "Persona"
WHERE name = 'Alice-DevOps';
```

**Check 3: Inngest Logs**
- Go to Vercel Functions logs
- Search for `[Email Handler]`
- Look for skip reasons or errors

**Check 4: Resend Dashboard**
- Login to resend.com
- Check "Logs" for recent sends
- Verify domain is verified

### Rate Limit Errors

**Symptom:** `429 Too Many Requests` in logs

**Solution:** Already handled by Inngest rate limiting, but if persisting:
- Upgrade Resend plan
- Reduce notification frequency
- Implement email digests

### Timeout Errors

**Symptom:** `Task timed out after 300 seconds`

**Solutions:**
- Dashboard generation is too complex
- Consider simpler notification formats
- Split dashboard generation to separate async job
- Increase timeout further (requires Inngest config)

## API Reference

### Inngest Events

#### `notification.send-email`
**Trigger:** After notification is saved to database

**Payload:**
```typescript
{
  notificationId: string;      // UUID of saved notification
  personaName: string;         // Name of recipient persona
  subject: string;             // Email subject line
  bodyHtml: string;            // HTML email body
  bodyText: string;            // Plain text fallback
  executionId: string;         // For activity log correlation
}
```

### Database Schema

#### `Persona` Table
```typescript
{
  name: string;                // Primary key
  email: string | null;        // Email address
  sendNotification: boolean;   // Enable/disable emails
  createdAt: Date;
  updatedAt: Date;
}
```

### API Endpoints

#### `PATCH /api/personas/[name]`
**Update persona email settings**

**Request:**
```json
{
  "email": "alice@example.com",
  "sendNotification": true
}
```

**Response:**
```json
{
  "success": true
}
```

## Security Considerations

### Email Address Validation
- No validation on frontend (UX)
- Resend validates email format
- Invalid emails fail silently with log

### Sender Verification
- Sender domain must be verified in Resend
- Default: `notifications@jeeves.app` (must verify)
- Custom: Set `EMAIL_FROM` environment variable

### Rate Limiting
- Prevents API abuse
- Protects Resend account
- Inngest handles automatically

### Data Privacy
- Email addresses stored in database
- Only sent to Resend API
- No third-party tracking
- Logs may contain email addresses (review retention)

---

## Quick Start

1. **Configure Resend**
   ```bash
   # Add to Vercel environment variables
   RESEND_API_KEY=re_your_api_key_here
   ```

2. **Run Database Migration**
   ```sql
   ALTER TABLE "Persona"
     ADD COLUMN "email" text,
     ADD COLUMN "sendNotification" boolean NOT NULL DEFAULT false;
   ```

3. **Configure Team Members**
   - Open Jeeves Console
   - Find persona card
   - Enter email address
   - Toggle "Send notifications" to ON

4. **Test**
   - Trigger Jeeves analysis
   - Check Vercel logs for email flow
   - Verify email delivery

That's it! 🎩
