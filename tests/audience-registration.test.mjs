import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const WORKSPACE_ROOT = process.cwd();

const ADMIN_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@alfaaz.test',
  email_confirmed_at: '2026-12-01T10:00:00.000Z',
};

const STAFF_A = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'staff.a@alfaaz.test',
  email_confirmed_at: '2026-12-01T10:00:00.000Z',
};

const AUDIENCE_USER = {
  id: '66666666-6666-4666-8666-666666666666',
  email: 'audience.guest@example.com',
  email_confirmed_at: '2026-12-10T10:00:00.000Z',
};

const PARTICIPANT_USER = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'performer.guest@example.com',
  email_confirmed_at: '2026-12-10T10:00:00.000Z',
};

// Minimal valid 1x1 PNG file header + bytes for proof upload tests
const SAMPLE_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

function makeFakeServiceRoleJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role: 'service_role', iss: 'supabase' })).toString('base64url');
  return `${header}.${payload}.mock-sig`;
}

function createMockSupabaseServer({ omitRegistrationTypeColumn = false } = {}) {
  const db = {
    authUsers: [ADMIN_USER, STAFF_A, AUDIENCE_USER, PARTICIPANT_USER],
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
      },
    ],
    registrations: [],
    payment_submissions: [],
    ticket_checkins: [],
    ticket_checkin_audit_logs: [],
    storageObjects: new Map(),
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

  const regProperties = {
    id: { type: 'string' },
    registration_code: { type: 'string' },
    entry_type: { type: 'string' },
    amount_inr: { type: 'integer' },
    full_name: { type: 'string' },
    email: { type: 'string' },
    mobile_number: { type: 'string' },
    college_name: { type: 'string' },
    city: { type: 'string' },
    categories: { type: 'array' },
    team_or_individual_name: { type: 'string' },
    participant_count: { type: 'integer' },
    participant_names: { type: 'string' },
    team_leader_name: { type: 'string' },
    emergency_contact_number: { type: 'string' },
    payment_status: { type: 'string' },
    utr: { type: 'string' },
    proof_storage_path: { type: 'string' },
    proof_mime_type: { type: 'string' },
    proof_file_name: { type: 'string' },
    idempotency_key: { type: 'string' },
    verified_at: { type: 'string' },
    created_at: { type: 'string' },
  };

  const subProperties = {
    id: { type: 'string' },
    registration_id: { type: 'string' },
    registration_code: { type: 'string' },
    entry_type: { type: 'string' },
    amount_inr: { type: 'integer' },
    utr: { type: 'string' },
    proof_storage_path: { type: 'string' },
    proof_mime_type: { type: 'string' },
    proof_file_name: { type: 'string' },
    proof_file_size: { type: 'integer' },
    full_name: { type: 'string' },
    team_or_individual_name: { type: 'string' },
    email: { type: 'string' },
    mobile_number: { type: 'string' },
    college_name: { type: 'string' },
    verification_status: { type: 'string' },
    admin_remarks: { type: 'string' },
    idempotency_key: { type: 'string' },
    verified_at: { type: 'string' },
    created_at: { type: 'string' },
  };

  if (!omitRegistrationTypeColumn) {
    regProperties.registration_type = { type: 'string' };
    subProperties.registration_type = { type: 'string' };
  }

  const server = http.createServer(async (req, res) => {
    const parsed = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const rawBuffer = Buffer.concat(chunks);

    const send = (status, data) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };

    if (parsed.pathname === '/auth/v1/user') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      const map = {
        'token-admin': ADMIN_USER,
        'token-staff-a': STAFF_A,
        'token-audience': AUDIENCE_USER,
        'token-participant': PARTICIPANT_USER,
      };
      const user = map[token];
      if (!user) return send(401, { message: 'Invalid JWT' });
      return send(200, {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        aud: 'authenticated',
      });
    }

    if (parsed.pathname === '/auth/v1/admin/users' && req.method === 'GET') {
      return send(200, { users: db.authUsers, total: db.authUsers.length });
    }

    // Supabase Storage upload/delete mock
    if (parsed.pathname.startsWith('/storage/v1/object/')) {
      const objectKey = parsed.pathname.slice('/storage/v1/object/'.length);
      if (req.method === 'POST' || req.method === 'PUT') {
        db.storageObjects.set(objectKey, rawBuffer);
        const relPath = objectKey.replace(/^payment-proofs\//, '');
        return send(200, { Key: objectKey, path: relPath });
      }
      if (req.method === 'DELETE') {
        db.storageObjects.delete(objectKey);
        return send(200, []);
      }
    }

    if (parsed.pathname === '/rest/v1/' && req.method === 'GET') {
      return send(200, {
        definitions: {
          registrations: { properties: regProperties },
          payment_submissions: { properties: subProperties },
        },
      });
    }

    const bodyText = rawBuffer.toString('utf8');
    const body = bodyText && req.headers['content-type']?.includes('json') ? JSON.parse(bodyText) : null;

    if (parsed.pathname === '/rest/v1/rpc/perform_atomic_ticket_checkin' && req.method === 'POST') {
      const ticketId = String(body.p_ticket_id || '').trim().toUpperCase();
      const registrationId = String(body.p_registration_id || '').trim();
      const registrationCode = String(body.p_registration_code || '').trim();
      const registrationType = body.p_registration_type === 'AUDIENCE' ? 'AUDIENCE' : 'PARTICIPANT';
      const scanMethod = body.p_scan_method === 'manual' ? 'manual' : 'qr';

      const existing = db.ticket_checkins.find(
        (r) => r.ticket_id === ticketId || r.registration_id === registrationId
      );
      if (existing) {
        return send(200, {
          outcome: 'ALREADY_CHECKED_IN',
          checked_in_at: existing.checked_in_at,
          checked_in_by_name: existing.checked_in_by_name,
          checked_in_by_email: existing.checked_in_by_email,
        });
      }

      const nowIso = new Date().toISOString();
      const checkinRow = {
        id: `chk-${db.ticket_checkins.length + 1}`,
        ticket_id: ticketId,
        registration_id: registrationId,
        registration_code: registrationCode,
        registration_type: registrationType,
        checked_in_at: nowIso,
        checked_in_by_user_id: body.p_staff_user_id,
        checked_in_by_email: body.p_staff_email || '',
        checked_in_by_name: body.p_staff_name || '',
        scan_method: scanMethod,
        created_at: nowIso,
      };
      db.ticket_checkins.push(checkinRow);
      db.ticket_checkin_audit_logs.push({
        id: `aud-${db.ticket_checkin_audit_logs.length + 1}`,
        action: 'CHECKED_IN',
        ticket_id: ticketId,
        registration_id: registrationId,
        registration_code: registrationCode,
        registration_type: registrationType,
        performed_by_user_id: body.p_staff_user_id,
        performed_by_email: body.p_staff_email || '',
        performed_by_role: 'staff',
        original_checked_in_at: nowIso,
        original_staff_user_id: body.p_staff_user_id,
        reason: scanMethod === 'manual' ? 'Manual gate check-in' : 'QR camera check-in',
        created_at: nowIso,
      });

      return send(200, {
        outcome: 'ENTRY_APPROVED',
        checked_in_at: nowIso,
        checked_in_by_name: checkinRow.checked_in_by_name,
        checked_in_by_email: checkinRow.checked_in_by_email,
      });
    }

    if (parsed.pathname === '/rest/v1/rpc/reverse_ticket_checkin_atomic' && req.method === 'POST') {
      const ticketId = String(body.p_ticket_id || '').trim().toUpperCase();
      const reason = String(body.p_reason || '').trim().slice(0, 300);
      const idx = db.ticket_checkins.findIndex((r) => r.ticket_id === ticketId);
      if (idx < 0) {
        return send(200, { reversed: false, not_found: true, ticket_id: ticketId });
      }
      const [deleted] = db.ticket_checkins.splice(idx, 1);
      db.ticket_checkin_audit_logs.push({
        id: `aud-${db.ticket_checkin_audit_logs.length + 1}`,
        action: 'REVERSED',
        ticket_id: deleted.ticket_id,
        registration_id: deleted.registration_id,
        registration_code: deleted.registration_code,
        registration_type: deleted.registration_type || 'PARTICIPANT',
        performed_by_user_id: body.p_admin_user_id,
        performed_by_email: body.p_admin_email || '',
        performed_by_role: 'admin',
        original_checked_in_at: deleted.checked_in_at,
        original_staff_user_id: deleted.checked_in_by_user_id,
        reason,
        created_at: new Date().toISOString(),
      });
      return send(200, {
        reversed: true,
        not_found: false,
        ticket_id: deleted.ticket_id,
        registration_id: deleted.registration_id,
        registration_code: deleted.registration_code,
      });
    }

    if (parsed.pathname.startsWith('/rest/v1/')) {
      const table = parsed.pathname.slice('/rest/v1/'.length);
      if (!Array.isArray(db[table])) {
        return send(404, { code: '42P01', message: `relation "public.${table}" does not exist` });
      }

      const accept = req.headers.accept || '';
      const isSingleObject = accept.includes('application/vnd.pgrst.object+json');

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
          if (
            omitRegistrationTypeColumn &&
            (table === 'registrations' || table === 'payment_submissions') &&
            Object.prototype.hasOwnProperty.call(item, 'registration_type')
          ) {
            return send(400, {
              code: 'PGRST204',
              message: `Could not find the 'registration_type' column of '${table}' in the schema cache`,
            });
          }

          const row = {
            id: item.id || `${table}-${db[table].length + 1}`,
            created_at: new Date().toISOString(),
            ...item,
          };
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
          if (matched.length === 0) return send(406, { code: 'PGRST116', message: '0 rows' });
          return send(200, matched[0]);
        }
        return send(200, matched);
      }
    }

    return send(404, { error: 'Unhandled route', pathname: parsed.pathname });
  });

  return { server, db };
}

async function callApiOverHttp(handler, { method = 'GET', url = '/', headers = {}, body = undefined } = {}) {
  const appServer = http.createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'TEST_UNHANDLED', message: err.message }));
    });
  });

  await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  const { port } = appServer.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers,
      body,
    });
    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const text = buf.toString('utf8');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      buffer: buf,
      text,
      json,
    };
  } finally {
    appServer.closeAllConnections?.();
    await new Promise((resolve) => appServer.close(resolve));
  }
}

let tempDir;
let mockServer;
let db;
let handlers;

before(async () => {
  tempDir = mkdtempSync(path.join(WORKSPACE_ROOT, '.tmp-audience-test-'));
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
      path.join(WORKSPACE_ROOT, 'api/registrations.ts'),
      path.join(WORKSPACE_ROOT, 'api/registrations/payment-proof.ts'),
      path.join(WORKSPACE_ROOT, 'api/participant/registrations.ts'),
      path.join(WORKSPACE_ROOT, 'api/participant/resubmit-proof.ts'),
      path.join(WORKSPACE_ROOT, 'api/participant/ticket.ts'),
      path.join(WORKSPACE_ROOT, 'api/tickets/verify.ts'),
      path.join(WORKSPACE_ROOT, 'api/staff/session.ts'),
      path.join(WORKSPACE_ROOT, 'api/staff/checkin.ts'),
      path.join(WORKSPACE_ROOT, 'api/admin/checkins.ts'),
    ],
    { cwd: WORKSPACE_ROOT, stdio: 'pipe' }
  );

  const mock = createMockSupabaseServer({ omitRegistrationTypeColumn: false });
  mockServer = mock.server;
  db = mock.db;

  await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
  const address = mockServer.address();
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = makeFakeServiceRoleJwt();
  process.env.TICKET_SIGNING_SECRET = 'test-signing-secret-for-audience-suite';

  const importCompiled = async (relPath) =>
    import(pathToFileURL(path.join(tempDir, relPath)).href);

  handlers = {
    registrations: (await importCompiled('api/registrations.js')).default,
    paymentProof: (await importCompiled('api/registrations/payment-proof.js')).default,
    participantRegs: (await importCompiled('api/participant/registrations.js')).default,
    participantResubmit: (await importCompiled('api/participant/resubmit-proof.js')).default,
    participantTicket: (await importCompiled('api/participant/ticket.js')).default,
    verifyPublic: (await importCompiled('api/tickets/verify.js')).default,
    staffSession: (await importCompiled('api/staff/session.js')).default,
    staffCheckin: (await importCompiled('api/staff/checkin.js')).default,
    adminCheckins: (await importCompiled('api/admin/checkins.js')).default,
  };
});

after(async () => {
  if (mockServer) {
    mockServer.closeAllConnections?.();
    await new Promise((resolve) => mockServer.close(resolve));
  }
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

let audienceRegId = '';
let audienceRegCode = '';
let participantRegId = '';
let participantRegCode = '';

test('1. Participant registrations preserve fees (₹99/₹149/₹199) and assign permanent PARTICIPANT registration_type', async () => {
  // Tampered participant fee rejected
  const badFeeRes = await callApiOverHttp(handlers.registrations, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      registrationType: 'PARTICIPANT',
      entryType: 'individual',
      expectedFeeInr: 59,
      fullName: 'Tamper Performer',
      email: PARTICIPANT_USER.email,
      mobileNumber: '9876543210',
      collegeName: 'Quad AI',
      city: 'Bengaluru',
      categories: ['Poetry'],
      teamOrIndividualName: 'Tamper Performer',
      participantCount: 1,
      participantNames: 'Tamper Performer',
      teamLeaderName: 'Tamper Performer',
      emergencyContactNumber: '9876543211',
    }),
  });
  assert.equal(badFeeRes.status, 400);
  assert.equal(badFeeRes.json.error, 'FEE_MISMATCH');

  // Valid Individual Participant (₹99)
  const indRes = await callApiOverHttp(handlers.registrations, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      registrationType: 'PARTICIPANT',
      entryType: 'individual',
      expectedFeeInr: 99,
      fullName: 'Rohan Kulkarni',
      email: PARTICIPANT_USER.email,
      mobileNumber: '9876543210',
      collegeName: 'Quad AI',
      city: 'Bengaluru',
      categories: ['Poetry', 'Singing'],
      teamOrIndividualName: 'Rohan Live',
      participantCount: 1,
      participantNames: 'Rohan Kulkarni',
      teamLeaderName: 'Rohan Kulkarni',
      emergencyContactNumber: '9876543211',
      idempotencyKey: 'part-ind-test-001',
    }),
  });
  assert.equal(indRes.status, 201);
  assert.equal(indRes.json.registrationType, 'PARTICIPANT');
  assert.equal(indRes.json.amountInr, 99);
  participantRegId = indRes.json.registrationId;
  participantRegCode = indRes.json.referenceId;

  const savedRow = db.registrations.find((r) => r.id === participantRegId);
  assert.equal(savedRow.registration_type, 'PARTICIPANT');
  assert.equal(savedRow.amount_inr, 99);

  // Couple (₹149) and Group (₹199)
  const coupleRes = await callApiOverHttp(handlers.registrations, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      registrationType: 'PARTICIPANT',
      entryType: 'couple',
      expectedFeeInr: 149,
      fullName: 'Duo Lead',
      email: 'duo@example.com',
      mobileNumber: '9876500001',
      collegeName: 'RVCE',
      city: 'Bengaluru',
      categories: ['Dance'],
      teamOrIndividualName: 'Twin Pulse',
      participantCount: 2,
      participantNames: 'Duo Lead, Partner Two',
      teamLeaderName: 'Duo Lead',
      emergencyContactNumber: '9876500002',
    }),
  });
  assert.equal(coupleRes.status, 201);
  assert.equal(coupleRes.json.amountInr, 149);

  const groupRes = await callApiOverHttp(handlers.registrations, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      registrationType: 'PARTICIPANT',
      entryType: 'group',
      expectedFeeInr: 199,
      fullName: 'Crew Captain',
      email: 'crew@example.com',
      mobileNumber: '9876500003',
      collegeName: 'PES',
      city: 'Bengaluru',
      categories: ['Dance'],
      teamOrIndividualName: ' Bengaluru Beats',
      participantCount: 4,
      participantNames: 'A, B, C, D',
      teamLeaderName: 'Crew Captain',
      emergencyContactNumber: '9876500004',
    }),
  });
  assert.equal(groupRes.status, 201);
  assert.equal(groupRes.json.amountInr, 199);
});

test('2. Audience registration validates watch-only acknowledgment, enforces fixed ₹59 fee, and persists AUDIENCE type', async () => {
  // Missing watch-only acknowledgment must fail
  const missingAckRes = await callApiOverHttp(handlers.registrations, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      registrationType: 'AUDIENCE',
      fullName: 'Meera Nair',
      email: AUDIENCE_USER.email,
      mobileNumber: '9123456789',
      collegeName: 'Christ University',
      city: 'Bengaluru',
      acknowledgedWatchOnly: false,
      expectedFeeInr: 59,
    }),
  });
  assert.equal(missingAckRes.status, 400);
  assert.equal(missingAckRes.json.error, 'VALIDATION_ERROR');

  // Tampered fee (trying to pay ₹10 or ₹99 on AUDIENCE route) must fail
  const badFeeRes = await callApiOverHttp(handlers.registrations, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      registrationType: 'AUDIENCE',
      fullName: 'Meera Nair',
      email: AUDIENCE_USER.email,
      mobileNumber: '9123456789',
      collegeName: 'Christ University',
      city: 'Bengaluru',
      acknowledgedWatchOnly: true,
      expectedFeeInr: 10,
    }),
  });
  assert.equal(badFeeRes.status, 400);
  assert.equal(badFeeRes.json.error, 'FEE_MISMATCH');

  // Valid Audience registration
  const okRes = await callApiOverHttp(handlers.registrations, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      registrationType: 'AUDIENCE',
      fullName: 'Meera Nair',
      email: AUDIENCE_USER.email,
      mobileNumber: '9123456789',
      collegeName: 'Christ University',
      city: 'Bengaluru',
      emergencyContactNumber: '9123456780',
      acknowledgedWatchOnly: true,
      expectedFeeInr: 59,
      // Attempt to spoof performer fields — server must strip/override
      categories: ['Dance', 'Singing'],
      participantCount: 5,
      idempotencyKey: 'aud-test-key-001',
    }),
  });
  assert.equal(okRes.status, 201);
  assert.equal(okRes.json.registrationType, 'AUDIENCE');
  assert.equal(okRes.json.amountInr, 59);
  assert.ok(okRes.json.registrationId);

  audienceRegId = okRes.json.registrationId;
  audienceRegCode = okRes.json.referenceId;

  const savedAud = db.registrations.find((r) => r.id === audienceRegId);
  assert.equal(savedAud.registration_type, 'AUDIENCE');
  assert.equal(savedAud.amount_inr, 59);
  assert.equal(savedAud.participant_count, 1);
  assert.deepEqual(savedAud.categories, []);
});

test('3. Shared UPI proof upload enforces ₹59 + AUDIENCE type, keeps status pending, and supports rejected resubmission', async () => {
  // Fee tampering on proof upload must fail
  const tamperedForm = new FormData();
  tamperedForm.set('registrationId', audienceRegId);
  tamperedForm.set('registrationType', 'AUDIENCE');
  tamperedForm.set('expectedFeeInr', '15');
  tamperedForm.set('utr', 'AUDUTR123456');
  tamperedForm.set('paymentProof', new Blob([SAMPLE_PNG_BUFFER], { type: 'image/png' }), 'proof.png');

  const tamperedUpload = await callApiOverHttp(handlers.paymentProof, {
    method: 'POST',
    body: tamperedForm,
  });
  assert.equal(tamperedUpload.status, 400);
  assert.equal(tamperedUpload.json.error, 'FEE_MISMATCH');

  // Spoofed registrationType on proof upload must fail
  const mismatchForm = new FormData();
  mismatchForm.set('registrationId', audienceRegId);
  mismatchForm.set('registrationType', 'PARTICIPANT');
  mismatchForm.set('expectedFeeInr', '59');
  mismatchForm.set('utr', 'AUDUTR123456');
  mismatchForm.set('paymentProof', new Blob([SAMPLE_PNG_BUFFER], { type: 'image/png' }), 'proof.png');

  const mismatchUpload = await callApiOverHttp(handlers.paymentProof, {
    method: 'POST',
    body: mismatchForm,
  });
  assert.equal(mismatchUpload.status, 400);
  assert.equal(mismatchUpload.json.error, 'REGISTRATION_TYPE_MISMATCH');

  // Valid Audience proof upload
  const validForm = new FormData();
  validForm.set('registrationId', audienceRegId);
  validForm.set('registrationType', 'AUDIENCE');
  validForm.set('expectedFeeInr', '59');
  validForm.set('utr', 'AUDUTR998877');
  validForm.set('idempotencyKey', 'aud-proof-key-001');
  validForm.set('paymentProof', new Blob([SAMPLE_PNG_BUFFER], { type: 'image/png' }), 'audience-upi.png');

  const okUpload = await callApiOverHttp(handlers.paymentProof, {
    method: 'POST',
    body: validForm,
  });
  assert.equal(okUpload.status, 201);
  assert.equal(okUpload.json.registrationType, 'AUDIENCE');
  assert.equal(okUpload.json.status, 'pending_verification');

  const subRow = db.payment_submissions.find((s) => s.registration_id === audienceRegId);
  assert.equal(subRow.registration_type, 'AUDIENCE');
  assert.equal(subRow.amount_inr, 59);
  assert.equal(subRow.verification_status, 'pending');

  // Upload Participant proof as well so both passes exist in shared flow
  const partForm = new FormData();
  partForm.set('registrationId', participantRegId);
  partForm.set('registrationType', 'PARTICIPANT');
  partForm.set('entryType', 'individual');
  partForm.set('expectedFeeInr', '99');
  partForm.set('utr', 'PARTUTR998877');
  partForm.set('paymentProof', new Blob([SAMPLE_PNG_BUFFER], { type: 'image/png' }), 'part-upi.png');

  const partUpload = await callApiOverHttp(handlers.paymentProof, {
    method: 'POST',
    body: partForm,
  });
  assert.equal(partUpload.status, 201);
  assert.equal(partUpload.json.registrationType, 'PARTICIPANT');

  // Simulate admin rejection of Audience submission, then verify participant resubmission works with ₹59
  subRow.verification_status = 'rejected';
  subRow.admin_remarks = 'Screenshot blurred';
  const audReg = db.registrations.find((r) => r.id === audienceRegId);
  audReg.payment_status = 'rejected';

  const resubmitForm = new FormData();
  resubmitForm.set('registrationId', audienceRegId);
  resubmitForm.set('utr', 'AUDUTR998878');
  resubmitForm.set('paymentProof', new Blob([SAMPLE_PNG_BUFFER], { type: 'image/png' }), 'audience-clear.png');

  const resubmitRes = await callApiOverHttp(handlers.participantResubmit, {
    method: 'POST',
    headers: { authorization: 'Bearer token-audience' },
    body: resubmitForm,
  });
  assert.equal(resubmitRes.status, 201);
  assert.equal(resubmitRes.json.status, 'pending_verification');

  const latestAudSub = db.payment_submissions.filter((s) => s.registration_id === audienceRegId).at(-1);
  assert.equal(latestAudSub.registration_type, 'AUDIENCE');
  assert.equal(latestAudSub.amount_inr, 59);
});

test('4. Pending Audience pass blocks ticket PDF & QR entry until Admin verifies, then issues distinct AUDIENCE PASS PDF', async () => {
  // Pending ticket PDF download must return 403
  const pendingPdfRes = await callApiOverHttp(handlers.participantTicket, {
    method: 'GET',
    url: `/api/participant/ticket?registrationId=${encodeURIComponent(audienceRegId)}`,
    headers: { authorization: 'Bearer token-audience' },
  });
  assert.equal(pendingPdfRes.status, 403);
  assert.equal(pendingPdfRes.json.error, 'PAYMENT_NOT_VERIFIED');

  // Admin verifies both Audience and Participant registrations
  const audReg = db.registrations.find((r) => r.id === audienceRegId);
  audReg.payment_status = 'verified';
  audReg.verified_at = '2026-12-12T10:00:00.000Z';
  const latestAudSub = db.payment_submissions.filter((s) => s.registration_id === audienceRegId).at(-1);
  latestAudSub.verification_status = 'verified';
  latestAudSub.verified_at = audReg.verified_at;

  const partReg = db.registrations.find((r) => r.id === participantRegId);
  partReg.payment_status = 'verified';
  partReg.verified_at = '2026-12-12T10:05:00.000Z';
  const latestPartSub = db.payment_submissions.filter((s) => s.registration_id === participantRegId).at(-1);
  latestPartSub.verification_status = 'verified';
  latestPartSub.verified_at = partReg.verified_at;

  // Audience Portal listing shows AUDIENCE PASS with Watch Only metadata
  const portalRes = await callApiOverHttp(handlers.participantRegs, {
    method: 'GET',
    headers: { authorization: 'Bearer token-audience' },
  });
  assert.equal(portalRes.status, 200);
  assert.equal(portalRes.json.registrations.length, 1);
  const portalItem = portalRes.json.registrations[0];
  assert.equal(portalItem.registrationType, 'AUDIENCE');
  assert.equal(portalItem.passCategoryLabel, 'AUDIENCE PASS');
  assert.equal(portalItem.amountPayableInr, 59);
  assert.equal(portalItem.participantCount, 1);
  assert.ok(portalItem.ticket?.qrVerificationUrl);

  // Audience Ticket PDF downloads successfully as valid PDF bytes
  const pdfRes = await callApiOverHttp(handlers.participantTicket, {
    method: 'GET',
    url: `/api/participant/ticket?registrationId=${encodeURIComponent(audienceRegId)}`,
    headers: { authorization: 'Bearer token-audience' },
  });
  assert.equal(pdfRes.status, 200);
  assert.equal(pdfRes.headers['content-type'], 'application/pdf');
  assert.equal(pdfRes.buffer.subarray(0, 5).toString('utf8'), '%PDF-');

  // Public QR verification identifies Audience Pass cleanly
  const qrUrl = new URL(portalItem.ticket.qrVerificationUrl);
  const verifyRes = await callApiOverHttp(handlers.verifyPublic, {
    method: 'GET',
    url: `/api/tickets/verify${qrUrl.search}`,
  });
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.json.valid, true);
  assert.equal(verifyRes.json.registrationType, 'AUDIENCE');
  assert.equal(verifyRes.json.passCategoryLabel, 'AUDIENCE PASS');
  assert.equal(verifyRes.json.participantCount, 1);
  assert.match(verifyRes.json.message, /Audience Pass/i);
});

test('5. Shared Staff QR Check-In distinguishes AUDIENCE PASS vs PARTICIPANT PASS, enforces atomic duplicate lock & split stats', async () => {
  // Fetch Audience QR URL from participant portal
  const audPortalRes = await callApiOverHttp(handlers.participantRegs, {
    method: 'GET',
    headers: { authorization: 'Bearer token-audience' },
  });
  const audTicket = audPortalRes.json.registrations[0].ticket;

  // Fetch Participant QR URL from participant portal
  const partPortalRes = await callApiOverHttp(handlers.participantRegs, {
    method: 'GET',
    headers: { authorization: 'Bearer token-participant' },
  });
  const partTicket = partPortalRes.json.registrations[0].ticket;

  // Staff scans Audience Pass QR
  const audScan = await callApiOverHttp(handlers.staffCheckin, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer token-staff-a',
    },
    body: JSON.stringify({ qrPayload: audTicket.qrVerificationUrl, scanMethod: 'qr' }),
  });
  assert.equal(audScan.status, 200);
  assert.equal(audScan.json.approved, true);
  assert.equal(audScan.json.outcome, 'ENTRY_APPROVED');
  assert.equal(audScan.json.headline, 'AUDIENCE PASS — ENTRY APPROVED');
  assert.equal(audScan.json.ticket.registrationType, 'AUDIENCE');
  assert.equal(audScan.json.ticket.passCategoryLabel, 'AUDIENCE PASS');

  // Duplicate scan of same Audience Pass via manual code must be blocked
  const audDup = await callApiOverHttp(handlers.staffCheckin, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer token-staff-a',
    },
    body: JSON.stringify({ manualCode: audienceRegCode, scanMethod: 'manual' }),
  });
  assert.equal(audDup.status, 200);
  assert.equal(audDup.json.approved, false);
  assert.equal(audDup.json.outcome, 'ALREADY_CHECKED_IN');

  // Staff scans Participant Pass QR
  const partScan = await callApiOverHttp(handlers.staffCheckin, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer token-staff-a',
    },
    body: JSON.stringify({ qrPayload: partTicket.qrVerificationUrl, scanMethod: 'qr' }),
  });
  assert.equal(partScan.status, 200);
  assert.equal(partScan.json.approved, true);
  assert.equal(partScan.json.headline, 'PARTICIPANT PASS — ENTRY APPROVED');
  assert.equal(partScan.json.ticket.registrationType, 'PARTICIPANT');

  // Staff gate summary returns split Participant vs Audience counts
  const staffSummary = await callApiOverHttp(handlers.staffSession, {
    method: 'GET',
    headers: { authorization: 'Bearer token-staff-a' },
  });
  assert.equal(staffSummary.status, 200);
  assert.equal(staffSummary.json.stats.participantCheckedInCount, 1);
  assert.equal(staffSummary.json.stats.audienceCheckedInCount, 1);
  assert.equal(staffSummary.json.stats.checkedInCount, 2);

  // Admin reverses Audience check-in and preserves AUDIENCE registration_type in audit log
  const reverseRes = await callApiOverHttp(handlers.adminCheckins, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer token-admin',
    },
    body: JSON.stringify({
      action: 'reverse',
      ticketId: audTicket.ticketId,
      reason: 'Gate test reversal',
    }),
  });
  assert.equal(reverseRes.status, 200);
  assert.equal(reverseRes.json.reversed, true);

  const adminReport = await callApiOverHttp(handlers.adminCheckins, {
    method: 'GET',
    headers: { authorization: 'Bearer token-admin' },
  });
  assert.equal(adminReport.status, 200);
  assert.equal(adminReport.json.stats.audienceCheckedInCount, 0);
  assert.equal(adminReport.json.stats.participantCheckedInCount, 1);
  const reversalLog = adminReport.json.auditLogs.find(
    (log) => log.ticketId === audTicket.ticketId && log.action === 'REVERSED'
  );
  assert.ok(reversalLog);
  assert.equal(reversalLog.registrationType, 'AUDIENCE');
});

test('6. Fails closed with 503 SCHEMA_NOT_READY if audience_registration_migration.sql has not been applied', async () => {
  const { server: legacyServer } = createMockSupabaseServer({ omitRegistrationTypeColumn: true });
  await new Promise((resolve) => legacyServer.listen(0, '127.0.0.1', resolve));
  const legacyPort = legacyServer.address().port;

  try {
    const regHandlerUrl = pathToFileURL(path.join(tempDir, 'api/registrations.js')).href;
    const script = `
      import http from 'node:http';
      import handler from ${JSON.stringify(regHandlerUrl)};
      const srv = http.createServer((req, res) => handler(req, res));
      await new Promise((r) => srv.listen(0, '127.0.0.1', r));
      const { port } = srv.address();
      const resp = await fetch('http://127.0.0.1:' + port + '/api/registrations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          registrationType: 'AUDIENCE',
          fullName: 'Schema Check',
          email: 'schema@example.com',
          mobileNumber: '9876543210',
          collegeName: 'Quad AI',
          city: 'Bengaluru',
          acknowledgedWatchOnly: true,
          expectedFeeInr: 59,
        }),
      });
      const json = await resp.json();
      console.log(JSON.stringify({ status: resp.status, json }));
      srv.closeAllConnections?.();
      srv.close();
      process.exit(0);
    `;

    const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        SUPABASE_URL: `http://127.0.0.1:${legacyPort}`,
        SUPABASE_SERVICE_ROLE_KEY: makeFakeServiceRoleJwt(),
      },
      encoding: 'utf8',
      timeout: 8000,
    });

    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.status, 503);
    assert.equal(parsed.json.error, 'SCHEMA_NOT_READY');
  } finally {
    legacyServer.closeAllConnections?.();
    await new Promise((resolve) => legacyServer.close(resolve));
  }
});

test('7. Admin checkins API filters checkedInTickets, auditLogs, and ticketStatuses strictly by registrationType', async () => {
  // Invalid registrationType query param must fail closed with 400
  const invalidFilterRes = await callApiOverHttp(handlers.adminCheckins, {
    method: 'GET',
    url: '/api/admin/checkins?registrationType=VIP_HACK',
    headers: { authorization: 'Bearer token-admin' },
  });
  assert.equal(invalidFilterRes.status, 400);
  assert.equal(invalidFilterRes.json.error, 'VALIDATION_ERROR');

  // Unfiltered report includes ticketStatuses for both Participant and Audience
  const allReport = await callApiOverHttp(handlers.adminCheckins, {
    method: 'GET',
    headers: { authorization: 'Bearer token-admin' },
  });
  assert.equal(allReport.status, 200);
  assert.ok(Array.isArray(allReport.json.ticketStatuses));
  assert.ok(allReport.json.ticketStatuses.some((t) => t.registrationType === 'PARTICIPANT'));
  assert.ok(allReport.json.ticketStatuses.some((t) => t.registrationType === 'AUDIENCE'));

  // Scoped PARTICIPANT filter returns zero AUDIENCE records
  const participantReport = await callApiOverHttp(handlers.adminCheckins, {
    method: 'GET',
    url: '/api/admin/checkins?registrationType=PARTICIPANT',
    headers: { authorization: 'Bearer token-admin' },
  });
  assert.equal(participantReport.status, 200);
  assert.equal(participantReport.json.checkedInTickets.length, 1);
  assert.ok(participantReport.json.checkedInTickets.every((t) => t.registrationType === 'PARTICIPANT'));
  assert.ok(participantReport.json.auditLogs.every((l) => l.registrationType === 'PARTICIPANT'));
  assert.ok(participantReport.json.ticketStatuses.every((t) => t.registrationType === 'PARTICIPANT'));
  // Combined & split stats remain intact for dashboard summary counters
  assert.equal(participantReport.json.stats.participantCheckedInCount, 1);
  assert.equal(participantReport.json.stats.audienceCheckedInCount, 0);

  // Scoped AUDIENCE filter returns zero PARTICIPANT records
  const audienceReport = await callApiOverHttp(handlers.adminCheckins, {
    method: 'GET',
    url: '/api/admin/checkins?registrationType=AUDIENCE',
    headers: { authorization: 'Bearer token-admin' },
  });
  assert.equal(audienceReport.status, 200);
  assert.equal(audienceReport.json.checkedInTickets.length, 0);
  assert.ok(audienceReport.json.auditLogs.length >= 2);
  assert.ok(audienceReport.json.auditLogs.every((l) => l.registrationType === 'AUDIENCE'));
  assert.ok(audienceReport.json.ticketStatuses.length >= 1);
  assert.ok(audienceReport.json.ticketStatuses.every((t) => t.registrationType === 'AUDIENCE'));
  const audTicketStatus = audienceReport.json.ticketStatuses.find(
    (t) => t.registrationId === audienceRegId
  );
  assert.ok(audTicketStatus);
  assert.equal(audTicketStatus.ticketStatus, 'issued');
  assert.equal(audTicketStatus.passCategoryLabel, 'AUDIENCE PASS');
});

test('8. Admin scoped section selector strictly partitions PARTICIPANT vs AUDIENCE registrations and payments', async () => {
  const adminApiOut = mkdtempSync(path.join(WORKSPACE_ROOT, '.tmp-admin-api-test-'));
  try {
    execFileSync(
      'npx',
      [
        'esbuild',
        path.join(WORKSPACE_ROOT, 'src/types/registration.ts'),
        path.join(WORKSPACE_ROOT, 'src/services/adminSelectors.ts'),
        '--bundle',
        '--format=esm',
        '--platform=node',
        '--out-extension:.js=.mjs',
        `--outdir=${adminApiOut}`,
      ],
      { cwd: WORKSPACE_ROOT, stdio: 'pipe' }
    );

    const regTypes = await import(pathToFileURL(path.join(adminApiOut, 'types/registration.mjs')).href);
    const selectors = await import(pathToFileURL(path.join(adminApiOut, 'services/adminSelectors.mjs')).href);

    assert.equal(regTypes.AUDIENCE_PASS_FEE_INR, 59);
    assert.equal(regTypes.ENTRY_PASS_OPTIONS.individual.price, 99);
    assert.equal(regTypes.ENTRY_PASS_OPTIONS.couple.price, 149);
    assert.equal(regTypes.ENTRY_PASS_OPTIONS.group.price, 199);

    const mockPayload = {
      registrations: [
        {
          id: 'reg-p1',
          registrationCode: 'ALF-P1',
          registrationType: 'PARTICIPANT',
          entryType: 'individual',
          amountInr: 99,
          paymentStatus: 'verified',
        },
        {
          id: 'reg-p2',
          registrationCode: 'ALF-P2',
          registrationType: 'PARTICIPANT',
          entryType: 'group',
          amountInr: 199,
          paymentStatus: 'pending',
        },
        {
          id: 'reg-a1',
          registrationCode: 'ALF-A1',
          registrationType: 'AUDIENCE',
          entryType: 'individual',
          amountInr: 59,
          paymentStatus: 'verified',
        },
        {
          id: 'reg-a2',
          registrationCode: 'ALF-A2',
          registrationType: 'AUDIENCE',
          entryType: 'individual',
          amountInr: 59,
          paymentStatus: 'pending',
        },
      ],
      submissions: [
        {
          id: 'sub-p1',
          registrationId: 'reg-p1',
          registrationCode: 'ALF-P1',
          registrationType: 'PARTICIPANT',
          entryType: 'individual',
          amountInr: 99,
          status: 'verified',
        },
        {
          id: 'sub-p2',
          registrationId: 'reg-p2',
          registrationCode: 'ALF-P2',
          registrationType: 'PARTICIPANT',
          entryType: 'group',
          amountInr: 199,
          status: 'pending',
        },
        {
          id: 'sub-a1',
          registrationId: 'reg-a1',
          registrationCode: 'ALF-A1',
          registrationType: 'AUDIENCE',
          entryType: 'individual',
          amountInr: 59,
          status: 'verified',
        },
      ],
    };

    const participantSection = selectors.selectScopedSectionData(mockPayload, 'PARTICIPANT');
    assert.equal(participantSection.registrations.length, 2);
    assert.ok(participantSection.registrations.every((r) => r.registrationType === 'PARTICIPANT'));
    assert.ok(participantSection.submissions.every((s) => s.registrationType === 'PARTICIPANT'));
    assert.equal(participantSection.stats.totalCount, 2);
    assert.equal(participantSection.stats.verifiedCount, 1);
    assert.equal(participantSection.stats.pendingCount, 1);
    assert.equal(participantSection.stats.verifiedRevenueInr, 99);
    assert.equal(participantSection.stats.individualCount, 1);
    assert.equal(participantSection.stats.groupCount, 1);

    const audienceSection = selectors.selectScopedSectionData(mockPayload, 'AUDIENCE');
    assert.equal(audienceSection.registrations.length, 2);
    assert.ok(audienceSection.registrations.every((r) => r.registrationType === 'AUDIENCE'));
    assert.ok(audienceSection.submissions.every((s) => s.registrationType === 'AUDIENCE'));
    assert.equal(audienceSection.stats.totalCount, 2);
    assert.equal(audienceSection.stats.verifiedCount, 1);
    assert.equal(audienceSection.stats.pendingCount, 1);
    assert.equal(audienceSection.stats.verifiedRevenueInr, 59);
    assert.equal(audienceSection.stats.individualCount, 0);
  } finally {
    rmSync(adminApiOut, { recursive: true, force: true });
  }
});

