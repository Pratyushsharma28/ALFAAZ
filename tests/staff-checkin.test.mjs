import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';

const WORKSPACE_ROOT = process.cwd();
const ADMIN_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@alfaaz.test',
};
const STAFF_A = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'staff.a@alfaaz.test',
};
const STAFF_B = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'staff.b@alfaaz.test',
};
const PARTICIPANT_USER = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'guest@example.com',
};
const NEW_STAFF_CANDIDATE = {
  id: '55555555-5555-4555-8555-555555555555',
  email: 'new.staff@alfaaz.test',
};

function makeFakeServiceRoleJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role: 'service_role', iss: 'supabase' })).toString('base64url');
  return `${header}.${payload}.mock-sig`;
}

function createStatefulMockSupabase() {
  const db = {
    authUsers: [ADMIN_USER, STAFF_A, STAFF_B, PARTICIPANT_USER, NEW_STAFF_CANDIDATE],
    admin_users: [
      {
        user_id: ADMIN_USER.id,
        email: ADMIN_USER.email,
        full_name: 'Chief Organizer',
        role: 'super_admin',
        is_active: true,
      },
    ],
    staff_users: [
      {
        id: 'stf-row-a',
        user_id: STAFF_A.id,
        email: STAFF_A.email,
        full_name: 'Gate Staff A',
        role: 'checkin_staff',
        is_active: true,
        authorized_by: ADMIN_USER.id,
        authorized_at: '2026-12-01T10:00:00.000Z',
        revoked_by: null,
        revoked_at: null,
      },
      {
        id: 'stf-row-b',
        user_id: STAFF_B.id,
        email: STAFF_B.email,
        full_name: 'Gate Staff B',
        role: 'checkin_staff',
        is_active: true,
        authorized_by: ADMIN_USER.id,
        authorized_at: '2026-12-01T10:05:00.000Z',
        revoked_by: null,
        revoked_at: null,
      },
    ],
    registrations: [
      {
        id: 'reg-verified-1',
        registration_code: 'ALF-2026-VER1',
        full_name: 'Aanya Verma',
        team_or_individual_name: 'Aanya Verma',
        email: 'aanya.secret@example.com',
        mobile_number: '9999900001',
        entry_type: 'individual',
        categories: ['Poetry'],
        participant_count: 1,
        payment_status: 'verified',
        verified_at: '2026-12-10T12:00:00.000Z',
        created_at: '2026-12-09T10:00:00.000Z',
      },
      {
        id: 'reg-verified-2',
        registration_code: 'ALF-2026-VER2',
        full_name: 'Kabir Mehta',
        team_or_individual_name: 'Duo Rhythm',
        email: 'kabir.secret@example.com',
        mobile_number: '9999900002',
        entry_type: 'couple',
        categories: ['Dance'],
        participant_count: 2,
        payment_status: 'verified',
        verified_at: '2026-12-10T13:00:00.000Z',
        created_at: '2026-12-09T11:00:00.000Z',
      },
      {
        id: 'reg-pending-1',
        registration_code: 'ALF-2026-PND1',
        full_name: 'Pending Guest',
        team_or_individual_name: 'Pending Guest',
        email: 'pending@example.com',
        mobile_number: '9999900003',
        entry_type: 'individual',
        categories: ['Singing'],
        participant_count: 1,
        payment_status: 'pending',
        created_at: '2026-12-09T12:00:00.000Z',
      },
      {
        id: 'reg-rejected-1',
        registration_code: 'ALF-2026-REJ1',
        full_name: 'Rejected Guest',
        team_or_individual_name: 'Rejected Guest',
        email: 'rejected@example.com',
        mobile_number: '9999900004',
        entry_type: 'individual',
        categories: ['Poetry'],
        payment_status: 'rejected',
        created_at: '2026-12-09T13:00:00.000Z',
      },
      {
        id: 'reg-revoked-1',
        registration_code: 'ALF-2026-REV1',
        full_name: 'Revoked Guest',
        team_or_individual_name: 'Revoked Guest',
        email: 'revoked@example.com',
        mobile_number: '9999900005',
        entry_type: 'individual',
        categories: ['Poetry'],
        payment_status: 'verified',
        is_revoked: true,
        revoked_at: '2026-12-11T09:00:00.000Z',
        created_at: '2026-12-09T14:00:00.000Z',
      },
    ],
    payment_submissions: [
      {
        id: 'sub-ver-1',
        registration_id: 'reg-verified-1',
        registration_code: 'ALF-2026-VER1',
        utr: 'SECRETUTR111222',
        proof_storage_path: 'registrations/reg-verified-1/secret-receipt.png',
        amount_inr: 150,
        verification_status: 'verified',
        verified_at: '2026-12-10T12:00:00.000Z',
        created_at: '2026-12-09T10:05:00.000Z',
      },
      {
        id: 'sub-ver-2',
        registration_id: 'reg-verified-2',
        registration_code: 'ALF-2026-VER2',
        utr: 'SECRETUTR333444',
        proof_storage_path: 'registrations/reg-verified-2/secret-receipt2.png',
        amount_inr: 250,
        verification_status: 'verified',
        verified_at: '2026-12-10T13:00:00.000Z',
        created_at: '2026-12-09T11:05:00.000Z',
      },
      {
        id: 'sub-rej-1',
        registration_id: 'reg-rejected-1',
        registration_code: 'ALF-2026-REJ1',
        utr: 'SECRETUTR555666',
        proof_storage_path: 'registrations/reg-rejected-1/bad.png',
        amount_inr: 150,
        verification_status: 'rejected',
        admin_remarks: 'UTR not found',
        created_at: '2026-12-09T13:05:00.000Z',
      },
    ],
    ticket_checkins: [],
    ticket_checkin_audit_logs: [],
  };

  function applyFilters(rows, searchParams) {
    let result = [...rows];
    for (const [key, val] of searchParams.entries()) {
      if (['select', 'order', 'limit', 'on_conflict'].includes(key)) continue;
      if (val.startsWith('eq.')) {
        const expected = val.slice(3);
        result = result.filter((r) => String(r[key] ?? '') === expected);
      } else if (val.startsWith('ilike.')) {
        const expected = val.slice(6).toLowerCase();
        result = result.filter((r) => String(r[key] ?? '').toLowerCase() === expected);
      } else if (val.startsWith('in.(') && val.endsWith(')')) {
        const items = val
          .slice(4, -1)
          .split(',')
          .map((s) => s.replace(/^"|"$/g, '').trim());
        result = result.filter((r) => items.includes(String(r[key] ?? '')));
      }
    }

    const orderParam = searchParams.get('order');
    if (orderParam) {
      const [col, dir] = orderParam.split('.');
      const desc = dir?.toLowerCase() === 'desc';
      result.sort((a, b) => {
        const vA = String(a[col] ?? '');
        const vB = String(b[col] ?? '');
        return desc ? vB.localeCompare(vA) : vA.localeCompare(vB);
      });
    }

    const limitParam = Number(searchParams.get('limit'));
    if (Number.isFinite(limitParam) && limitParam > 0) {
      result = result.slice(0, limitParam);
    }

    return result;
  }

  const server = http.createServer(async (req, res) => {
    const parsed = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const body = rawBody ? JSON.parse(rawBody) : null;

    const send = (status, data) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };

    // Supabase Auth: getUser(token)
    if (parsed.pathname === '/auth/v1/user') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const map = {
        'token-admin': ADMIN_USER,
        'token-staff-a': STAFF_A,
        'token-staff-b': STAFF_B,
        'token-participant': PARTICIPANT_USER,
        'token-new-staff': NEW_STAFF_CANDIDATE,
      };
      const user = map[token];
      if (!user) {
        return send(401, { message: 'Invalid JWT' });
      }
      return send(200, { id: user.id, email: user.email, aud: 'authenticated' });
    }

    // Supabase Auth Admin: listUsers
    if (parsed.pathname === '/auth/v1/admin/users' && req.method === 'GET') {
      return send(200, { users: db.authUsers, total: db.authUsers.length });
    }

    // Supabase PostgREST OpenAPI root schema
    if (parsed.pathname === '/rest/v1/' && req.method === 'GET') {
      return send(200, {
        definitions: {
          registrations: {
            properties: {
              id: { type: 'string' },
              registration_code: { type: 'string' },
              full_name: { type: 'string' },
              email: { type: 'string' },
              payment_status: { type: 'string' },
            },
          },
        },
      });
    }

    if (parsed.pathname.startsWith('/rest/v1/')) {
      const table = parsed.pathname.slice('/rest/v1/'.length);
      if (!Array.isArray(db[table])) {
        return send(404, { code: '42P01', message: `relation "public.${table}" does not exist` });
      }

      const accept = req.headers.accept || '';
      const isSingleObject = accept.includes('application/vnd.pgrst.object+json');
      const prefer = String(req.headers.prefer || '');

      if (req.method === 'GET') {
        const rows = applyFilters(db[table], parsed.searchParams);
        if (isSingleObject) {
          if (rows.length === 0) {
            return send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
          }
          return send(200, rows[0]);
        }
        return send(200, rows);
      }

      if (req.method === 'POST') {
        const items = Array.isArray(body) ? body : [body];
        const inserted = [];
        for (const item of items) {
          if (table === 'ticket_checkins') {
            const dup = db.ticket_checkins.find(
              (r) => r.ticket_id === item.ticket_id || r.registration_id === item.registration_id
            );
            if (dup) {
              return send(409, {
                code: '23505',
                message: 'duplicate key value violates unique constraint "ticket_checkins_ticket_id_key"',
              });
            }
          }

          if (table === 'staff_users' && prefer.includes('resolution=merge-duplicates')) {
            const idx = db.staff_users.findIndex((r) => r.user_id === item.user_id);
            if (idx >= 0) {
              db.staff_users[idx] = { ...db.staff_users[idx], ...item };
              inserted.push(db.staff_users[idx]);
              continue;
            }
          }

          const row = { id: item.id || `${table}-${db[table].length + 1}`, created_at: new Date().toISOString(), ...item };
          db[table].push(row);
          inserted.push(row);
        }
        return send(201, isSingleObject ? inserted[0] : inserted);
      }

      if (req.method === 'PATCH') {
        const matched = applyFilters(db[table], parsed.searchParams);
        for (const row of matched) {
          Object.assign(row, body);
        }
        if (isSingleObject) {
          if (matched.length === 0) {
            return send(406, { code: 'PGRST116', message: '0 rows' });
          }
          return send(200, matched[0]);
        }
        return send(200, matched);
      }

      if (req.method === 'DELETE') {
        const matched = applyFilters(db[table], parsed.searchParams);
        const matchSet = new Set(matched);
        db[table] = db[table].filter((r) => !matchSet.has(r));
        if (isSingleObject) {
          if (matched.length === 0) {
            return send(406, { code: 'PGRST116', message: '0 rows' });
          }
          return send(200, matched[0]);
        }
        return send(200, matched);
      }
    }

    send(404, { error: 'Unhandled mock route', pathname: parsed.pathname });
  });

  return { server, db };
}

function invokeHandler(handler, { method = 'GET', url = '/', headers = {}, body = undefined } = {}) {
  return new Promise((resolve) => {
    const req = new http.IncomingMessage(null);
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:3000', ...headers };
    if (body !== undefined) {
      req.body = body;
    }

    let rawResponse = '';
    const responseHeaders = {};
    const res = {
      statusCode: 200,
      setHeader(k, v) {
        responseHeaders[k.toLowerCase()] = v;
      },
      end(chunk) {
        if (chunk) rawResponse += chunk.toString();
        let json = null;
        try {
          json = rawResponse ? JSON.parse(rawResponse) : null;
        } catch {
          json = null;
        }
        resolve({ status: this.statusCode, headers: responseHeaders, json, text: rawResponse });
      },
    };

    Promise.resolve(handler(req, res)).catch((err) => {
      resolve({ status: 500, headers: responseHeaders, json: { error: err.message }, text: err.message });
    });
  });
}

let tempDir;
let mockServer;
let db;
let handlers;
let ticketService;

before(async () => {
  tempDir = mkdtempSync(path.join(WORKSPACE_ROOT, '.tmp-staff-test-'));
  execFileSync(
    'npx',
    [
      'tsc',
      '--ignoreConfig',
      '--rootDir',
      '.',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--esModuleInterop',
      '--skipLibCheck',
      '--strict',
      '--outDir',
      tempDir,
      path.join(WORKSPACE_ROOT, 'api/_lib/ticketService.ts'),
      path.join(WORKSPACE_ROOT, 'api/tickets/verify.ts'),
      path.join(WORKSPACE_ROOT, 'api/staff/session.ts'),
      path.join(WORKSPACE_ROOT, 'api/staff/checkin.ts'),
      path.join(WORKSPACE_ROOT, 'api/admin/staff.ts'),
      path.join(WORKSPACE_ROOT, 'api/admin/checkins.ts'),
    ],
    { cwd: WORKSPACE_ROOT, stdio: 'pipe' }
  );

  const mock = createStatefulMockSupabase();
  mockServer = mock.server;
  db = mock.db;

  await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
  const address = mockServer.address();
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = makeFakeServiceRoleJwt();
  process.env.TICKET_SIGNING_SECRET = 'test-signing-secret-for-staff-checkin-suite';

  const importCompiled = async (relPath) =>
    import(pathToFileURL(path.join(tempDir, relPath)).href);

  ticketService = await importCompiled('api/_lib/ticketService.js');
  handlers = {
    verifyPublic: (await importCompiled('api/tickets/verify.js')).default,
    staffSession: (await importCompiled('api/staff/session.js')).default,
    staffCheckin: (await importCompiled('api/staff/checkin.js')).default,
    adminStaff: (await importCompiled('api/admin/staff.js')).default,
    adminCheckins: (await importCompiled('api/admin/checkins.js')).default,
  };
});

after(async () => {
  if (mockServer) {
    await new Promise((resolve) => mockServer.close(resolve));
  }
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('1. Rejects unauthorized and non-staff callers on staff and admin endpoints', async () => {
  const noAuthSession = await invokeHandler(handlers.staffSession, { method: 'GET' });
  assert.equal(noAuthSession.status, 401);

  const noAuthCheckin = await invokeHandler(handlers.staffCheckin, {
    method: 'POST',
    body: { manualCode: 'ALF-2026-VER1', scanMethod: 'manual' },
  });
  assert.equal(noAuthCheckin.status, 401);

  const participantAttempt = await invokeHandler(handlers.staffCheckin, {
    method: 'POST',
    headers: { authorization: 'Bearer token-participant' },
    body: { manualCode: 'ALF-2026-VER1', scanMethod: 'manual' },
  });
  assert.equal(participantAttempt.status, 403);
  assert.equal(participantAttempt.json.error, 'ACCESS_DENIED');

  const staffCallingAdmin = await invokeHandler(handlers.adminStaff, {
    method: 'GET',
    headers: { authorization: 'Bearer token-staff-a' },
  });
  assert.equal(staffCallingAdmin.status, 403);
  assert.equal(db.ticket_checkins.length, 0);
});

test('2. Admin can authorize and revoke staff access, immediately blocking revoked staff', async () => {
  const unauthorizedBefore = await invokeHandler(handlers.staffSession, {
    method: 'GET',
    headers: { authorization: 'Bearer token-new-staff' },
  });
  assert.equal(unauthorizedBefore.status, 403);

  const grantRes = await invokeHandler(handlers.adminStaff, {
    method: 'POST',
    headers: { authorization: 'Bearer token-admin' },
    body: {
      email: NEW_STAFF_CANDIDATE.email,
      fullName: 'Gate Staff New',
    },
  });
  assert.equal(grantRes.status, 200);
  assert.equal(grantRes.json.staffUser.isActive, true);

  const authorizedSession = await invokeHandler(handlers.staffSession, {
    method: 'GET',
    headers: { authorization: 'Bearer token-new-staff' },
  });
  assert.equal(authorizedSession.status, 200);
  assert.equal(authorizedSession.json.staff.email, NEW_STAFF_CANDIDATE.email);

  const revokeRes = await invokeHandler(handlers.adminStaff, {
    method: 'PATCH',
    headers: { authorization: 'Bearer token-admin' },
    body: {
      userId: NEW_STAFF_CANDIDATE.id,
      action: 'revoke',
    },
  });
  assert.equal(revokeRes.status, 200);
  assert.equal(revokeRes.json.staffUser.isActive, false);

  const deniedAfterRevoke = await invokeHandler(handlers.staffCheckin, {
    method: 'POST',
    headers: { authorization: 'Bearer token-new-staff' },
    body: { manualCode: 'ALF-2026-VER1', scanMethod: 'manual' },
  });
  assert.equal(deniedAfterRevoke.status, 403);
  assert.equal(deniedAfterRevoke.json.error, 'ACCESS_REVOKED');
});

test('3. Denies invalid signatures, pending, rejected, and revoked tickets and keeps public verify read-only', async () => {
  const verifiedBuilt = ticketService.buildVerifiedTicketUrls({
    registrationId: 'reg-verified-1',
    requestOrigin: 'https://alfaaz-unfiltered.vercel.app',
  });

  // Public verification must never write to ticket_checkins
  const publicVerifyRes = await invokeHandler(handlers.verifyPublic, {
    method: 'GET',
    url: `/api/tickets/verify?ticketId=${encodeURIComponent(verifiedBuilt.ticketId)}&reg=reg-verified-1&sig=${encodeURIComponent(verifiedBuilt.signature)}`,
  });
  assert.equal(publicVerifyRes.status, 200);
  assert.equal(publicVerifyRes.json.valid, true);
  assert.equal(db.ticket_checkins.length, 0);
  assert.equal(publicVerifyRes.text.includes('aanya.secret@example.com'), false);
  assert.equal(publicVerifyRes.text.includes('SECRETUTR'), false);

  // Tampered signature
  const tamperedRes = await invokeHandler(handlers.staffCheckin, {
    method: 'POST',
    headers: { authorization: 'Bearer token-staff-a' },
    body: {
      qrPayload: `https://alfaaz-unfiltered.vercel.app/verify-ticket?ticketId=${verifiedBuilt.ticketId}&reg=reg-verified-1&sig=deadbeefdeadbeefdeadbeef`,
      scanMethod: 'qr',
    },
  });
  assert.equal(tamperedRes.status, 200);
  assert.equal(tamperedRes.json.outcome, 'ENTRY_DENIED');

  // Pending registration via manual fallback
  const pendingRes = await invokeHandler(handlers.staffCheckin, {
    method: 'POST',
    headers: { authorization: 'Bearer token-staff-a' },
    body: { manualCode: 'ALF-2026-PND1', scanMethod: 'manual' },
  });
  assert.equal(pendingRes.status, 200);
  assert.equal(pendingRes.json.outcome, 'ENTRY_DENIED');

  // Rejected registration
  const rejectedRes = await invokeHandler(handlers.staffCheckin, {
    method: 'POST',
    headers: { authorization: 'Bearer token-staff-a' },
    body: { manualCode: 'ALF-2026-REJ1', scanMethod: 'manual' },
  });
  assert.equal(rejectedRes.status, 200);
  assert.equal(rejectedRes.json.outcome, 'ENTRY_DENIED');

  // Revoked ticket (even with valid HMAC signature)
  const revokedBuilt = ticketService.buildVerifiedTicketUrls({
    registrationId: 'reg-revoked-1',
    requestOrigin: 'https://alfaaz-unfiltered.vercel.app',
  });
  const revokedRes = await invokeHandler(handlers.staffCheckin, {
    method: 'POST',
    headers: { authorization: 'Bearer token-staff-a' },
    body: { qrPayload: revokedBuilt.qrVerificationUrl, scanMethod: 'qr' },
  });
  assert.equal(revokedRes.status, 200);
  assert.equal(revokedRes.json.outcome, 'ENTRY_DENIED');
  assert.equal(db.ticket_checkins.length, 0);
});

test('4. Simultaneous concurrent scans allow strictly one check-in and reject the duplicate atomically', async () => {
  const built = ticketService.buildVerifiedTicketUrls({
    registrationId: 'reg-verified-1',
    requestOrigin: 'https://alfaaz-unfiltered.vercel.app',
  });

  const [scanA, scanB] = await Promise.all([
    invokeHandler(handlers.staffCheckin, {
      method: 'POST',
      headers: { authorization: 'Bearer token-staff-a' },
      body: { qrPayload: built.qrVerificationUrl, scanMethod: 'qr' },
    }),
    invokeHandler(handlers.staffCheckin, {
      method: 'POST',
      headers: { authorization: 'Bearer token-staff-b' },
      body: { qrPayload: built.qrVerificationUrl, scanMethod: 'qr' },
    }),
  ]);

  assert.equal(scanA.status, 200);
  assert.equal(scanB.status, 200);

  const outcomes = [scanA.json.outcome, scanB.json.outcome].sort();
  assert.deepEqual(outcomes, ['ALREADY_CHECKED_IN', 'ENTRY_APPROVED']);
  assert.equal(db.ticket_checkins.length, 1);

  const approvedResp = scanA.json.outcome === 'ENTRY_APPROVED' ? scanA.json : scanB.json;
  const duplicateResp = scanA.json.outcome === 'ALREADY_CHECKED_IN' ? scanA.json : scanB.json;
  assert.equal(approvedResp.headline, 'ENTRY APPROVED — CHECKED IN');
  assert.equal(duplicateResp.headline, 'ALREADY CHECKED IN');
  assert.equal(duplicateResp.checkedInAt, approvedResp.checkedInAt);

  // Zero participant PII, UTR, or storage path leakage
  const combinedText = JSON.stringify([scanA.json, scanB.json]);
  assert.equal(combinedText.includes('aanya.secret@example.com'), false);
  assert.equal(combinedText.includes('SECRETUTR'), false);
  assert.equal(combinedText.includes('secret-receipt'), false);

  // Subsequent repeated scan must also report ALREADY CHECKED IN
  const repeatRes = await invokeHandler(handlers.staffCheckin, {
    method: 'POST',
    headers: { authorization: 'Bearer token-staff-a' },
    body: { manualCode: built.ticketId, scanMethod: 'manual' },
  });
  assert.equal(repeatRes.status, 200);
  assert.equal(repeatRes.json.outcome, 'ALREADY_CHECKED_IN');
  assert.equal(repeatRes.json.checkedInAt, approvedResp.checkedInAt);
});

test('5. Admin report reflects attendance counts, reversal logs immutable audit trail, and enables re-scan', async () => {
  const builtOne = ticketService.buildVerifiedTicketUrls({
    registrationId: 'reg-verified-1',
    requestOrigin: 'https://alfaaz-unfiltered.vercel.app',
  });

  // Check in ticket 2 via manual code
  const manualRes = await invokeHandler(handlers.staffCheckin, {
    method: 'POST',
    headers: { authorization: 'Bearer token-staff-b' },
    body: { manualCode: 'ALF-2026-VER2', scanMethod: 'manual' },
  });
  assert.equal(manualRes.status, 200);
  assert.equal(manualRes.json.outcome, 'ENTRY_APPROVED');

  const reportBefore = await invokeHandler(handlers.adminCheckins, {
    method: 'GET',
    headers: { authorization: 'Bearer token-admin' },
  });
  assert.equal(reportBefore.status, 200);
  assert.equal(reportBefore.json.stats.totalValidTickets, 2);
  assert.equal(reportBefore.json.stats.checkedInCount, 2);
  assert.equal(reportBefore.json.stats.remainingCount, 0);

  // Admin reverses ticket 1
  const reverseRes = await invokeHandler(handlers.adminCheckins, {
    method: 'POST',
    headers: { authorization: 'Bearer token-admin' },
    body: {
      action: 'reverse',
      ticketId: builtOne.ticketId,
      reason: 'Accidental duplicate test scan',
    },
  });
  assert.equal(reverseRes.status, 200);
  assert.equal(reverseRes.json.reversed, true);

  const reportAfter = await invokeHandler(handlers.adminCheckins, {
    method: 'GET',
    headers: { authorization: 'Bearer token-admin' },
  });
  assert.equal(reportAfter.status, 200);
  assert.equal(reportAfter.json.stats.checkedInCount, 1);
  assert.equal(reportAfter.json.stats.remainingCount, 1);
  assert.ok(
    reportAfter.json.auditLogs.some(
      (log) =>
        log.action === 'REVERSED' &&
        log.ticketId === builtOne.ticketId &&
        log.reason === 'Accidental duplicate test scan'
    )
  );

  // Ticket 1 can now be legitimately checked in again
  const recheckinRes = await invokeHandler(handlers.staffCheckin, {
    method: 'POST',
    headers: { authorization: 'Bearer token-staff-a' },
    body: { qrPayload: builtOne.qrVerificationUrl, scanMethod: 'qr' },
  });
  assert.equal(recheckinRes.status, 200);
  assert.equal(recheckinRes.json.outcome, 'ENTRY_APPROVED');
});
