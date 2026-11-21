// @ts-check
/// <reference types="vite/client" />
/**
 * auth.js — AT Protocol login (OAuth) for the browser.
 *
 * The app is a public client: there is no server and no secret. The library
 * handles PKCE, DPoP and token storage (IndexedDB), and remembers the last
 * session, so a page refresh keeps the player signed in.
 *
 * Locally (http://127.0.0.1) the library uses ATProto's loopback client, so no
 * metadata file is needed. When deployed, the client_id is the URL of the
 * client-metadata.json that vite.config.js generates from SITE_URL.
 */
import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

/** Resolves handles to DIDs. The PDS is found from the DID afterwards. */
const HANDLE_RESOLVER = 'https://bsky.social';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** @type {Promise<BrowserOAuthClient> | null} */
let clientPromise = null;

function getClient() {
  clientPromise ??= LOOPBACK_HOSTS.includes(location.hostname)
    ? Promise.resolve(new BrowserOAuthClient({ handleResolver: HANDLE_RESOLVER }))
    : BrowserOAuthClient.load({
        clientId: new URL(`${import.meta.env.BASE_URL}client-metadata.json`, location.origin).href,
        handleResolver: HANDLE_RESOLVER,
      });
  return clientPromise;
}

/**
 * Call once on page load. Finishes a login redirect if the URL has one,
 * otherwise restores the saved session.
 *
 * @returns {Promise<import('@atproto/oauth-client-browser').OAuthSession | undefined>}
 *   The signed-in session, or undefined when nobody is signed in.
 */
export async function initAuth() {
  const client = await getClient();
  return (await client.init())?.session;
}

/**
 * Sends the browser to the player's PDS to approve the login. Never returns
 * normally: the page navigates away and comes back through initAuth().
 *
 * @param {string} handle - e.g. "alice.bsky.social"
 */
export async function signIn(handle) {
  const client = await getClient();
  await client.signInRedirect(handle);
}

/**
 * Looks up a player's public profile. The session only carries the DID, so
 * this asks Bluesky's public AppView, which needs no login.
 *
 * @param {string} did
 * @returns {Promise<{ handle: string, displayName?: string }>}
 */
export async function getProfile(did) {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Profile lookup failed (${response.status})`);
  }
  return response.json();
}

/**
 * @param {import('@atproto/oauth-client-browser').OAuthSession} session
 */
export async function signOut(session) {
  await session.signOut();
}
