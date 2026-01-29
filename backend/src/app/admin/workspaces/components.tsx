'use client';

import React, { useState } from 'react';
import { WorkspaceForm } from './api';

// Toast Notification
export function Toast({
  message,
  type = 'success',
  onClose,
}: {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? '#27ae60' : '#e74c3c';

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: bgColor,
        color: 'white',
        padding: '15px 20px',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        zIndex: 1000,
      }}
    >
      {message}
    </div>
  );
}

// Create/Edit Workspace Modal
export function WorkspaceFormModal({
  isOpen,
  isLoading,
  isEdit = false,
  initialData,
  onSubmit,
  onClose,
}: {
  isOpen: boolean;
  isLoading: boolean;
  isEdit?: boolean;
  initialData?: WorkspaceForm;
  onSubmit: (data: WorkspaceForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<WorkspaceForm>(
    initialData || {
      workspace_id: '',
      name: '',
      type: 'team',
      agent_key: 'agent_support',
      system_prompt: '',
      status: 'active',
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!isEdit && !form.workspace_id) {
      newErrors.workspace_id = 'Workspace ID is required';
    }
    if (!form.name) {
      newErrors.name = 'Name is required';
    }
    if (!form.system_prompt) {
      newErrors.system_prompt = 'System prompt is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await onSubmit(form);
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '30px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '20px' }}>
          {isEdit ? 'Edit Workspace' : 'Create New Workspace'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Workspace ID */}
          {!isEdit && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Workspace ID *
              </label>
              <input
                type="text"
                name="workspace_id"
                value={form.workspace_id || ''}
                onChange={handleChange}
                placeholder="e.g., workspace_mycompany"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: errors.workspace_id ? '2px solid #e74c3c' : '1px solid #bdc3c7',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
                disabled={isLoading}
              />
              {errors.workspace_id && (
                <span style={{ color: '#e74c3c', fontSize: '12px', marginTop: '3px' }}>
                  {errors.workspace_id}
                </span>
              )}
            </div>
          )}

          {/* Name */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Name *
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g., My Company"
              style={{
                width: '100%',
                padding: '10px',
                border: errors.name ? '2px solid #e74c3c' : '1px solid #bdc3c7',
                borderRadius: '4px',
                fontSize: '14px',
              }}
              disabled={isLoading}
            />
            {errors.name && (
              <span style={{ color: '#e74c3c', fontSize: '12px', marginTop: '3px' }}>
                {errors.name}
              </span>
            )}
          </div>

          {/* Type */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Type
            </label>
            <select
              name="type"
              value={form.type || 'team'}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #bdc3c7',
                borderRadius: '4px',
                fontSize: '14px',
              }}
              disabled={isLoading}
            >
              <option value="team">Team</option>
              <option value="company">Company</option>
              <option value="personal">Personal</option>
            </select>
          </div>

          {/* Agent */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Default Agent
            </label>
            <select
              name="agent_key"
              value={form.agent_key || 'agent_support'}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #bdc3c7',
                borderRadius: '4px',
                fontSize: '14px',
              }}
              disabled={isLoading}
            >
              <option value="agent_support">Support Agent</option>
              <option value="agent_finance">Finance Agent</option>
            </select>
          </div>

          {/* System Prompt */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              System Prompt *
            </label>
            <textarea
              name="system_prompt"
              value={form.system_prompt}
              onChange={handleChange}
              placeholder="e.g., You are a customer support agent..."
              style={{
                width: '100%',
                padding: '10px',
                border: errors.system_prompt ? '2px solid #e74c3c' : '1px solid #bdc3c7',
                borderRadius: '4px',
                fontSize: '14px',
                minHeight: '100px',
                fontFamily: 'monospace',
              }}
              disabled={isLoading}
            />
            {errors.system_prompt && (
              <span style={{ color: '#e74c3c', fontSize: '12px', marginTop: '3px' }}>
                {errors.system_prompt}
              </span>
            )}
          </div>

          {/* Status (only in edit mode) */}
          {isEdit && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Status
              </label>
              <select
                name="status"
                value={form.status || 'active'}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #bdc3c7',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
                disabled={isLoading}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          )}

          {errors.submit && (
            <div style={{ color: '#e74c3c', padding: '10px', backgroundColor: '#fadbd8', borderRadius: '4px' }}>
              {errors.submit}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: isLoading ? '#95a5a6' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
export function DeleteConfirmModal({
  isOpen,
  workspaceName,
  isLoading,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  workspaceName?: string;
  isLoading: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '30px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '15px', color: '#e74c3c' }}>Delete Workspace</h2>
        <p style={{ marginBottom: '20px', color: '#555' }}>
          Are you sure you want to delete workspace <strong>{workspaceName}</strong>?
        </p>
        <p style={{ marginBottom: '20px', color: '#e74c3c', fontSize: '12px' }}>
          ⚠️ This action cannot be undone. All relationships will be deleted.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: isLoading ? '#95a5a6' : '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
