// What a friend sees when an invite link is tapped somewhere that is not the app: a Messages
// preview card, a browser, a share sheet. Apple's Link Presentation renders that card from the
// page's Open Graph tags, so this page is mostly metadata. It is also where universal links start:
// iOS reads /.well-known/apple-app-site-association to learn which paths belong to the app.
import type { InvitePreview } from '../shared/api.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type PageOptions = {
  /** Absolute origin this page is served from, used for the canonical URL and the preview image. */
  base: string;
  token: string;
  /** The app's URL scheme, for the "Open in Rally" button. */
  scheme: string;
};

/** Title and description for the card. Kept short, because Messages truncates hard. */
export function cardText(p: InvitePreview): { title: string; description: string } {
  const c = p.challenge;
  if (!c) return { title: `${p.inviterName} wants you in their crew`, description: 'Start challenges together and keep each other honest.' };
  const consequence = c.consequence?.text ? ` Last place: ${c.consequence.text.toLowerCase()}.` : '';
  return { title: `${p.inviterName} invited you to ${c.name}`, description: `${c.targetText}${consequence}` };
}

export function invitePage(p: InvitePreview, o: PageOptions): string {
  const { title, description } = cardText(p);
  const url = `${o.base}/invite/${encodeURIComponent(o.token)}`;
  const open = `${o.scheme}://invite/${encodeURIComponent(o.token)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#E8342B">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rally">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(o.base)}/invite-image.png">
<meta name="twitter:card" content="summary">
<style>
  :root { color-scheme: light; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #F7F5F1; color: #1B1A19;
         font: 17px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; }
  main { max-width: 420px; padding: 32px 24px; text-align: center; }
  img { width: 96px; height: 96px; border-radius: 24px; }
  h1 { font-size: 28px; line-height: 1.2; margin: 20px 0 8px; }
  p { color: #7C7873; margin: 0 0 24px; }
  a { display: inline-block; background: #E8342B; color: #fff; text-decoration: none; font-weight: 600;
      padding: 16px 32px; border-radius: 999px; }
</style>
</head>
<body>
<main>
  <img src="${esc(o.base)}/invite-image.png" alt="Rally">
  <h1>${esc(title)}</h1>
  <p>${esc(description)}</p>
  <a href="${esc(open)}">Open in Rally</a>
</main>
</body>
</html>`;
}

/**
 * The file iOS fetches to decide whether a link should open the app. It is only meaningful with a
 * real team id, so without one this returns null rather than publishing a wrong association.
 */
export function appSiteAssociation(teamId: string | undefined, bundleId: string): object | null {
  if (!teamId) return null;
  return { applinks: { details: [{ appIDs: [`${teamId}.${bundleId}`], components: [{ '/': '/invite/*' }] }] } };
}
