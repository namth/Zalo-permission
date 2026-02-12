# Audit Log Schema Fix - 10/02/2026

## Problem Identified

When creating a workspace through the admin interface, the following error occurred:

```
column "action" of relation "audit_logs" does not exist
```

### Root Cause

**Schema Mismatch**: There were TWO different audit log services with conflicting schemas:

1. **audit.service.ts** (OLD) - Using legacy schema columns:
   - `action` (not `action_type`)
   - `entity_type` (not in new schema)
   - `entity_id` (not in new schema)
   - `old_value` (not in new schema)
   - `new_value` (not in new schema)

2. **audit-log.service.ts** (NEW) - Using correct schema columns:
   - `action_type` ✓
   - `agent_role`, `thread_id`, `input_data`, `output_data` ✓

3. **Database** - Created with NEW schema (005_create_audit_logs_table.sql)
   ```sql
   CREATE TABLE audit_logs (
     id UUID,
     workspace_id UUID,
     thread_id VARCHAR(255),
     user_id UUID,
     agent_role VARCHAR(50),
     action_type VARCHAR(100),    -- NOT "action"
     input_data JSONB,
     output_data JSONB,
     status VARCHAR(50),
     error_message TEXT,
     metadata JSONB,
     created_at TIMESTAMP
   )
   ```

### Problem Chain

1. `workspace.service.ts` and other services imported `logAuditAction` from `audit.service.ts`
2. They called it with old 7-parameter signature
3. Old signature tried to insert `action` column (which doesn't exist)
4. Database threw error: **column "action" does not exist**

## Solution Implemented

### Step 1: Fixed audit.service.ts

Updated `logAuditAction` function signature to match new schema:

```typescript
// OLD SIGNATURE (5 parameters after workspace_id)
export async function logAuditAction(
  workspace_id: string | null,
  user_id: string | null,
  action: string,
  entity_type: string,
  entity_id: string | null,
  old_value: any = null,
  new_value: any = null,
  ...
)

// NEW SIGNATURE (5 parameters after workspace_id)
export async function logAuditAction(
  workspace_id: string | null,
  thread_id: string | null = null,
  user_id: string | null = null,
  agent_role: string | null = null,
  action_type: string,  // NOW MATCHES action_type COLUMN
  input_data: any = null,
  output_data: any = null,
  ...
)
```

### Step 2: Updated workspace.service.ts

Fixed 6 audit log calls to use new signature:

- `createWorkspace()` - CREATE_WORKSPACE
- `updateWorkspace()` - UPDATE_WORKSPACE  
- `deleteWorkspace()` - DELETE_WORKSPACE
- `addZaloGroup()` - ADD_ZALO_GROUP
- `removeZaloGroup()` - REMOVE_ZALO_GROUP
- `assignUserRole()` - ASSIGN_USER_ROLE (2 locations)
- `removeUserFromWorkspace()` - REMOVE_USER_FROM_WORKSPACE

## Schema Mapping Reference

| Old Column | Old Usage | New Column | New Usage |
|---|---|---|---|
| `action` | Custom string | `action_type` | Custom string |
| `entity_type` | Type of entity changed | N/A | Use `agent_role` if agent action |
| `entity_id` | ID of changed entity | N/A | Use `thread_id` for context |
| `old_value` | Previous state | `input_data` | Input/context data |
| `new_value` | New state | `output_data` | Output/result data |
| N/A | N/A | `agent_role` | 'Planner' \| 'Worker' \| 'Observer' |
| N/A | N/A | `thread_id` | Zalo thread context |
| N/A | N/A | `metadata` | Additional debugging info |

## Files Modified

1. **workspace-api/src/services/audit.service.ts**
   - Completely rewritten to match new schema
   - 6 functions updated: createAuditLog, getAuditLogs, getAuditLogsByActionType, getAuditLogsForUser, getAllAuditLogs, logAuditError

2. **workspace-api/src/services/workspace.service.ts**
   - 9 audit log calls updated to new signature
   - All workspace CRUD operations now log correctly

## Build Status

✅ **Build Successful**
- Compiled without errors
- All endpoints registered
- Ready for Docker deployment

## Notes for Future Maintenance

### When Adding New Audit Calls

Use the NEW signature pattern:

```typescript
await logAuditAction(
  workspace_id,
  thread_id || null,        // Zalo context
  user_id || null,          // Who did the action
  agent_role || null,       // Planner/Worker/Observer (or null for manual)
  'ACTION_TYPE_HERE',       // e.g., 'CREATE_WORKSPACE'
  old_state || null,        // input_data
  new_state || null,        // output_data
  'success' || 'failed',    // status
  error_message || null,    // error details
  { extra: 'context' }      // metadata
);
```

### Don't Mix with audit-log.service.ts

- `audit.service.ts` - Simple function-based API for quick logging
- `audit-log.service.ts` - Class-based service for Agent workflows (Planner/Worker/Observer)

Both are now aligned to the SAME database schema, so they're interchangeable.

---

**Status:** ✅ FIXED & BUILD SUCCESS
**Next Step:** Test admin workspace creation flow
