// Returns the iceServers array (STUN + TURN relay) a client needs to start
// a voice call (see packages/shared/src/webrtc.ts and the useVoiceCall
// hooks). The TURN account is a single shared credential for the whole app,
// so it stays server-side and is never shipped in a client bundle -- this
// function is the only thing that reads it, gated by the platform's default
// JWT verification (no config.toml override here, same as every other
// function in this project that doesn't pass --no-verify-jwt), so only an
// already-authenticated rider/driver can fetch it.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const STUN_ONLY = [{ urls: 'stun:stun.relay.metered.ca:80' }];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const username = Deno.env.get('TURN_USERNAME');
  const credential = Deno.env.get('TURN_CREDENTIAL');

  // Degrade to STUN-only rather than error -- a call can still be attempted
  // (and will still connect for most NAT types), just without TURN relay as
  // a last resort.
  const iceServers = username && credential
    ? [
        { urls: 'stun:stun.relay.metered.ca:80' },
        { urls: 'turn:global.relay.metered.ca:80', username, credential },
        { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username, credential },
        { urls: 'turn:global.relay.metered.ca:443', username, credential },
        { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username, credential }
      ]
    : STUN_ONLY;

  return new Response(JSON.stringify(iceServers), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
});
