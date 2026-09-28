import assert from 'node:assert';
import { VariableInjector } from '../tools/variable-injector.ts';

console.log('Running Variable Injector Unit Tests...');

// Test 1: URL String injection
const urlTemplate = 'https://{{TENANT_ID}}.kiotapi.com/api/v1/branches/{{BRANCH_CODE}}/products';
const variables = {
  TENANT_ID: 'my-shop-hanoi',
  BRANCH_CODE: 'HN_01',
  API_KEY: 'secret_key_123',
};

const resolvedUrl = VariableInjector.injectString(urlTemplate, variables);
assert.strictEqual(
  resolvedUrl,
  'https://my-shop-hanoi.kiotapi.com/api/v1/branches/HN_01/products',
  'URL placeholders must be correctly replaced'
);
console.log('✓ Test 1: URL String injection passed.');

// Test 2: Nested Object & Headers injection
const headersTemplate = {
  Authorization: 'Bearer {{API_KEY}}',
  'X-Branch': '{{BRANCH_CODE}}',
  'Content-Type': 'application/json',
  meta: {
    tenant: '{{TENANT_ID}}',
  },
};

const resolvedHeaders = VariableInjector.injectObject(headersTemplate, variables);
assert.strictEqual(resolvedHeaders.Authorization, 'Bearer secret_key_123');
assert.strictEqual(resolvedHeaders['X-Branch'], 'HN_01');
assert.strictEqual(resolvedHeaders.meta.tenant, 'my-shop-hanoi');
console.log('✓ Test 2: Nested Object & Headers injection passed.');

// Test 3: Validation of required variables
const validation = VariableInjector.validateRequiredVariables(
  ['TENANT_ID', 'BRANCH_CODE', 'SECRET_PEPPER'],
  variables
);
assert.strictEqual(validation.isValid, false);
assert.deepStrictEqual(validation.missingVariables, ['SECRET_PEPPER']);
console.log('✓ Test 3: Required variables validation passed.');

console.log('All Variable Injector tests passed successfully!');
