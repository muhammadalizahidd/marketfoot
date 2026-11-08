import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabasePublicEnvironment } from "@/lib/supabase/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getSafeDestination(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/mon-equipe";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/connexion?erreur=oauth", requestUrl.origin),
    );
  }

  // The auth-code exchange updates the Supabase session. The updated cookies
  // must be applied to this redirect response, otherwise the browser reaches
  // Mon équipe without a session after a successful Google sign-in.
  const response = NextResponse.redirect(
    new URL(getSafeDestination(requestUrl.searchParams.get("next")), requestUrl.origin),
  );
  const { url, publishableKey } = getSupabasePublicEnvironment();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>,
      ) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/connexion?erreur=oauth", requestUrl.origin),
    );
  }

  // A profile can be missing when an Auth user survives a manual database
  // cleanup. Re-create only the missing profile; never overwrite an existing
  // username or role.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const fallbackUsername = `gamer-${user.id.slice(0, 8)}`;
    const requestedUsername = typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username.trim()
      : "";
    await createSupabaseAdminClient().from("profiles").upsert(
      { id: user.id, username: requestedUsername || fallbackUsername },
      { onConflict: "id", ignoreDuplicates: true },
    );
  }

  return response;
}
