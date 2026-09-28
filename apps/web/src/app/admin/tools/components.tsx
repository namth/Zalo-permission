'use client';

import { useState, useEffect } from 'react';
import {
  Tool,
  createTool, updateTool,
} from './api';

interface ToolFormProps {
  tool?: Tool;
  onSubmit: (data: Partial<Tool>) => Promise<void>;
  onSuccess?: () => void;
}

export function ToolForm({ tool, onSubmit, onSuccess }: ToolFormProps) {
  const [formData, setFormData] = useState<Partial<Tool>>(() => {
    if (tool) {
      return {
        ...tool,
        group_id: tool.group_id || tool.group_info?.id || ''
      };
    }
    return {
      key: '',
      name: '',
      description: '',
      status: 'active',
      group_id: '',
    };
  });
  const [groups, setGroups] = useState<{ id: string, name: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [inputSchemaRaw, setInputSchemaRaw] = useState<string>(
    tool?.input_schema ? JSON.stringify(tool.input_schema, null, 2) : ''
  );
  const [inputSchemaError, setInputSchemaError] = useState<string | null>(null);
  const [outputSchemaRaw, setOutputSchemaRaw] = useState<string>(
    tool?.output_schema ? JSON.stringify(tool.output_schema, null, 2) : ''
  );
  const [outputSchemaError, setOutputSchemaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoadingGroups(true);
        const res = await fetch('/api/admin/tool-groups');
        const data = await res.json();
        if (data.success && data.data) {
          setGroups(data.data);
        }
      } catch (err) {
        console.error('Failed to load tool groups for form', err);
      } finally {
        setLoadingGroups(false);
      }
    };
    loadGroups();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInputSchemaError(null);
    setOutputSchemaError(null);
    setSuccess(false);

    // Validate required fields
    if (!formData.key?.trim()) {
      setError('Tool key is required');
      return;
    }
    if (!formData.name?.trim()) {
      setError('Tool name is required');
      return;
    }

    // Parse input_schema JSON
    let parsedInputSchema: Record<string, any> | undefined = undefined;
    if (inputSchemaRaw.trim()) {
      try {
        parsedInputSchema = JSON.parse(inputSchemaRaw);
      } catch {
        setInputSchemaError('Input Schema is not valid JSON');
        return;
      }
    }

    // Parse output_schema JSON
    let parsedOutputSchema: Record<string, any> | undefined = undefined;
    if (outputSchemaRaw.trim()) {
      try {
        parsedOutputSchema = JSON.parse(outputSchemaRaw);
      } catch {
        setOutputSchemaError('Output Schema is not valid JSON');
        return;
      }
    }

    try {
      setLoading(true);
      await onSubmit({ 
        ...formData, 
        input_schema: parsedInputSchema,
        output_schema: parsedOutputSchema,
      });
      setSuccess(true);

      if (!tool) {
        // Reset form for new tool
        setFormData({
          key: '',
          name: '',
          description: '',
          status: 'active',
          group_id: '',
        });
        setInputSchemaRaw('');
        setOutputSchemaRaw('');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving tool');
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

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          Tool saved successfully!
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tool Key <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.key || ''}
          onChange={(e) => setFormData({ ...formData, key: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., send_email"
          disabled={loading || !!tool}
        />
        <p className="text-xs text-gray-500 mt-1">Unique identifier for the tool (cannot be changed)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Send Email"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="What does this tool do?"
          rows={4}
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Input Schema
          <span className="ml-2 text-xs font-normal text-gray-400">(JSON)</span>
        </label>
        <textarea
          value={inputSchemaRaw}
          onChange={(e) => {
            setInputSchemaRaw(e.target.value);
            setInputSchemaError(null);
          }}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
            inputSchemaError ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
          placeholder={`{\n  "type": "object",\n  "properties": {\n    "param": { "type": "string" }\n  },\n  "required": ["param"]\n}`}
          rows={8}
          disabled={loading}
        />
        {inputSchemaError && (
          <p className="text-xs text-red-600 mt-1">{inputSchemaError}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Optional JSON Schema describing the tool&apos;s input parameters.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Output Schema
          <span className="ml-2 text-xs font-normal text-gray-400">(JSON)</span>
        </label>
        <textarea
          value={outputSchemaRaw}
          onChange={(e) => {
            setOutputSchemaRaw(e.target.value);
            setOutputSchemaError(null);
          }}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
            outputSchemaError ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
          placeholder={`{\n  "type": "object",\n  "properties": {\n    "result": { "type": "string" }\n  }\n}`}
          rows={8}
          disabled={loading}
        />
        {outputSchemaError && (
          <p className="text-xs text-red-600 mt-1">{outputSchemaError}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Optional JSON Schema describing the tool&apos;s return values.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          value={formData.status || 'active'}
          onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value="active">Active</option>
          <option value="deprecated">Deprecated</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tool Group
        </label>
        <select
          value={formData.group_id || ''}
          onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading || loadingGroups}
        >
          <option value="">No Group</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">Group to logically organize this tool</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? 'Saving...' : tool ? 'Update Tool' : 'Create Tool'}
      </button>
    </form>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-green-100 text-green-800',
    deprecated: 'bg-yellow-100 text-yellow-800',
    disabled: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

