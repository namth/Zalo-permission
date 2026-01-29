// Workspace Context Response Type
export interface WorkspaceContext {
  allowed: boolean;
  agent_key?: string;
  role?: string;
  system_prompt?: string;
  status?: string;
  error?: string;
  message?: string;
  created_at?: string;
}

// API Request Types
export interface ResolveWorkspaceContextRequest {
  zalo_thread_id: string;
  zalo_user_id: string;
}

export interface SyncUserRequest {
  zalo_thread_id: string;
  workspace_id: string;
  users: SyncUserItem[];
}

export interface SyncUserItem {
  zalo_user_id: string;
  name?: string;
  role: string;
}

export interface SyncUserResponse {
  success: boolean;
  synced_count: number;
  created_count: number;
  updated_count: number;
  errors: SyncUserError[];
}

export interface SyncUserError {
  user_id: string;
  error: string;
}

// User Creation Request (by AI Agent)
export interface CreateUserRequest {
  zalo_group_id: string; // Group user will belong to
  zalo_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gender?: string; // male | female | other
}

// User Creation Response
export interface CreateUserResponse {
  user_id: string; // UUID
  zalo_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gender?: string;
  zalo_group_id: string;
  workspace_id: string;
  created_at: string;
}

// Neo4j Node Types
export interface ZaloUserNode {
  zalo_user_id: string;
  name?: string;
  created_at: string;
}

export interface WorkspaceNode {
  id: string;
  name: string;
  type: string;
  created_at: string;
}

export interface ZaloGroupNode {
  zalo_thread_id: string;
}

export interface AgentNode {
  key: string;
  type: string;
}

// Neo4j Relationship Types
export interface MemberOfRelationship {
  role: string;
  joined_at: string;
}

// SQL Types - User (Contact List)
export interface User {
  id: string; // UUID
  zalo_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gender?: string; // male | female | other
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: number;
  zalo_user_id: string;
  phone?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceConfig {
  id: number;
  workspace_id: string;
  default_agent: string;
  system_prompt: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Admin API Types
export interface CreateWorkspaceRequest {
  workspace_id: string;
  name: string;
  type?: string; // company, team, personal
  agent_key?: string; // default: agent_support
  system_prompt: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  type?: string;
  agent_key?: string;
  system_prompt?: string;
  status?: string; // active, disabled
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  type: string;
  agent_key: string;
  status: string;
  created_at: string;
}

export interface WorkspaceDetailResponse {
  id: string;
  name: string;
  type: string;
  agent_key: string;
  system_prompt: string;
  status: string;
  created_at: string;
  updated_at: string;
  member_count: number;
}

export interface AdminApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
