# Public player sign-in — operator setup

Players use an existing Google or Apple account. They do not fill in a separate registration form or create a game password. First successful sign-in creates the player profile automatically; subsequent sign-ins restore the same account and cloud save. Nicknames can be changed in Settings.

Google and Apple require the game operator to configure an OAuth connection once. This is separate from player registration. No provider credentials currently exist in this project's production environment. The deployed backend and sign-in flow are prepared; the buttons remain explicitly unavailable until real provider credentials are supplied. No dummy credentials are enabled publicly.

## Stable public addresses

- Game: `https://bastions-of-last-kingdom-statistics.sinagl-r.chatgpt.site/play/`
- Privacy: `https://bastions-of-last-kingdom-statistics.sinagl-r.chatgpt.site/play/privacy.html`
- Google callback: `https://bastions-of-last-kingdom-statistics.sinagl-r.chatgpt.site/api/auth/callback/google`
- Apple callback: `https://bastions-of-last-kingdom-statistics.sinagl-r.chatgpt.site/api/auth/callback/apple`
- The previous GitHub Pages game entry redirects to the hosted game. The game and `/api` share one origin so sign-in does not depend on third-party cookies. Existing game assets remain on their current GitHub distribution. The gallery is not published.

## Google

In the operator's Google Cloud project, configure Google Auth Platform for an external web application. Use the game name “Forged Alliances TD”, the game and privacy addresses above, and a real operator support contact. Create an OAuth client of type **Web application**. Register the exact Google callback above; the authorized JavaScript origin is `https://bastions-of-last-kingdom-statistics.sinagl-r.chatgpt.site`.

The server needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The game requests only `openid`, `email` and `profile`; it does not request Gmail, Drive or contact access. Make the provider application available to the intended audience: Google testing mode limits access to configured test users. Follow any domain/branding verification requested by Google; never bypass its review requirements.

See [Google OAuth web applications](https://developers.google.com/identity/protocols/oauth2/web-server) and [the provider integration](https://better-auth.com/docs/authentication/google).

## Apple

An active Apple Developer membership and an eligible primary App ID with Sign in with Apple are required. Create/configure a Services ID for the website, register the exact hosted domain and Apple return URL above, and create the associated Sign in with Apple private key. Check Apple's eligibility requirements for the primary app before purchasing membership for this purpose.

The server needs `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (the downloaded `.p8` key). The backend generates a signed short-lived Apple client secret and refreshes its authentication configuration before that secret expires. Apple's HTTPS `form_post` callback is handled separately, with signed state and secure state cookies. Apple can supply a private relay email address; use the same provider to return to the same player account.

See [Apple web configuration](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/) and [Apple private keys](https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key/).

## Secret handoff and activation

Do not paste passwords, OAuth client secrets or Apple keys into a chat, issue, public source file or frontend build setting. Enter them as secrets in the existing Site's runtime settings. If local assistance is needed, place them in the ignored `artifacts/fr010-public/provider-secrets.env` file on this PC and report only that the file is ready. Keep the Apple `.p8` file private; its contents belong only in a runtime secret.

After updating runtime variables, redeploy the existing saved Site version to apply the new environment revision. A new game build is unnecessary: `/api/player/session` advertises which providers are configured and the menu enables only those providers. Preserve `AUTH_SECRET`, Site identity and the `DB` binding so existing sessions and records remain valid.

`AUTH_ENABLE_EMAIL=false` intentionally leaves manual email/password sign-up disabled in public deployment, as requested. It can be enabled later only with a real configured email sender. Local development can continue using its private local mailbox.

## Verification limits

Automated tests exercise signed Google identities against isolated test keys, first-profile creation, repeat sign-in, cloud continuation, state/PKCE, nonce rejection for direct ID tokens, Apple client-secret signing, nickname changes, owner-scoped deletion and the same-origin asset proxy. They do not prove an external production OAuth application has been configured. Real Google/Apple browser sign-in must be tested after the operator supplies valid credentials and provider-side callback settings.
