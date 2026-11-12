# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting instead: go to the **Security** tab of this repository and choose **Report a vulnerability**.

Include what you found, how to reproduce it and the impact you see. You can expect a first answer within a few days.

## What is in scope

- Cross-site scripting or injection through user-controlled text in SVG cards or the landing page
- Leaking private repository names or other private data in cards, JSON responses or logs
- Ways to bypass the rate limit or abuse the server's GitHub token
- Anything that exposes the `GITHUB_TOKEN` of whoever runs the server

## Good to know

- The server only ever uses the token you give it, and never logs or returns it.
- Use a token with the fewest scopes possible. Public data needs none.
- If you run the server behind a reverse proxy, set `TRUST_PROXY=1`. Without a proxy, leave it off, otherwise clients could spoof their address and skip the rate limit.
