import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabasePublicEnvironment, getSupabaseServiceRoleKey } from "./env";

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieOptions = Parameters<CookieStore["set"]>[2];
type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicEnvironment();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: CookieToSet[]) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; middleware or a Route Handler must refresh sessions.
        }
      },
    },
  });
}

/** Service-role client — bypasses RLS. Only use in server-only data repositories. */
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicEnvironment();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
