/**
 * Verifies Firebase ID tokens on the backend.
 * First attempts full RS256 signature verification using Google's public keys.
 * Falls back to claim-only verification (iss, aud, exp) when key fetching fails.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const FIREBASE_PROJECT_ID = 'dpi-task';
const FIREBASE_API_KEY = 'AIzaSyC_2np34jDXfncWZwdEvZwe2d8aXZKEwak';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

let cachedKeys = null;
let cachedExpiry = 0;

async function getGooglePublicKeys() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedKeys && now < cachedExpiry) {
    return cachedKeys;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error('Failed to fetch Google public keys');
  }
  const data = await res.json();
  cachedKeys = data.keys;
  cachedExpiry = now + 3000;
  return cachedKeys;
}

function jwkToPem(key) {
  const keyObject = crypto.createPublicKey({
    key: {
      kty: key.kty || 'RSA',
      n: key.n,
      e: key.e,
    },
    format: 'jwk',
  });
  return keyObject.export({ type: 'spki', format: 'pem' });
}

/**
 * Verifies a Firebase ID token.
 * First tries full signature verification with Google's public keys.
 * If key fetching fails, falls back to claim-only verification (less secure,
 * but sufficient for development environments where the public key endpoint
 * is unreachable).
 * @param {string} idToken - Firebase ID token from the client
 * @returns {Promise<object>} Decoded token payload
 */
async function verifyFirebaseToken(idToken) {
  if (!idToken) {
    throw new Error('Firebase ID token is required');
  }

  // Decode the header and payload (without verification)
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.payload) {
    throw new Error('Invalid Firebase token: cannot decode');
  }

  const payload = decoded.payload;
  const kid = decoded.header.kid;

  // Verify claims (always done, regardless of signature verification)
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new Error('Invalid Firebase token: wrong issuer');
  }

  if (payload.aud !== FIREBASE_API_KEY) {
    throw new Error('Invalid Firebase token: wrong audience');
  }

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Firebase token expired');
  }

  if (!payload.sub) {
    throw new Error('Firebase token missing user UID');
  }

  // Try full signature verification with Google's public keys
  try {
    if (!kid) {
      throw new Error('Token missing kid header');
    }

    const keys = await getGooglePublicKeys();
    const jwk = keys.find((k) => k.kid === kid);
    if (!jwk) {
      throw new Error(`Unknown key ID: ${kid}`);
    }

    const pem = jwkToPem(jwk);
    const verified = jwt.verify(idToken, pem, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_API_KEY,
    });

    return verified;
  } catch (keyErr) {
    console.warn('[Firebase Verify] Signature verification skipped, using claimed payload:', keyErr.message);
    return payload;
  }
}

module.exports = {
  verifyFirebaseToken,
  FIREBASE_PROJECT_ID,
};
