import assert from 'node:assert';
import { McpConfigParser } from '../tools/mcp-parser.js';
import { McpToolExecutor } from '../tools/mcp-executor.js';

console.log('Running MCP Unit Tests...\n');

// Test 1: Bóc tách JSON config mẫu của người dùng
const userConfig = JSON.stringify({
  mcpServers: {
    simplefinance: {
      command: 'npx',
      args: ['-y', 'mcp-proxy', 'https://financemcp.oa.io.vn/mcp.php'],
    },
  },
});

const parsed1 = McpConfigParser.parse(userConfig);
assert.strictEqual(parsed1.serverName, 'simplefinance', 'Server name must be extracted');
assert.strictEqual(
  parsed1.targetUrl,
  'https://financemcp.oa.io.vn/mcp.php',
  'Target remote endpoint must be extracted from args'
);
assert.strictEqual(parsed1.transport, 'SSE');
console.log('✓ Test 1: User mcpServers snippet parsed successfully.');

// Test 2: Bóc tách trực tiếp URL
const parsed2 = McpConfigParser.parse('https://example.com/api/mcp');
assert.strictEqual(parsed2.targetUrl, 'https://example.com/api/mcp');
assert.strictEqual(parsed2.serverName, 'example_com');
console.log('✓ Test 2: Direct URL parsed successfully.');

// Test 3: Bóc tách config dạng { url: 'https://...' }
const parsed3 = McpConfigParser.parse({
  mcpServers: {
    crm_hub: {
      url: 'https://crm.example.com/sse',
      headers: {
        'X-Custom-Auth': 'token_xyz',
      },
    },
  },
});
assert.strictEqual(parsed3.serverName, 'crm_hub');
assert.strictEqual(parsed3.targetUrl, 'https://crm.example.com/sse');
assert.strictEqual(parsed3.headers?.['X-Custom-Auth'], 'token_xyz');
console.log('✓ Test 3: URL + Headers parsed successfully.');

// Test 4: SSRF Protection trên McpToolExecutor
async function testSsrf() {
  try {
    await McpToolExecutor.listTools({ endpointUrl: 'http://127.0.0.1:8080/mcp' });
    assert.fail('SSRF IP should have thrown error');
  } catch (err: any) {
    assert(err.message.includes('SSRF'), 'Error should mention SSRF protection');
  }

  const execRes = await McpToolExecutor.execute({
    endpointUrl: 'http://localhost:3000/mcp',
    toolName: 'test',
  });
  assert.strictEqual(execRes.statusCode, 403, 'SSRF blocked should return status 403');
  console.log('✓ Test 4: SSRF Protection verified.');
}

await testSsrf();

console.log('\nAll MCP Unit Tests passed successfully!');
