// The registered redirect URI is /oauth/callback (shared with the embedded
// flow, where it is never visited). The off-platform flow's browser redirect
// lands here — reuse the existing callback handler.
export { GET } from "../../callback/route";
