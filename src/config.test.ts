import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultDevice, DEFAULT_CONFIG, loadConfig, saveConfig, syncConfigProblem, tzOffsetMinutes, type SyncConfig } from './config.js';

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

describe('device config', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const tempConfig = (raw: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-storage-cfg-'));
    dirs.push(dir);
    const path = join(dir, 'dsh-storage.json');
    writeFileSync(path, raw);
    return path;
  };

  it('defaults the device to the OS hostname truncated to 100 chars', () => {
    expect(defaultDevice()).toBe(hostname().trim().slice(0, 100));
    expect(defaultDevice().length).toBeLessThanOrEqual(100);
    expect(DEFAULT_CONFIG.device).toBe(defaultDevice());
  });

  it('tolerates a config missing device: loads without error and fills the hostname', () => {
    const { config, error } = loadConfig(tempConfig(JSON.stringify({
      enabled: true,
      provider: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      user: 'u',
      password: 'p',
      database: 'db',
      timezone: '+08:00',
    })));
    expect(error).toBeUndefined();
    expect(config.device).toBe(defaultDevice());
    expect(syncConfigProblem({ ...config, device: undefined })).toBeUndefined();
  });

  it('a stored non-empty device survives the roundtrip', () => {
    const path = tempConfig(JSON.stringify({
      enabled: true,
      provider: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      user: 'u',
      password: 'p',
      database: 'db',
      timezone: '+08:00',
      device: '  MacBook-Pro  ',
    }));
    const { config, error } = loadConfig(path);
    expect(error).toBeUndefined();
    expect(config.device).toBe('MacBook-Pro');
    const other = join(path, '..', 'saved.json');
    saveConfig(config, other);
    expect(loadConfig(other).config).toEqual(config satisfies SyncConfig);
  });

  it('a non-string device value falls back to the hostname, not an error', () => {
    const { config, error } = loadConfig(tempConfig(JSON.stringify({
      enabled: false,
      provider: 'sqlite',
      host: '',
      port: 0,
      user: '',
      password: '',
      database: '/tmp/x.sqlite',
      timezone: '+08:00',
      device: 42,
    })));
    expect(error).toBeUndefined();
    expect(config.device).toBe(defaultDevice());
  });
});
