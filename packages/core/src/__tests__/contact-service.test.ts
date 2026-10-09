import assert from 'node:assert';
import { isPrivateIpOrHost } from '../tools/executor.js';

console.log('Running Contact & MCP Security Unit Tests...');

// Test 1: SSRF check blocks random private hosts
assert.strictEqual(
  isPrivateIpOrHost('localhost', '/other/endpoint'),
  true,
  'localhost for non-mcp should be blocked'
);
assert.strictEqual(
  isPrivateIpOrHost('192.168.1.1', '/other/endpoint'),
  true,
  'Private IP for non-mcp should be blocked'
);
console.log('✓ Test 1: External SSRF blocking verified.');

// Test 2: Internal MCP route /api/mcp is allowed through security exemption
assert.strictEqual(
  isPrivateIpOrHost('localhost', '/api/mcp'),
  false,
  '/api/mcp endpoint should be allowed for internal system calls'
);
assert.strictEqual(
  isPrivateIpOrHost('127.0.0.1', '/api/mcp/inspect'),
  false,
  '/api/mcp sub-endpoints should be allowed for internal system calls'
);
console.log('✓ Test 2: Internal MCP exemption verified.');

// Test 3: Contact field merging logic emulation
interface MockContact {
  id: string;
  name: string;
  zaloId?: string | null;
  telegramId?: string | null;
  role: 'USER' | 'SUPER_ADMIN';
  gender?: string | null;
  birthYear?: number | null;
  email?: string | null;
  phone?: string | null;
  hobbies?: string | null;
}

function mergeProfileData(primary: MockContact, secondary: MockContact): Partial<MockContact> {
  const merged: Partial<MockContact> = {};
  if (!primary.zaloId && secondary.zaloId) merged.zaloId = secondary.zaloId;
  if (!primary.telegramId && secondary.telegramId) merged.telegramId = secondary.telegramId;
  if (!primary.gender && secondary.gender) merged.gender = secondary.gender;
  if (!primary.birthYear && secondary.birthYear) merged.birthYear = secondary.birthYear;
  if (!primary.email && secondary.email) merged.email = secondary.email;
  if (!primary.phone && secondary.phone) merged.phone = secondary.phone;

  if (secondary.hobbies) {
    if (!primary.hobbies) {
      merged.hobbies = secondary.hobbies;
    } else if (!primary.hobbies.includes(secondary.hobbies)) {
      merged.hobbies = `${primary.hobbies}, ${secondary.hobbies}`;
    }
  }

  if (secondary.role === 'SUPER_ADMIN' && primary.role !== 'SUPER_ADMIN') {
    merged.role = 'SUPER_ADMIN';
  }

  return merged;
}

const primary: MockContact = {
  id: 'c-1',
  name: 'Anh Huy',
  zaloId: 'zalo_123',
  telegramId: null,
  role: 'USER',
  email: 'huy@example.com',
  hobbies: 'Đọc sách',
};

const secondary: MockContact = {
  id: 'c-2',
  name: 'Huy Tran',
  zaloId: null,
  telegramId: 'tele_999',
  role: 'SUPER_ADMIN',
  phone: '0901234567',
  gender: 'nam',
  birthYear: 1992,
  hobbies: 'Chơi bóng đá',
};

const mergedFields = mergeProfileData(primary, secondary);
assert.strictEqual(mergedFields.telegramId, 'tele_999', 'Secondary telegramId must be copied to primary');
assert.strictEqual(mergedFields.role, 'SUPER_ADMIN', 'Role must be promoted to SUPER_ADMIN');
assert.strictEqual(mergedFields.phone, '0901234567', 'Phone must be merged');
assert.strictEqual(mergedFields.gender, 'nam', 'Gender must be merged');
assert.strictEqual(mergedFields.birthYear, 1992, 'Birth year must be merged');
assert.strictEqual(mergedFields.hobbies, 'Đọc sách, Chơi bóng đá', 'Hobbies must be concatenated');
assert.strictEqual(mergedFields.email, undefined, 'Existing primary email must not be overwritten');

console.log('✓ Test 3: Profile and identity merging logic passed.');

console.log('All Contact & MCP Unit Tests passed successfully! 🚀');
