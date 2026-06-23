import { describe, it, expect } from 'vitest';
import { toBase64, fromBase64, encode, decode, generateIV, generateSalt } from './utils.js';

describe('toBase64 / fromBase64', () => {
  it('round-trip encodes and decodes arbitrary bytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    expect(fromBase64(toBase64(original))).toEqual(original);
  });

  it('encodes a known value correctly', () => {
    // [72, 101, 108, 108, 111] = "Hello"
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    expect(toBase64(bytes)).toBe('SGVsbG8=');
  });

  it('decodes a known base64 value correctly', () => {
    const result = fromBase64('SGVsbG8=');
    expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });

  it('handles empty array', () => {
    const empty = new Uint8Array(0);
    expect(fromBase64(toBase64(empty))).toEqual(empty);
  });
});

describe('encode / decode', () => {
  it('round-trip encodes and decodes a UTF-8 string', () => {
    const str = 'IronKey test string 🔒';
    expect(decode(encode(str))).toBe(str);
  });

  it('encodes ASCII string to the correct byte values', () => {
    const result = encode('ABC');
    expect(Array.from(result)).toEqual([65, 66, 67]);
  });

  it('handles empty string', () => {
    expect(Array.from(encode(''))).toEqual([]);
    expect(decode(new Uint8Array(0))).toBe('');
  });
});

describe('generateIV', () => {
  it('returns exactly 12 bytes', () => {
    const iv = generateIV();
    expect(iv).toBeInstanceOf(Uint8Array);
    expect(iv.byteLength).toBe(12);
  });

  it('returns different values on each call', () => {
    const iv1 = generateIV();
    const iv2 = generateIV();
    expect(toBase64(iv1)).not.toBe(toBase64(iv2));
  });
});

describe('generateSalt', () => {
  it('returns a base64 string of the correct decoded length (default 32 bytes)', () => {
    const salt = generateSalt();
    const decoded = fromBase64(salt);
    expect(decoded.byteLength).toBe(32);
  });

  it('accepts a custom byte length', () => {
    const salt = generateSalt(16);
    expect(fromBase64(salt).byteLength).toBe(16);
  });

  it('returns different values on each call', () => {
    expect(generateSalt()).not.toBe(generateSalt());
  });
});
