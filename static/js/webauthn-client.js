// ═══════════════════════════════════════════════════════════════════
// webauthn-client.js — Session 13 destination-binding
//
// No external library needed — navigator.credentials.create()/.get()
// are native browser APIs. This file only handles: (a) base64url
// encode/decode of the binary fields the API works with, since
// ArrayBuffers don't serialize to JSON on their own, and (b) the two
// ceremony flows (login-gate, silent-registration).
//
// Uses submitFormAjax-style patterns to stay consistent with the rest
// of the codebase's AJAX conventions (seen in the image-click submit
// JS) rather than introducing fetch()-based code with a different
// error-handling shape. Adjust the actual request-sending lines below
// if submitFormAjax itself needs to be used instead of a raw XHR/fetch
// — I don't have that helper's implementation, only its call signature.
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  function base64urlToBuffer(base64url) {
    var padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    var base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var buffer = new ArrayBuffer(raw.length);
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return buffer;
  }

  function bufferToBase64url(buffer) {
    var bytes = new Uint8Array(buffer);
    var str = '';
    for (var i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function supportsWebAuthn() {
    return !!(window.PublicKeyCredential && navigator.credentials
        && navigator.credentials.create && navigator.credentials.get);
  }

  // ── Login gate — used on the webauthnRequired page ──────────────────
  // MUST be called directly from a user gesture handler (click/tap) —
  // navigator.credentials.get() will reject otherwise. This is why the
  // webauthnRequired view has exactly one explicit "Continue" tap rather
  // than attempting this automatically on page load.
  window.NewauthWebAuthn = window.NewauthWebAuthn || {};

  window.NewauthWebAuthn.attemptLogin = function (opts, onSuccess, onFailure) {
    if (!supportsWebAuthn()) { onFailure('unsupported'); return; }

    var publicKey = {
      challenge: base64urlToBuffer(opts.challengeB64),
      rpId: opts.rpId,
      userVerification: 'discouraged',   // presence only — see product
                                          // decision: no fingerprint
                                          // requirement, tap is enough
      allowCredentials: (opts.allowCredentialIds || []).map(function (id) {
        return { type: 'public-key', id: base64urlToBuffer(id) };
      }),
      timeout: 60000
    };

    navigator.credentials.get({ publicKey: publicKey }).then(function (assertion) {
      var responseJson = JSON.stringify({
        id: assertion.id,
        rawId: bufferToBase64url(assertion.rawId),
        type: assertion.type,
        response: {
          clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
          authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
          signature: bufferToBase64url(assertion.response.signature),
          userHandle: assertion.response.userHandle
              ? bufferToBase64url(assertion.response.userHandle) : null
        }
      });

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/vn/webauthn/login/verify', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Server response is the actual doAuthenticate page HTML
          // (forwardtoAuthenticateUser re-entered and passed the gate) —
          // simplest correct behavior is a full page replace, matching
          // how a normal form POST navigation would have worked here.
          document.open(); document.write(xhr.responseText); document.close();
        } else {
          onFailure('verify_failed');
        }
      };
      xhr.onerror = function () { onFailure('network_error'); };
      xhr.send(JSON.stringify({ assertionResponseJson: responseJson }));

    }).catch(function (err) {
      // Wrong origin, no matching credential, user cancelled, etc. —
      // deliberately generic. Do NOT branch UI behavior on err.name;
      // that's exactly the kind of oracle a relay attacker could probe.
      onFailure('ceremony_failed');
    });
  };

  // ── Silent registration — piggybacked on the click that just
  //    succeeded. Called from the existing click-submit success
  //    handler; see PATCHES.md item on the click-submit JS. ────────────
  window.NewauthWebAuthn.attemptSilentRegistration = function (opts) {
    if (!supportsWebAuthn()) return;         // no-op, never blocks anything
    if (!opts || !opts.challengeB64) return; // means gate already had a
                                              // credential on file — nothing to do

    var publicKey = {
      challenge: base64urlToBuffer(opts.challengeB64),
      rp: { id: opts.rpId, name: opts.rpName },
      user: {
        id: base64urlToBuffer(opts.userHandleB64),
        name: opts.username,
        displayName: opts.displayName
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -35 }   // ES384
      ],
      authenticatorSelection: {
        userVerification: 'discouraged',
        residentKey: 'preferred'
      },
      timeout: 60000
    };

    // Deliberately fire-and-forget: this must never delay or block the
    // navigation the user is already doing after a successful login.
    navigator.credentials.create({ publicKey: publicKey }).then(function (credential) {
      var responseJson = JSON.stringify({
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
          attestationObject: bufferToBase64url(credential.response.attestationObject)
        }
      });

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/vn/webauthn/register/verify', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      // No onload/onerror handling needed — silent, best-effort, and the
      // user has already moved on to wherever their login was taking them.
      xhr.send(JSON.stringify({
        credentialResponseJson: responseJson,
        deviceLabel: (navigator.userAgentData && navigator.userAgentData.platform)
            || navigator.platform || 'unknown device'
      }));

    }).catch(function () {
      // Swallow silently — registration is a pure enhancement. A
      // dismissed prompt, an unsupported platform authenticator, or any
      // other failure here must never surface to the user or affect
      // the login flow they're already in.
    });
  };

  // ═══════════════════════════════════════════════════════════════════
  // Fix for the innerHTML-doesn't-execute-<script> bug (found testing
  // Session 13). This app swaps fragment responses in via
  // `#app.innerHTML = xmlhttp.responseText` (confirmed in
  // submitFormAjax) — browsers never execute <script> tags injected
  // that way. So NOTHING in this file can be data that arrives via an
  // inline <script> block in a swapped fragment. Everything below reads
  // data-* attributes instead (attributes DO survive an innerHTML swap)
  // and is called EXPLICITLY by the dispatcher, matching the existing
  // afterauthscreenload()/afteranyscreenload() convention already used
  // throughout this codebase.
  // ═══════════════════════════════════════════════════════════════════

  var _pendingRegOptions = null;  // internal state, NOT a global var —
                                   // avoids the exact bug this section fixes

  // ── Called by the dispatcher whenever #webauthnGate appears in a
  //    freshly-swapped fragment (new dispatcher branch needed — see
  //    JS_DISPATCHER_PATCH.md). Reads the challenge from data-*
  //    attributes and wires the Continue/fallback buttons. ─────────────
  window.NewauthWebAuthn.initGate = function () {
    var gateEl = document.getElementById('webauthnGate');
    if (!gateEl) return;

    var allowRaw = gateEl.getAttribute('data-allow-credentials') || '';
    var opts = {
      challengeB64: gateEl.getAttribute('data-challenge'),
      rpId: gateEl.getAttribute('data-rp-id'),
      allowCredentialIds: allowRaw.length ? allowRaw.split(',') : []
    };

    var continueBtn = document.getElementById('webauthnContinueBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', function () {
        // This click IS the user gesture navigator.credentials.get()
        // needs — call it synchronously from inside this handler.
        NewauthWebAuthn.attemptLogin(
          opts,
          function onSuccess() { /* handled inside attemptLogin via document.write full-page replace */ },
          function onFailure(reason) {
            var errEl = document.getElementById('webauthnGateError');
            if (errEl) errEl.style.display = 'block';
          }
        );
      });
    }

    var fallbackLink = document.getElementById('webauthnFallbackLink');
    if (fallbackLink) {
      fallbackLink.addEventListener('click', function () {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/vn/webauthn/login/fallback', true);
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) {
            // document.open/write/close — NOT innerHTML — this genuinely
            // re-parses the document, so any <script> in the response
            // (e.g. doAuthenticate.jsp's own markup) executes correctly.
            // Confirmed safe: this matches the same technique already
            // used for the /webauthn/login/verify success path.
            document.open(); document.write(xhr.responseText); document.close();
          }
        };
        xhr.send();
      });
    }
  };

  // ── Called by the dispatcher every time it already calls
  //    afterauthscreenload(...) — i.e., every time a fragment containing
  //    .auth-image-main-container gets swapped in. Idempotent and safe
  //    to call even when no registration data is present (silently
  //    no-ops) — this is why it can piggyback on an EXISTING dispatcher
  //    branch rather than needing its own new one. ─────────────────────
  window.NewauthWebAuthn.captureRegOptionsFromDom = function () {
    var el = document.getElementById('webauthnRegData');
    if (!el) { _pendingRegOptions = null; return; }

    var challengeB64 = el.getAttribute('data-challenge');
    if (!challengeB64) { _pendingRegOptions = null; return; }

    _pendingRegOptions = {
      challengeB64:  challengeB64,
      rpId:          el.getAttribute('data-rp-id'),
      rpName:        el.getAttribute('data-rp-name'),
      userHandleB64: el.getAttribute('data-user-handle'),
      username:      el.getAttribute('data-username'),
      displayName:   el.getAttribute('data-display-name')
    };
  };

  // ── Called by the dispatcher in all four terminal ("user is now
  //    logged in") branches. Replaces the earlier fully-silent
  //    attemptSilentRegistrationIfPending() — post-testing product
  //    decision: users found a silent, no-context prompt (with no way
  //    to permanently decline) annoying. This shows an explicit,
  //    dismissible offer instead, built entirely client-side (no JSP
  //    changes needed — works on any terminal page, since it's plain
  //    DOM construction, not server-rendered markup).
  //
  //    attemptSilentRegistrationIfPending() has been REMOVED from this
  //    file entirely, not just deprecated — an earlier version kept it
  //    around "for future manual use," and that's exactly what caused
  //    a real bug: a dispatcher still wired to the old name silently
  //    got the old silent-create() behavior back, no banner, no error.
  //    If you need this function, it doesn't exist — use
  //    offerRegistrationIfPending() below. ────────────────────────────
  window.NewauthWebAuthn.offerRegistrationIfPending = function () {
    if (!_pendingRegOptions) return;               // most logins: nothing pending, no-op
    if (!supportsWebAuthn()) { _pendingRegOptions = null; return; }
    if (document.getElementById('webauthnOfferBanner')) return;  // already showing, don't duplicate

    var opts = _pendingRegOptions;

    // Per-device, per-user decline check (Session 13, revised). Not
    // server-side: deliberately scoped to THIS device/browser only, so
    // Alice declining on her phone doesn't suppress the offer on her
    // laptop — consistent with WebAuthn credentials themselves already
    // being per-device. Keyed by the stable userHandleB64 (not
    // username), same value already embedded for the create() call
    // itself, so no extra data needed. localStorage is origin-scoped
    // but NOT user-scoped on its own — the username-style key namespace
    // below is what prevents a decline by one user on a shared device
    // from silently suppressing the offer for a different user who
    // later logs in on that same browser.
    var declineKey = 'newauth_webauthn_declined_' + opts.userHandleB64;
    try {
      if (localStorage.getItem(declineKey) === '1') {
        _pendingRegOptions = null;
        return;
      }
    } catch (e) {
      // localStorage can throw in some contexts (private browsing in
      // older Safari, storage disabled entirely) — fail open (show the
      // offer) rather than silently breaking the whole function.
    }

    var banner = document.createElement('div');
    banner.id = 'webauthnOfferBanner';
    banner.setAttribute('style',
      'position:fixed;bottom:20px;right:20px;max-width:340px;' +
      'background:#16241f;color:#e8e8e8;padding:18px 20px;border-radius:14px;' +
      'box-shadow:0 12px 32px rgba(0,0,0,.35);z-index:99999;' +
      'font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.5;');

    banner.innerHTML =
      '<div style="font-weight:700;margin-bottom:6px;">Sign in even faster</div>' +
      '<div style="color:#c8d0cc;margin-bottom:14px;">' +
        'Use your device\u2019s fingerprint, face, or security key next time \u2014 ' +
        'no clicking required.' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button id="waOfferEnable" style="background:#3d8b8b;color:#fff;border:none;' +
          'border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer;">Enable</button>' +
        '<button id="waOfferLater" style="background:transparent;color:#c8d0cc;' +
          'border:1px solid #3a4d45;border-radius:8px;padding:8px 14px;cursor:pointer;">Not now</button>' +
        '<button id="waOfferNever" style="background:none;color:#8a9490;border:none;' +
          'padding:8px 4px;cursor:pointer;text-decoration:underline;font-size:13px;">' +
          'Don\u2019t ask again</button>' +
      '</div>';

    document.body.appendChild(banner);

    function removeBanner() {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }

    document.getElementById('waOfferEnable').addEventListener('click', function () {
      // This click IS the direct user gesture navigator.credentials.create()
      // needs — reuses the existing, already-tested attemptSilentRegistration
      // (its internal behavior — call create(), POST to register/verify on
      // success, swallow errors silently on failure/cancel — is unchanged
      // and correct; only the TRIGGER is new, an explicit button instead
      // of an automatic call).
      removeBanner();
      NewauthWebAuthn.attemptSilentRegistration(opts);
      _pendingRegOptions = null;
    });

    document.getElementById('waOfferLater').addEventListener('click', function () {
      // No persistence needed — shouldOfferRegistration re-evaluates
      // fresh every login server-side; simply not declining permanently
      // means it'll be offered again next time, which is the point.
      removeBanner();
      _pendingRegOptions = null;
    });

    document.getElementById('waOfferNever').addEventListener('click', function () {
      removeBanner();
      _pendingRegOptions = null;
      // Per-device, per-user — see the check at the top of this
      // function for why this is localStorage, not a server call.
      try {
        localStorage.setItem(declineKey, '1');
      } catch (e) {
        // Same fail-open reasoning as the read above — if storage is
        // unavailable, the user will just see the offer again next
        // login on this device. Not ideal, but not harmful either.
      }
    });
  };

  // ── Mandatory registration — called by the dispatcher when
  //    #webauthnForceRegister appears (a real RP flow requiring strict
  //    device sign-in, zero credentials yet). Deliberately NOT built on
  //    attemptSilentRegistration — that function is silent-by-design
  //    (swallows failures, never navigates). This one does the opposite
  //    on purpose: navigates to the RP's destination on success, and
  //    shows a real blocking failure state on cancel/error, with no way
  //    to proceed without succeeding — per explicit product decision
  //    that correct image clicks alone must NOT be sufficient for a
  //    hard_fail RP if the user has no registered device. ─────────────
  window.NewauthWebAuthn.initForceRegister = function () {
    var el = document.getElementById('webauthnForceRegister');
    if (!el) return;
    
    var cancelLink = document.getElementById('webauthnForceRegisterCancel');
    if (cancelLink) {
      cancelLink.addEventListener('click', function () {
        window.location.href = opts.cancelUrl || '/newauth/welcome';
      });
    }

    var opts = {
      challengeB64:  el.getAttribute('data-challenge'),
      rpId:          el.getAttribute('data-rp-id'),
      rpName:        el.getAttribute('data-rp-name'),
      userHandleB64: el.getAttribute('data-user-handle'),
      username:      el.getAttribute('data-username'),
      displayName:   el.getAttribute('data-display-name'),
      resumeUrl:     el.getAttribute('data-resume-url'),
      cancelUrl:     el.getAttribute('data-cancel-url')
    };

    function showError() {
      var errEl = document.getElementById('webauthnForceRegisterError');
      if (errEl) errEl.style.display = 'block';
    }

    function doRegisterAttempt() {
      if (!supportsWebAuthn()) { showError(); return; }

      var publicKey = {
        challenge: base64urlToBuffer(opts.challengeB64),
        rp: { id: opts.rpId, name: opts.rpName },
        user: {
          id: base64urlToBuffer(opts.userHandleB64),
          name: opts.username,
          displayName: (opts.displayName && opts.displayName.length)
              ? opts.displayName : opts.username
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -35 }
        ],
        authenticatorSelection: { userVerification: 'discouraged', residentKey: 'preferred' },
        timeout: 60000
      };

      navigator.credentials.create({ publicKey: publicKey }).then(function (credential) {
        var responseJson = JSON.stringify({
          id: credential.id,
          rawId: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
            attestationObject: bufferToBase64url(credential.response.attestationObject)
          }
        });

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/vn/webauthn/register/verify', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) {
            var result = {};
            try { result = JSON.parse(xhr.responseText); } catch (e) {}
            if (result.status === 'OK') {
              // Success — proceed to the RP the user was actually
              // trying to reach. resume() re-checks everything
              // (consent, etc.) server-side regardless.
              window.location.href = opts.resumeUrl || '/vn/oauth2/authorize/resume';
            } else {
              showError();
            }
          } else {
            showError();
          }
        };
        xhr.onerror = function () { showError(); };
        xhr.send(JSON.stringify({
          credentialResponseJson: responseJson,
          deviceLabel: (navigator.userAgentData && navigator.userAgentData.platform)
              || navigator.platform || 'unknown device'
        }));

      }).catch(function () {
        // Cancelled, no compatible authenticator, or any other
        // ceremony failure — show the blocking error. Deliberately NO
        // path forward from here except retry; this is the entire
        // point of "mandatory."
        showError();
      });
    }

    var btn = document.getElementById('webauthnForceRegisterBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        document.getElementById('webauthnForceRegisterError').style.display = 'none';
        doRegisterAttempt();  // real click = real user gesture
      });
    }

    var retryLink = document.getElementById('webauthnForceRegisterRetry');
    if (retryLink) {
      retryLink.addEventListener('click', function () {
        document.getElementById('webauthnForceRegisterError').style.display = 'none';
        doRegisterAttempt();  // retry click is ALSO a real gesture — no
                                // need to reload the page first
      });
    }
  };

})();
