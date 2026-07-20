/**
 * newauth-button.js
 * Hosted sign-in button for newauth SSO.
 *
 * Usage:
 *   <script
 *     src="https://auth.newauth.io/static/js/newauth-button.js"
 *     data-client-id="YOUR_CLIENT_ID"
 *     data-redirect-uri="https://yourapp.com/auth/callback"
 *     data-scope="openid profile"
 *     data-label="Sign in with newauth"
 *     data-theme="light">
 *   </script>
 *
 * Optional custom container:
 *   <div id="newauth-signin" data-label="..." data-theme="dark"></div>
 *   <script src="..." data-client-id="..." data-redirect-uri="..."></script>
 */
(function() {
  'use strict';

  // ── Read config from script tag ─────────────────────────────
  var scripts  = document.querySelectorAll('script[data-client-id]');
  var scriptEl = scripts[scripts.length - 1];

  var config = {
    clientId:    scriptEl.getAttribute('data-client-id')    || '',
    redirectUri: scriptEl.getAttribute('data-redirect-uri') || window.location.origin + '/auth/callback',
    scope:       scriptEl.getAttribute('data-scope')        || 'openid profile',
    label:       scriptEl.getAttribute('data-label')        || 'Sign in with newauth',
    theme:       scriptEl.getAttribute('data-theme')        || 'light',
    issuer:      scriptEl.getAttribute('data-issuer')       || 'https://auth.newauth.io/vn',
    images:      5  // /image/-1 through /image/-5
  };

  if (!config.clientId) {
    console.error('[newauth] data-client-id is required');
    return;
  }

  // ── PKCE helpers ────────────────────────────────────────────
  function b64u(buf) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function generateVerifier() {
    var a = new Uint8Array(32);
    crypto.getRandomValues(a);
    return b64u(a);
  }

  function generateChallenge(verifier) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
      .then(function(buf) { return b64u(buf); });
  }

  function generateState() {
    var a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return b64u(a);
  }

  // ── Start OIDC flow ─────────────────────────────────────────
  function startFlow() {
    var verifier = generateVerifier();
    generateChallenge(verifier).then(function(challenge) {
      var state = generateState();
      var key   = 'na_' + config.clientId;
      sessionStorage.setItem(key + '_v', verifier);
      sessionStorage.setItem(key + '_s', state);
      var params = new URLSearchParams({
        client_id:             config.clientId,
        redirect_uri:          config.redirectUri,
        response_type:         'code',
        scope:                 config.scope,
        state:                 state,
        code_challenge:        challenge,
        code_challenge_method: 'S256'
      });
      window.location.href = config.issuer + '/oauth2/authorize?' + params;
    });
  }

  // ── Retrieve PKCE values (call from your callback page) ─────
  // window.newauthGetPkce(clientId) → { verifier, state }
  window.newauthGetPkce = function(clientId) {
    var key = 'na_' + (clientId || config.clientId);
    var result = {
      verifier: sessionStorage.getItem(key + '_v') || '',
      state:    sessionStorage.getItem(key + '_s') || ''
    };
    sessionStorage.removeItem(key + '_v');
    sessionStorage.removeItem(key + '_s');
    return result;
  };

  // ── Build button styles ─────────────────────────────────────
  var dark  = config.theme === 'dark';
  var styles = {
    btn: [
      'display:inline-flex',
      'align-items:center',
      'gap:10px',
      'padding:10px 18px',
      'background:' + (dark ? '#1a1a1a' : '#fff'),
      'border:1.5px solid ' + (dark ? '#444' : '#c0c0c0'),
      'border-radius:8px',
      'font-size:15px',
      'font-weight:600',
      'color:' + (dark ? '#fff' : '#2d2d2d'),
      'cursor:pointer',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'box-shadow:0 1px 4px rgba(0,0,0,.06)',
      'transition:border-color .15s,box-shadow .15s,background .15s',
      'position:relative',
      'overflow:hidden'
    ].join(';'),
    imgWrap: [
      'width:28px',
      'height:28px',
      'border-radius:50%',
      'position:relative',
      'overflow:hidden',
      'flex:none',
      'border:1px solid rgba(0,0,0,.08)'
    ].join(';'),
    img: [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'object-fit:cover',
      'opacity:0',
      'transition:opacity 0.4s ease-in-out'
    ].join(';')
  };

  // ── Build button HTML ───────────────────────────────────────
  var imgWrap = document.createElement('span');
  imgWrap.setAttribute('style', styles.imgWrap);
  imgWrap.setAttribute('aria-hidden', 'true');

  var imgEls = [];
  for (var i = 1; i <= config.images; i++) {
    var img = document.createElement('img');
    img.src = config.issuer.replace('/vn', '') + '/image/-' + i;
    img.alt = '';
    img.setAttribute('style', styles.img);
    if (i === 1) img.style.opacity = '1';
    imgWrap.appendChild(img);
    imgEls.push(img);
  }

  var label = document.createElement('span');
  label.textContent = config.label;

  var btn = document.createElement('button');
  btn.setAttribute('style', styles.btn);
  btn.setAttribute('type', 'button');
  btn.appendChild(imgWrap);
  btn.appendChild(label);
  btn.addEventListener('click', startFlow);

  // Hover effect
  btn.addEventListener('mouseenter', function() {
    btn.style.borderColor = '#3d8b8b';
    btn.style.boxShadow   = '0 4px 16px rgba(61,139,139,.15)';
    btn.style.background  = dark ? '#222' : 'rgba(61,139,139,.04)';
  });
  btn.addEventListener('mouseleave', function() {
    btn.style.borderColor = dark ? '#444' : '#c0c0c0';
    btn.style.boxShadow   = '0 1px 4px rgba(0,0,0,.06)';
    btn.style.background  = dark ? '#1a1a1a' : '#fff';
  });

  // ── Cycle images ────────────────────────────────────────────
  var cur = 0;
  setInterval(function() {
    imgEls[cur].style.opacity = '0';
    cur = (cur + 1) % imgEls.length;
    imgEls[cur].style.opacity = '1';
  }, 1500);

  // ── Mount button ────────────────────────────────────────────
  // Try custom container first, else insert after script tag
  var container = document.getElementById('newauth-signin');
  if (container) {
    // Honour per-container overrides
    var cLabel = container.getAttribute('data-label');
    var cTheme = container.getAttribute('data-theme');
    if (cLabel) label.textContent = cLabel;
    if (cTheme && cTheme !== config.theme) {
      // Re-apply theme overrides
      var isDark = cTheme === 'dark';
      btn.style.background   = isDark ? '#1a1a1a' : '#fff';
      btn.style.borderColor  = isDark ? '#444'    : '#c0c0c0';
      btn.style.color        = isDark ? '#fff'    : '#2d2d2d';
    }
    container.appendChild(btn);
  } else {
    // Insert immediately after the script tag
    scriptEl.parentNode.insertBefore(btn, scriptEl.nextSibling);
  }

  // ── Expose public API ───────────────────────────────────────
  window.newauth = window.newauth || {};
  window.newauth.signIn  = startFlow;
  window.newauth.getPkce = window.newauthGetPkce;

})();