import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import api, { ApiRequestError } from '../lib/api.ts';
import { encodePath, decodePath, validateName, isWithinPath } from '../lib/paths.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; api.setToken(null); });

function reply(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

test('filesystem paths round-trip without losing Unicode or URL punctuation', () => {
  const path = '/پوشه #100%+?/literal%20.json';
  assert.equal(decodePath(encodePath(path)), path);
  assert.equal(decodePath('/literal%'), '/literal%');
  assert.equal(encodePath('note.txt'), '/note.txt');
});

test('invalid names and self-moves are caught without rejecting sibling names', () => {
  for (const name of ['', ' ', '.', '..', 'a/b', 'a\\b', 'nul\0']) assert.ok(validateName(name));
  assert.equal(validateName('سلام #100%+.txt'), null);
  assert.equal(isWithinPath('/one', '/one/child'), true);
  assert.equal(isWithinPath('/one', '/one-more'), false);
});

test('resource operations escape paths once and send the server overwrite option', async () => {
  let requested = '';
  let headers: Headers | undefined;
  globalThis.fetch = async (input, options) => {
    requested = String(input); headers = new Headers(options?.headers);
    return new Response(null, { status: 204 });
  };
  api.setToken('test-session');
  await api.resourceAction('/file #%.txt', 'move', '/dest/a+%.txt', true);
  const url = new URL(requested, 'http://localhost');
  assert.equal(url.pathname, '/api/resources/file%20%23%25.txt');
  assert.equal(url.searchParams.get('destination'), '/dest/a+%.txt');
  assert.equal(url.searchParams.get('override'), 'true');
  assert.equal(headers?.get('X-Auth'), 'test-session');
});

test('JSON editor receives source text rather than a parsed object', async () => {
  const content = '{"answer":42}';
  globalThis.fetch = async () => reply({ type: 'text', content });
  assert.equal(await api.getFileContent('/data.json'), content);
  globalThis.fetch = async () => reply({ type: 'text' });
  assert.equal(await api.getFileContent('/empty.txt'), '');
});

test('binary content is refused by the text editor', async () => {
  globalThis.fetch = async () => reply({ type: 'blob' });
  await assert.rejects(() => api.getFileContent('/file.bin'), /binary or too large/);
});

test('API errors remain Error objects and retain the plain-text server reason', async () => {
  globalThis.fetch = async () => new Response('400 Bad Request (current password is incorrect)', { status: 400 });
  await assert.rejects(() => api.updateUser(1, { password: 'bad' }), (error: unknown) => {
    assert.ok(error instanceof ApiRequestError);
    assert.equal(error.status, 400);
    assert.match(error.message, /current password is incorrect/);
    return true;
  });
});

test('duplicate upload provides a useful message and keeps the original safe', async () => {
  globalThis.fetch = async () => new Response('409 Conflict', { status: 409 });
  await assert.rejects(() => api.uploadFile('/file.txt', new File(['test'], 'file.txt')), /already exists/);
});

test('search paths stay scoped and downloads support reserved characters', async () => {
  globalThis.fetch = async () => new Response('{"path":"sub/سلام #%.txt","dir":false,"size":42,"modified":"2026-10-24T00:00:00Z"}\n\n');
  const result = await api.search('/folder', 'سلام');
  assert.equal(result.items[0].path, '/folder/sub/سلام #%.txt');
  assert.equal(result.items[0].size, 42);
  assert.equal(result.items[0].modified, '2026-10-24T00:00:00Z');
  assert.match(api.getDownloadUrl('/folder/#%.txt'), /%23%25.txt/);
  assert.match(api.getPublicDownloadUrl('hash', '/#%.txt'), /hash\/%23%25.txt/);
});

test('checksums unwrap the resource response', async () => {
  globalThis.fetch = async () => reply({ checksums: { sha256: 'abc' } });
  assert.deepEqual(await api.getChecksums('/file', 'sha256'), { sha256: 'abc' });
});

test('HTML fallback is reported as an API error instead of crashing the UI', async () => {
  globalThis.fetch = async () => new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html' } });
  await assert.rejects(() => api.getPublicSettings(), /unexpected response/);
});

test('plain-text authentication tokens remain supported', async () => {
  globalThis.fetch = async () => new Response('test.token.value', { headers: { 'Content-Type': 'text/plain' } });
  assert.deepEqual(await api.login({ username: 'test', password: 'test' }), { token: 'test.token.value' });
  assert.deepEqual(await api.renewToken(), { token: 'test.token.value' });
  globalThis.fetch = async () => reply({ token: 'json.token.value' });
  assert.deepEqual(await api.login({ username: 'test', password: 'test' }), { token: 'json.token.value' });
});
