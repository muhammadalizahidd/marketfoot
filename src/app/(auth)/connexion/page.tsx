import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { AuthForm } from "@/features/auth/auth-form";

/**
 * Development only: when the local QA fixture exists (scripts/qa-seed.ts writes .figma-cache/qa-credentials.json),
 * offer a one-click fill for the labelled test gamer. Never rendered in production builds.
 */
function devTestUser() {
  if (process.env.NODE_ENV === "production") return undefined;
  const file = join(process.cwd(), ".figma-cache", "qa-credentials.json");
  if (!existsSync(file)) return undefined;
  try {
    const { email, password } = JSON.parse(readFileSync(file, "utf8")) as { email?: string; password?: string };
    return email && password ? { label: "QA_Claude", email, password } : undefined;
  } catch { return undefined; }
}

export default function SignInPage() { return <main className="auth-page"><AuthForm devUser={devTestUser()} /></main>; }
