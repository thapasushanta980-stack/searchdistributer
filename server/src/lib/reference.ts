import { randomBytes } from "node:crypto";

// Crockford-style alphabet without ambiguous characters.
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

export function makeReference(prefix: string): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  const d = new Date();
  const ym = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${ym}-${code}`;
}
