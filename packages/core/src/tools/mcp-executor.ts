import type { ToolExecutionResult } from '../types.js';

/**
 * Kiểm tra xem hostname/IP có nằm trong dải IP nội bộ hay không để phòng ngừa SSRF
 */
function isPrivateIpOrHost(hostname: string): boolean {
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

export interface DiscoveredMcpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpListToolsOptions {
  endpointUrl: string;
  authHeaders?: Record<string, string>;
  timeoutMs?: number;
}

export interface McpCallToolOptions {
  endpointUrl: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  authHeaders?: Record<string, string>;
  timeoutMs?: number;
  toolId?: string;
}

export class McpToolExecutor {
  /**
   * Gọi remote MCP server để lấy danh sách tool (Auto-discovery)
   */
  static async listTools(options: McpListToolsOptions): Promise<DiscoveredMcpTool[]> {
    const { endpointUrl, authHeaders = {}, timeoutMs = 15000 } = options;

    const url = new URL(endpointUrl);
    if (isPrivateIpOrHost(url.hostname)) {
      throw new Error(`Endpoint URL không an toàn (bảo vệ SSRF): ${url.hostname}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...authHeaders,
      };

      // 1. Gửi request tools/list chuẩn JSON-RPC 2.0
      const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      let res = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // Tự động thử lại với HTTPS nếu server trả về lỗi do redirect từ HTTP sang HTTPS (ví dụ qua Cloudflare 301 chuyển method thành GET)
      if (!res.ok && endpointUrl.startsWith('http://')) {
        try {
          const httpsUrl = endpointUrl.replace('http://', 'https://');
          const httpsRes = await fetch(httpsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          if (httpsRes.ok) {
            res = httpsRes;
          }
        } catch {}
      }

      if (!res.ok) {
        throw new Error(`MCP server phản hồi lỗi HTTP ${res.status}: ${res.statusText}`);
      }

      const contentType = res.headers.get('content-type') || '';

      // Trường hợp phản hồi JSON
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (json.error) {
          throw new Error(`MCP JSON-RPC Error [${json.error.code}]: ${json.error.message}`);
        }

        const tools = json.result?.tools;
        if (!Array.isArray(tools)) {
          throw new Error('Dữ liệu trả về không chứa mảng result.tools hợp lệ');
        }

        return tools.map((t: any) => ({
          name: t.name,
          description: t.description || '',
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
        }));
      }

      // Trường hợp SSE hoặc raw stream text
      const rawText = await res.text();
      // Thử parse dòng data: {...} của SSE nếu có
      const lines = rawText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          try {
            const data = JSON.parse(trimmed.slice(5).trim());
            const tools = data.result?.tools;
            if (Array.isArray(tools)) {
              return tools.map((t: any) => ({
                name: t.name,
                description: t.description || '',
                inputSchema: t.inputSchema || { type: 'object', properties: {} },
              }));
            }
          } catch {
            // bỏ qua dòng không parse được
          }
        }
      }

      // Thử parse toàn bộ raw text nếu là JSON mà header content-type bị thiếu
      try {
        const parsed = JSON.parse(rawText);
        const tools = parsed.result?.tools;
        if (Array.isArray(tools)) {
          return tools.map((t: any) => ({
            name: t.name,
            description: t.description || '',
            inputSchema: t.inputSchema || { type: 'object', properties: {} },
          }));
        }
      } catch {
        // Fallback
      }

      throw new Error(`Không thể giải mã danh sách công cụ từ phản hồi của MCP Server. Nội dung: ${rawText.slice(0, 200)}`);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Quá thời gian kết nối tới MCP Server (> ${timeoutMs / 1000}s). Vui lòng thử lại sau.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Thực thi một tool trên MCP server (Runtime Execution)
   */
  static async execute(options: McpCallToolOptions): Promise<ToolExecutionResult> {
    const { endpointUrl, toolName, arguments: args = {}, authHeaders = {}, timeoutMs = 15000, toolId = 'mcp_tool' } = options;
    const startTime = Date.now();

    const targetUrl = new URL(endpointUrl);
    if (isPrivateIpOrHost(targetUrl.hostname)) {
      const latencyMs = Date.now() - startTime;
      return {
        toolId,
        toolKey: toolName,
        url: endpointUrl,
        method: 'POST',
        headersSent: authHeaders,
        statusCode: 403,
        responseBody: {
          error: `Endpoint URL ${targetUrl.hostname} bị chặn bởi cơ chế bảo mật nội bộ (SSRF).`,
          success: false,
        },
        latencyMs,
        error: `SSRF Blocked: ${targetUrl.hostname}`,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const rpcPayload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...authHeaders,
    };

    try {
      let response = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(rpcPayload),
        signal: controller.signal,
      });

      if (!response.ok && endpointUrl.startsWith('http://')) {
        try {
          const httpsUrl = endpointUrl.replace('http://', 'https://');
          const httpsRes = await fetch(httpsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(rpcPayload),
            signal: controller.signal,
          });
          if (httpsRes.ok) {
            response = httpsRes;
          }
        } catch {}
      }

      const latencyMs = Date.now() - startTime;
      let responseBody: any;
      const text = await response.text();

      try {
        responseBody = JSON.parse(text);
      } catch {
        responseBody = { raw: text };
      }

      if (!response.ok) {
        return {
          toolId,
          toolKey: toolName,
          url: endpointUrl,
          method: 'POST',
          headersSent: headers,
          statusCode: response.status,
          responseBody: {
            success: false,
            error: `MCP Server phản hồi lỗi HTTP ${response.status}: ${response.statusText}`,
            detail: responseBody,
          },
          latencyMs,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Xử lý lỗi trả về trong JSON-RPC
      if (responseBody.error) {
        return {
          toolId,
          toolKey: toolName,
          url: endpointUrl,
          method: 'POST',
          headersSent: headers,
          statusCode: 200,
          responseBody: {
            success: false,
            error: responseBody.error.message || 'Lỗi thực thi từ MCP Server',
            code: responseBody.error.code,
          },
          latencyMs,
          error: responseBody.error.message || 'MCP Error',
        };
      }

      // Xử lý kết quả chuẩn của MCP tool result: { content: [{ type: "text", text: "..." }], isError: boolean }
      const result = responseBody.result || responseBody;
      const isError = result.isError === true;

      return {
        toolId,
        toolKey: toolName,
        url: endpointUrl,
        method: 'POST',
        headersSent: headers,
        statusCode: 200,
        responseBody: result,
        latencyMs,
        error: isError ? 'Tool execution marked as error' : null,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';

      const errorMsg = isTimeout
        ? `Thời gian thực thi MCP Tool [${toolName}] vượt quá giới hạn cho phép (${timeoutMs / 1000}s). Vui lòng thử lại sau.`
        : `Lỗi kết nối tới MCP Server: ${err.message || String(err)}`;

      return {
        toolId,
        toolKey: toolName,
        url: endpointUrl,
        method: 'POST',
        headersSent: headers,
        statusCode: isTimeout ? 504 : 500,
        responseBody: {
          success: false,
          error: errorMsg,
          isTimeout,
        },
        latencyMs,
        error: errorMsg,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
