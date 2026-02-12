# Admin UI Upgrade - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Understand the Change
**Old System (Agents)** → **New System (Tools & Skills)**
- Agents managed in database ❌ → Agents managed by n8n ✅
- No tools management ❌ → Tools management ✅
- No skills management ❌ → Skills management ✅
- Simple permissions ❌ → Neo4j graph permissions ✅

---

## 📋 PHASE 1: DELETE OLD COMPONENTS (15 minutes)

### Step 1.1: Remove agents folder
```bash
rm -rf workspace-api/src/app/admin/agents/
```

### Step 1.2: Update layout.tsx - Remove agents link
**File:** `workspace-api/src/app/admin/layout.tsx`

**Find and remove:**
```tsx
<Link
  href="/admin/agents"
  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
>
  🤖 Agents
</Link>
```

**Replace with:**
```tsx
<Link
  href="/admin/tools"
  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
>
  📦 Tools
</Link>
<Link
  href="/admin/skills"
  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
>
  🎯 Skills
</Link>
<Link
  href="/admin/permissions"
  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
>
  🔐 Permissions
</Link>
```

**Full updated layout structure:**
```tsx
<nav className="space-y-4">
  <Link href="/admin/dashboard">📊 Dashboard</Link>
  
  {/* RESOURCES */}
  <div className="pt-4 pb-2">
    <p className="text-xs font-semibold text-gray-500 uppercase">Resources</p>
  </div>
  <Link href="/admin/tools">📦 Tools</Link>
  <Link href="/admin/skills">🎯 Skills</Link>
  <Link href="/admin/permissions">🔐 Permissions</Link>
  
  {/* MANAGEMENT */}
  <div className="pt-4 pb-2">
    <p className="text-xs font-semibold text-gray-500 uppercase">Management</p>
  </div>
  <Link href="/admin/workspaces">🏢 Workspaces</Link>
  <Link href="/admin/users">👥 Users</Link>
  
  {/* MONITORING */}
  <div className="pt-4 pb-2">
    <p className="text-xs font-semibold text-gray-500 uppercase">Monitoring</p>
  </div>
  <Link href="/admin/pending-tasks">⏳ Pending Tasks</Link>
  <Link href="/admin/audit-logs">📝 Audit Logs</Link>
</nav>
```

---

## 📦 PHASE 2: CREATE TOOLS MANAGEMENT (3 hours)

### Step 2.1: Create tools folder structure
```bash
mkdir -p workspace-api/src/app/admin/tools/[id]
touch workspace-api/src/app/admin/tools/page.tsx
touch workspace-api/src/app/admin/tools/components.tsx
touch workspace-api/src/app/admin/tools/api.ts
touch workspace-api/src/app/admin/tools/[id]/page.tsx
```

### Step 2.2: Create tools/api.ts (API client)
```typescript
// workspace-api/src/app/admin/tools/api.ts

export interface Tool {
  id: string;
  key: string;
  name: string;
  description?: string;
  input_schema?: Record<string, any>;
  status: 'active' | 'deprecated' | 'disabled';
  created_at: string;
  updated_at: string;
}

export async function fetchTools() {
  const response = await fetch('/api/admin/tools');
  return response.json();
}

export async function createTool(data: Partial<Tool>) {
  const response = await fetch('/api/admin/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function updateTool(id: string, data: Partial<Tool>) {
  const response = await fetch(`/api/admin/tools/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteTool(id: string) {
  const response = await fetch(`/api/admin/tools/${id}`, {
    method: 'DELETE',
  });
  return response.json();
}
```

### Step 2.3: Create tools/page.tsx (list view)
```typescript
// workspace-api/src/app/admin/tools/page.tsx

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Tool, fetchTools } from "./api";

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTools = async () => {
      try {
        setLoading(true);
        const data = await fetchTools();
        setTools(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading tools");
      } finally {
        setLoading(false);
      }
    };
    loadTools();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Tools</h1>
          <p className="text-gray-600 mt-2">Manage API tools available to workspaces</p>
        </div>
        <Link
          href="/admin/tools/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Tool
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading tools...</div>
      ) : tools.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No tools found</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Key</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tools.map((tool) => (
                <tr key={tool.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">{tool.key}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">{tool.name}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      tool.status === 'active' ? 'bg-green-100 text-green-800' :
                      tool.status === 'deprecated' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {tool.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(tool.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <Link
                      href={`/admin/tools/${tool.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

### Step 2.4: Create tools/components.tsx (form components)
```typescript
// workspace-api/src/app/admin/tools/components.tsx

import { useState } from "react";
import { Tool, createTool, updateTool } from "./api";

export function ToolForm({ tool, onSubmit }: {
  tool?: Tool;
  onSubmit: (data: Partial<Tool>) => Promise<void>;
}) {
  const [formData, setFormData] = useState<Partial<Tool>>(
    tool || { key: '', name: '', description: '', status: 'active' }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving tool");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tool Key</label>
        <input
          type="text"
          required
          value={formData.key || ''}
          onChange={(e) => setFormData({ ...formData, key: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., send_email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          required
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Send Email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="What does this tool do?"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={formData.status || 'active'}
          onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="active">Active</option>
          <option value="deprecated">Deprecated</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save Tool"}
      </button>
    </form>
  );
}
```

### Step 2.5: Create tools/[id]/page.tsx (detail view)
```typescript
// workspace-api/src/app/admin/tools/[id]/page.tsx

"use client";

import { useState, useEffect } from "react";
import { Tool } from "../api";

export default function ToolDetailPage({ params }: { params: { id: string } }) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTool = async () => {
      try {
        const response = await fetch(`/api/admin/tools/${params.id}`);
        const data = await response.json();
        setTool(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading tool");
      } finally {
        setLoading(false);
      }
    };
    loadTool();
  }, [params.id]);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;
  if (error) return <div className="text-red-600 p-4">{error}</div>;
  if (!tool) return <div className="text-gray-500 p-4">Tool not found</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{tool.name}</h1>
        <p className="text-gray-600 mt-2">{tool.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Tool Information</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-600">Key</dt>
              <dd className="text-sm font-mono text-gray-900">{tool.key}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Status</dt>
              <dd className="text-sm text-gray-900">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  tool.status === 'active' ? 'bg-green-100 text-green-800' :
                  tool.status === 'deprecated' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {tool.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Created</dt>
              <dd className="text-sm text-gray-900">{new Date(tool.created_at).toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Workspace Access</h3>
          <p className="text-sm text-gray-600 mb-4">Manage which workspaces can use this tool</p>
          <a
            href={`/admin/permissions?tool=${tool.id}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Manage Permissions →
          </a>
        </div>
      </div>
    </div>
  );
}
```

---

## 🎯 QUICK PRIORITY ORDER

**Implement in this order:**
1. ✅ Delete agents code
2. ✅ Create tools/page.tsx (list)
3. ✅ Create tools/[id]/page.tsx (detail)
4. ⏭️ Create skills folder (same structure as tools)
5. ⏭️ Create permissions page
6. ⏭️ Update dashboard
7. ⏭️ Update layout

---

## 🧪 Testing Checklist

After each component:
- [ ] Page loads without errors
- [ ] API calls work correctly
- [ ] Form submissions work
- [ ] Loading states visible
- [ ] Error messages display properly
- [ ] Navigation works

---

## 💡 Tips & Tricks

1. **Copy structure:** Skills folder structure should mirror Tools folder
2. **Reuse components:** Create shared form components in a `components/` folder
3. **API clients:** Keep API calls in separate `api.ts` files for reusability
4. **TypeScript:** Use proper typing for all data structures
5. **Error handling:** Always wrap API calls in try-catch blocks
6. **Loading states:** Show spinners while data is loading

---

**Next Step:** Start with Step 1 (Delete agents) → Then create Tools → Then Skills → Then Permissions

Good luck! 🚀
