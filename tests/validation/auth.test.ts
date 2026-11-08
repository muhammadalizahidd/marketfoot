import test from "node:test";
import assert from "node:assert/strict";
import { signUpSchema } from "@/lib/validation/auth";

const account = { email: "joueur@example.test", password: "motdepasse8" };

test("signup pseudo accepts readable French names and normalizes pasted whitespace", () => {
  const result = signUpSchema.parse({ ...account, username: "  Équipe   de  Paris  " });
  assert.equal(result.username, "Équipe de Paris");
});

test("signup pseudo rejects punctuation that could be unsafe or ambiguous", () => {
  assert.equal(signUpSchema.safeParse({ ...account, username: "Joueur!" }).success, false);
});
