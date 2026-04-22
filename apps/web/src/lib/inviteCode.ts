// 8-character alphanumeric invite code.
// Excludes visually ambiguous characters (0/O, 1/I/L) so users copying
// by hand are less likely to misread.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
