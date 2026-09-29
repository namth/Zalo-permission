export type PlatformType = 'TELEGRAM' | 'ZALO';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type AuthType = 'NONE' | 'BEARER' | 'API_KEY' | 'BASIC' | 'CUSTOM_HEADERS';

export type ProtocolType = 'REST' | 'MCP';

export type McpTransportType = 'SSE' | 'STREAMABLE_HTTP' | 'DIRECT_HTTP';

export interface ToolGroupDefinition {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  protocolType?: ProtocolType | string;
  baseUrl: string;
  mcpTransport?: McpTransportType | string;
  mcpRawConfig?: Record<string, unknown> | null;
  timeoutSeconds?: number;
  authType: AuthType;
  defaultAuthConfig?: Record<string, unknown>;
  defaultHeaders?: Record<string, string>;
  requiredVariables: string[];
  isActive: boolean;
}

export interface ToolDefinition {
  id: string;
  toolGroupId: string;
  key: string;
  name: string;
  description: string;
  method?: HttpMethod;
  path?: string;
  mcpToolName?: string;
  parametersSchema?: Record<string, unknown>;
  bodySchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  isActive: boolean;
}

export interface SkillDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  systemPrompt: string;
  triggerIntents: string[];
  requiredTools: string[];
  isActive: boolean;
}

export interface WorkspaceScopedConfig {
  workspaceId: string;
  toolGroupId: string;
  isEnabled: boolean;
  envOverrides: Record<string, string>;
  disabledToolIds: string[];
}

export interface InboundChatMessage {
  platform: PlatformType;
  accountId: string;
  platformChatId: string;
  senderId: string;
  senderName?: string;
  messageId: string;
  text: string;
  timestamp: number;
}

export interface RouterDecision {
  intent: string;
  isSkillMatched: boolean;
  matchedSkillId?: string | null;
  matchedSkillKey?: string | null;
  recommendedToolGroups: string[];
  confidence: number;
  extractedParameters?: Record<string, unknown>;
}

export interface ToolExecutionResult {
  toolId: string;
  toolKey: string;
  url: string;
  method: HttpMethod;
  headersSent: Record<string, string>;
  statusCode: number;
  responseBody: unknown;
  latencyMs: number;
  error?: string | null;
}

export interface ExecutionPlanStep {
  step: number;
  action: 'THINK' | 'CALL_TOOL' | 'SYNTHESIZE';
  description: string;
  toolKey?: string;
  input?: Record<string, unknown>;
  output?: unknown;
}

export interface AgentExecutionOutput {
  workspaceId: string;
  chatId: string;
  platform: PlatformType;
  senderId: string;
  userPrompt: string;
  detectedIntent: string;
  matchedSkillId?: string | null;
  plan: ExecutionPlanStep[];
  toolCalls: ToolExecutionResult[];
  finalResponse: string;
  status: 'SUCCESS' | 'FAILED' | 'REJECTED';
  latencyMs: number;
}
