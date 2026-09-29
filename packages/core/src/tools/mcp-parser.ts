/**
 * MCP Config Parser
 * Trích xuất server name, remote endpoint URL và cấu hình từ JSON snippet của MCP
 */

export interface ParsedMcpConfig {
  serverName: string;
  targetUrl: string;
  transport: 'SSE' | 'STREAMABLE_HTTP' | 'DIRECT_HTTP';
  headers?: Record<string, string>;
  rawSnippet?: Record<string, unknown>;
}

export class McpConfigParser {
  /**
   * Bóc tách JSON config hoặc URL thành cấu trúc MCP có thể kết nối được
   */
  static parse(input: string | Record<string, unknown>): ParsedMcpConfig {
    let parsed: Record<string, unknown>;

    if (typeof input === 'string') {
      const trimmed = input.trim();
      // Nếu là URL trực tiếp
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const urlObj = new URL(trimmed);
        const nameGuess = urlObj.hostname.replace(/[^a-zA-Z0-9_]/g, '_');
        return {
          serverName: nameGuess || 'mcp_server',
          targetUrl: trimmed,
          transport: 'SSE',
        };
      }

      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        throw new Error(`Cấu hình JSON không hợp lệ: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      parsed = input;
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Dữ liệu cấu hình phải là một đối tượng JSON.');
    }

    // 1. Kiểm tra format chuẩn { "mcpServers": { "<serverName>": { ... } } }
    if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
      const servers = parsed.mcpServers as Record<string, any>;
      const keys = Object.keys(servers);
      if (keys.length === 0) {
        throw new Error('Không tìm thấy server nào trong mục "mcpServers".');
      }

      const serverName = keys[0];
      const serverConfig = servers[serverName];
      return this.extractFromSingleConfig(serverName, serverConfig, parsed);
    }

    // 2. Kiểm tra nếu người dùng paste trực tiếp config của 1 server: { "command": "...", "args": [...] } hoặc { "url": "..." }
    const keys = Object.keys(parsed);
    if (keys.includes('command') || keys.includes('args') || keys.includes('url')) {
      return this.extractFromSingleConfig('mcp_server', parsed, parsed);
    }

    // 3. Kiểm tra nếu là format { "simplefinance": { "command": ... } }
    if (keys.length === 1 && typeof parsed[keys[0]] === 'object') {
      const serverName = keys[0];
      return this.extractFromSingleConfig(serverName, parsed[serverName] as Record<string, any>, parsed);
    }

    throw new Error('Không nhận diện được định dạng cấu hình MCP. Vui lòng kiểm tra lại JSON.');
  }

  private static extractFromSingleConfig(
    serverName: string,
    config: Record<string, any>,
    rawSnippet: Record<string, unknown>
  ): ParsedMcpConfig {
    let targetUrl = '';
    const headers: Record<string, string> = {};

    // Tìm URL trực tiếp trong config (ví dụ: url: "https://...")
    if (typeof config.url === 'string' && config.url.startsWith('http')) {
      targetUrl = config.url;
    }

    // Tìm URL trong args (ví dụ: ["-y", "mcp-proxy", "https://financemcp.oa.io.vn/mcp.php"])
    if (!targetUrl && Array.isArray(config.args)) {
      for (const arg of config.args) {
        if (typeof arg === 'string' && (arg.startsWith('http://') || arg.startsWith('https://'))) {
          targetUrl = arg;
          break;
        }
      }
    }

    // Tìm headers nếu có khai báo
    if (config.headers && typeof config.headers === 'object') {
      Object.assign(headers, config.headers);
    }

    if (!targetUrl) {
      throw new Error(
        `Không thể tìm thấy URL endpoint HTTP/SSE của server MCP "${serverName}". Hệ thống hiện tại yêu cầu remote endpoint để kết nối native.`
      );
    }

    // Chuẩn hóa tên server thành key an toàn (chỉ chữ thường, số, gạch dưới)
    const sanitizedKey = serverName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    return {
      serverName: sanitizedKey || 'mcp_server',
      targetUrl,
      transport: 'SSE',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      rawSnippet,
    };
  }
}
