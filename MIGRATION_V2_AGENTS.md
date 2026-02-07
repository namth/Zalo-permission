# Migration: workspace_agent_config → zalo_groups.agent_key

## Overview
Removed the deprecated `workspace_agent_config` table and migrated agent configuration logic to use direct linking via `zalo_groups.agent_key` column.

**Change Summary:**
- Each Zalo group now has exactly ONE agent (via `agent_key` column in `zalo_groups`)
- Agents are linked directly to Zalo groups, not to workspaces
- In Neo4j: Direct relationship between `ZaloGroup` and `Agent` nodes

## Files Modified

### 1. API Routes
#### `/backend/src/app/api/workspace/groups/[group_id]/agents/route.ts`
**Changes:**
- **GET endpoint**: Now retrieves the single `agent_key` from the Zalo group, not from `workspace_agent_config`
  - Returns the agent details or `null` if no agent assigned
  - Uses `getAgent()` to fetch agent details
  
- **POST endpoint**: Assigns agent directly to group via `zalo_groups.agent_key` update
  - No longer inserts into `workspace_agent_config`
  - Validates agent exists before assignment
  - Creates Neo4j relationship between `ZaloGroup` and `Agent` (not `Workspace`)

**Old Logic:**
```sql
SELECT id FROM workspace_agent_config WHERE workspace_id = $1 AND agent_key = $2
INSERT INTO workspace_agent_config (workspace_id, agent_key, ...)
```

**New Logic:**
```sql
UPDATE zalo_groups SET agent_key = $1 WHERE id = $2
```

#### `/backend/src/app/api/admin/workspaces/[id]/agent/route.ts`
**Changes:**
- **Removed POST/PUT methods** (no longer needed for deprecated `workspace_agent_config`)
- **GET endpoint**: Modified to query Zalo groups with agents instead of workspace configs
  - Returns list of groups in workspace that have agents assigned
  - Query: `SELECT id, agent_key, name FROM zalo_groups WHERE workspace_id = $1 AND agent_key IS NOT NULL`

### 2. Services
#### `/backend/src/services/agent.service.ts`
**Removed:**
- `WorkspaceAgentConfig` interface (no longer needed)
- `assignAgentToWorkspace()` function (deprecated)
- `getWorkspaceAgentConfig()` function (deprecated)
- `getWorkspaceAgentConfigs()` function (deprecated)
- `updateAgentConfig()` function (deprecated)

**Kept (active):**
- `createAgent()`
- `getAgent()`
- `listAgents()`
- `updateAgent()`
- `deleteAgent()` - now checks `zalo_groups.agent_key` instead of `workspace_agent_config`

#### `/backend/src/services/policy.service.ts`
**Changes:**
- Removed import of deprecated functions
- Now uses `zaloGroup.agent_key` directly from `getZaloGroupByThreadId()`
- No change to logic (already uses v2.0 schema)

### 3. Database
#### `/backend/scripts/init-data.sh`
**Changes:**
- Removed `workspace_agent_config` table creation
- Updated test data: Now assigns agent to Zalo group via UPDATE instead of INSERT

#### Migrations (No changes needed)
- `002a-drop-workspace-agent-config.sql` - Already drops the table
- `002b-add-agent-to-zalo-groups.sql` - Already adds `agent_key` column

## API Changes

### Old: GET /api/workspace/groups/:group_id/agents
**Old Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "config-uuid",
      "workspace_id": "ws-uuid",
      "agent_key": "agent_support",
      "system_prompt": "You are...",
      "temperature": 0.7,
      "max_tokens": 2000
    }
  ]
}
```

**New Response:**
```json
{
  "success": true,
  "data": {
    "key": "agent_support",
    "name": "Support Agent",
    "description": "...",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
// OR (if no agent assigned)
{
  "success": true,
  "data": null
}
```

### Old: POST /api/workspace/groups/:group_id/agents
**Old Body:**
```json
{
  "agent_key": "agent_support",
  "system_prompt": "You are...",
  "temperature": 0.7,
  "max_tokens": 2000,
  "workspace_id": "ws-uuid"
}
```

**New Body:**
```json
{
  "agent_key": "agent_support",
  "assigned_by": "user-uuid"
}
```

**Old Response:**
```json
{
  "success": true,
  "data": {
    "id": "config-uuid",
    "workspace_id": "ws-uuid",
    "agent_key": "agent_support",
    ...
  }
}
```

**New Response:**
```json
{
  "success": true,
  "data": {
    "id": "group-uuid",
    "agent_key": "agent_support",
    "workspace_id": "ws-uuid",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### Old: POST /api/admin/workspaces/:id/agent (now removed)
This endpoint is no longer used. To assign agents, use:
```
POST /api/workspace/groups/:group_id/agents
```

### New: GET /api/admin/workspaces/:id/agent
Returns all Zalo groups in the workspace with agents assigned.

## Neo4j Schema Changes
### Old Relationship:
```cypher
Workspace -[:USES_AGENT]-> Agent
```

### New Relationship:
```cypher
ZaloGroup -[:USES_AGENT]-> Agent
```

## Migration Steps for Clients

1. **Update API calls:**
   - Change POST body to remove `system_prompt`, `temperature`, `max_tokens`
   - Keep only `agent_key` and optionally `assigned_by`

2. **Update response parsing:**
   - GET now returns single agent object (not array of configs)
   - Handle `null` response when no agent assigned

3. **Workspace-level agent config:**
   - No longer possible (by design)
   - Each group has its own agent
   - If you need workspace-level defaults, implement in client

## Backward Compatibility
- ❌ No backward compatibility maintained
- Old `workspace_agent_config` table is dropped
- Old API endpoints return 404 or different data structure
- Must update all clients using agent assignment APIs
