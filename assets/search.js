// Client-side search — decrypts all pages, indexes by section, links to anchors
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

  var searchIndex = []; // { url, title, sectionTitle, anchor, text }
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

  function stripHtml(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  // Split decrypted HTML into sections by headings (h1-h4)
  // Each section gets: sectionTitle, anchor (heading id), text content
  function splitIntoSections(html, pageTitle) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    var headings = doc.querySelectorAll("h1, h2, h3, h4");
    var sections = [];

    if (headings.length === 0) {
      // No headings — index the whole page
      sections.push({
        sectionTitle: pageTitle,
        anchor: "",
        text: stripHtml(html).toLowerCase(),
      });
      return sections;
    }

    for (var i = 0; i < headings.length; i++) {
      var heading = headings[i];
      var headingId = heading.id || "";
      var headingText = heading.textContent || heading.innerText || "";
      var level = parseInt(heading.tagName.substring(1));

      // Collect all text until the next heading of same or higher level
      var textParts = [headingText];
      var node = heading.nextElementSibling;
      while (node) {
        var tag = node.tagName.toLowerCase();
        if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
          // Stop at next heading — but include h3/h4 content under h2
          var nodeLevel = parseInt(tag.substring(1));
          if (nodeLevel <= level) break;
        }
        textParts.push(node.textContent || node.innerText || "");
        node = node.nextElementSibling;
      }

      var fullText = textParts.join(" ").toLowerCase();
      sections.push({
        sectionTitle: headingText,
        anchor: headingId,
        text: fullText,
      });
    }

    return sections;
  }

  async function buildIndex() {
    if (loaded) return;
    searchResults.innerHTML = '<div class="search-hint">Loading search index…</div>';
    try {
      for (var i = 0; i < PAGES.length; i++) {
        var content = await decryptPage(PAGES[i].url);
        if (!content) continue;
        var sections = splitIntoSections(content, PAGES[i].title);
        for (var s = 0; s < sections.length; s++) {
          searchIndex.push({
            url: PAGES[i].url,
            title: PAGES[i].title,
            sectionTitle: sections[s].sectionTitle,
            anchor: sections[s].anchor,
            text: sections[s].text,
          });
        }
      }
      loaded = true;
      searchResults.innerHTML = "";
    } catch (e) {
      searchResults.innerHTML = '<div class="search-hint">Search unavailable</div>';
    }
  }

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
        var start = Math.max(0, idx - 40);
        var end = Math.min(entry.text.length, idx + query.length + 60);
        var snippet = (start > 0 ? "…" : "") + entry.text.substring(start, end) + (end < entry.text.length ? "…" : "");
        var link = entry.url + (entry.anchor ? "#" + entry.anchor : "");
        results.push({ link: link, title: entry.title, sectionTitle: entry.sectionTitle, snippet: snippet });
      }
    }

    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-hint">No results found</div>';
      return;
    }

    var html = "";
    for (var j = 0; j < results.length; j++) {
      var r = results[j];
      html += '<a href="' + r.link + '" class="search-result">' +
        '<div class="search-result-title">' + r.title + " › " + r.sectionTitle + "</div>" +
        '<div class="search-result-snippet">' + r.snippet + "</div></a>";
    }
    searchResults.innerHTML = html;
  }

  searchInput.addEventListener("focus", function () {
    if (!loaded) buildIndex();
  });

  var debounceTimer;
  searchInput.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      search(searchInput.value);
    }, 200);
  });

  // Close search when clicking outside
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".search-wrapper")) {
      searchResults.innerHTML = "";
      searchInput.value = "";
    }
  });
})();