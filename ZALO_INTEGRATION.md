# Zalo Integration Guide

## Architecture Overview

```
Zalo User Message
       ↓
[Webhook] POST /api/webhooks/zalo
       ↓
Zalo Integration Client
       ↓
[Forward] POST /webhook/planner (n8n)
       ↓
n8n Planner Workflow
  ├── Get Auth Context (Neo4j)
  ├── Check Pending Tasks (PostgreSQL)
  ├── Decision Logic
  ├── [Branch] Call Worker or Save Task
  └── Log Audit
       ↓
[If Worker executed]
Worker Workflow → Observer Workflow
       ↓
[Callback] POST /api/webhooks/n8n-callback
       ↓
Send Response Back to Zalo User
```

## Setup Steps

### 1. Zalo Developer Configuration

#### Register Zalo Bot

1. Go to [Zalo Developer Portal](https://developers.zalo.me/)
2. Create new application
3. Get:
   - `App ID`
   - `App Secret`
   - `Access Token`

#### Set Webhook URL

In Zalo Developer Portal → Webhook Settings:

```
Webhook URL: https://your-backend-domain.com/api/webhooks/zalo
Method: POST
Verify Token: YOUR_RANDOM_TOKEN
```

#### Enable Events

Subscribe to these events:
- `user.send.message.text`
- `user.send.message.image`
- `user.send.message.file`
- `bot.command`

### 2. Environment Variables

Add to `.env.local` or `.env.production`:

```bash
# Zalo Configuration
ZALO_ACCESS_TOKEN=your_access_token_here
ZALO_WEBHOOK_TOKEN=your_verify_token_here
ZALO_WEBHOOK_SECRET=your_webhook_secret_here

# n8n Configuration
N8N_WEBHOOK_URL=http://localhost:5678/webhook/planner
N8N_WEBHOOK_TOKEN=your_n8n_token_here

# API Configuration
BACKEND_API_URL=http://localhost:3000
```

### 3. Webhook Verification

When Zalo sends webhook verification request:

```bash
GET /api/webhooks/zalo?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
```

Expected response:
```json
{
  "challenge": "CHALLENGE_STRING"
}
```

### 4. Message Flow

#### Incoming Message

```
1. Zalo sends POST to /api/webhooks/zalo
2. Backend verifies signature
3. Extract thread_id, user_id, message
4. Forward to n8n Planner webhook
5. n8n processes and executes workflow
6. Observer validates results
7. Callback to /api/webhooks/n8n-callback
8. Backend sends response to Zalo thread
```

#### Message Payload Example

```json
{
  "event_type": "user_sent_text",
  "thread_id": "group_123456",
  "sender_id": "user_789",
  "message_content": "Gửi email tới team@company.com với báo cáo tuần này",
  "message_id": "msg_abc123",
  "timestamp": 1707545600
}
```

## API Endpoints

### Zalo Webhook

**POST** `/api/webhooks/zalo`

Receives events from Zalo platform.

**Headers:**
```
X-Zalo-Signature: HMAC-SHA256(payload, secret)
Content-Type: application/json
```

**Request Body:**
```json
{
  "event_type": "user_sent_text",
  "thread_id": "group_id",
  "sender_id": "user_id",
  "message_content": "User message",
  "message_id": "msg_id",
  "timestamp": 1234567890
}
```

**Response:**
```json
{
  "success": true,
  "event_id": "msg_id"
}
```

### n8n Callback

**POST** `/api/webhooks/n8n-callback`

Receives workflow results from n8n Observer workflow.

**Request Body:**
```json
{
  "thread_id": "group_id",
  "user_id": "user_id",
  "verdict": "FINISH",
  "feedback": "Yêu cầu của bạn đã hoàn thành",
  "results": [
    {
      "step": 1,
      "tool": "tool_email",
      "status": "success"
    }
  ],
  "issues": []
}
```

**Response:**
```json
{
  "success": true,
  "delivered": true
}
```

## Error Handling

### Invalid Signature

```
Response: 401 Unauthorized
Error: "Invalid signature"
```

**Fix:**
1. Verify `ZALO_WEBHOOK_SECRET` is correct
2. Check signature calculation in code
3. Ensure webhook secret matches Zalo settings

### Timeout

```
Response: 408 Request Timeout
Error: "n8n workflow execution timed out"
```

**Fix:**
1. Increase HTTP timeout in integration client
2. Optimize n8n workflow (remove slow steps)
3. Check external API response times

### Zalo API Error

```
Response: 500 Internal Server Error
Error: "Failed to send message to Zalo"
```

**Fix:**
1. Verify `ZALO_ACCESS_TOKEN` is valid
2. Check token hasn't expired
3. Verify thread_id exists
4. Check Zalo API status

## Testing

### Manual Webhook Test

```bash
curl -X POST http://localhost:3000/api/webhooks/zalo \
  -H "Content-Type: application/json" \
  -H "X-Zalo-Signature: test_signature" \
  -d '{
    "event_type": "user_sent_text",
    "thread_id": "test_group_1",
    "sender_id": "test_user_1",
    "message_content": "Test message",
    "message_id": "msg_test_1",
    "timestamp": '$(date +%s)'
  }'
```

### Check Audit Logs

```bash
curl http://localhost:3000/api/user/audit-logs?workspace_id=test&limit=10
```

### Monitor n8n Workflow

1. Go to n8n UI: http://localhost:5678
2. Open Planner workflow
3. Click "Execute Workflow"
4. Check "Executions" tab for results

## Best Practices

### 1. Rate Limiting

Zalo has rate limits (typically 100 requests/minute). Implement:

```typescript
// In backend, add rate limiter middleware
import rateLimit from 'express-rate-limit';

const zaloLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (req) => req.ip,
});

app.post('/api/webhooks/zalo', zaloLimiter, handler);
```

### 2. Idempotency

Zalo may retry failed webhooks. Handle duplicates:

```typescript
// Check if message_id already processed
const exists = await db.query(
  'SELECT * FROM audit_logs WHERE metadata->>"zalo_message_id" = $1',
  [payload.message_id]
);

if (exists.rows.length > 0) {
  return { success: true }; // Already processed
}
```

### 3. Queue Processing

For high volume, use queue:

```typescript
// Instead of immediate processing
await zaloClient.processWebhook(payload);

// Use queue
await queue.add('process_zalo_event', payload);
```

### 4. Logging & Monitoring

Log all events:

```typescript
// In audit service
await auditLogService.createAuditLog({
  workspace_id,
  action_type: 'ZALO_MESSAGE_RECEIVED',
  input_data: {
    zalo_event_type: payload.event_type,
    zalo_thread_id: payload.thread_id,
    message_id: payload.message_id,
  },
  status: 'success',
});
```

## Production Checklist

- [ ] Zalo access token obtained and stored in secrets manager
- [ ] Webhook URL configured in Zalo Developer Portal
- [ ] Webhook secret configured in environment variables
- [ ] HTTPS enforced for webhook URL
- [ ] Rate limiting implemented
- [ ] Idempotency checking in place
- [ ] Audit logging for all events
- [ ] Error handling for Zalo API failures
- [ ] Monitoring/alerting set up
- [ ] n8n workflows tested with real Zalo messages
- [ ] Callback endpoint tested
- [ ] SSL certificate valid for webhook domain
- [ ] Auto-renewal of Zalo tokens (if applicable)

## Troubleshooting

### Webhook Not Receiving Events

**Check:**
1. Webhook URL correct in Zalo portal?
2. HTTPS and valid certificate?
3. Backend API running?
4. Firewall allowing inbound requests?
5. Signature verification disabled for testing?

### Messages Not Being Processed

**Check:**
1. n8n webhook URL correct?
2. n8n workflow active?
3. API keys valid?
4. Sufficient permissions in Neo4j?
5. Queue/processing service running?

### Response Not Reaching Zalo

**Check:**
1. Access token valid?
2. Thread_id correct?
3. Message format correct?
4. Callback endpoint being called?
5. Error in n8n execution logs?

## Support

- Zalo Developer Docs: https://developers.zalo.me/docs
- n8n Documentation: https://docs.n8n.io
- Backend API Docs: `/api/docs` (Swagger UI)

---

**Version:** 1.0  
**Last Updated:** 10/02/2026
