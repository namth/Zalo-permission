import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM

/**
 * Lấy encryption key từ biến môi trường.
 * Bắt buộc 32 bytes (64 ký tự hex hoặc 32 ký tự ascii).
 */
function getMasterKey(): Buffer {
  const masterKey =
    process.env.ENCRYPTION_MASTER_KEY ||
    process.env.JWT_SECRET ||
    process.env.DATABASE_URL ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  if (masterKey.length === 64) {
    return Buffer.from(masterKey, 'hex');
  }

  if (masterKey.length === 32) {
    return Buffer.from(masterKey, 'utf8');
  }

  // Fallback hash to 32 bytes if not exactly 32 bytes
  return crypto.createHash('sha256').update(masterKey).digest();
}

/**
 * Mã hóa chuỗi văn bản hoặc JSON sang chuỗi mã hóa định dạng hex: iv:auth_tag:ciphertext
 */
export function encryptData(plainText: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Giải mã chuỗi đã mã hóa từ định dạng iv:auth_tag:ciphertext
 */
export function decryptData(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected iv:auth_tag:ciphertext');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Tiện ích mã hóa đối tượng JSON (dành cho credentials & env overrides)
 */
export function encryptJson<T = unknown>(obj: T): string {
  return encryptData(JSON.stringify(obj));
}

/**
 * Tiện ích giải mã chuỗi thành đối tượng JSON
 */
export function decryptJson<T = unknown>(encryptedPayload: string): T {
  const decrypted = decryptData(encryptedPayload);
  return JSON.parse(decrypted) as T;
}
