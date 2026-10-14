// Shared by the push endpoints. Files starting with _ aren't served as their own endpoints.
import { createECDH, createHash } from 'node:crypto';

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hhusayxsiwizjhbsifgp.supabase.co';

// The notification keys come from one secret you choose (PUSH_SECRET in Vercel), so there is no key file to keep.
export function vapidKeys() {
  const seed = process.env.PUSH_SECRET;
  if (!seed || seed.length < 16) return null;
  const priv = createHash('sha256').update('almanac-vapid:' + seed).digest();
  const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(priv);
  return { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: priv.toString('base64url') };
}
