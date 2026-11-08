"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createSupabaseBrowserClient() {
  if (!url || !publishableKey) throw new Error("Missing public Supabase configuration.");
  return createBrowserClient(url, publishableKey);
}
