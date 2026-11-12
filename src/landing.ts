/** The single-page UI served at `/`. Plain HTML, no build step, no external requests. */
export const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Git Wrapped</title>
<meta name="description" content="Your year in code, wrapped. Shareable recap cards for any GitHub profile.">
<style>
  :root { color-scheme: dark; --bg:#0b0f1a; --panel:#ffffff10; --muted:#94a3b8; --text:#f8fafc; --a:#8b5cf6; --b:#ec4899; --c:#22d3ee; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background:radial-gradient(900px 500px at 85% -10%, #8b5cf633, transparent), radial-gradient(700px 500px at -10% 110%, #22d3ee22, transparent), var(--bg); color:var(--text); min-height:100vh; }
  main { max-width: 980px; margin: 0 auto; padding: 56px 20px 80px; }
  .eyebrow { letter-spacing:.3em; font-weight:700; font-size:13px; text-transform:uppercase; background:linear-gradient(90deg,var(--a),var(--b),var(--c)); -webkit-background-clip:text; background-clip:text; color:transparent; }
  h1 { font-size: clamp(36px, 7vw, 64px); margin: 10px 0 8px; line-height:1.05; }
  p.lead { color: var(--muted); font-size: 18px; max-width: 640px; margin: 0 0 32px; }
  form { display:grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; background: var(--panel); padding: 16px; border-radius: 16px; }
  label { display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
  input, select, button { font: inherit; font-size:16px; color: var(--text); background:#0b0f1a; border:1px solid #ffffff22; border-radius:10px; padding:10px 12px; }
  input:focus, select:focus, button:focus-visible { outline:2px solid var(--a); outline-offset:1px; }
  .preview { margin-top: 24px; border-radius: 16px; overflow:hidden; background: var(--panel); aspect-ratio: 1200/630; }
  .preview img { display:block; width:100%; height:100%; }
  #note { color: var(--muted); font-size: 14px; min-height: 20px; margin: 10px 2px 0; }
  .embed { margin-top: 20px; display:flex; gap:10px; align-items:stretch; }
  pre { flex:1; margin:0; overflow:auto; background:#0b0f1a; border:1px solid #ffffff22; border-radius:10px; padding:12px 14px; font-size:13px; }
  button { cursor:pointer; background:linear-gradient(90deg,var(--a),var(--b)); border:0; font-weight:700; padding:0 22px; }
  footer { margin-top:48px; color:var(--muted); font-size:14px; }
  a { color: var(--c); }
  @media (max-width: 720px) { form { grid-template-columns: 1fr 1fr; } label:first-child { grid-column: 1 / -1; } .embed { flex-direction:column; } button { padding: 12px; } }
</style>
</head>
<body>
<main>
  <div class="eyebrow">Git Wrapped</div>
  <h1>Your year in code, wrapped.</h1>
  <p class="lead">Beautiful, shareable recap cards for any GitHub profile: languages, streaks, coding rhythm and your dev personality.</p>

  <form id="form" onsubmit="return false">
    <label>GitHub username<input id="user" placeholder="octocat" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="39"></label>
    <label>Year<input id="year" type="number" min="2008" max="2100"></label>
    <label>Card<select id="card">
      <option value="summary">Summary</option>
      <option value="languages">Languages</option>
      <option value="rhythm">Rhythm</option>
      <option value="heatmap">Heatmap</option>
      <option value="personality">Personality</option>
    </select></label>
    <label>Theme<select id="theme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
  </form>
  <p id="note"></p>

  <div class="preview"><img id="preview" alt="Preview of your Git Wrapped card" width="1200" height="630"></div>

  <div class="embed">
    <pre><code id="embed"></code></pre>
    <button id="copy" type="button">Copy</button>
  </div>

  <footer>Open source under the MIT license. <a href="https://github.com/guilhermeoliveirabrito/gitwrapped">View on GitHub</a></footer>
</main>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var user = $('user'), year = $('year'), card = $('card'), theme = $('theme');
  var img = $('preview'), embed = $('embed'), note = $('note'), copy = $('copy');
  var timer;
  year.value = new Date().getFullYear();

  function path() {
    var u = user.value.trim().replace(/^@/, '');
    var qs = new URLSearchParams({ theme: theme.value });
    if (u) {
      qs.set('user', u);
      qs.set('year', year.value);
      qs.set('tz', String(-new Date().getTimezoneOffset() / 60));
    }
    return (u ? '/api/card/' : '/api/demo/') + card.value + '?' + qs.toString();
  }

  function update() {
    var p = path();
    img.src = p;
    embed.textContent = '![Git Wrapped](' + location.origin + p + ')';
    note.textContent = user.value.trim() ? '' : 'Showing sample data. Type a GitHub username to see your own.';
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(update, 400); }
  user.addEventListener('input', schedule);
  year.addEventListener('input', schedule);
  card.addEventListener('change', update);
  theme.addEventListener('change', update);
  copy.addEventListener('click', function () {
    navigator.clipboard.writeText(embed.textContent).then(function () {
      copy.textContent = 'Copied!';
      setTimeout(function () { copy.textContent = 'Copy'; }, 1500);
    });
  });
  update();
})();
</script>
</body>
</html>
`;
