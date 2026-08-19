// Client-side search — decrypts all pages in memory and searches through them
(async function () {
  var AUTH_CONFIG = window.AUTH_CONFIG || {};
  var BASE = "/company-guide";
  var searchInput = document.getElementById("search-input");
  var searchResults = document.getElementById("search-results");
  if (!searchInput || !searchResults) return;

  var password = sessionStorage.getItem("pw");
  if (!password) return;

  var PAGES = [
    { url: BASE + "/index.html", title: "Home" },
    { url: BASE + "/onboarding.html", title: "Developer Onboarding Guide" },
    { url: BASE + "/handbook.html", title: "Company Handbook" },
    { url: BASE + "/developer-policy.html", title: "Developer Policy Handbook" },
  ];

  var searchIndex = [];
  var loaded = false;

  async function decryptPage(url) {
    var resp = await fetch(url);
    var html = await resp.text();
    var match = html.match(/var PAGE_DATA = ({.*?});/);
    if (!match) return null;
    var data = JSON.parse(match[1]);
    var enc = new TextEncoder();
    var keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    var key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode(AUTH_CONFIG.kdf_salt), iterations: 100000, hash: "SHA-256" },
      keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
    );
    var iv = new Uint8Array(data.iv.match(/.{2}/g).map(function (h) { return parseInt(h, 16); }));
    var ct = new Uint8Array(data.ciphertext.match(/.{2}/g).map(function (h) { return parseInt(h, 16); }));
    var decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
    return new TextDecoder().decode(decrypted);
  }

  // Strip HTML tags for search text
  function stripHtml(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  // Build search index from decrypted content
  async function buildIndex() {
    if (loaded) return;
    searchResults.innerHTML = '<div class="search-hint">Loading search index…</div>';
    try {
      for (var i = 0; i < PAGES.length; i++) {
        var content = await decryptPage(PAGES[i].url);
        if (!content) continue;
        var text = stripHtml(content).toLowerCase();
        searchIndex.push({ url: PAGES[i].url, title: PAGES[i].title, text: text, html: content });
      }
      loaded = true;
      searchResults.innerHTML = "";
    } catch (e) {
      searchResults.innerHTML = '<div class="search-hint">Search unavailable</div>';
    }
  }

  // Search through index
  function search(query) {
    query = query.trim().toLowerCase();
    if (!query) {
      searchResults.innerHTML = "";
      return;
    }

    var results = [];
    for (var i = 0; i < searchIndex.length; i++) {
      var entry = searchIndex[i];
      var idx = entry.text.indexOf(query);
      if (idx !== -1) {
        // Get snippet around match
        var start = Math.max(0, idx - 40);
        var end = Math.min(entry.text.length, idx + query.length + 60);
        var snippet = (start > 0 ? "…" : "") + entry.text.substring(start, end) + (end < entry.text.length ? "…" : "");
        results.push({ url: entry.url, title: entry.title, snippet: snippet });
      }
    }

    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-hint">No results found</div>';
      return;
    }

    var html = "";
    for (var j = 0; j < results.length; j++) {
      var r = results[j];
      html += '<a href="' + r.url + '" class="search-result">' +
        '<div class="search-result-title">' + r.title + '</div>' +
        '<div class="search-result-snippet">' + r.snippet + '</div></a>';
    }
    searchResults.innerHTML = html;
  }

  // Load index on first focus
  searchInput.addEventListener("focus", function () {
    if (!loaded) buildIndex();
  });

  // Search on input
  var debounceTimer;
  searchInput.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      search(searchInput.value);
    }, 200);
  });
})();