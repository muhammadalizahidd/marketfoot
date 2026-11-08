import "server-only";

function requireEnvironment(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getSupabasePublicEnvironment() {
  return {
    url: requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requireEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function getSupabaseServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  return value;
}

/** Public application origin used for auth callback URLs. Never derive this from
 * an untrusted Host header in production. */
export function getApplicationUrl(fallbackOrigin?: string | null) {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) throw new Error("APP_URL must use HTTPS in production.");
    return url.origin;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Missing required environment variable: APP_URL");
  return fallbackOrigin?.replace(/\/$/, "") ?? "http://localhost:3000";
}
