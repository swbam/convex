// Run before the first paint. Every visitor/crawler receives the same HTML;
// JavaScript-disabled and failed-startup visits retain the readable page.
export const APP_STARTUP_SCRIPT = `(function () {
  if (!window.MutationObserver) return;
  var html = document.documentElement;
  var observer;
  var finished = false;
  html.setAttribute('data-app-starting', '');
  function finish() {
    if (finished) return;
    finished = true;
    html.removeAttribute('data-app-starting');
    clearTimeout(timeout);
    if (observer) observer.disconnect();
    document.removeEventListener('DOMContentLoaded', watch);
    var screen = document.getElementById('app-startup');
    if (screen) screen.remove();
  }
  function watch() {
    if (finished) return;
    var root = document.getElementById('root');
    function mounted() {
      return !root || !root.querySelector(':scope > .seo-prerender');
    }
    if (mounted()) { finish(); return; }
    observer = new MutationObserver(function () { if (mounted()) finish(); });
    observer.observe(root, { childList: true });
  }
  var timeout = setTimeout(finish, 5000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, { once: true });
  else watch();
})();`;

export const APP_STARTUP_STYLES = `
#app-startup{display:none}
html[data-app-starting] #root>.seo-prerender{display:none}
html[data-app-starting] #app-startup{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:hsl(var(--background,0 0% 4%));color:hsl(var(--foreground,0 0% 96%))}
.app-startup-spinner{width:20px;height:20px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:app-startup-spin .75s linear infinite}
@keyframes app-startup-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.app-startup-spinner{animation:none}}
`;

export const APP_STARTUP_MARKUP = '<div id="app-startup" role="status" aria-label="Loading setlists.live"><span class="app-startup-spinner" aria-hidden="true"></span></div>';
