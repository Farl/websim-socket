import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import PartySocket from 'partysocket';

// A wrong route, reversed onMessage args, or missed broadcast breaks these tests.
const remoteOrigin = process.env.PARTYSERVER_TEST_ORIGIN;
const roomPrefix = `migration-test-${randomUUID()}`;
const port = remoteOrigin ? undefined : await new Promise(resolve => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
const state = remoteOrigin ? undefined : await mkdtemp(path.join(tmpdir(), 'websim-partyserver-'));
let processOutput = '';
let worker;
const sockets = [];
const origin = remoteOrigin || `http://127.0.0.1:${port}`;
function connect(room, id) {
  const ws = new WebSocket(`${origin.replace('http', 'ws')}/parties/main/${roomPrefix}-${room}?_pk=${id}&username=${id}`);
  const messages = [];
  ws.addEventListener('message', event => messages.push(JSON.parse(event.data)));
  sockets.push(ws);
  return { ws, messages, send: message => ws.send(JSON.stringify(message)) };
}
async function until(fn, detail) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const value = fn();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out: ${detail}\n${processOutput}`);
}
function receive(client, type) {
  return until(() => {
    const index = client.messages.findIndex(message => message.type === type);
    if (index >= 0) return client.messages.splice(index, 1)[0];
  }, type);
}

test.before(async () => {
  if (remoteOrigin) return;
  worker = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', 'wrangler.jsonc', '--ip', '127.0.0.1', '--port', `${port}`, '--persist-to', state], {
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  worker.stdout.on('data', data => processOutput += data);
  worker.stderr.on('data', data => processOutput += data);
  await until(() => processOutput.includes('Ready on'), 'local Worker startup');
});
test.after(async () => {
  for (const ws of sockets) ws.close();
  if (worker && worker.exitCode === null) {
    const closed = new Promise(resolve => worker.once('exit', resolve));
    worker.kill('SIGTERM');
    await closed;
  }
  if (state) await rm(state, { recursive: true, force: true });
});

test('existing main-party clients synchronize presence, state, events, reconnect and isolated rooms', async () => {
  const a = connect('compatibility', 'alice');
  assert.deepEqual((await receive(a, 'init')).roomState, {});
  const b = connect('compatibility', 'bob');
  const init = await receive(b, 'init');
  assert.equal(init.clientId, 'bob');
  assert.equal(init.peers.alice.username, 'alice');
  assert.equal((await receive(a, 'peer-joined')).clientId, 'bob');
  await receive(a, 'presence-updated');
  a.send({ type: 'update-presence', presence: { position: { x: 3, y: 4 } } });
  assert.deepEqual((await receive(b, 'presence-updated')).presence, { position: { x: 3, y: 4 } });
  a.send({ type: 'update-room-state', roomState: { music: { bpm: 120, title: 'fixture' } } });
  assert.deepEqual((await receive(b, 'room-state-updated')).roomState, { music: { bpm: 120, title: 'fixture' } });
  b.send({ type: 'update-room-state', roomState: { music: { bpm: 130, title: null } } });
  assert.deepEqual((await receive(b, 'room-state-updated')).roomState, { music: { bpm: 130 } });
  a.messages.length = 0;
  a.send({ type: 'broadcast-event', event: { type: 'dance', echo: false, move: 2 } });
  assert.deepEqual((await receive(b, 'event')).data, { type: 'dance', clientId: 'alice', username: 'alice', move: 2 });
  assert.equal(a.messages.some(message => message.type === 'event'), false);
  b.send({ type: 'request-presence-update', targetClientId: 'alice', update: { color: 'blue' } });
  assert.deepEqual(await receive(a, 'presence-update-request'), { type: 'presence-update-request', update: { color: 'blue' }, fromClientId: 'bob' });
  a.ws.send('{invalid json');
  a.send({ type: 'broadcast-event', event: { type: 'after-malformed' } });
  assert.equal((await receive(b, 'event')).data.type, 'after-malformed');
  const isolated = connect('isolated', 'other');
  assert.deepEqual((await receive(isolated, 'init')).roomState, {});
  a.ws.close();
  assert.equal((await receive(b, 'peer-left')).clientId, 'alice');
  const rejoined = connect('compatibility', 'alice');
  const restored = await receive(rejoined, 'init');
  assert.deepEqual(restored.roomState, { music: { bpm: 130 } });
  assert.deepEqual(restored.presence.alice, {});
});

test('unrecognized paths and data import/export endpoints stay unavailable', { skip: process.env.PARTYSERVER_TEST_ASSETS === 'true' }, async () => {
  assert.equal((await fetch(`${origin}/not-a-route`)).status, 404);
  for (const suffix of ['', '/import', '/export']) {
    assert.equal((await fetch(`${origin}/parties/main/compatibility${suffix}`)).status, 404);
  }
});

// Exercise PartySocket itself, including its default main-party routing and IDs.
test('the existing PartySocket client connects without a custom party option', async () => {
  const ws = new PartySocket({ host: new URL(origin).host, protocol: new URL(origin).protocol === 'https:' ? 'wss' : 'ws', room: `${roomPrefix}-library-client`, id: 'party-client', query: { username: 'Existing client' } });
  const messages = [];
  ws.addEventListener('message', event => messages.push(JSON.parse(event.data)));
  sockets.push(ws);
  const client = { ws, messages };
  const init = await receive(client, 'init');
  assert.equal(init.clientId, 'party-client');
  assert.equal(init.peers['party-client'].username, 'Existing client');
  ws.send(JSON.stringify({ type: 'update-presence', presence: { dancing: true } }));
  assert.deepEqual((await receive(client, 'presence-updated')).presence, { dancing: true });
});
