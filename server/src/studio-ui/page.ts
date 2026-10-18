export const studioHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Content Studio</title>
<style>
:root{--bg:#0b1220;--card:#121b2e;--line:#24324d;--tx:#e6edf7;--mut:#8fa0bd;--ac:#22d3ee;--warn:#fbbf24;--bad:#f87171;--ok:#4ade80}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 Segoe UI,Arial,sans-serif}
header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--line)}
h1{font-size:18px;margin:0}h2{font-size:15px;margin:0 0 10px;color:var(--ac)}
main{display:grid;grid-template-columns:320px 1fr;gap:16px;padding:16px;max-width:1300px;margin:auto}
@media(max-width:860px){main{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:16px}
input,select,textarea,button{font:inherit;color:var(--tx);background:#0d1526;border:1px solid var(--line);border-radius:8px;padding:8px 10px}
input,textarea,select{width:100%}textarea{min-height:70px;resize:vertical}
button{cursor:pointer;background:#16233d}button:hover{border-color:var(--ac)}
button.pri{background:var(--ac);color:#04212a;border-color:var(--ac);font-weight:600}
button.bad{color:var(--bad)}label{display:block;color:var(--mut);font-size:12px;margin:8px 0 3px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.grow{flex:1}
.assets{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.asset{position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#0d1526}
.asset img{width:100%;height:110px;object-fit:cover;display:block}
.asset span{display:block;font-size:11px;padding:3px 6px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.asset button{position:absolute;top:3px;right:3px;padding:0 6px;font-size:12px}
.slides{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}@media(max-width:1000px){.slides{grid-template-columns:1fr}}
.prev{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}.prev img{width:100%;border-radius:8px;border:1px solid var(--line)}
.msg{padding:8px 10px;border-radius:8px;margin-top:10px;font-size:13px}.msg.ok{background:#0f2a1c;color:var(--ok)}.msg.err{background:#2c1515;color:var(--bad)}
.mut{color:var(--mut);font-size:12px}.hide{display:none}#login{max-width:360px;margin:12vh auto}
</style></head><body>
<div id="login" class="card hide"><h2>Sign in</h2>
<label>Email</label><input id="em" type="email" autocomplete="username">
<label>Password</label><input id="pw" type="password" autocomplete="current-password">
<p><button class="pri" id="go">Sign in</button></p><div id="lmsg"></div></div>
<div id="app" class="hide">
<header><h1>Content Studio · Nurvexa Labs</h1><div class="row"><span class="mut" id="stat"></span><button id="out">Sign out</button></div></header>
<main>
<aside>
 <div class="card"><h2>Assets</h2>
  <div class="row"><select id="kind" style="width:auto"><option value="screenshot">App screenshot</option><option value="logo">Logo</option><option value="reference">Post reference</option></select>
  <input id="aname" placeholder="Label (e.g. quiz screen)" class="grow"></div>
  <p><input id="file" type="file" accept="image/png,image/jpeg,image/webp"></p>
  <button class="pri" id="up">Upload</button><span class="mut"> JPEG, PNG or WebP, 8 MB max</span>
  <div id="amsg"></div><div class="assets" id="assets"></div></div>
 <div class="card"><h2>Topics</h2><div id="tlist"></div>
  <p><button id="newt">+ New topic</button></p></div>
</aside>
<section>
 <div class="card" id="editor"><h2 id="etitle">Select a topic</h2><div id="ebody"></div></div>
</section>
</main></div>
<script src="/studio/app.js"></script></body></html>`;
