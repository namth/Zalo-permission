# Deployment & Launch Checklist

## ✅ Pre-Deployment Verification

### Database & Schema
- [ ] PostgreSQL running and accessible
- [ ] All 7 migrations executed successfully
- [ ] pgvector extension installed: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Tables created: `tools`, `skills`, `pending_tasks`, `audit_logs`
- [ ] Indexes created for vector columns (HNSW)
- [ ] Batch embedding script executed: `npx ts-node batch-embedding.ts`
- [ ] Test data inserted and verified

### Neo4j & Authorization
- [ ] Neo4j running and accessible
- [ ] `neo4j-init.cypher` executed
- [ ] Node types created: `ZaloUser`, `Workspace`, `ZaloGroup`, `Tool`, `Skill`
- [ ] Relationship types defined: `PART_OF`, `CAN_USE`, `OWNER_OF`, `SHARED_TO`, `BELONGS_TO`
- [ ] Test relationships created and verified
- [ ] Permission graph queries tested

### Backend API
- [ ] Next.js backend starts without errors: `npm run dev`
- [ ] All 13 API endpoints responding: `curl http://localhost:3000/api/health`
- [ ] Environment variables set correctly:
  - [ ] `DATABASE_URL`
  - [ ] `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
  - [ ] `OPENAI_API_KEY`
  - [ ] `ZALO_ACCESS_TOKEN`, `ZALO_WEBHOOK_TOKEN`, `ZALO_WEBHOOK_SECRET`
  - [ ] `N8N_WEBHOOK_URL`
- [ ] CORS configured if needed
- [ ] Rate limiting implemented
- [ ] Error handling tested

### n8n Workflows
- [ ] n8n running: `n8n start`
- [ ] Planner workflow imported from JSON
- [ ] Workflow nodes configured with correct API endpoints
- [ ] Credentials set up (API keys, Basic Auth)
- [ ] Webhook trigger configured
- [ ] Workflow activated
- [ ] Test execution successful
- [ ] Worker workflow template prepared
- [ ] Observer workflow template prepared

### Zalo Integration
- [ ] Zalo app created in Developer Portal
- [ ] Access token obtained and stored in env
- [ ] Webhook URL configured: `https://domain.com/api/webhooks/zalo`
- [ ] Webhook verified (GET request with verify_token)
- [ ] Message events subscribed
- [ ] Webhook secret generated and stored
- [ ] Test webhook received and processed

---

## 🔒 Security Checklist

### API Security
- [ ] HTTPS enforced (not HTTP in production)
- [ ] API authentication implemented
- [ ] CORS restricted to trusted domains
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using parameterized queries)
- [ ] XSS protection enabled
- [ ] CSRF tokens if needed

### Secrets Management
- [ ] No secrets hardcoded in code
- [ ] Environment variables used for all sensitive data
- [ ] Secrets stored in secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)
- [ ] Rotation policy for tokens/keys
- [ ] Access logs for secret retrieval

### Database Security
- [ ] Database connections require authentication
- [ ] PostgreSQL user has limited privileges (not superuser)
- [ ] Network access restricted (firewall rules)
- [ ] Backups encrypted and stored securely
- [ ] Replication/failover configured
- [ ] Query logging enabled for audit

### n8n Security
- [ ] n8n admin password strong and unique
- [ ] OAuth configured if self-hosted
- [ ] API tokens generated for integrations
- [ ] Webhook tokens generated and validated
- [ ] Sensitive data masked in execution logs
- [ ] Access controls on workflows (who can edit/view)

### Zalo Security
- [ ] Webhook signature verification enabled
- [ ] HTTPS for all Zalo API calls
- [ ] Access token stored securely (not in logs)
- [ ] Token refresh/rotation policy
- [ ] Rate limiting respected
- [ ] Message content logging restricted (privacy)

---

## 🚀 Performance & Optimization

### Database Performance
- [ ] Indexes created on frequently queried columns
- [ ] Vector indexes (HNSW) created for embeddings
- [ ] Query performance tested with production-like data
- [ ] Connection pooling configured
- [ ] Slow query log enabled
- [ ] Query execution plans analyzed

### API Performance
- [ ] Response times measured (<200ms target)
- [ ] Caching implemented for frequent requests
- [ ] Database query optimization done
- [ ] N+1 query problems eliminated
- [ ] Large result sets paginated
- [ ] Batch operations for bulk inserts

### n8n Performance
- [ ] Workflow execution time monitored
- [ ] External API timeouts configured
- [ ] Parallel processing where possible
- [ ] Memory usage monitored
- [ ] Long-running workflows optimized

### Frontend/User Experience
- [ ] Typing indicator sent while processing
- [ ] Response messages clear and helpful
- [ ] Error messages actionable
- [ ] Pending task updates sent to user
- [ ] Workflow progress visible

---

## 📊 Monitoring & Logging

### Logging Setup
- [ ] Application logs captured (file or service)
- [ ] Database query logs enabled
- [ ] API request/response logging
- [ ] Error logging with stack traces
- [ ] Audit logs written for all actions
- [ ] Log rotation configured (to prevent disk full)
- [ ] Log retention policy set (typically 30 days)

### Monitoring & Alerts
- [ ] Service health checks implemented
- [ ] Uptime monitoring (external service)
- [ ] Error rate monitoring
- [ ] Database performance monitored
- [ ] API response time SLO set (and monitored)
- [ ] Alerts configured for:
  - [ ] Service down
  - [ ] High error rate (>5%)
  - [ ] Slow queries (>1000ms)
  - [ ] Database connection failures
  - [ ] Zalo API errors
  - [ ] n8n workflow failures

### Distributed Tracing
- [ ] Request IDs generated and propagated
- [ ] Trace context included in logs
- [ ] Service-to-service calls tracked
- [ ] End-to-end flow visible in logs

---

## 🧪 Testing Verification

### Unit Tests
- [ ] Tool service tests pass
- [ ] Skill service tests pass
- [ ] Pending task service tests pass
- [ ] Audit log service tests pass
- [ ] Planner service tests pass
- [ ] Worker service tests pass
- [ ] Observer service tests pass

### Integration Tests
- [ ] API endpoint tests pass
- [ ] Database operations tested
- [ ] Neo4j queries tested
- [ ] Embedding generation tested
- [ ] n8n webhook integration tested
- [ ] Zalo webhook integration tested

### E2E Tests
- [ ] Full message flow tested (Zalo → Backend → n8n → Zalo)
- [ ] Error scenarios tested
- [ ] Timeout handling tested
- [ ] Rate limiting tested
- [ ] Authorization tested
- [ ] Pending task resumption tested
- [ ] Skill learning tested

---

## 📋 Documentation Verification

- [ ] README updated with latest info
- [ ] API documentation generated (Swagger/OpenAPI)
- [ ] n8n workflow setup guide complete
- [ ] Zalo integration guide complete
- [ ] Quick start guide tested
- [ ] Architecture diagram up to date
- [ ] Database schema documented
- [ ] Environment variables documented
- [ ] Troubleshooting guide complete

---

## 🚨 Incident Response Plan

- [ ] Runbooks created for common issues
- [ ] On-call rotation established
- [ ] Escalation procedures defined
- [ ] Backup/restore procedures tested
- [ ] Database rollback plan documented
- [ ] Code rollback procedures established
- [ ] Communication plan for incidents
- [ ] Post-incident review process defined

---

## 🔄 Deployment Steps (Production)

### 1. Pre-Deployment (24 hours before)
- [ ] Code reviewed and approved
- [ ] All tests passing
- [ ] Database backups current
- [ ] Team notified of maintenance window
- [ ] Deployment plan reviewed

### 2. Deployment Day (Off-peak hours)
- [ ] Scale down to single instance (if applicable)
- [ ] Enable maintenance mode (optional)
- [ ] Run database migrations
- [ ] Deploy backend code
- [ ] Verify API endpoints responding
- [ ] Deploy n8n workflows (if updated)
- [ ] Verify webhooks working
- [ ] Monitor error logs closely
- [ ] Enable normal traffic

### 3. Post-Deployment
- [ ] Smoke tests passed
- [ ] Monitor for 1 hour
- [ ] Check error rates normal
- [ ] Verify n8n workflows executing
- [ ] Confirm audit logs being written
- [ ] Team notified deployment complete

### 4. Rollback Plan (if needed)
- [ ] Identify what failed
- [ ] Prepare rollback command
- [ ] Revert to previous version
- [ ] Verify services restored
- [ ] Restore from backup if data corrupted
- [ ] Post-mortem scheduled

---

## 💾 Backup & Disaster Recovery

- [ ] PostgreSQL backups automated daily
- [ ] Neo4j backups automated daily
- [ ] Backups stored in secure location (separate region)
- [ ] Backup restoration tested monthly
- [ ] Recovery time objective (RTO) defined: __ hours
- [ ] Recovery point objective (RPO) defined: __ minutes
- [ ] Backup retention policy defined: __ months
- [ ] Point-in-time recovery capability verified

---

## 📞 Support & SLA

### Service Level Agreement
- [ ] Availability target: __ % (e.g., 99.9%)
- [ ] Response time target: __ ms
- [ ] Error rate target: < __ %
- [ ] Monthly SLA review scheduled

### Support Team
- [ ] Support team trained on system
- [ ] Runbooks distributed
- [ ] Escalation contacts identified
- [ ] Communication channels established
- [ ] Status page configured (if public)

---

## ✨ Final Checklist

- [ ] All critical issues resolved
- [ ] Load test passed (__ RPS)
- [ ] Security audit passed
- [ ] Performance audit passed
- [ ] Stakeholders approved for launch
- [ ] Launch date communicated to users
- [ ] Marketing materials prepared
- [ ] Analytics tracking configured
- [ ] Feedback mechanism ready (surveys/support)

---

## 🎉 Launch Readiness Sign-Off

| Role | Name | Date | Sign-Off |
|------|------|------|----------|
| Tech Lead | __________ | __________ | ☐ |
| DevOps | __________ | __________ | ☐ |
| QA Lead | __________ | __________ | ☐ |
| Security | __________ | __________ | ☐ |
| Product Manager | __________ | __________ | ☐ |

---

**Deployment Date:** ______________  
**Target Rollout:** ______________  
**Maintenance Window:** ______________  
**Expected Duration:** ______________  

**Post-Launch Review Date:** ______________

---

**Version:** 1.0  
**Last Updated:** 10/02/2026
