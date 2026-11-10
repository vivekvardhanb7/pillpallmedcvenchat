import { createHash, verify } from 'node:crypto';

// A checksum is integrity evidence, never an approval or an authenticity claim.
export function inspectSnapshot(snapshot, publicKey = null, now = Date.now()) {
  if (!snapshot || !Array.isArray(snapshot.products) || !Array.isArray(snapshot.vending_inventory)
      || !Array.isArray(snapshot.alternatives)) throw new Error('Invalid catalogue schema');
  const { integrity_sha256, signature, ...payload } = snapshot;
  const bytes = Buffer.from(JSON.stringify(payload, null, 2));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (!integrity_sha256 || hash !== integrity_sha256) throw new Error('Catalogue checksum mismatch');
  const expires = Date.parse(payload.expires_at);
  const starts = Date.parse(payload.valid_from);
  const signatureValid = Boolean(publicKey && signature
    && verify(null, bytes, publicKey, Buffer.from(signature, 'base64')));
  const trusted = signatureValid && Number.isFinite(expires) && expires > now
    && Number.isFinite(starts) && starts <= now;
  return { snapshot, trusted, expires_at: trusted ? expires : null,
    reason: trusted ? 'verified_release' : 'unsigned_expired_or_untrusted_reference' };
}
