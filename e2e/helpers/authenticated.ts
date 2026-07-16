import type { Page, Route } from '@playwright/test';

const projectRef = 'cwwqcyfwhipfzrlmfdcq';
const authStorageKey = `sb-${projectRef}-auth-token`;

const mockUser = {
  id: 'user-e2e-123',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'sona@example.com',
  email_confirmed_at: '2026-04-17T08:00:00.000Z',
  phone: '',
  confirmed_at: '2026-04-17T08:00:00.000Z',
  last_sign_in_at: '2026-04-17T08:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Sona Maria', display_name: 'Sona Maria' },
  identities: [],
  created_at: '2026-04-17T08:00:00.000Z',
  updated_at: '2026-04-17T08:00:00.000Z',
  is_anonymous: false,
};

const mockSession = {
  access_token: 'e2e-access-token',
  refresh_token: 'e2e-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: mockUser,
};

const mockProfile = {
  user_id: mockUser.id,
  display_name: 'Sona Maria',
  avatar_url: null,
};

const mockMedicalRecords = [
  {
    id: 'record-e2e-1',
    type: 'blood_test',
    title: 'Quarterly Lab Review',
    date: '2026-04-10',
    doctor: 'Dr. Priya Sharma',
    hospital: 'Apollo Preventive Care',
    patient_name: 'Sona Maria',
    status: 'attention',
    extracted_data: {
      Hemoglobin: { value: 11.4, unit: 'g/dL', normalRange: '12-16', status: 'low' },
      'Fasting Glucose': { value: 104, unit: 'mg/dL', normalRange: '70-100', status: 'high' },
      'Total Cholesterol': { value: 228, unit: 'mg/dL', normalRange: '0-200', status: 'high' },
      Creatinine: { value: 1.0, unit: 'mg/dL', normalRange: '0.6-1.2', status: 'normal' },
    },
    file_name: 'quarterly-review.pdf',
    file_path: null,
    amount: null,
    summary: 'Mild anemia and lipid elevation noted.',
    notes: 'Follow-up in six weeks.',
    processing_status: 'processed',
    reviewed_at: '2026-04-10T09:00:00.000Z',
    user_id: mockUser.id,
    created_at: '2026-04-10T09:00:00.000Z',
    updated_at: '2026-04-10T09:00:00.000Z',
  },
];

const mockPredictions = {
  predictions: [
    {
      condition: 'Cardiovascular Risk',
      risk: 'moderate',
      probability: 74,
      factors: ['Total Cholesterol: 228.00 mg/dL', 'LDL Cholesterol: 130.00 mg/dL', 'Abnormal marker ratio is 75% across saved reports.'],
      recommendation: 'Review diet, exercise, and lipid follow-up planning with your clinician, especially if LDL or triglycerides remain elevated.',
      method: 'trained_model',
      modelVersion: 'ensemble-tabular-v2',
    },
    {
      condition: 'Diabetes Risk',
      risk: 'moderate',
      probability: 58,
      factors: ['Fasting Glucose: 104.00 mg/dL', 'Glycemic Signal: 4.0 score', 'Glucose HbA1c Interaction: 582.4 score'],
      recommendation: 'Continue glucose monitoring, prioritize balanced meals and activity, and discuss follow-up testing with your clinician.',
      method: 'trained_model',
      modelVersion: 'ensemble-tabular-v2',
    },
  ],
  source: 'backend_model',
  modelVersion: 'ensemble-tabular-v2',
};

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

export async function mockAuthenticatedSession(page: Page, roles: string[] = ['patient']) {
  await page.addInitScript(
    ({ key, session, reminderKey }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
      window.localStorage.setItem(
        reminderKey,
        JSON.stringify([
          {
            id: 'reminder-e2e-1',
            title: 'Repeat HbA1c test',
            notes: 'Book the lab visit before breakfast.',
            scheduledFor: new Date(Date.now() + 86400000).toISOString(),
            enabled: true,
            createdAt: new Date().toISOString(),
          },
        ]),
      );
    },
    {
      key: authStorageKey,
      session: mockSession,
      reminderKey: `healytics-reminders:${mockUser.id}`,
    },
  );

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());

    if (!url.hostname.includes('supabase.co')) {
      await route.continue();
      return;
    }

    if (url.pathname.endsWith('/auth/v1/user')) {
      await fulfillJson(route, { user: mockUser });
      return;
    }

    if (url.pathname.endsWith('/rest/v1/profiles') && route.request().method() === 'GET') {
      await fulfillJson(route, [mockProfile]);
      return;
    }

    if (url.pathname.endsWith('/rest/v1/profiles') && ['POST', 'PATCH'].includes(route.request().method())) {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, [{ ...mockProfile, ...body }]);
      return;
    }

    if (url.pathname.endsWith('/rest/v1/user_roles') && route.request().method() === 'GET') {
      await fulfillJson(route, roles.map((role) => ({ role })));
      return;
    }

    if (url.pathname.endsWith('/rest/v1/medical_records') && route.request().method() === 'GET') {
      await fulfillJson(route, mockMedicalRecords);
      return;
    }

    if (url.pathname.endsWith('/rest/v1/medical_records') && ['POST', 'PATCH', 'DELETE'].includes(route.request().method())) {
      await fulfillJson(route, []);
      return;
    }

    if (url.pathname.endsWith('/rest/v1/ml_training_datasets')) {
      await fulfillJson(route, []);
      return;
    }

    if (url.pathname.endsWith('/rest/v1/prediction_reviews') && route.request().method() === 'GET') {
      await fulfillJson(route, []);
      return;
    }

    if (url.pathname.endsWith('/rest/v1/prediction_reviews') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, [{ id: 'review-e2e-1', created_at: new Date().toISOString(), ...body }], 201);
      return;
    }

    if (url.pathname.endsWith('/functions/v1/predict-health-risks')) {
      await fulfillJson(route, mockPredictions);
      return;
    }

    if (url.pathname.endsWith('/auth/v1/logout')) {
      await fulfillJson(route, {});
      return;
    }

    await route.continue();
  });
}
