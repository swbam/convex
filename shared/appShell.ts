// Vite builds the public document once per release.
export function appShell(entry: string, stylesheet: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name='impact-site-verification' value='cb4296e5-d318-484f-ab79-065cbc57c07b'>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="stylesheet" href="${stylesheet}" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎵</text></svg>">

    <title>Concert Setlists | Vote &amp; Request Songs | setlists.live</title>
    <meta name="description" content="Find concert setlists and upcoming tour dates. Vote for your favorites, request songs for your next show, and see what artists played at past concerts." />
    <link rel="canonical" href="https://www.setlists.live/" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://www.setlists.live/" />
    <meta property="og:title" content="Concert Setlists | Vote &amp; Request Songs | setlists.live" />
    <meta property="og:description" content="Find concert setlists and upcoming tour dates. Vote for your favorites, request songs for your next show, and see what artists played at past concerts." />
    <meta property="og:image" content="https://www.setlists.live/og-preview.png" />
    <meta property="og:site_name" content="setlists.live" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="https://www.setlists.live/" />
    <meta name="twitter:title" content="Concert Setlists | Vote &amp; Request Songs | setlists.live" />
    <meta name="twitter:description" content="Find concert setlists and upcoming tour dates. Vote for your favorites, request songs for your next show, and see what artists played at past concerts." />
    <meta name="twitter:image" content="https://www.setlists.live/og-preview.png" />

    <!-- Additional SEO -->
    <meta name="keywords" content="concert setlists, live music, setlist predictions, song voting, tour dates, concert schedule, music events" />
    <meta name="author" content="setlists.live" />
    <meta name="theme-color" content="#000000" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${entry}"></script>
  </body>
</html>`;
}
