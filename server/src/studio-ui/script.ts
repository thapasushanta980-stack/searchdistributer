export const studioJs = String.raw`(function () {
  var B = "/api/admin/v1";
  var $ = function (id) { return document.getElementById(id); };
  var st = { assets: [], topics: [], cur: -1 };

  function api(method, path, body, raw) {
    var h = { "x-sd-admin": "1" };
    var opt = { method: method, headers: h, credentials: "same-origin" };
    if (raw) { h["Content-Type"] = raw.type; opt.body = raw; }
    else if (body !== undefined) { h["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    return fetch(B + path, opt).then(function (r) {
      if (r.status === 204) return null;
      return r.json().then(function (j) {
        if (!r.ok) { var e = new Error((j.error && j.error.message) || "Request failed"); e.status = r.status; e.fields = j.error && j.error.fields; throw e; }
        return j;
      });
    });
  }
  function msg(el, text, ok) { el.innerHTML = ""; if (!text) return; var d = document.createElement("div"); d.className = "msg " + (ok ? "ok" : "err"); d.textContent = text; el.appendChild(d); }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

  function showLogin() { $("app").classList.add("hide"); $("login").classList.remove("hide"); }
  function showApp() { $("login").classList.add("hide"); $("app").classList.remove("hide"); }

  $("go").onclick = function () {
    api("POST", "/auth/login", { email: $("em").value, password: $("pw").value }).then(function () { $("pw").value = ""; boot(); })
      .catch(function (e) { msg($("lmsg"), e.message, false); });
  };
  $("out").onclick = function () { api("POST", "/auth/logout").then(showLogin); };

  function loadAll() {
    return Promise.all([api("GET", "/studio/assets"), api("GET", "/studio/topics"), api("GET", "/studio/status")]).then(function (r) {
      st.assets = r[0].data; st.topics = r[1].data;
      var s = r[2].data;
      $("stat").textContent = (s.zernioConfigured ? "Zernio connected" : "Zernio NOT configured") + " | daily worker: " + s.workerMode + (s.workerMode !== "off" ? " after " + s.workerHourNpt + ":00 NPT" : "");
      if (st.cur >= st.topics.length) st.cur = -1;
      drawAssets(); drawTopics(); drawEditor();
    });
  }

  function boot() {
    api("GET", "/auth/me").then(function () { showApp(); return loadAll(); }).catch(function (e) { if (e.status === 401) showLogin(); else { showApp(); alert(e.message); } });
  }

  function drawAssets() {
    var box = $("assets"); box.innerHTML = "";
    st.assets.forEach(function (a) {
      var d = document.createElement("div"); d.className = "asset";
      d.innerHTML = '<img src="' + B + "/studio/assets/" + a.id + '/file" alt=""><span>' + esc(a.kind + ": " + a.name) + '</span><button class="bad" title="Delete">x</button>';
      d.querySelector("button").onclick = function () {
        if (!confirm("Delete this asset? Slides using it fall back to text-only.")) return;
        api("DELETE", "/studio/assets/" + a.id).then(loadAll).catch(function (e) { msg($("amsg"), e.message, false); });
      };
      box.appendChild(d);
    });
    if (!st.assets.length) box.innerHTML = '<p class="mut" style="grid-column:1/-1">No assets yet.</p>';
  }

  $("up").onclick = function () {
    var f = $("file").files[0];
    if (!f) return msg($("amsg"), "Choose an image first.", false);
    api("POST", "/studio/assets?kind=" + encodeURIComponent($("kind").value) + "&name=" + encodeURIComponent($("aname").value || f.name), null, f)
      .then(function () { $("file").value = ""; $("aname").value = ""; msg($("amsg"), "Uploaded.", true); return loadAll(); })
      .catch(function (e) { msg($("amsg"), e.message, false); });
  };

  function drawTopics() {
    var box = $("tlist"); box.innerHTML = "";
    st.topics.forEach(function (t, i) {
      var b = document.createElement("button");
      b.style.cssText = "display:block;width:100%;text-align:left;margin-bottom:6px" + (i === st.cur ? ";border-color:var(--ac)" : "");
      b.textContent = (t.enabled === false ? "(off) " : "") + t.slides[0].title;
      b.onclick = function () { st.cur = i; drawTopics(); drawEditor(); };
      box.appendChild(b);
    });
  }

  $("newt").onclick = function () {
    var id = prompt("Short id (lowercase letters, numbers, dashes):", "new-topic");
    if (!id) return;
    var sl = function (n) { return { kicker: n + " / 3", title: "Slide " + n + " headline", lines: ["Supporting line"] }; };
    st.topics.push({ id: id.toLowerCase(), slides: [sl(1), sl(2), sl(3)], caption: "Write your caption. nurvexalabs.com #nurvexalabs", enabled: false });
    st.cur = st.topics.length - 1; drawTopics(); drawEditor();
  };

  function shots(sel) {
    var o = '<option value="">No screenshot (text slide)</option>';
    st.assets.filter(function (a) { return a.kind === "screenshot"; }).forEach(function (a) { o += '<option value="' + a.id + '"' + (a.id === sel ? " selected" : "") + ">" + esc(a.name) + "</option>"; });
    return o;
  }

  function drawEditor() {
    var t = st.topics[st.cur], eb = $("ebody");
    if (!t) { $("etitle").textContent = "Select a topic"; eb.innerHTML = '<p class="mut">Pick a topic on the left, or create a new one.</p>'; return; }
    $("etitle").textContent = "Topic: " + t.id;
    var h = '<label><input type="checkbox" id="en" style="width:auto"' + (t.enabled === false ? "" : " checked") + '> Include in the daily automation</label><div class="slides">';
    t.slides.forEach(function (s, i) {
      h += '<div><label>Slide ' + (i + 1) + ' label</label><input data-k="kicker" data-i="' + i + '" value="' + esc(s.kicker) + '">' +
        '<label>Headline</label><textarea data-k="title" data-i="' + i + '">' + esc(s.title) + "</textarea>" +
        '<label>Lines (one per line)</label><textarea data-k="lines" data-i="' + i + '">' + esc(s.lines.join("\n")) + "</textarea>" +
        '<label>Screenshot</label><select data-k="assetId" data-i="' + i + '">' + shots(s.assetId) + "</select></div>";
    });
    h += '</div><label>Caption (hashtags and link)</label><textarea id="cap" style="min-height:90px">' + esc(t.caption) + "</textarea>" +
      '<div class="row" style="margin-top:12px"><button id="sv" class="pri">Save topics</button><button id="pv">Preview slides</button>' +
      '<button id="pd">Send as TikTok draft</button><button id="pl" class="bad">Publish live now</button><button id="dl" class="bad">Delete topic</button></div>' +
      '<div id="emsg"></div><div class="prev" id="prev"></div>';
    eb.innerHTML = h;
    $("sv").onclick = function () { save().then(function () { msg($("emsg"), "Saved.", true); }).catch(fail); };
    $("pv").onclick = preview;
    $("pd").onclick = function () { postNow("draft"); };
    $("pl").onclick = function () { if (confirm("Publish this carousel publicly on TikTok right now?")) postNow("publish"); };
    $("dl").onclick = function () {
      if (!confirm("Delete this topic?")) return;
      st.topics.splice(st.cur, 1); st.cur = -1;
      (st.topics.length ? api("PUT", "/studio/topics", st.topics) : Promise.reject(new Error("Keep at least one topic."))).then(loadAll).catch(fail);
    };
  }

  function fail(e) {
    msg($("emsg"), e.message + (e.fields ? " " + JSON.stringify(e.fields) : ""), false);
  }

  function collect() {
    var t = st.topics[st.cur];
    document.querySelectorAll("[data-k]").forEach(function (el) {
      var s = t.slides[+el.getAttribute("data-i")], k = el.getAttribute("data-k");
      if (k === "lines") s.lines = el.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      else if (k === "assetId") { if (el.value) s.assetId = el.value; else delete s.assetId; }
      else s[k] = el.value;
    });
    t.caption = $("cap").value; t.enabled = $("en").checked;
    return t;
  }

  function save() { collect(); return api("PUT", "/studio/topics", st.topics).then(function (r) { st.topics = r.data; drawTopics(); }); }

  function preview() {
    msg($("emsg"), "Rendering...", true);
    api("POST", "/studio/preview", collect()).then(function (r) {
      msg($("emsg"), "", true);
      $("prev").innerHTML = r.data.map(function (u) { return '<img src="' + u + '" alt="">'; }).join("");
    }).catch(fail);
  }

  function postNow(mode) {
    msg($("emsg"), mode === "draft" ? "Sending draft..." : "Publishing...", true);
    save().then(function () { return api("POST", "/studio/post", { topicId: st.topics[st.cur].id, mode: mode }); })
      .then(function () { msg($("emsg"), mode === "draft" ? "Draft sent to your TikTok inbox. Open the app to finish it." : "Published to TikTok.", true); })
      .catch(fail);
  }

  boot();
})();`;
