import "server-only"
import { randomInt } from "node:crypto"
import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

// Excludes visually ambiguous characters (0/O, 1/l/I) to make the one-time
// provisional password easier to read and copy by hand.
const PROVISIONAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

/**
 * Generates a strong one-time provisional password of the form
 * `Sinery@` + 8 cryptographically-random characters. It always satisfies the
 * change-password policy (>=8 chars, at least one letter and one number).
 * The plaintext is returned so it can be shown to an admin exactly once —
 * only the bcrypt hash is ever persisted.
 */
export function generateProvisionalPassword(): string {
  let suffix = ""
  for (let i = 0; i < 8; i++) {
    suffix += PROVISIONAL_ALPHABET[randomInt(PROVISIONAL_ALPHABET.length)]
  }
  return `Sinery@${suffix}`
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}

/**
 * A valid bcrypt hash of an arbitrary, unused password. Used to run
 * `verifyPassword` even when no matching user/hash was found, so a login
 * attempt for a non-existent e-mail takes the same amount of time as one for
 * an existing e-mail with a wrong password — this avoids leaking whether an
 * e-mail is registered via response-timing.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "sinery-timing-safety-placeholder",
  SALT_ROUNDS
)
