// Browser + database harness for the admin end-to-end checks (hosted TEST project, dev server on :3100).
// Never prints credentials. Usage: see scripts/qa-admin-e2e.mjs
import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const envFile = readFileSync(".env.local", "utf8").split(/\r?\n/);
export const env = (name) => envFile.find((l) => l.startsWith(`${name}=`))?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
export const service = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const BASE = "http://localhost:3100";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Direct SQL through the IPv4 pooler (the db.* host does not resolve here). */
export async function sql(text, params = []) {
  const u = new URL(env("DATABASE_URL"));
  let last;
  for (let attempt = 0; attempt < 8; attempt++) {
    const c = new pg.Client({ host: "aws-0-ap-southeast-1.pooler.supabase.com", port: 5432, user: `postgres.${u.hostname.replace(/^db./, "").split(".")[0]}`, password: decodeURIComponent(u.password), database: "postgres", ssl: { rejectUnauthorized: false } });
    c.on("error", () => undefined);
    try { await c.connect(); const rows = (await c.query(text, params)).rows; await c.end().catch(() => undefined); return rows; }
    catch (error) { last = error; await c.end().catch(() => undefined); const code = error?.code ?? error?.errors?.[0]?.code ?? ""; const transient = /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|EPIPE/.test(code) || /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|terminated|Connection/i.test(String(error?.message ?? "")) || !String(error?.message ?? "").trim() || error?.name === "AggregateError";
      if (!transient) throw error; await sleep(1500 * (attempt + 1)); }
  }
  throw last;
}

export const results = [];
export function check(label, ok, detail = "") { results.push({ label, ok: Boolean(ok), detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : `  -> ${detail}`}`); return Boolean(ok); }

/** A signed-in headless Chrome driven over CDP. */
export async function openSession(credsPath) {
  const creds = JSON.parse(readFileSync(credsPath, "utf8"));
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = createClient(url, env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword(creds);
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  const ref = new URL(url).hostname.split(".")[0];
  const value = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  const name = `sb-${ref}-auth-token`;
  const cookies = [];
  for (let i = 0, n = 0; i < value.length; i += 3180, n++) cookies.push({ name: value.length > 3180 ? `${name}.${n}` : name, value: value.slice(i, i + 3180), url: BASE, path: "/" });

  const port = 9700 + Math.floor(Math.random() * 200);
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "e2e-chrome-"))}`, "about:blank"], { stdio: "ignore" });
  let tabs;
  for (let i = 0; i < 40; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find((t) => t.type === "page")) break; } catch { /* retry */ } await sleep(250); }
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } if (msg.method === "Runtime.exceptionThrown") logs.push(msg.params.exceptionDetails.exception?.description ?? "exception"); };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; const timer = setTimeout(() => { pending.delete(i); reject(new Error(`browser call timed out: ${method}`)); }, 60000); pending.set(i, (message) => { clearTimeout(timer); resolve(message); }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Network.enable"); await send("Network.setCookies", { cookies });
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.enable"); await send("Runtime.enable");

  const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(`eval: ${r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text}`); return r.result?.result?.value; };
  const waitFor = async (expr, ms = 20000, label = expr) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await ev(expr)) return true; } catch { /* page navigating */ } await sleep(250); } throw new Error(`timeout waiting for: ${label}`); };
  const api = {
    logs,
    ev, waitFor,
    async goto(path, ready = "document.readyState==='complete' && !!document.querySelector('main, .ad-main')") { await send("Page.navigate", { url: BASE + path }); await sleep(400); const target = path.split('?')[0]; await waitFor(`location.pathname === ${JSON.stringify(target)} && (${ready})`, 90000, `load ${path}`); await sleep(300); },
    path: () => ev("location.pathname + location.search"),
    text: () => ev("document.body.innerText"),
    has: (needle) => ev(`document.body.innerText.includes(${JSON.stringify(needle)})`),
    notes: () => ev(`[...document.querySelectorAll('.ad-note, [role=alert]')].map((n) => n.innerText).join(' | ')`),
    async waitText(needle, ms = 20000) { try { await waitFor(`document.body.innerText.includes(${JSON.stringify(needle)})`, ms, `text "${needle}"`); } catch (error) { throw new Error(`${error.message} (page notes: ${await ev(`[...document.querySelectorAll('.ad-note, [role=alert]')].map((n) => n.innerText).join(' | ')`)})`); } },
    /** Sets a field the way a user would (native setter + input/change events so React sees it). */
    set: (selector, value) => ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('no element ${selector.replace(/'/g, "")}'); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; if (el.type === 'checkbox') { if (el.checked !== ${JSON.stringify(value)}) el.click(); } else { Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } return true; })()`),
    /** Clicks the first visible button/link whose text matches (optionally inside a scope selector). */
    /** Clicks the first visible button/link whose text matches. A scoped click (e.g. a dialog) waits for the scope to exist instead of falling back to the page. */
    click: async (text, scope = "body") => {
      const attempt = () => ev(`(() => { const root = document.querySelector(${JSON.stringify(scope)}); if (!root) return 'no-scope'; const els = [...root.querySelectorAll('button, a, summary, label')].filter((e) => !e.disabled && (e.offsetParent !== null || e.closest('dialog[open]'))); const el = els.find((e) => e.innerText.trim() === ${JSON.stringify(text)}) ?? els.find((e) => e.innerText.trim().includes(${JSON.stringify(text)})); if (!el) return 'no-element'; el.click(); return true; })()`);
      const end = Date.now() + (scope === "body" ? 0 : 10000);
      let result = await attempt();
      while (result !== true && Date.now() < end) { await sleep(300); result = await attempt(); }
      if (result !== true) throw new Error(`no clickable "${text}" in ${scope} (${result})`);
      return true;
    },
    /** Waits until the button exists and is enabled (forms disable their button while saving), then clicks it. */
    async clickReady(text, scope = "body", ms = 30000) { const end = Date.now() + ms; let last; while (Date.now() < end) { try { return await api.click(text, scope); } catch (error) { last = error; await sleep(500); } } throw last; },
    close() { try { ws.close(); } catch { /* ignore */ } chrome.kill(); },
  };
  return api;
}
