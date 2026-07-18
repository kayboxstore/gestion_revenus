import { createClient } from "@supabase/supabase-js";

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return;

  const email = process.env.TEST_OWNER_EMAIL ?? "e2e-owner@example.test";
  const password = process.env.TEST_OWNER_PASSWORD ?? "Test-password-1";
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let healthError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${url}/auth/v1/health`);
      if (response.ok) {
        healthError = undefined;
        break;
      }
      healthError = new Error(`Auth health returned ${response.status}`);
    } catch (error) {
      healthError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (healthError) throw healthError;

  let createError: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!error || /already.+registered|already.+exists/i.test(error.message))
      return;
    createError = error;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw createError ?? new Error("Unable to create the E2E user");
}
