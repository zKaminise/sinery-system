import "server-only"
import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

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
