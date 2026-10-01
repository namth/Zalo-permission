import type { ToolDefinition, ToolGroupDefinition, ToolExecutionResult, HttpMethod } from '../types.js';
import { VariableInjector } from './variable-injector.js';
import { McpToolExecutor } from './mcp-executor.js';

/**
 * Kiểm tra xem hostname/IP có nằm trong dải IP nội bộ hay không để phòng ngừa SSRF
 */
export function isPrivateIpOrHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.startsWith('127.') ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.') ||
    lower === '0.0.0.0' ||
    lower === '::1'
  ) {
    return true;
  }

  // Check 172.16.0.0/12
  const parts = lower.split('.');
  if (parts.length === 4) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    if (p0 === 172 && p1 >= 16 && p1 <= 31) {
      return true;
    }
  }

  return false;
}

export interface ExecuteToolOptions {
  tool: ToolDefinition;
  group: ToolGroupDefinition;
  scopedVariables: Record<string, string>;
  inputParameters?: Record<string, unknown>;
  timeoutMs?: number;
}

export class ToolExecutor {
  /**
   * Thực thi gọi API thật đến hệ thống bên ngoài với đầy đủ xác thực và đo đếm
   */
  static async execute(options: ExecuteToolOptions): Promise<ToolExecutionResult> {
    const { tool, group, scopedVariables, inputParameters = {}, timeoutMs = 10000 } = options;
    const startTime = Date.now();

    // 0. Nếu là MCP ToolGroup, chuyển tiếp cho McpToolExecutor
    if (group.protocolType === 'MCP' || (group.baseUrl && (group.baseUrl.includes('/mcp.php') || group.baseUrl.includes('/mcp')))) {
      const rawBaseUrl = VariableInjector.injectString(group.baseUrl, scopedVariables);
      const authHeaders: Record<string, string> = {};

      const token =
        scopedVariables.AUTH_TOKEN ||
        scopedVariables.API_KEY ||
        scopedVariables.TOKEN ||
        scopedVariables.BEARER_TOKEN ||
        scopedVariables.API_TOKEN ||
        scopedVariables.SECRET_KEY;

      if (token) {
        authHeaders['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      } else if (group.defaultAuthConfig && typeof group.defaultAuthConfig === 'object') {
        const defaultToken = (group.defaultAuthConfig as any).token || (group.defaultAuthConfig as any).apiKey;
        if (defaultToken) {
          authHeaders['Authorization'] = defaultToken.startsWith('Bearer ') ? defaultToken : `Bearer ${defaultToken}`;
        }
      }

      // Check for custom header variables in scopedVariables (e.g. X_API_KEY, HEADER_*)
      for (const [vKey, vVal] of Object.entries(scopedVariables)) {
        if (!vVal) continue;
        const upper = vKey.toUpperCase();
        if (upper === 'X_API_KEY' || upper === 'X-API-KEY') {
          authHeaders['X-API-Key'] = vVal;
        } else if (upper.startsWith('HEADER_')) {
          const headerName = vKey.substring(7).replace(/_/g, '-');
          authHeaders[headerName] = vVal;
        }
      }

      // Hỗ trợ merge thêm defaultHeaders nếu có
      if (group.defaultHeaders) {
        Object.assign(authHeaders, group.defaultHeaders);
      }

      const mcpToolName = tool.mcpToolName || tool.name || tool.key;
      const timeout = (group.timeoutSeconds || 15) * 1000;

      return McpToolExecutor.execute({
        endpointUrl: rawBaseUrl,
        toolName: mcpToolName,
        arguments: inputParameters,
        authHeaders,
        timeoutMs: timeout,
        toolId: tool.id,
      });
    }

    // 1. Resolve Base URL & Endpoint Path with scoped variables
    const rawBaseUrl = VariableInjector.injectString(group.baseUrl, scopedVariables);
    let resolvedPath = VariableInjector.injectString(tool.path || '', scopedVariables);

    // 2. Thay thế path parameters (ví dụ /products/{id})
    for (const [key, value] of Object.entries(inputParameters)) {
      const placeholder = `{${key}}`;
      if (resolvedPath.includes(placeholder)) {
        resolvedPath = resolvedPath.replace(placeholder, encodeURIComponent(String(value)));
      }
    }

    const fullUrlString = `${rawBaseUrl.replace(/\/+$/, '')}/${resolvedPath.replace(/^\/+/, '')}`;
    const targetUrl = new URL(fullUrlString);

    // 3. SSRF Protection check
    if (isPrivateIpOrHost(targetUrl.hostname)) {
      const latencyMs = Date.now() - startTime;
      return {
        toolId: tool.id,
        toolKey: tool.key,
        url: fullUrlString,
        method: tool.method || 'GET',
        headersSent: {},
        statusCode: 403,
        responseBody: { error: `SSRF Blocked: Destination ${targetUrl.hostname} is restricted.` },
        latencyMs,
        error: `SSRF Blocked: ${targetUrl.hostname}`,
      };
    }

    // 4. Construct Headers based on Auth Type and Scoped Config
    const headers: Record<string, string> = {
      'User-Agent': 'OmniAgent-Gateway/2.0',
      Accept: 'application/json',
      ...VariableInjector.injectObject(group.defaultHeaders || {}, scopedVariables),
    };

    // Áp dụng Authentication theo Auth Type
    switch (group.authType) {
      case 'BEARER': {
        const token =
          scopedVariables.AUTH_TOKEN ||
          scopedVariables.API_KEY ||
          scopedVariables.TOKEN ||
          scopedVariables.BEARER_TOKEN ||
          scopedVariables.API_TOKEN ||
          scopedVariables.SECRET_KEY ||
          (group.defaultAuthConfig && typeof group.defaultAuthConfig === 'object'
            ? (group.defaultAuthConfig as any).token || (group.defaultAuthConfig as any).apiKey
            : undefined);
        if (token) {
          headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
        }
        break;
      }
      case 'API_KEY': {
        const keyHeader = (group.defaultAuthConfig?.header_name as string) || 'X-API-Key';
        const apiKey =
          scopedVariables.API_KEY ||
          scopedVariables.KEY ||
          scopedVariables.AUTH_TOKEN ||
          scopedVariables.TOKEN ||
          (group.defaultAuthConfig && typeof group.defaultAuthConfig === 'object'
            ? (group.defaultAuthConfig as any).apiKey || (group.defaultAuthConfig as any).token
            : undefined);
        if (apiKey) {
          headers[keyHeader] = apiKey;
        }
        break;
      }
      case 'BASIC': {
        const username = scopedVariables.USERNAME || '';
        const password = scopedVariables.PASSWORD || '';
        const encoded = Buffer.from(`${username}:${password}`).toString('base64');
        headers.Authorization = `Basic ${encoded}`;
        break;
      }
      case 'CUSTOM_HEADERS': {
        const customAuth = VariableInjector.injectObject(
          (group.defaultAuthConfig?.headers as Record<string, string>) || {},
          scopedVariables
        );
        Object.assign(headers, customAuth);
        break;
      }
      default:
        break;
    }

    // 5. Query Parameters vs Request Body
    const method = (tool.method || 'GET').toUpperCase() as HttpMethod;
    let requestBody: string | undefined;

    if (method === 'GET' || method === 'DELETE') {
      const toolPathParam = tool.path || '';
      for (const [key, value] of Object.entries(inputParameters)) {
        if (!toolPathParam.includes(`{${key}}`) && value !== undefined && value !== null) {
          targetUrl.searchParams.append(key, String(value));
        }
      }
    } else {
      // POST, PUT, PATCH
      headers['Content-Type'] = 'application/json';
      const bodyPayload = VariableInjector.injectObject(inputParameters, scopedVariables);
      requestBody = JSON.stringify(bodyPayload);
    }

    // 6. Execute HTTP Request with AbortController timeout
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl.toString(), {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;
      let responseBody: unknown;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }
      } else {
        responseBody = await response.text();
      }

      return {
        toolId: tool.id,
        toolKey: tool.key,
        url: targetUrl.toString(),
        method,
        headersSent: headers,
        statusCode: response.status,
        responseBody,
        latencyMs,
        error: response.ok ? null : `HTTP Error ${response.status}: ${response.statusText}`,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      const errorMessage = isTimeout ? `Request timed out after ${timeoutMs}ms` : String(err);

      return {
        toolId: tool.id,
        toolKey: tool.key,
        url: targetUrl.toString(),
        method,
        headersSent: headers,
        statusCode: isTimeout ? 504 : 500,
        responseBody: { error: errorMessage },
        latencyMs,
        error: errorMessage,
      };
    } finally {
      clearTimeout(timeoutTimer);
    }
  }
}
