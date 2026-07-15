import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { optionalEnv, requiredEnv } from "./env";

export type Session = {
	/** GitHub user-to-server OAuth token. */
	token: string;
	login: string;
	avatarUrl?: string;
};

const COOKIE_NAME = "goreview_session";
const ALGO = "aes-256-gcm";

function key(): Buffer {
	// Any string secret works; hash it to a fixed 32 bytes.
	return createHash("sha256").update(requiredEnv("SESSION_SECRET")).digest();
}

export function sealSession(session: Session): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGO, key(), iv);
	const plaintext = Buffer.from(JSON.stringify(session), "utf8");
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function openSession(sealed: string): Session | null {
	try {
		const raw = Buffer.from(sealed, "base64url");
		const iv = raw.subarray(0, 12);
		const tag = raw.subarray(12, 28);
		const encrypted = raw.subarray(28);
		const decipher = createDecipheriv(ALGO, key(), iv);
		decipher.setAuthTag(tag);
		const plaintext = Buffer.concat([
			decipher.update(encrypted),
			decipher.final(),
		]);
		return JSON.parse(plaintext.toString("utf8")) as Session;
	} catch {
		return null;
	}
}

export async function readSession(): Promise<Session | null> {
	if (!optionalEnv("SESSION_SECRET")) return null;
	const store = await cookies();
	const cookie = store.get(COOKIE_NAME);
	if (!cookie?.value) return null;
	return openSession(cookie.value);
}

export async function writeSession(session: Session): Promise<void> {
	const store = await cookies();
	store.set(COOKIE_NAME, sealSession(session), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 7,
	});
}

export async function clearSession(): Promise<void> {
	const store = await cookies();
	store.delete(COOKIE_NAME);
}
