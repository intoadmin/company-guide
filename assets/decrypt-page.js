// Scroll to anchor with 20px top offset, smooth scrolling, and highlight
function scrollToAnchor(anchorId) {
  var target = document.getElementById(anchorId);
  if (!target) return;

  // Calculate position with 20px top padding
  var rect = target.getBoundingClientRect();
  var currentScroll = window.pageYOffset || document.documentElement.scrollTop;
  var targetPos = currentScroll + rect.top - 20;

  // Clamp to max scroll (don't try to scroll past the bottom)
  var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (targetPos > maxScroll) targetPos = maxScroll;
  if (targetPos < 0) targetPos = 0;

  window.scrollTo({
    top: targetPos,
    behavior: "smooth",
  });

  // Briefly highlight the section
  target.style.transition = "background-color 0.5s";
  target.style.backgroundColor = "rgba(0, 85, 164, 0.1)";
  setTimeout(function () { target.style.backgroundColor = ""; }, 2000);
}

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
        scrollToAnchor(anchorId);
      }, 100);
    }

    // Handle clicks on in-page TOC links (#anchor)
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var anchorId = link.getAttribute("href").substring(1);
        if (anchorId) {
          e.preventDefault();
          scrollToAnchor(anchorId);
          // Update URL hash without jumping
          history.replaceState(null, null, "#" + anchorId);
        }
      });
    });
  } catch (e) {
    console.error("Decryption failed:", e);
    contentEl.innerHTML = '<p style="color:#cc0000;font-size:16px;padding:40px 0;">Failed to decrypt content. Please <a href="' + BASE + '/decrypt.html">log in again</a>.</p>';
  }
})();