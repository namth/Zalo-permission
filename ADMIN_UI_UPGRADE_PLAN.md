# Admin UI Upgrade Plan - 10/02/2026

## 📋 Executive Summary

The admin UI currently uses an **OLD schema** (agents-based system). We need to upgrade it to support the **NEW AI Agent Workspace System** with Tools, Skills, and proper permission management.

---

## 🔄 Key Changes: Old vs New

### A. SCHEMA CHANGES

| Component | Old System | New System |
|-----------|-----------|-----------|
| **Agents** | Managed in DB (`agents` table) | Managed by n8n (no DB storage) |
| **Tools** | Not present | ✅ NEW: Admin defines API tools |
| **Skills** | Not present | ✅ NEW: Users can learn/create skills |
| **Permissions** | Simple role-based | Neo4j graph-based (CAN_USE, OWNER_OF, SHARED_TO) |
| **Audit** | Basic logging | Detailed agent action logging |
| **Pending Tasks** | Not present | ✅ NEW: Track incomplete requests |

### B. CURRENT ADMIN UI STRUCTURE

```
src/app/admin/
├── page.tsx (main dashboard)
├── layout.tsx (sidebar navigation)
├── agents/ (❌ DELETE - OLD)
├── dashboard/
├── workspaces/
├── users/
├── audit-logs/
└── [id]/groups/ (workspace group management)
```

### C. NEW ADMIN UI STRUCTURE

```
src/app/admin/
├── page.tsx (updated dashboard)
├── layout.tsx (updated sidebar)
├── tools/ (✅ NEW)
│   ├── page.tsx (list tools)
│   ├── [id]/
│   │   └── page.tsx (tool detail & permissions)
│   └── components.tsx (create/edit tool form)
├── skills/ (✅ NEW)
│   ├── page.tsx (list all skills)
│   ├── [id]/
│   │   └── page.tsx (skill detail & sharing)
│   └── components.tsx (skill management)
├── permissions/ (✅ NEW)
│   └── page.tsx (workspace ↔ tool mappings)
├── workspaces/ (update)
├── users/ (keep)
├── audit-logs/ (update)
└── dashboard/ (update)
```

---

## 🎯 Detailed Implementation Plan

### PHASE 1: DELETE OLD COMPONENTS

#### Task 1.1: Remove Agents Section ❌
- **File to delete:** `src/app/admin/agents/page.tsx`
- **Update:** `src/app/admin/layout.tsx` - Remove "🤖 Agents" link
- **Remove:** All agent-related API calls

#### Task 1.2: Update Dashboard
- **File:** `src/app/admin/page.tsx`
- **Changes:**
  - Replace agents card with tools card
  - Add skills card
  - Add pending tasks overview card
  - Show workspace status summary

---

### PHASE 2: CREATE NEW COMPONENTS

#### Task 2.1: Tools Management Page ✅ NEW
**File:** `src/app/admin/tools/page.tsx`

**Features:**
- List all system tools with pagination
- Create new tool form (name, description, input_schema JSON)
- Auto-generate embeddings via OpenAI
- Edit tool details
- Delete tool (with confirmation)
- Search/filter by name

**Table Columns:**
| Column | Type | Notes |
|--------|------|-------|
| Key | text | Unique identifier |
| Name | text | Display name |
| Description | text | What it does |
| Status | enum | active/deprecated/disabled |
| Used By | count | Number of workspaces using it |
| Created | date | Creation date |
| Actions | buttons | Edit, Delete, Assign |

**API Endpoints Used:**
- `GET /api/admin/tools` - List tools
- `POST /api/admin/tools` - Create tool
- `PUT /api/admin/tools/:id` - Update tool
- `DELETE /api/admin/tools/:id` - Delete tool

---

#### Task 2.2: Tool Detail & Permissions Page ✅ NEW
**File:** `src/app/admin/tools/[id]/page.tsx`

**Features:**
- View tool metadata (schema, embedding dimensions)
- Assign tool to workspaces ([:CAN_USE] relationship)
- View which workspaces can use this tool
- Remove workspace access
- View tool usage statistics

**UI Layout:**
```
┌─ Tool: SendEmail
├─ Description: Send email via SMTP
├─ Schema: { to, subject, body, ... }
├─ Status: [active | deprecated | disabled]
│
└─ Workspace Access (Whitelist)
   ├─ [✓] Workspace A - Admin Access
   ├─ [✓] Workspace B - Limited
   └─ [+ Add Workspace]
```

**API Endpoints:**
- `GET /api/admin/tools/:id` - Tool detail
- `POST /api/admin/permissions` - Grant access (create CAN_USE)
- `DELETE /api/admin/permissions` - Revoke access

---

#### Task 2.3: Skills Management Page ✅ NEW
**File:** `src/app/admin/skills/page.tsx`

**Features:**
- List all skills (user-created + system)
- Filter by owner, workspace, status
- View skill details (logic_config visualization)
- Disable/enable skills
- Delete skills with confirmation
- View who shared it to which workspaces

**Table Columns:**
| Column | Type | Notes |
|--------|------|-------|
| Name | text | Skill name |
| Owner | user | Who created it |
| Workspace | text | Original workspace |
| Type | enum | user / system |
| Status | enum | active/archived/disabled |
| Shared To | count | Workspaces it's shared with |
| Created | date | Creation date |
| Actions | buttons | Edit, Share, Disable, Delete |

**API Endpoints:**
- `GET /api/admin/skills` - List skills
- `GET /api/admin/skills/:id` - Skill detail
- `PATCH /api/admin/skills/:id` - Update status
- `DELETE /api/admin/skills/:id` - Delete skill

---

#### Task 2.4: Skill Detail & Sharing Page ✅ NEW
**File:** `src/app/admin/skills/[id]/page.tsx`

**Features:**
- View skill metadata (name, description, logic_config)
- Visualize logic_config as steps/flowchart
- View owner user profile
- List workspaces this skill is shared to
- Remove sharing from workspaces
- Disable/restore skill
- View usage statistics

**UI Layout:**
```
┌─ Skill: Sales Report
├─ Owner: User A (workspace: Sales Team)
├─ Status: [active | archived | disabled]
├─ Logic Steps:
│  1. Fetch data from Excel
│  2. Calculate totals
│  3. Generate chart
│  4. Send email
│
└─ Shared With ([:SHARED_TO])
   ├─ [✓] Workspace A (3 users)
   ├─ [✓] Workspace B (2 users)
   └─ [+ Share to More]
```

**API Endpoints:**
- `GET /api/admin/skills/:id` - Skill detail
- `PATCH /api/admin/skills/:id/status` - Change status
- `POST /api/admin/skills/:id/share` - Share to workspace
- `DELETE /api/admin/skills/:id/share/:workspace_id` - Unshare
- `DELETE /api/admin/skills/:id` - Delete skill

---

#### Task 2.5: Permissions Management Page ✅ NEW
**File:** `src/app/admin/permissions/page.tsx`

**Features:**
- Matrix view: Workspaces × Tools × Permissions
- Grant/revoke tool access to workspaces
- Grant/revoke skill sharing to workspaces
- Bulk operations (assign tool to multiple workspaces)
- View audit trail of permission changes

**UI Layout - Table Format:**
```
Workspace          | Tool A | Tool B | Tool C | Skills Shared
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Workspace A        |   ✓    |   ✓    |   -    | 5 skills
Workspace B        |   ✓    |   -    |   ✓    | 2 skills
Workspace C        |   -    |   ✓    |   ✓    | 3 skills
```

**API Endpoints:**
- `GET /api/admin/permissions` - Get matrix
- `POST /api/admin/permissions` - Create CAN_USE relationship
- `DELETE /api/admin/permissions/:workspace_id/:tool_id` - Remove access

---

### PHASE 3: UPDATE EXISTING COMPONENTS

#### Task 3.1: Update Dashboard
**File:** `src/app/admin/page.tsx`

**Changes:**
- Remove agents card
- Add Tools card → "Manage API tools available to workspaces"
- Add Skills card → "View and manage learned/shared skills"
- Add Pending Tasks card → "Tasks waiting for user input"
- Keep Workspaces card
- Update styling to match new system

**Cards to Display:**
```
┌─ 📦 Tools (15)
│  ├─ Active: 12
│  ├─ Deprecated: 2
│  └─ Manage → /admin/tools
│
├─ 🎯 Skills (24)
│  ├─ User-Created: 18
│  ├─ System: 6
│  └─ Manage → /admin/skills
│
├─ ⏳ Pending Tasks (3)
│  ├─ Awaiting Input: 3
│  └─ View → /admin/pending-tasks
│
└─ 🏢 Workspaces (8)
   ├─ Active: 7
   ├─ Disabled: 1
   └─ Manage → /admin/workspaces
```

---

#### Task 3.2: Update Layout Sidebar
**File:** `src/app/admin/layout.tsx`

**Changes:**
- **Remove:** "🤖 Agents" link
- **Add:** "📦 Tools" link
- **Add:** "🎯 Skills" link
- **Add:** "🔐 Permissions" link
- Reorganize navigation grouping:
  - **Resources:** Tools, Skills
  - **Management:** Workspaces, Users, Permissions
  - **Monitoring:** Audit Logs, Pending Tasks
  - **Reporting:** Dashboard

**Updated Navigation:**
```
📊 Dashboard

RESOURCES
├─ 📦 Tools
├─ 🎯 Skills
└─ 🔐 Permissions

MANAGEMENT
├─ 🏢 Workspaces
└─ 👥 Users

MONITORING
├─ ⏳ Pending Tasks (NEW)
└─ 📝 Audit Logs

SETTINGS
└─ ⚙️ System Settings (Future)
```

---

#### Task 3.3: Update Workspace Management
**File:** `src/app/admin/workspaces/page.tsx`

**Changes:**
- Add "Tools Available" column to workspace table
- Add "Skills Shared" column to workspace table
- In workspace detail, show:
  - List of tools this workspace can use
  - List of skills this workspace has access to
  - Assigned Zalo groups
- Link to permission management

---

#### Task 3.4: Update Audit Logs
**File:** `src/app/admin/audit-logs/page.tsx`

**Changes:**
- Add filters by agent_role (Planner, Worker, Observer)
- Add filter by action_type (CREATE_TOOL, SHARE_SKILL, etc.)
- Show more details in log entries:
  - Agent role (who did it)
  - Action type
  - Input/output data
  - Status & errors
- Add export to CSV functionality

**Filter Options:**
```
Agent Role: [All | Planner | Worker | Observer]
Action Type: [All | CREATE_TOOL | SHARE_SKILL | GRANT_PERMISSION | ...]
Status: [All | Success | Failed]
Date Range: [From] [To]
Workspace: [All | Workspace A | Workspace B | ...]
```

---

### PHASE 4: NEW FEATURE - PENDING TASKS DASHBOARD

#### Task 4.1: Pending Tasks Page ✅ NEW
**File:** `src/app/admin/pending-tasks/page.tsx`

**Features:**
- List all pending tasks across workspaces
- Filter by status (AWAITING_INPUT, READY_TO_RESUME, COMPLETED)
- View task details (intent, missing parameters, full plan)
- Admin can manually complete or remove tasks
- Show user who created the task
- Show which workspace/thread the task belongs to

**Table:**
```
User      | Workspace | Status           | Intent                  | Missing Info
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User A    | Workspace A | AWAITING_INPUT  | Generate report         | [date_from, date_to]
User B    | Workspace B | READY_TO_RESUME | Send email campaign     | None
User A    | Workspace A | COMPLETED       | Create spreadsheet      | All provided
```

**API Endpoints:**
- `GET /api/admin/pending-tasks` - List pending tasks
- `GET /api/admin/pending-tasks/:id` - Task detail
- `PATCH /api/admin/pending-tasks/:id` - Update status
- `DELETE /api/admin/pending-tasks/:id` - Delete task

---

## 📊 Implementation Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| 1 | Delete agents code | 1 hour | TODO |
| 2.1 | Tools page | 3 hours | TODO |
| 2.2 | Tool detail page | 2 hours | TODO |
| 2.3 | Skills page | 3 hours | TODO |
| 2.4 | Skill detail page | 2 hours | TODO |
| 2.5 | Permissions page | 2 hours | TODO |
| 3.1 | Update dashboard | 1.5 hours | TODO |
| 3.2 | Update layout | 0.5 hours | TODO |
| 3.3 | Update workspaces | 1 hour | TODO |
| 3.4 | Update audit logs | 1.5 hours | TODO |
| 4.1 | Pending tasks page | 2 hours | TODO |

**Total: ~20 hours**

---

## 🗂️ Files to Create/Modify

### ❌ FILES TO DELETE
```
src/app/admin/agents/
  └── page.tsx
```

### ✅ FILES TO CREATE
```
src/app/admin/tools/
  ├── page.tsx                    (list tools)
  ├── components.tsx              (form components)
  └── [id]/page.tsx              (tool detail & assign)

src/app/admin/skills/
  ├── page.tsx                    (list skills)
  ├── components.tsx              (management components)
  └── [id]/page.tsx              (skill detail & share)

src/app/admin/permissions/
  └── page.tsx                    (workspace ↔ tool matrix)

src/app/admin/pending-tasks/
  └── page.tsx                    (pending tasks admin)

src/app/admin/tools/api.ts        (API client for tools)
src/app/admin/skills/api.ts       (API client for skills)
src/app/admin/permissions/api.ts  (API client for permissions)
```

### 🔄 FILES TO MODIFY
```
src/app/admin/page.tsx            (update dashboard cards)
src/app/admin/layout.tsx          (update sidebar navigation)
src/app/admin/workspaces/page.tsx (add tools/skills columns)
src/app/admin/audit-logs/page.tsx (add agent_role filters)
```

---

## 🔗 API Integration Points

### New Endpoints to Use
```
Backend Agent APIs:
- GET /api/admin/tools
- POST /api/admin/tools
- PUT /api/admin/tools/:id
- DELETE /api/admin/tools/:id

- GET /api/admin/skills (when available)
- POST /api/admin/skills/share (when available)
- DELETE /api/admin/skills/:id (when available)

- GET /api/admin/permissions
- POST /api/admin/permissions
- DELETE /api/admin/permissions/:workspace_id/:tool_id

- GET /api/admin/pending-tasks (when available)
```

---

## 🎨 UI/UX Considerations

1. **Consistent Design:** Use Tailwind CSS classes consistent with existing admin UI
2. **Loading States:** Show spinners while fetching data
3. **Error Handling:** Display error messages prominently
4. **Confirmations:** Ask for confirmation on delete actions
5. **Pagination:** Implement pagination for large lists
6. **Search:** Add search/filter for tools and skills
7. **Breadcrumbs:** Add breadcrumb navigation for detail pages
8. **Tooltips:** Add helpful tooltips explaining complex concepts

---

## ✅ Success Criteria

- [ ] All old agents-related code removed
- [ ] Tools management page fully functional
- [ ] Skills management page fully functional
- [ ] Permissions matrix view working
- [ ] Pending tasks admin dashboard working
- [ ] All new pages integrated with updated layout
- [ ] API calls properly typed with TypeScript
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Mobile responsive design verified
- [ ] All pages tested manually
- [ ] Documentation updated

---

## 🚀 Deployment Checklist

- [ ] Build passes without errors
- [ ] No console warnings
- [ ] All features tested in development
- [ ] Performance verified (no slow queries)
- [ ] Error handling verified
- [ ] Responsive design verified on mobile
- [ ] Ready for production deployment

---

**Status:** PLANNING PHASE  
**Next Step:** Begin PHASE 1 - Delete old components
