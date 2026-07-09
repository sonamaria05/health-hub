import { describe, it, expect } from 'vitest';
import { encryptPhi, decryptPhi } from '../../supabase/functions/_shared/crypto';

// A throwaway 32-byte (AES-256) key, base64-encoded - equivalent in shape
// to what would be generated for a real PHI_ENCRYPTION_KEY secret.
const TEST_KEY = Buffer.from('0'.repeat(32)).toString('base64');

describe('PHI encryption (AES-256-GCM)', () => {
  it('round-trips plaintext through encrypt then decrypt', async () => {
    const plaintext = 'Patient reports mild fatigue and elevated glucose.';
    const ciphertext = await encryptPhi(plaintext, TEST_KEY);
    expect(ciphertext).not.toContain(plaintext);
    const decrypted = await decryptPhi(ciphertext, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('round-trips JSON-serialized extracted_data', async () => {
    const extractedData = JSON.stringify({ glucose: { value: 140, unit: 'mg/dL', status: 'high' } });
    const ciphertext = await encryptPhi(extractedData, TEST_KEY);
    const decrypted = await decryptPhi(ciphertext, TEST_KEY);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(extractedData));
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', async () => {
    const plaintext = 'same input';
    const a = await encryptPhi(plaintext, TEST_KEY);
    const b = await encryptPhi(plaintext, TEST_KEY);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong key', async () => {
    const wrongKey = Buffer.from('1'.repeat(32)).toString('base64');
    const ciphertext = await encryptPhi('secret notes', TEST_KEY);
    await expect(decryptPhi(ciphertext, wrongKey)).rejects.toThrow();
  });

  it('fails to decrypt tampered ciphertext (GCM auth tag catches it)', async () => {
    const ciphertext = await encryptPhi('secret notes', TEST_KEY);
    const bytes = Buffer.from(ciphertext, 'base64');
    bytes[bytes.length - 1] ^= 0xff; // flip a bit near the end (inside the auth tag)
    const tampered = bytes.toString('base64');
    await expect(decryptPhi(tampered, TEST_KEY)).rejects.toThrow();
  });

  it('rejects a key that is not exactly 32 bytes', async () => {
    const shortKey = Buffer.from('too-short').toString('base64');
    await expect(encryptPhi('x', shortKey)).rejects.toThrow(/32 bytes/);
  });
});
