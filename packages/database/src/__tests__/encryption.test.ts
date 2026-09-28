import assert from 'node:assert';
import { encryptData, decryptData, encryptJson, decryptJson } from '../encryption.ts';

// Setup test key (32 bytes hex)
process.env.ENCRYPTION_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

console.log('Running Encryption Unit Tests...');

// Test 1: String encryption and decryption
const secretText = 'Zalo-Session-Cookie-123456789-Secret';
const encryptedString = encryptData(secretText);
console.log('Encrypted text:', encryptedString);
assert.notStrictEqual(encryptedString, secretText);

const decryptedString = decryptData(encryptedString);
assert.strictEqual(decryptedString, secretText, 'Decrypted text must match original');
console.log('✓ Test 1: Plaintext encryption/decryption passed.');

// Test 2: JSON Object encryption and decryption (for Scoped Variables)
const credentials = {
  API_KEY: 'kv_prod_99882233',
  BRANCH_ID: 'STORE_HN_01',
  IS_SANDBOX: false,
};

const encryptedJson = encryptJson(credentials);
const decryptedJson = decryptJson<typeof credentials>(encryptedJson);
assert.deepStrictEqual(decryptedJson, credentials, 'Decrypted JSON must match original object');
console.log('✓ Test 2: JSON Scoped Variables encryption/decryption passed.');

console.log('All encryption tests passed successfully!');
