"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

const onboardingSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  householdName: z.string().trim().min(2).max(100),
});

function authRedirect(code: string, mode = "login"): never {
  redirect(`/login?mode=${mode}&message=${code}`);
}

async function appOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredOrigin) return new URL(configuredOrigin).origin;
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function signIn(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) authRedirect("invalid_credentials");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) authRedirect("invalid_credentials");

  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signUp(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) authRedirect("invalid_signup", "signup");

  const supabase = await createClient();
  const origin = await appOrigin();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  });
  if (error) authRedirect("signup_failed", "signup");
  if (data.session) redirect("/onboarding");
  authRedirect("confirmation_sent", "login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = z
    .string()
    .trim()
    .email()
    .max(254)
    .safeParse(formData.get("email"));
  if (!email.success) authRedirect("invalid_email", "reset");

  const supabase = await createClient();
  const origin = await appOrigin();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });
  // Intentionally identical for existing and unknown accounts.
  authRedirect("reset_sent", "login");
}

export async function updatePassword(formData: FormData) {
  const password = z
    .string()
    .min(8)
    .max(128)
    .safeParse(formData.get("password"));
  if (!password.success) redirect("/auth/update-password?error=validation");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect("/auth/update-password?error=validation");
  redirect("/?message=password_updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function onboardHousehold(formData: FormData) {
  const parsed = onboardingSchema.safeParse({
    displayName: formData.get("display_name"),
    householdName: formData.get("household_name"),
  });
  if (!parsed.success) redirect("/onboarding?error=validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("bootstrap_household", {
    p_household_name: parsed.data.householdName,
    p_display_name: parsed.data.displayName,
  });
  if (error) redirect("/onboarding?error=initialization");
  redirect("/");
}
