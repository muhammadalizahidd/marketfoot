import { openSession } from "./harness.mjs";
const s = await openSession(".figma-cache/qa-admin-credentials.json");
try {
  await s.goto("/admin");
  console.log("shell display:", await s.ev(`getComputedStyle(document.querySelector('.ad-shell')).display`));
  console.log("stylesheets:", await s.ev(`[...document.styleSheets].map((sh) => { let n = -1; try { n = sh.cssRules.length } catch {} return (sh.href || 'inline').split('/').pop() + ':' + n; }).join(' | ')`));
  console.log("has .ad-shell rule:", await s.ev(`[...document.styleSheets].some((sh) => { try { return [...sh.cssRules].some((r) => r.cssText.includes('.ad-shell')) } catch { return false } })`));
  console.log("body bg:", await s.ev(`getComputedStyle(document.body).backgroundColor + ' / font ' + getComputedStyle(document.body).fontFamily.slice(0, 40)`));
} finally { s.close(); }
