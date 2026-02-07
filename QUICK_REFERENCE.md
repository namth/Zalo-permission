# Agent Display - Quick Reference Guide

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `backend/src/app/admin/workspaces/[id]/page.tsx` | Updated | Add agent column to groups list |
| `backend/src/app/admin/workspaces/[id]/groups/[group_id]/page.tsx` | Updated | Complete agents tab redesign |
| `backend/src/app/api/workspace/groups/[group_id]/agents/route.ts` | Updated | Add DELETE endpoint |
| `backend/src/app/api/admin/workspaces/[id]/agent/route.ts` | Updated | Simplified to GET only |
| `backend/src/services/agent.service.ts` | Updated | Removed deprecated functions |
| `backend/src/services/policy.service.ts` | Updated | Removed unused imports |
| `backend/scripts/init-data.sh` | Updated | Update test data setup |

## API Endpoints

### GET /api/workspace/groups/{group_id}/agents
Fetch agent assigned to group
```bash
curl "http://localhost:3000/api/workspace/groups/group-uuid/agents"
```
**Response:**
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
```

### POST /api/workspace/groups/{group_id}/agents
Assign agent to group
```bash
curl -X POST "http://localhost:3000/api/workspace/groups/group-uuid/agents" \
  -H "Content-Type: application/json" \
  -d '{"agent_key":"agent_support"}'
```

### DELETE /api/workspace/groups/{group_id}/agents
Remove agent from group
```bash
curl -X DELETE "http://localhost:3000/api/workspace/groups/group-uuid/agents"
```

## Component Props & State

### Workspace List Page
```typescript
interface ZaloGroup {
  id: string;
  thread_id: string;
  name?: string;
  agent_key?: string;        // NEW
  created_at: string;
}
```

### Group Detail Page
```typescript
interface AssignedAgent {                    // NEW
  key: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// State
const [assignedAgent, setAssignedAgent] = useState<AssignedAgent | null>(null);
const [allAgents, setAllAgents] = useState<Agent[]>([]);
const [removingAgent, setRemovingAgent] = useState(false);
```

## Frontend Fetch Pattern

```typescript
// Get assigned agent
const response = await fetch(`/api/workspace/groups/${group_id}/agents`);
const data = await response.json();
if (data.success) {
  setAssignedAgent(data.data);  // Can be null
}

// Assign agent
const response = await fetch(`/api/workspace/groups/${group_id}/agents`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ agent_key: selectedAgent })
});

// Remove agent
const response = await fetch(`/api/workspace/groups/${group_id}/agents`, {
  method: 'DELETE'
});
```

## UI Components

### Agent Status Badge
```tsx
{group.agent_key ? (
  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
    {group.agent_key}
  </span>
) : (
  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
    None
  </span>
)}
```

### Agent Details Card
```tsx
{assignedAgent && (
  <div className="bg-white border border-gray-200 rounded-lg p-6">
    <h3 className="text-lg font-semibold">Assigned Agent</h3>
    <div className="grid grid-cols-2 gap-4 mt-4">
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase">
          Agent Name
        </label>
        <p className="text-lg font-semibold mt-1">{assignedAgent.name}</p>
      </div>
      {/* More fields... */}
    </div>
  </div>
)}
```

### Agent Selection Modal
```tsx
{showAddAgent && (
  <div className="bg-white border border-gray-200 rounded-lg p-6">
    <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
      <option value="">Choose an agent...</option>
      {allAgents.map((agent) => (
        <option key={agent.key} value={agent.key}>
          {agent.name} ({agent.key})
        </option>
      ))}
    </select>
    <button onClick={handleAddAgent} disabled={addingAgent}>
      {addingAgent ? 'Assigning...' : 'Assign Agent'}
    </button>
  </div>
)}
```

## Database Queries

### Fetch group with agent
```sql
SELECT id, agent_key FROM zalo_groups WHERE id = $1
```

### Assign agent to group
```sql
UPDATE zalo_groups 
SET agent_key = $1, updated_at = NOW()
WHERE id = $2
RETURNING id, agent_key, workspace_id, updated_at
```

### Remove agent from group
```sql
UPDATE zalo_groups 
SET agent_key = NULL, updated_at = NOW()
WHERE id = $1
RETURNING id, agent_key, workspace_id, updated_at
```

### Get all groups with agents in workspace
```sql
SELECT id, agent_key, name FROM zalo_groups 
WHERE workspace_id = $1 AND agent_key IS NOT NULL
ORDER BY updated_at DESC
```

## Neo4j Operations

### Create agent relationship
```cypher
MATCH (g:ZaloGroup {id: $group_id})
MATCH (a:Agent {key: $agent_key})
MERGE (g)-[r:USES_AGENT]->(a)
RETURN r
```

### Remove agent relationship
```cypher
MATCH (g:ZaloGroup {id: $group_id})-[r:USES_AGENT]->(a:Agent {key: $agent_key})
DELETE r
RETURN g
```

## Error Codes

| Code | Message | Cause |
|------|---------|-------|
| 400 | Invalid JSON | Malformed request body |
| 400 | agent_key is required | Missing agent_key in POST |
| 404 | Group not found | Invalid group_id |
| 404 | Agent not found | Invalid agent_key |
| 500 | Failed to assign agent | Database error |
| 500 | Failed to remove agent | Database error |

## Common Issues & Solutions

### Issue: Agent not showing in list
**Solution:** Make sure agent_key is populated in database for that group

### Issue: Can't assign agent
**Solution:** Verify agent exists in agents table with matching key

### Issue: Neo4j relationship not created
**Solution:** Check Neo4j connectivity, non-critical (logged but doesn't block)

### Issue: Modal doesn't close after assign
**Solution:** Check if fetchData() completes successfully

### Issue: Audit log not recording
**Solution:** Verify audit service is available, non-critical

## Testing Helpers

### Check if agent is assigned
```javascript
console.log(assignedAgent); // Will be null or Agent object
```

### Log API response
```javascript
const response = await fetch('/api/workspace/groups/{id}/agents');
const data = await response.json();
console.log('Response:', data);
```

### Mock agent data
```typescript
const mockAgent = {
  key: 'agent_test',
  name: 'Test Agent',
  description: 'Test description',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};
```

## Styling Classes Used

| Element | Classes |
|---------|---------|
| Green badge | `bg-green-100 text-green-800 rounded-full` |
| Gray badge | `bg-gray-100 text-gray-600 rounded-full` |
| Card | `bg-white border border-gray-200 rounded-lg p-6` |
| Label | `text-xs font-medium text-gray-500 uppercase` |
| Value | `text-lg font-semibold text-gray-900` |
| Button primary | `bg-blue-600 text-white hover:bg-blue-700` |
| Button danger | `bg-red-100 text-red-700 hover:bg-red-200` |
| Modal | `fixed inset-0 bg-black bg-opacity-50 flex` |

## Version History

- **v2.0** (Feb 7, 2025): Initial implementation
  - Removed workspace_agent_config table usage
  - Added agent display to admin dashboard
  - Implemented full agent management UI

## Related Documentation

- `MIGRATION_V2_AGENTS.md` - Schema migration details
- `DASHBOARD_AGENT_DISPLAY.md` - Full implementation guide
- `VISUAL_CHANGES.md` - UI before/after comparison
- `IMPLEMENTATION_CHECKLIST.md` - Testing checklist

## Quick Start

1. **View agents in list:**
   - Open workspace detail page
   - Look at "Groups" tab
   - See agent column with status badges

2. **Manage agent for group:**
   - Click on group to open detail
   - Go to "Agents" tab
   - Assign/change/remove agent as needed

3. **Debug issues:**
   - Check browser console for errors
   - Check server logs for API errors
   - Verify database has agent_key populated
   - Verify Neo4j is running

## Support

For issues:
1. Check error message in UI
2. Check browser developer console
3. Check server logs
4. Review troubleshooting section
5. Contact development team
