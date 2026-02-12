# Quick Start Guide

## 🚀 What Was Implemented

A complete **AI Agent Workspace System** with multi-tenant support, deep permission controls, and AI self-learning capabilities. The system allows users to:

1. **Create and manage workspaces** with group-based access
2. **Use AI agents** (Planner → Worker → Observer) for task execution
3. **Learn custom skills** that persist and can be shared
4. **Manage tools & permissions** with Neo4j-based authorization
5. **Track activity** with comprehensive audit logs

All integrated with **Zalo chat** platform and **n8n** workflow automation.

---

## 📊 Architecture

```
Zalo User
    ↓
Webhook: POST /api/webhooks/zalo
    ↓
Zalo Integration Client
    ↓
n8n Planner Workflow (Authenticated + Resource Check)
    ↓
Decision: Ask for more info OR Proceed
    ├→ Ask Input → Save to pending_tasks
    └→ Execute  → n8n Worker Workflow (Tool Execution)
         ↓
    n8n Observer Workflow (Validation)
         ↓
    POST /api/webhooks/n8n-callback
         ↓
    Send Response back to Zalo User
```

---

## ⚙️ Setup Checklist

### 1. Database Setup
```bash
# PostgreSQL
export DATABASE_URL="postgresql://user:pass@localhost:5432/plutusdb"

# Run migrations
npm run migrate:latest

# Run batch embedding (after tools/skills are created)
npx ts-node backend/scripts/batch-embedding.ts
```

### 2. Neo4j Setup
```bash
# Initialize graph
docker exec plutus-neo4j cypher-shell -u neo4j -p password < backend/scripts/neo4j-init.cypher
```

### 3. Environment Variables
```bash
# Backend
DATABASE_URL=postgresql://...
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_password

# OpenAI
OPENAI_API_KEY=sk-...

# Zalo Integration
ZALO_ACCESS_TOKEN=...
ZALO_WEBHOOK_TOKEN=...
ZALO_WEBHOOK_SECRET=...

# n8n
N8N_WEBHOOK_URL=http://localhost:5678/webhook/planner
```

### 4. Start Services
```bash
# Backend (NextJS)
npm run dev

# n8n (in separate terminal)
n8n start

# Database services (if using Docker)
docker-compose up -d
```

### 5. Import n8n Workflows
1. Open n8n UI: http://localhost:5678
2. Create new workflow
3. Import JSON from `backend/n8n-workflows/planner-workflow.json`
4. Configure API endpoints
5. Activate workflow

### 6. Configure Zalo Webhook
1. Go to Zalo Developer Portal
2. Set webhook URL: `https://your-domain.com/api/webhooks/zalo`
3. Add verify token from env
4. Subscribe to message events

---

## 🔌 API Examples

### Get Authorized Resources
```bash
curl -X POST http://localhost:3000/api/agent/auth-and-resources \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "zalo_group_123",
    "user_id": "user_456"
  }'
```

### Create a Tool
```bash
curl -X POST http://localhost:3000/api/admin/tools \
  -H "Content-Type: application/json" \
  -d '{
    "key": "tool_email",
    "name": "Email Tool",
    "description": "Send emails to users",
    "input_schema": {
      "to": "string",
      "subject": "string",
      "body": "string"
    }
  }'
```

### Grant Permission
```bash
curl -X POST http://localhost:3000/api/admin/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "workspace_1",
    "tool_key": "tool_email"
  }'
```

### Learn a Skill
```bash
curl -X POST http://localhost:3000/api/agent/learn-skill \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "workspace_1",
    "owner_id": "user_123",
    "name": "Weekly Report",
    "description": "Generate weekly sales report",
    "logic_config": [
      {
        "step": 1,
        "tool": "tool_spreadsheet",
        "params": {"sheet_id": "sales_data"}
      },
      {
        "step": 2,
        "tool": "tool_email",
        "params": {"to": "manager@company.com", "subject": "Weekly Report"}
      }
    ],
    "is_shared": true
  }'
```

### List User's Skills
```bash
curl "http://localhost:3000/api/user/skills?user_id=user_123"
```

### View Audit Logs
```bash
curl "http://localhost:3000/api/user/audit-logs?workspace_id=workspace_1&limit=20"
```

---

## 🧪 Testing Workflow

### Test 1: Basic Message
Send message to Zalo bot:
```
"Xin chào, tôi muốn gửi email đến team@company.com"
```

Expected:
- Webhook received at `/api/webhooks/zalo`
- n8n Planner workflow triggered
- If missing info: Bot asks for more details (saved to pending_tasks)
- If complete: Continues to Worker

### Test 2: Pending Task Resume
Send follow-up message:
```
"Email title là: Weekly Report, nội dung: Báo cáo doanh số tuần này"
```

Expected:
- Planner checks pending_tasks
- Finds existing task
- Merges new info into plan
- Proceeds to Worker

### Test 3: Skill Learning
Send message:
```
"Hãy học cách làm báo cáo: B1 lấy data từ sheet sales, B2 tạo biểu đồ, B3 gửi email"
```

Expected:
- Planner detects learning intent
- Calls `/api/agent/learn-skill`
- Skill saved with embeddings
- Relationship created in Neo4j
- Can reuse later

### Test 4: Check Logs
```bash
curl "http://localhost:3000/api/user/audit-logs?workspace_id=test&agent_role=Planner"
```

Should see all Planner actions with timestamps and outcomes.

---

## 📁 Key Files

| Component | Files |
|-----------|-------|
| **Backend** | `backend/src/services/*.ts` |
| **APIs** | `backend/src/app/api/**/route.ts` |
| **Types** | `backend/src/types/index.ts` |
| **Workflows** | `backend/n8n-workflows/*.json` |
| **Integrations** | `backend/src/lib/*-integration.ts` |
| **Migrations** | `backend/migrations/*.sql` |
| **Scripts** | `backend/scripts/*.ts` |

---

## 🐛 Troubleshooting

### Issue: "User not authorized"
**Solution:** Check Neo4j graph:
```cypher
MATCH (u:ZaloUser {zalo_user_id: 'user_id'})-[:PART_OF]->(w:Workspace)<-[:BELONGS_TO]-(zg:ZaloGroup {zalo_thread_id: 'thread_id'})
RETURN u, w, zg
```

### Issue: "Tool not found"
**Solution:** Create tool and grant permission:
```bash
# Create tool
curl -X POST http://localhost:3000/api/admin/tools -d '{...}'

# Grant permission
curl -X POST http://localhost:3000/api/admin/permissions -d '{...}'
```

### Issue: "Embedding failed"
**Solution:** Check OpenAI key and batch generation:
```bash
export OPENAI_API_KEY=sk-...
npx ts-node backend/scripts/batch-embedding.ts
```

### Issue: "n8n webhook not responding"
**Solution:** 
1. Verify n8n is running: http://localhost:5678
2. Check webhook URL matches (localhost vs domain)
3. Verify workflow is activated
4. Check n8n logs

### Issue: "Zalo signature invalid"
**Solution:**
1. Verify `ZALO_WEBHOOK_SECRET` matches portal
2. Check payload not modified
3. Temporarily disable verification for testing (not production!)

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `AI AGENT WORKSPACE SYSTEM.md` | System design & architecture |
| `IMPLEMENTATION_PLAN.md` | Development timeline & progress |
| `ZALO_INTEGRATION.md` | Zalo webhook setup & troubleshooting |
| `backend/n8n-workflows/WORKFLOW_SETUP_GUIDE.md` | n8n workflow configuration |
| `QUICK_START.md` | This file (quick reference) |

---

## 🎯 Next Steps

1. **Run migrations** to set up database
2. **Start backend & n8n**
3. **Create test tools** via admin APIs
4. **Grant permissions** to workspace
5. **Import n8n workflow**
6. **Configure Zalo webhook**
7. **Send test message** via Zalo
8. **Check audit logs** to verify flow

---

## 💡 Pro Tips

- Use [Postman](https://www.postman.com/) to test APIs
- Monitor n8n workflow executions in real-time
- Check PostgreSQL audit_logs for detailed activity
- Use Neo4j Browser to visualize permission graph
- Enable debug logging in env: `DEBUG=*`

---

## 📞 Support

For issues or questions:

1. Check **Troubleshooting** section above
2. Review audit logs: `/api/user/audit-logs`
3. Check n8n workflow execution history
4. Consult `AI AGENT WORKSPACE SYSTEM.md` for architecture details
5. Review `ZALO_INTEGRATION.md` for Zalo-specific issues

---

**Version:** 1.0  
**Last Updated:** 10/02/2026  
**Status:** Ready for Testing & Deployment
