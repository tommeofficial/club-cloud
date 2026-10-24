// The app at /app is invite-only: without the cookie from /api/unlock, people go back to the website's password pop-up.
export const config = { matcher: ['/app', '/app.html'] };

const ACCESS_TOKEN = '26aeec9afc765928a26673e59e5edff090c6c0ab583bffdbe2e91f3c45aab2e6'; // keep in step with api/unlock.js

export default function middleware(request) {
  const cookies = (request.headers.get('cookie') || '').split(/;\s*/);
  if (cookies.includes(`cc_access=${ACCESS_TOKEN}`)) return;
  return Response.redirect(new URL('/?invite=1', request.url), 307);
}
