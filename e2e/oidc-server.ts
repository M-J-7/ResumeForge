/**
 * A throwaway OpenID Connect provider the E2E run points Google sign-in at.
 *
 * M2-T2's acceptance is "**both** flows work end-to-end". Only one of them
 * was covered: the magic link, through a real SMTP conversation. The Google
 * half had never been executed at all — not in a test, not by hand — because
 * running it needs a Google Cloud project. What that left untested was not
 * Google's code, it was ours: the callback route, the checks, the profile
 * mapping, and the adapter write. The first of those to run in production
 * would have failed (see `src/server/auth/adapter.ts`).
 *
 * So this server stands in for `accounts.google.com` and **nothing is
 * stubbed on our side of the wire**: the app discovers this issuer over
 * HTTP, sends a real PKCE challenge, redeems a real authorization code with
 * `client_secret_basic`, and is handed a real RS256-signed `id_token` that
 * `oauth4webapi` validates claim by claim. It is the same arrangement as
 * `mail-server.ts` — point the production path at a local endpoint rather
 * than replace the production path.
 *
 * ## What it deliberately copies from Google
 *
 * - `expires_in` in the token response, which has no column in §7's `Account`
 *   model and is what broke the adapter write.
 * - A `picture` claim in the `id_token`, so "no avatar URL is stored" is
 *   proved against a provider that sent one rather than one that did not.
 * - PKCE, `nonce`, and exact redirect-URI matching, all enforced, so the
 *   three things an operator gets wrong in the Google console fail here
 *   first and say why.
 *
 * ## What it cannot cover, and what still owes a human
 *
 * Google's consent screen: its branding, the scopes it lists, and the
 * publishing state of the OAuth client. That is a real browser in front of a
 * real Google account, and `docs/QA.md` keeps it. `scripts/check-google-oauth.mjs`
 * takes the rest of it — that the credentials and redirect URI are ones
 * Google itself accepts — without needing anyone to consent.
 */

import {
  createHash,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  randomUUID,
} from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

/** Its own port, next to the mail server's. */
export const OIDC_PORT = 2527;

/**
 * Loopback, so `googleIssuer` accepts it over plain HTTP. An `http:` issuer
 * on any other host is refused — see `src/server/auth/config.ts`.
 */
export const OIDC_ISSUER = `http://127.0.0.1:${OIDC_PORT}`;

/** Shaped like Google's, so nothing in the app can be accidentally lenient. */
export const OIDC_CLIENT_ID = "e2e-client.apps.googleusercontent.com";
export const OIDC_CLIENT_SECRET = "e2e-client-secret-never-used-outside-playwright";

/**
 * The one redirect URI this provider will send a code to.
 *
 * Registered exactly, the way the Google console registers it, so a change
 * to the callback path fails here with `redirect_uri_mismatch` instead of
 * silently working in tests and failing in production.
 */
export const OIDC_REDIRECT_URI = "http://localhost:3000/api/auth/callback/google";

/** Whoever the provider says is signing in. */
export interface OidcAccount {
  sub: string;
  email: string;
  name?: string;
  /** Google always sends one. Nothing here may store it — that is the point. */
  picture?: string;
}

/** What the app asked for, kept so a test can assert on it. */
export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

export interface IdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  nonce: string;
  iat: number;
  exp: number;
}

export interface OidcServer {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Every authorization request seen, oldest first. */
  authorizations: AuthorizationRequest[];
  /** The claims of every `id_token` issued, oldest first. */
  issuedIdTokens: IdTokenClaims[];
  /**
   * Sets who the next sign-in is.
   *
   * Sticky rather than one-shot: a second sign-in with no new call is the
   * same person coming back, which is what "reuses the account" means.
   */
  signInAs(account: OidcAccount): void;
  /** Makes the next authorization decline, the way pressing Cancel does. */
  declineNext(): void;
  close(): Promise<void>;
}

interface PendingCode {
  account: OidcAccount;
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KEY_ID = "e2e-signing-key";

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

/** An RS256 JWT, signed the way Google signs an id_token. */
function signJwt(claims: IdTokenClaims): string {
  const header = { alg: "RS256", typ: "JWT", kid: KEY_ID };
  const body = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(body).sign(privateKey).toString("base64url");
  return `${body}.${signature}`;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    // Discovery is re-fetched on every sign-in; a cached copy across tests
    // would hide a change to this file.
    "cache-control": "no-store",
  });
  response.end(payload);
}

function text(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

/**
 * Undoes the encoding `client_secret_basic` applies.
 *
 * RFC 6749 form-encodes each half before base64, and Auth.js does exactly
 * that. Decoding it back is what makes this a real check of the secret
 * rather than a check that *some* credentials were sent.
 */
function credentialsFromBasic(header: string | undefined): { id: string; secret: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator === -1) return null;
  const decodeHalf = (half: string) => decodeURIComponent(half.replace(/\+/g, "%20"));
  return {
    id: decodeHalf(decoded.slice(0, separator)),
    secret: decodeHalf(decoded.slice(separator + 1)),
  };
}

export async function startOidcServer(port: number = OIDC_PORT): Promise<OidcServer> {
  const authorizations: AuthorizationRequest[] = [];
  const issuedIdTokens: IdTokenClaims[] = [];
  const codes = new Map<string, PendingCode>();
  let account: OidcAccount | null = null;
  let declineNextRequest = false;

  const discovery = {
    issuer: OIDC_ISSUER,
    authorization_endpoint: `${OIDC_ISSUER}/authorize`,
    token_endpoint: `${OIDC_ISSUER}/token`,
    userinfo_endpoint: `${OIDC_ISSUER}/userinfo`,
    jwks_uri: `${OIDC_ISSUER}/jwks`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "email", "profile"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code"],
    claims_supported: ["sub", "email", "email_verified", "name", "picture", "aud", "exp", "iss"],
  };

  function handleAuthorize(url: URL, response: ServerResponse): void {
    const parameter = (name: string) => url.searchParams.get(name) ?? "";
    const redirectUri = parameter("redirect_uri");

    // Registration is checked before anything is sent anywhere, exactly as
    // Google does: an unregistered URI must never receive a code.
    if (redirectUri !== OIDC_REDIRECT_URI) {
      text(response, 400, `redirect_uri_mismatch: ${redirectUri || "(none)"}`);
      return;
    }
    if (parameter("client_id") !== OIDC_CLIENT_ID) {
      text(response, 401, "invalid_client");
      return;
    }
    if (parameter("response_type") !== "code") {
      text(response, 400, `unsupported_response_type: ${parameter("response_type")}`);
      return;
    }

    const request: AuthorizationRequest = {
      clientId: parameter("client_id"),
      redirectUri,
      scope: parameter("scope"),
      state: parameter("state"),
      nonce: parameter("nonce"),
      codeChallenge: parameter("code_challenge"),
      codeChallengeMethod: parameter("code_challenge_method"),
    };
    authorizations.push(request);

    const back = new URL(redirectUri);
    if (request.state) back.searchParams.set("state", request.state);

    if (declineNextRequest) {
      declineNextRequest = false;
      // What Google sends when the consent screen is dismissed.
      back.searchParams.set("error", "access_denied");
      back.searchParams.set("error_description", "The user denied the request");
      response.writeHead(302, { location: back.toString() });
      response.end();
      return;
    }

    // `prompt=none` asks for an answer without showing anyone a screen,
    // which is how `scripts/check-google-oauth.mjs` probes a registration
    // unattended. With nobody signed in, the spec's answer is
    // `login_required` — a redirect back, not an error page.
    if (!account && url.searchParams.get("prompt") === "none") {
      back.searchParams.set("error", "login_required");
      response.writeHead(302, { location: back.toString() });
      response.end();
      return;
    }
    if (!account) {
      text(response, 400, "No account configured: call signInAs() before signing in.");
      return;
    }
    if (request.codeChallengeMethod !== "S256" || !request.codeChallenge) {
      text(response, 400, "invalid_request: PKCE with S256 is required");
      return;
    }
    if (!request.nonce) {
      text(response, 400, "invalid_request: nonce is required");
      return;
    }

    const code = randomUUID();
    codes.set(code, {
      account,
      nonce: request.nonce,
      codeChallenge: request.codeChallenge,
      redirectUri,
    });
    back.searchParams.set("code", code);
    response.writeHead(302, { location: back.toString() });
    response.end();
  }

  async function handleToken(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = new URLSearchParams(await readBody(request));
    const credentials =
      credentialsFromBasic(request.headers.authorization) ??
      // `client_secret_post` is advertised too, so a change of client auth
      // method fails on the credentials rather than on the transport.
      (body.has("client_id")
        ? { id: body.get("client_id") ?? "", secret: body.get("client_secret") ?? "" }
        : null);

    if (credentials?.id !== OIDC_CLIENT_ID || credentials.secret !== OIDC_CLIENT_SECRET) {
      json(response, 401, { error: "invalid_client" });
      return;
    }
    if (body.get("grant_type") !== "authorization_code") {
      json(response, 400, { error: "unsupported_grant_type" });
      return;
    }

    const code = body.get("code") ?? "";
    const pending = codes.get(code);
    // Single use, like the magic link: deleted whether or not the rest of
    // the exchange succeeds.
    codes.delete(code);
    if (!pending) {
      json(response, 400, { error: "invalid_grant", error_description: "unknown code" });
      return;
    }
    if (body.get("redirect_uri") !== pending.redirectUri) {
      json(response, 400, { error: "invalid_grant", error_description: "redirect_uri_mismatch" });
      return;
    }

    const verifier = body.get("code_verifier") ?? "";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    if (!verifier || challenge !== pending.codeChallenge) {
      json(response, 400, {
        error: "invalid_grant",
        error_description: "PKCE verification failed",
      });
      return;
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const claims: IdTokenClaims = {
      iss: OIDC_ISSUER,
      aud: OIDC_CLIENT_ID,
      sub: pending.account.sub,
      email: pending.account.email,
      email_verified: true,
      ...(pending.account.name === undefined ? {} : { name: pending.account.name }),
      ...(pending.account.picture === undefined ? {} : { picture: pending.account.picture }),
      nonce: pending.nonce,
      iat: issuedAt,
      exp: issuedAt + 3600,
    };
    issuedIdTokens.push(claims);

    json(response, 200, {
      access_token: `access-${randomUUID()}`,
      token_type: "Bearer",
      // Google sends this, §7's `Account` has no column for it, and Auth.js
      // hands the whole response to the adapter. This one field is the
      // regression `src/server/auth/adapter.ts` exists to stop.
      expires_in: 3599,
      scope: "openid https://www.googleapis.com/auth/userinfo.email",
      id_token: signJwt(claims),
    });
  }

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", OIDC_ISSUER);

    if (url.pathname === "/.well-known/openid-configuration") {
      json(response, 200, discovery);
      return;
    }
    if (url.pathname === "/jwks") {
      const jwk = createPublicKey(publicKey).export({ format: "jwk" });
      json(response, 200, { keys: [{ ...jwk, kid: KEY_ID, alg: "RS256", use: "sig" }] });
      return;
    }
    if (url.pathname === "/authorize") {
      handleAuthorize(url, response);
      return;
    }
    if (url.pathname === "/token" && request.method === "POST") {
      void handleToken(request, response).catch((error: unknown) => {
        json(response, 500, { error: "server_error", error_description: String(error) });
      });
      return;
    }
    if (url.pathname === "/userinfo") {
      const claims = issuedIdTokens.at(-1);
      if (!claims) {
        json(response, 401, { error: "invalid_token" });
        return;
      }
      json(response, 200, {
        sub: claims.sub,
        email: claims.email,
        email_verified: claims.email_verified,
        name: claims.name,
        picture: claims.picture,
      });
      return;
    }

    text(response, 404, `Not found: ${url.pathname}`);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    issuer: OIDC_ISSUER,
    clientId: OIDC_CLIENT_ID,
    clientSecret: OIDC_CLIENT_SECRET,
    authorizations,
    issuedIdTokens,
    signInAs(next) {
      account = next;
    },
    declineNext() {
      declineNextRequest = true;
    },
    close() {
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
