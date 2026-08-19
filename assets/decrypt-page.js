// Decrypt page content using session-derived key
(async function () {
  var AUTH_CONFIG = window.AUTH_CONFIG || {};
  var PAGE_DATA = window.PAGE_DATA || {};
  var contentEl = document.getElementById("content");
  var BASE = "/company-guide";

  // Check if authed
  var password = sessionStorage.getItem("pw");
  if (!password) {
    window.location.href = BASE + "/decrypt.html?redirect=" + encodeURIComponent(window.location.pathname + window.location.hash);
    return;
  }

  try {
    // Derive AES key from password + KDF salt
    var enc = new TextEncoder();
    var keyMaterial = await crypto.subtle.importKey(
      "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
    );
    var key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode(AUTH_CONFIG.kdf_salt), iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false, ["decrypt"]
    );

    // Decrypt
    var iv = new Uint8Array(PAGE_DATA.iv.match(/.{2}/g).map(function (h) { return parseInt(h, 16); }));
    var ct = new Uint8Array(PAGE_DATA.ciphertext.match(/.{2}/g).map(function (h) { return parseInt(h, 16); }));
    var decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
    var html = new TextDecoder().decode(decrypted);

    // Render decrypted HTML
    contentEl.innerHTML = html;

    // Highlight active nav link
    var path = window.location.pathname;
    var links = document.querySelectorAll(".nav-links a");
    links.forEach(function (link) {
      var href = link.getAttribute("href");
      if (href && path.includes(href)) {
        link.classList.add("active");
      }
    });

    // Scroll to anchor if present in URL (from search result click)
    var hash = window.location.hash;
    if (hash) {
      var anchorId = hash.substring(1);
      // Small delay to ensure DOM is ready
      setTimeout(function () {
        var target = document.getElementById(anchorId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          // Briefly highlight the section
          target.style.transition = "background-color 0.5s";
          target.style.backgroundColor = "rgba(0, 85, 164, 0.1)";
          setTimeout(function () { target.style.backgroundColor = ""; }, 2000);
        }
      }, 100);
    }
  } catch (e) {
    console.error("Decryption failed:", e);
    contentEl.innerHTML = '<p style="color:#cc0000;font-size:16px;padding:40px 0;">Failed to decrypt content. Please <a href="' + BASE + '/decrypt.html">log in again</a>.</p>';
  }
})();