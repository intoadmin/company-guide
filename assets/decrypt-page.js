// Decrypt page content using session-derived key
// Key is re-derived from sessionStorage-stored password
(async function () {
  var AUTH_CONFIG = window.AUTH_CONFIG || {};
  var PAGE_DATA = window.PAGE_DATA || {};
  var contentEl = document.getElementById("content");

  // Get password from sessionStorage (stored by decrypt.html on login)
  var password = sessionStorage.getItem("pw");
  if (!password) {
    // Not authed — redirect to login
    var currentPath = window.location.pathname;
    var base = window.location.origin;
    window.location.href = base + "/decrypt.html?redirect=" + encodeURIComponent(currentPath);
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
    contentEl.querySelector(".decrypting-msg")?.remove();

    // Highlight active nav link
    var path = window.location.pathname;
    var links = document.querySelectorAll(".nav-links a");
    links.forEach(function (link) {
      var href = link.getAttribute("href");
      if (href && path.endsWith(href.replace(/^\//, ""))) {
        link.classList.add("active");
      }
    });
  } catch (e) {
    console.error("Decryption failed:", e);
    contentEl.innerHTML = '<p style="color:#cc0000;font-size:16px;padding:40px 0;">Failed to decrypt content. Please <a href="/decrypt.html">log in again</a>.</p>';
  }
})();