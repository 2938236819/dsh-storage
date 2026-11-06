import { describe, expect, it } from 'vitest';
import { tzOffsetMinutes } from './config.js';

describe('tzOffsetMinutes', () => {
  it('parses positive offsets', () => {
    expect(tzOffsetMinutes('+08:00')).toBe(480);
    expect(tzOffsetMinutes('+05:30')).toBe(330);
  });

  it('parses negative offsets', () => {
    expect(tzOffsetMinutes('-05:00')).toBe(-300);
  });

  it('parses UTC/Z as zero', () => {
    expect(tzOffsetMinutes('UTC')).toBe(0);
    expect(tzOffsetMinutes('Z')).toBe(0);
  });

  it('maps invalid or absent values to 0', () => {
    expect(tzOffsetMinutes('')).toBe(0);
    expect(tzOffsetMinutes('Asia/Shanghai')).toBe(0);
    expect(tzOffsetMinutes('+8:00')).toBe(0);
    expect(tzOffsetMinutes('+0800')).toBe(0);
  });
});
