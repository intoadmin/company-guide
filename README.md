# INTO INFO — Company Guide

Encrypted documentation site hosted on GitHub Pages.

## Access

Visit the Pages URL and enter the password provided by your administrator.

## Content

All page content is AES-256-GCM encrypted. The plaintext password is not stored
in this repository — only a salted SHA-256 hash for verification and a PBKDF2
salt for key derivation.

## Architecture

- `decrypt.html` — login page (verifies password hash, derives AES key)
- `*.html` — encrypted page content (ciphertext only in source)
- `assets/auth-config.js` — password hash + KDF salt (no plaintext)
- `assets/decrypt-page.js` — client-side decryption logic
- `assets/style.css` — site styling
- `assets/logo.svg` — company logo
