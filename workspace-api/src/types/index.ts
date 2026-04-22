/**
 * TypeScript Type Definitions
 * Central place for all type definitions used across the application
 */

// ============================================================================
// USER & WORKSPACE TYPES
// ============================================================================

export interface UserProfile {
  id: string;
  zalo_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  gender?: string;
  note?: string;
  status?: string;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface ZaloUserNode {
  zalo_user_id: string;
  name?: string;
  created_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ZaloGroup {
  id: string;
  thread_id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}


// ============================================================================
// TOOL & SKILL TYPES
// ============================================================================

export interface Tool {
  id: string;
  key: string;
  name: string;
  description?: string;
  input_schema?: Record<string, any>;  // JSON schema
  output_schema?: Record<string, any>; // JSON schema
  embedding?: number[];
  status: 'active' | 'deprecated' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  detail?: string;
  is_shared: boolean;
  embedding?: number[];
  status: 'active' | 'archived' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface SkillStep {
  step: number;
  tool: string;  // tool key
  params: Record<string, any>;
  description?: string;
}


// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditLog {
  id: string;
  workspace_id: string | null;
  thread_id?: string;
  user_id?: string;
  // agent_role removed
  action_type: string;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  status: 'success' | 'failed' | 'pending';
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface AuditLogRequest {
  workspace_id: string | null;
  thread_id?: string;
  user_id?: string;
  // agent_role removed
  action_type: string;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  status: 'success' | 'failed' | 'pending';
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogResponse {
  success: boolean;
  data?: AuditLog;
  error?: string;
}

export interface LearnSkillRequest {
  workspace_id: string;
  owner_id: string;
  name: string;
  description: string;
  detail?: string;
  is_shared?: boolean;
}

export interface LearnSkillResponse {
  success: boolean;
  skill_id?: string;
  error?: string;
}

// Admin APIs - Workspace Management
export interface CreateWorkspaceRequest {
  workspace_id: string;
  name: string;
  type?: 'team' | 'company' | 'personal';
  system_prompt: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  type?: 'team' | 'company' | 'personal';
  system_prompt?: string;
  status?: 'active' | 'disabled';
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  type: 'team' | 'company' | 'personal';
  status: 'active' | 'disabled';
  created_at: string;
}

export interface WorkspaceDetailResponse {
  id: string;
  name: string;
  type: 'team' | 'company' | 'personal';
  system_prompt: string;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
  member_count: number;
}

export interface CreateToolRequest {
  key: string;
  name: string;
  description?: string;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
}

export interface CreateToolResponse {
  success: boolean;
  tool_id?: string;
  error?: string;
}

export interface CreatePermissionRequest {
  workspace_id: string;
  tool_key: string;
}

export interface CreatePermissionResponse {
  success: boolean;
  relationship_id?: string;
  error?: string;
}

// User APIs
export interface ListSkillsRequest {
  user_id: string;
  workspace_id?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export interface ListSkillsResponse {
  success: boolean;
  skills: Skill[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  error?: string;
}

export interface ShareSkillRequest {
  skill_id: string;
  workspace_id: string;
}

export interface ShareSkillResponse {
  success: boolean;
  error?: string;
}

export interface RemoveSkillRequest {
  skill_id: string;
  workspace_id: string;
}

export interface RemoveSkillResponse {
  success: boolean;
  error?: string;
}

export interface ListAuditLogsRequest {
  user_id: string;
  workspace_id?: string;
  thread_id?: string;
  limit?: number;
  offset?: number;
}

export interface ListAuditLogsResponse {
  success: boolean;
  logs: AuditLog[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  error?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

// ============================================================================
// NEO4J TYPES
// ============================================================================

export interface Neo4jNode {
  labels: string[];
  properties: Record<string, any>;
}

export interface Neo4jRelationship {
  type: string;
  properties?: Record<string, any>;
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface SemanticSearchRequest {
  query: string;
  type: 'tool' | 'skill';  // What to search
  workspace_id?: string;
  limit?: number;
  threshold?: number;  // Cosine similarity threshold
}

export interface SemanticSearchResult<T> {
  item: T;
  similarity: number;
}

export interface SemanticSearchResponse<T> {
  success: boolean;
  results: SemanticSearchResult<T>[];
  query: string;
  error?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string
  ) {
    super(message);
  }
}

export enum ErrorCode {
  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  USER_NOT_MEMBER = 'USER_NOT_MEMBER',

  // Resource errors
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  ZALO_GROUP_NOT_FOUND = 'ZALO_GROUP_NOT_FOUND',

  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_STATUS = 'INVALID_STATUS',

  // Business logic errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  SKILL_IMMUTABLE = 'SKILL_IMMUTABLE',

  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NEO4J_ERROR = 'NEO4J_ERROR',
}
