/**
 * Seeds a local/dev Supabase instance with realistic-but-fake patient
 * accounts and medical records, so the UI and ML pipeline can be exercised
 * end-to-end without ever touching real PHI.
 *
 * Usage:
 *   supabase start                     # local Supabase, if not already running
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<local service role key from `supabase status`> \
 *   npm run seed:dev
 *
 * Safety: refuses to run unless SUPABASE_URL looks like a local address
 * (localhost/127.0.0.1) or SEED_ALLOW_REMOTE=true is explicitly set. This
 * is meant for local development, not for writing fake data into a real
 * project.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOW_REMOTE = process.env.SEED_ALLOW_REMOTE === 'true';

const FAKE_PATIENTS = [
  { email: 'demo.patient1@healytics.local', displayName: 'Jordan Rivera', role: 'patient' as const },
  { email: 'demo.patient2@healytics.local', displayName: 'Amara Okafor', role: 'patient' as const },
  { email: 'demo.patient3@healytics.local', displayName: 'Wei Chen', role: 'patient' as const },
  { email: 'demo.clinician@healytics.local', displayName: 'Dr. Sam Patel', role: 'clinician' as const },
];

const SEED_PASSWORD = 'DevSeedPassword!23';

const RECORD_TYPES = ['blood_test', 'lipid_panel', 'metabolic_panel'] as const;

function randomBetween(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function buildFakeExtractedData() {
  const hemoglobin = randomBetween(9.5, 15.5);
  const glucose = randomBetween(75, 180);
  const cholesterol = randomBetween(150, 260);
  return {
    hemoglobin: { value: hemoglobin, unit: 'g/dL', normalRange: '12.0-16.0', status: hemoglobin < 12 ? 'low' : 'normal' },
    fasting_glucose: { value: glucose, unit: 'mg/dL', normalRange: '70-100', status: glucose > 100 ? 'high' : 'normal' },
    total_cholesterol: { value: cholesterol, unit: 'mg/dL', normalRange: '<200', status: cholesterol > 200 ? 'high' : 'normal' },
  };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. See the header comment in this file for usage.');
    process.exit(1);
  }

  const isLocal = /localhost|127\.0\.0\.1/.test(SUPABASE_URL);
  if (!isLocal && !ALLOW_REMOTE) {
    console.error(
      `Refusing to seed ${SUPABASE_URL}: it doesn't look like a local address. ` +
      'If you really want to seed a remote/hosted project (e.g. a shared staging environment), ' +
      'set SEED_ALLOW_REMOTE=true explicitly. Never run this against production.',
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Seeding ${SUPABASE_URL} with ${FAKE_PATIENTS.length} fake accounts...`);

  for (const patient of FAKE_PATIENTS) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: patient.email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: patient.displayName },
    });

    let userId = created?.user?.id;

    if (createError) {
      if (createError.message.toLowerCase().includes('already been registered') || createError.message.toLowerCase().includes('already exists')) {
        console.log(`  ${patient.email} already exists, looking it up...`);
        const { data: existing } = await supabase.auth.admin.listUsers();
        userId = existing?.users.find((u) => u.email === patient.email)?.id;
      } else {
        console.error(`  Failed to create ${patient.email}:`, createError.message);
        continue;
      }
    }

    if (!userId) {
      console.error(`  Could not resolve a user id for ${patient.email}, skipping.`);
      continue;
    }

    // The handle_new_user() trigger already assigns the 'patient' role by
    // default on signup - only need to explicitly grant additional roles.
    if (patient.role === 'clinician') {
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: 'clinician' }, { onConflict: 'user_id,role' });
      if (roleError) console.error(`  Failed to grant clinician role to ${patient.email}:`, roleError.message);
    }

    if (patient.role === 'patient') {
      const recordCount = 3 + Math.floor(Math.random() * 4);
      const records = Array.from({ length: recordCount }, (_, i) => {
        const daysAgo = i * 30 + Math.floor(Math.random() * 10);
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return {
          user_id: userId,
          type: RECORD_TYPES[i % RECORD_TYPES.length],
          title: `${RECORD_TYPES[i % RECORD_TYPES.length].replace('_', ' ')} - ${date}`,
          date,
          doctor: 'Dr. Fake Physician',
          hospital: 'Seed Data General Hospital',
          status: 'processed',
          extracted_data: buildFakeExtractedData(),
          notes: 'Seed data - not a real patient record.',
        };
      });

      const { error: insertError } = await supabase.from('medical_records').insert(records);
      if (insertError) {
        console.error(`  Failed to insert records for ${patient.email}:`, insertError.message);
      } else {
        console.log(`  Seeded ${records.length} fake records for ${patient.email}`);
      }
    } else {
      console.log(`  Granted clinician role to ${patient.email}`);
    }
  }

  console.log('\nDone. All seed accounts use the password:', SEED_PASSWORD);
  console.log('These are fake accounts for local development only - never reuse this password anywhere real.');
}

main().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});
