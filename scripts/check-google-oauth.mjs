/**
 * Does Google accept these credentials, and this redirect URI? (M2-T2)
 *
 *   node scripts/check-google-oauth.mjs [--origin https://example.com]
 *
 * `docs/QA.md` check 3 is "Google sign-in, live", and most of it is now
 * automated: `e2e/auth.spec.ts` runs the whole handshake against a local
 * OpenID provider, which proves our half — the redirect, the checks, the
 * profile mapping, the account row. What that cannot prove is the half that
 * lives in someone's Google Cloud console: whether the client id and secret
 * are real, whether *this* deployment's redirect URI is registered against
 * them, and whether the OAuth client is in a state that will serve users.
 *
 * Every one of those is a redirect away from the site when a user finds it,
 * on Google's error page rather than ours. This script finds them from a
 * terminal instead, without a browser and without anyone consenting to
 * anything:
 *
 *   - it asks Google for its discovery document, so the endpoints are the
 *     live ones rather than ones written down here;
 *   - it offers the token endpoint a deliberately invalid authorization
 *     code. `invalid_grant` means Google authenticated the client and
 *     rejected only the code — which is the pass. `invalid_client` means
 *     the id and secret are not a pair Google knows;
 *   - it makes one authorization request with `prompt=none`, which Google
 *     answers without a sign-in screen: a redirect back to our URI means
 *     the URI is registered, and an error page means it is not.
 *
 * What is left after a clean run is one human looking at the consent
 * screen. `docs/QA.md` keeps that, and this prints it as a reminder.
 *
 * No dependencies, no imports from `src/`: this has to run on a deployment
 * host with nothing but Node and the environment file.
 */

import process from "node:process";

const DEFAULT_ISSUER = "https://accounts.google.com";
const CALLBACK_PATH = "/api/auth/callback/google";

/** RFC 7636's example pair, so the probe carries a well-formed PKCE challenge. */
const EXAMPLE_CODE_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

const argv = process.argv.slice(2);

function flag(name) {
  const withEquals = argv.find((argument) => argument.startsWith(`--${name}=`));
  if (withEquals) return withEquals.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
}

let failed = false;

function report(status, message, detail) {
  const line = `[${status}] ${message}`;
  if (status === "fail") failed = true;
  if (detail) {
    console.log(line);
    for (const paragraph of [detail].flat()) console.log(`       ${paragraph}`);
  } else {
    console.log(line);
  }
}

const ok = (message, detail) => report(" ok ", message, detail);
const warn = (message, detail) => report("warn", message, detail);
const fail = (message, detail) => report("fail", message, detail);

/**
 * Ends the run early, without ending the process.
 *
 * `process.exit()` while a keep-alive socket is closing aborts the process
 * on Windows with a libuv assertion and an exit code of 127 — which reads as
 * "the script crashed" rather than "the configuration is wrong", and is the
 * one thing a check script must never get wrong. Everything unwinds to
 * `main` instead, and the exit code is set once, at the end.
 */
class Abort extends Error {}

function abort(message, detail) {
  fail(message, detail);
  throw new Abort(message);
}

/**
 * The public origin, which decides the redirect URI.
 *
 * `AUTH_URL` is the same value the app builds its callback from, so reading
 * it here is what makes this check about *this* deployment rather than
 * about a URL typed twice.
 */
function resolveOrigin() {
  const configured = flag("origin") ?? process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) {
    return { origin: "http://localhost:3000", assumed: true };
  }
  try {
    return { origin: new URL(configured).origin, assumed: false };
  } catch {
    return abort(`AUTH_URL is not a URL: ${configured}`);
  }
}

function checkCredentials() {
  const clientId = process.env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();

  if (!clientId || !clientSecret) {
    abort("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must both be set.", [
      "Google sign-in is optional: with neither set the button is simply not offered.",
      "With one set and not the other it is also not offered — half-configured renders",
      "a button that fails after redirecting away from the site.",
      "",
      "Run this with them in the environment, for example:",
      "  AUTH_GOOGLE_ID=… AUTH_GOOGLE_SECRET=… node scripts/check-google-oauth.mjs",
    ]);
  }

  ok(`Both credentials are set. Client id: ${clientId}`);
  if (!clientId.endsWith(".apps.googleusercontent.com")) {
    warn("That client id does not look like Google's.", [
      "Google issues ids ending in `.apps.googleusercontent.com`. A Web application",
      "credential is the right kind — not an API key, and not a service account.",
    ]);
  }
  return { clientId, clientSecret };
}

function checkRedirectUri(origin, assumed) {
  const redirectUri = `${origin}${CALLBACK_PATH}`;
  ok(`Redirect URI for this deployment: ${redirectUri}`, [
    "This exact string, including the scheme and any port, has to be listed under",
    "Authorized redirect URIs on the OAuth client. Google matches it literally.",
  ]);

  if (assumed) {
    warn("AUTH_URL is not set, so this assumed a local development origin.", [
      "In production `AUTH_URL` must be the real public origin: Auth.js otherwise",
      "builds callback URLs from the request's Host header. Pass --origin to check a",
      "different one.",
    ]);
  }

  const { protocol, hostname } = new URL(origin);
  if (protocol === "http:" && hostname !== "localhost" && hostname !== "127.0.0.1") {
    fail("Google will not accept a plain-HTTP redirect URI off localhost.", [
      "Serve the deployment over HTTPS, or the OAuth client cannot register this URI.",
    ]);
  }
  return redirectUri;
}

async function fetchDiscovery(issuer) {
  const url = `${issuer}/.well-known/openid-configuration`;
  let response;
  try {
    response = await fetch(url, { headers: { accept: "application/json" } });
  } catch (error) {
    return abort(`Could not reach ${url}`, [
      String(error?.message ?? error),
      "Everything below depends on this, so nothing else was tried.",
    ]);
  }
  if (!response.ok) {
    return abort(`${url} answered ${response.status}`);
  }
  const document = await response.json();
  if (!document.authorization_endpoint || !document.token_endpoint) {
    return abort("The discovery document has no authorization or token endpoint.");
  }
  ok(`Discovery reachable at ${issuer}`, [
    `authorization_endpoint: ${document.authorization_endpoint}`,
    `token_endpoint:         ${document.token_endpoint}`,
  ]);
  return document;
}

/**
 * Authenticates the client without signing anybody in.
 *
 * The authorization code is invalid by construction, so a working client can
 * only answer `invalid_grant`. Anything about the *client* is therefore
 * about the credentials rather than about the code.
 */
async function checkClientCredentials({ tokenEndpoint, clientId, clientSecret, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: "preflight-code-that-was-never-issued",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  let response;
  try {
    response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (error) {
    fail(`Could not reach the token endpoint: ${String(error?.message ?? error)}`);
    return;
  }

  const payload = await response.json().catch(() => ({}));
  const error = typeof payload.error === "string" ? payload.error : "";
  const description =
    typeof payload.error_description === "string" ? payload.error_description : "";

  if (error === "invalid_grant") {
    ok("Google accepted the client id and secret.", [
      "It rejected the deliberately invalid authorization code, which is the pass:",
      "the credentials were authenticated before the code was ever looked at.",
    ]);
    return;
  }
  if (error === "invalid_client" || response.status === 401) {
    fail("Google rejected the client id and secret as a pair.", [
      description || "The token endpoint answered `invalid_client`.",
      "Check that the secret belongs to *this* client id — a rotated or regenerated",
      "secret invalidates the old one immediately, and a deploy keeps the old value",
      "until it is redeployed.",
    ]);
    return;
  }
  if (error === "redirect_uri_mismatch") {
    fail(`Google does not have ${redirectUri} registered on this client.`, [
      description || "The token endpoint answered `redirect_uri_mismatch`.",
    ]);
    return;
  }
  if (response.ok) {
    warn("The token endpoint accepted an invalid code, which should not happen.", [
      "This is not Google. Check AUTH_GOOGLE_ISSUER.",
    ]);
    return;
  }
  warn(`Unexpected answer from the token endpoint: ${response.status} ${error || "(no error)"}`, [
    description,
  ]);
}

/** Markers Google puts in the HTML of its own error pages. */
const AUTHORIZATION_ERRORS = [
  ["redirect_uri_mismatch", "This redirect URI is not registered on the OAuth client."],
  ["invalid_client", "Google does not recognise this client id."],
  ["deleted_client", "This OAuth client has been deleted."],
  ["disabled_client", "This OAuth client is disabled."],
  ["admin_policy_enforced", "A Workspace admin policy blocks this app."],
  ["org_internal", "The client is internal to one organisation; outside accounts cannot use it."],
];

/**
 * Reads the error Google hides in a redirect.
 *
 * A rejected authorization request does not answer 400. It answers 302 to
 * `/signin/oauth/error?authError=…`, where the payload is a base64url blob
 * with the machine name and the human sentence packed into it. Treating any
 * redirect as success therefore passes a client id Google has never heard
 * of — which is exactly what this check exists to catch.
 */
/** An error page is HTML and long; this keeps the sentence and drops the rest. */
function readable(text) {
  const collapsed = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return collapsed.length > 240 ? `${collapsed.slice(0, 240)}…` : collapsed;
}

function googleAuthError(location) {
  let url;
  try {
    url = new URL(location);
  } catch {
    return null;
  }
  const encoded = url.searchParams.get("authError");
  if (!encoded) return url.pathname.includes("/signin/oauth/error") ? "unknown error" : null;
  const decoded = Buffer.from(encoded, "base64url").toString("utf8");
  // Framing bytes surround the two readable strings; keep the runs.
  const readable = decoded.match(/[ -~]{4,}/g);
  return readable?.join(" — ") || decoded;
}

/**
 * Asks for an authorization the way the app does, and reads the answer.
 *
 * `prompt=none` is what makes this safe to run unattended: Google answers
 * without showing anyone a screen. A redirect back to our own URI — even one
 * carrying `error=login_required`, which is exactly what should come back
 * when there is no browser session — means Google validated the client and
 * the redirect URI before deciding it had nobody to ask.
 */
async function checkAuthorizationRequest({ authorizationEndpoint, clientId, redirectUri }) {
  const url = new URL(authorizationEndpoint);
  for (const [key, value] of Object.entries({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: "preflight",
    nonce: "preflight",
    code_challenge: EXAMPLE_CODE_CHALLENGE,
    code_challenge_method: "S256",
    prompt: "none",
  })) {
    url.searchParams.set(key, value);
  }

  let response;
  try {
    response = await fetch(url, { redirect: "manual" });
  } catch (error) {
    fail(`Could not reach the authorization endpoint: ${String(error?.message ?? error)}`);
    return;
  }

  const location = response.headers.get("location") ?? "";
  if (location.startsWith(redirectUri)) {
    const returned = new URL(location).searchParams.get("error");
    ok(`Google accepted the client id and redirect URI, and redirected back.`, [
      returned
        ? `It came back with \`${returned}\`, which is what an unattended request should get.`
        : "It came back without an error.",
    ]);
    return;
  }
  // A rejection arrives as a redirect to Google's own error screen, not as
  // a 4xx, so the redirect has to be read before it is believed. Only when
  // there is no redirect at all is the body worth reading.
  const problem = location
    ? (googleAuthError(location) ?? "")
    : readable(await response.text().catch(() => ""));

  if (!problem) {
    if (response.status >= 300 && response.status < 400) {
      ok("Google accepted the request and sent a sign-in screen.", [
        "The client id and redirect URI are registered; the rest is a browser's job.",
      ]);
      return;
    }
    fail(`The authorization endpoint answered ${response.status} and said nothing readable.`, [
      "Open the URL below in a browser to read Google's own message:",
      url.toString(),
    ]);
    return;
  }

  const matched = AUTHORIZATION_ERRORS.find(([marker]) => problem.includes(marker));
  if (matched) {
    fail(`${matched[1]} (${matched[0]})`, [
      problem,
      `The client id used was: ${clientId}`,
      `The redirect URI has to be registered exactly as: ${redirectUri}`,
    ]);
    return;
  }
  if (problem.includes("access_blocked") || problem.includes("verification process")) {
    warn("Google is blocking access to this client.", [
      problem,
      "An unverified OAuth client in Testing can only be used by the accounts listed",
      "as test users. Add the account, or publish the client.",
    ]);
    return;
  }
  fail("Google refused the authorization request.", [
    problem,
    "Open the URL below in a browser to read Google's own message:",
    url.toString(),
  ]);
}

async function main() {
  const issuer = (flag("issuer") ?? process.env.AUTH_GOOGLE_ISSUER ?? DEFAULT_ISSUER).trim();
  const { origin, assumed } = resolveOrigin();

  console.log("Checking Google sign-in configuration.\n");
  if (issuer !== DEFAULT_ISSUER) {
    warn(`Issuer is overridden: ${issuer}`, [
      "AUTH_GOOGLE_ISSUER is a test seam. A deployment should leave it unset.",
    ]);
  }

  const { clientId, clientSecret } = checkCredentials();
  const redirectUri = checkRedirectUri(origin, assumed);
  const discovery = await fetchDiscovery(issuer);

  await checkClientCredentials({
    tokenEndpoint: discovery.token_endpoint,
    clientId,
    clientSecret,
    redirectUri,
  });
  await checkAuthorizationRequest({
    authorizationEndpoint: discovery.authorization_endpoint,
    clientId,
    redirectUri,
  });
}

function finish() {
  console.log("");
  if (failed) {
    console.log("Something above has to be fixed before Google sign-in will work.");
    process.exitCode = 1;
    return;
  }
  console.log("Google's side of the configuration is in order.");
  console.log("");
  console.log("What a person still has to look at once (docs/QA.md, check 3):");
  console.log("  - the consent screen shows the right app name, and asks for email and");
  console.log("    profile and nothing else;");
  console.log("  - a first sign-in with a real Google account lands on /dashboard.");
}

try {
  await main();
} catch (error) {
  if (!(error instanceof Abort)) throw error;
}
finish();
