// The app at /app is invite-only: without the cookie from /api/unlock, people go back to the website's password pop-up.
export const config = { matcher: ['/app', '/app.html'] };

const ACCESS_TOKEN = '36c7ab1734950b2b6c913479ddb7fcbfa901536f9ef20a6df4519f9fd2a55e04'; // keep in step with api/unlock.js

export default function middleware(request) {
  const cookies = (request.headers.get('cookie') || '').split(/;\s*/);
  if (cookies.includes(`cc_access=${ACCESS_TOKEN}`)) return;
  return Response.redirect(new URL('/?invite=1', request.url), 307);
}
