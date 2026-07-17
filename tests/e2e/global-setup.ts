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
  const { data: users, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  const existing = users.users.find((user) => user.email === email);
  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing.id);
    if (error) throw error;
  }
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
}
