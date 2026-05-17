/**
 * newauth-oauth.js
 * Platform-level OAuth + Vault layer for newauth apps.
 *
 * Sections:
 *  1. Vault registry      — localStorage metadata (no credentials)
 *  2. Local vault         — AES-GCM encrypted IndexedDB, tier-aware
 *  3. Vault worker schema — createVaultRegistryEntry, pendingVault helpers
 *  4. detectAuthRequirement — AI/heuristic auth detection on URLs
 *  5. vaultConnect        — OAuth popup flow for vault services
 *  6. vaultFetch          — authenticated API calls (local vault tier)
 *  7. Gmail adapter       — Gmail API → agnts article shape
 *  8. GitHub adapter      — GitHub API → agnts article shape
 *  9. _installOAuthListener — postMessage router (all apps)
 * 10. _handleEtsyCallback — inventory app post-auth handler
 * 11. _handleVaultCallback — agnts vault post-auth handler
 * 12. UX — vault auth card, flake prompt, Gmail config
 *
 * Build order: include BEFORE schema-orchestrator and agnts-app-ext.
 * Exposes: window.newauthOAuth  (all public API)
 */

/* ─────────────────────────────────────────────────────────────────────────────
   1. VAULT REGISTRY — localStorage metadata (no credentials)
   Each entry describes a connected service. Credentials live in IndexedDB.
   Registry key: agnts_vault_registry
   ───────────────────────────────────────────────────────────────────────────── */

var VAULT_REGISTRY_KEY = 'agnts_vault_registry';

var vaultRegistry = (function() {

  /* Return all registry entries */
  function getAll() {
    try {
      var raw = localStorage.getItem(VAULT_REGISTRY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  /* Save full registry */
  function _save(entries) {
    localStorage.setItem(VAULT_REGISTRY_KEY, JSON.stringify(entries));
  }

  /* Find entry by ID */
  function getById(id) {
    var entries = getAll();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].ID === id) return entries[i];
    }
    return null;
  }

  /* Find entry by service (+ optional identifier for multi-account) */
  function getByService(service, identifier) {
    var entries = getAll();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].service !== service) continue;
      if (identifier && entries[i].identifier !== identifier) continue;
      return entries[i];
    }
    return null;
  }

  /* Upsert a registry entry (add or update by ID) */
  function upsert(entry) {
    var entries = getAll();
    var idx     = -1;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].ID === entry.ID) { idx = i; break; }
    }
    if (idx >= 0) {
      entries[idx] = Object.assign({}, entries[idx], entry);
    } else {
      entries.push(entry);
    }
    _save(entries);
    return entry;
  }

  /* Remove a registry entry by ID */
  function remove(id) {
    var entries = getAll().filter(function(e) { return e.ID !== id; });
    _save(entries);
  }

  /* Update status field only */
  function setStatus(id, status) {
    var entries = getAll();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].ID === id) {
        entries[i].vaultStatus = status;
        entries[i].lastUpdated = Date.now();
        break;
      }
    }
    _save(entries);
  }

  return {
    getAll:       getAll,
    getById:      getById,
    getByService: getByService,
    upsert:       upsert,
    remove:       remove,
    setStatus:    setStatus,
  };
})();

/*
 * Registry entry shape:
 * {
 *   ID:          'vault_gmail_1234567890',   unique ID
 *   service:     'gmail',                   service key
 *   identifier:  'user@gmail.com',          human-readable account identifier
 *   authType:    'oauth2',                  oauth2 | api_key | session
 *   tier:        'open',                    open | locked-local | locked-vault
 *   locked:      false,                     requires flake to decrypt?
 *   vaultStatus: 'connected',               pending | connected | expired | revoked | error
 *   connectedAt: 1234567890,
 *   lastRefresh: 1234567890,
 *   lastUpdated: 1234567890,
 *   byokClientId: null,                     BYOK client ID if provided
 * }
 *
 * NOTE: credentials (tokens, keys) are NEVER in the registry.
 *       They live in IndexedDB keyed by the registry entry ID.
 */


/* ─────────────────────────────────────────────────────────────────────────────
   2. LOCAL VAULT — AES-GCM encrypted IndexedDB
   Keyed by vault registry entry ID (not service name directly).
   Tier-aware: open uses deviceSecret, locked tiers use deviceSecret + flakeObj.
   ───────────────────────────────────────────────────────────────────────────── */

var localVault = (function() {
  var DB_NAME  = 'agnts_vault';
  var DB_VER   = 1;
  var STORE    = 'credentials';
  var SALT_KEY = 'agnts_vault_salt';
  var DEV_KEY  = 'agnts_vault_device_secret';

  /* ── In-memory flake key cache ──────────────────────────────────────────────
     Flake-derived AES key lives here. Expires after FLAKE_TTL_MS.
     Keyed by vaultEntryId so different entries can have different lock states.
  ──────────────────────────────────────────────────────────────────────────── */
  var FLAKE_TTL_MS  = 4 * 60 * 60 * 1000;  /* 4 hours */
  var _flakeKeyCache = {};
  /* { [vaultEntryId]: { key: CryptoKey, expiresAt: timestamp } } */

  /* ── IndexedDB helpers ── */
  function _openDB() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function(e) {
        e.target.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function(e) { resolve(e.target.result); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  }

  function _dbSet(db, record) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror    = function(e) { reject(e.target.error); };
    });
  }

  function _dbGet(db, id) {
    return new Promise(function(resolve, reject) {
      var tx  = db.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).get(id);
      req.onsuccess = function(e) { resolve(e.target.result || null); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  }

  function _dbDelete(db, id) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror    = function(e) { reject(e.target.error); };
    });
  }

  /* ── Crypto helpers ── */
  function _getSalt() {
    var salt = localStorage.getItem(SALT_KEY);
    if (!salt) {
      var bytes = crypto.getRandomValues(new Uint8Array(16));
      salt = btoa(String.fromCharCode.apply(null, bytes));
      localStorage.setItem(SALT_KEY, salt);
    }
    return Uint8Array.from(atob(salt), function(c) { return c.charCodeAt(0); });
  }

  function _getDeviceSecret() {
    var secret = localStorage.getItem(DEV_KEY);
    if (!secret) {
      var bytes = crypto.getRandomValues(new Uint8Array(32));
      secret = btoa(String.fromCharCode.apply(null, bytes));
      localStorage.setItem(DEV_KEY, secret);
    }
    return secret;
  }

  /*
   * _deriveKey(baseSecret, flakeObj?)
   * open tier:         baseSecret = deviceSecret,              flakeObj = null
   * locked-local tier: baseSecret = deviceSecret + flakeObj,   flakeObj provided
   * locked-vault tier: key derived server-side — not used here
   */
  async function _deriveKey(baseSecret, flakeObj) {
    var combined = flakeObj
      ? baseSecret + ':' + JSON.stringify(flakeObj)
      : baseSecret;
    var enc    = new TextEncoder();
    var keyMat = await crypto.subtle.importKey(
      'raw', enc.encode(combined), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: _getSalt(), iterations: 100000, hash: 'SHA-256' },
      keyMat,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function _encrypt(plaintext, key) {
    var iv  = crypto.getRandomValues(new Uint8Array(12));
    var enc = new TextEncoder();
    var buf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv }, key, enc.encode(plaintext)
    );
    var combined = new Uint8Array(iv.byteLength + buf.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(buf), iv.byteLength);
    return btoa(String.fromCharCode.apply(null, combined));
  }

  async function _decrypt(blob, key) {
    var combined = Uint8Array.from(atob(blob), function(c) { return c.charCodeAt(0); });
    var iv       = combined.slice(0, 12);
    var data     = combined.slice(12);
    var buf      = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
    return new TextDecoder().decode(buf);
  }

  /*
   * Resolve the correct AES key for a vault entry.
   * open tier:         deviceSecret only — always available
   * locked-local tier: deviceSecret + flakeObj — flakeObj must be provided
   *                    key is cached in _flakeKeyCache for FLAKE_TTL_MS
   */
  async function _resolveKey(entryId, tier, flakeObj) {
    var deviceSecret = _getDeviceSecret();

    if (tier === 'open' || !tier) {
      return _deriveKey(deviceSecret, null);
    }

    /* locked-local — check cache first */
    var cached = _flakeKeyCache[entryId];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.key;
    }

    /* Need a fresh flake */
    if (!flakeObj) {
      throw { code: 'VAULT_LOCKED', entryId: entryId,
              message: 'Vault is locked — flake required to unlock' };
    }

    var key = await _deriveKey(deviceSecret, flakeObj);
    _flakeKeyCache[entryId] = { key: key, expiresAt: Date.now() + FLAKE_TTL_MS };
    return key;
  }

  /* ── Public API ── */

  /*
   * store(entryId, creds, tier, flakeObj?)
   * entryId  — vault registry entry ID (e.g. 'vault_gmail_1234567890')
   * creds    — { refreshToken, accessToken, scope, email, ... }
   * tier     — 'open' | 'locked-local'  (locked-vault stores on server, not here)
   * flakeObj — required if tier === 'locked-local'
   */
  async function store(entryId, creds, tier, flakeObj) {
    tier = tier || 'open';
    var key       = await _resolveKey(entryId, tier, flakeObj);
    var encrypted = await _encrypt(JSON.stringify(creds), key);
    var db        = await _openDB();
    await _dbSet(db, {
      id:        entryId,
      encrypted: encrypted,
      tier:      tier,
      storedAt:  Date.now(),
    });
  }

  /*
   * retrieve(entryId, tier, flakeObj?)
   * Returns decrypted creds or throws { code: 'VAULT_LOCKED' } if flake needed.
   */
  async function retrieve(entryId, tier, flakeObj) {
    tier = tier || 'open';
    var db     = await _openDB();
    var record = await _dbGet(db, entryId);
    if (!record) return null;
    var key   = await _resolveKey(entryId, tier, flakeObj);
    var plain = await _decrypt(record.encrypted, key);
    return Object.assign({}, JSON.parse(plain), { storedAt: record.storedAt });
  }

  /*
   * rekey(entryId, oldTier, newTier, oldFlakeObj?, newFlakeObj?)
   * Re-encrypts credentials when tier changes or flake rotates.
   * Called after each successful flake validation to rotate the encryption.
   */
  async function rekey(entryId, oldTier, newTier, oldFlakeObj, newFlakeObj) {
    var creds = await retrieve(entryId, oldTier, oldFlakeObj);
    if (!creds) return;
    await store(entryId, creds, newTier, newFlakeObj);
    /* Clear old cached key so next access uses new key */
    delete _flakeKeyCache[entryId];
  }

  /* Revoke — delete from IndexedDB + clear key cache */
  async function revoke(entryId) {
    var db = await _openDB();
    await _dbDelete(db, entryId);
    delete _flakeKeyCache[entryId];
  }

  /* Check if an entry exists in IndexedDB */
  async function has(entryId) {
    var db     = await _openDB();
    var record = await _dbGet(db, entryId);
    return !!record;
  }

  /* Check if the flake key for an entry is still warm in cache */
  function isUnlocked(entryId) {
    var cached = _flakeKeyCache[entryId];
    return !!(cached && cached.expiresAt > Date.now());
  }

  /* Explicitly lock an entry (clear cached key) */
  function lock(entryId) {
    delete _flakeKeyCache[entryId];
  }

  /* Lock all entries */
  function lockAll() {
    _flakeKeyCache = {};
  }

  /* Return remaining unlock time in ms for an entry (0 if locked) */
  function unlockTimeRemaining(entryId) {
    var cached = _flakeKeyCache[entryId];
    if (!cached || cached.expiresAt <= Date.now()) return 0;
    return cached.expiresAt - Date.now();
  }

  return {
    store:               store,
    retrieve:            retrieve,
    rekey:               rekey,
    revoke:              revoke,
    has:                 has,
    isUnlocked:          isUnlocked,
    lock:                lock,
    lockAll:             lockAll,
    unlockTimeRemaining: unlockTimeRemaining,
  };
})();


/* ─────────────────────────────────────────────────────────────────────────────
   3. VAULT WORKER SCHEMA HELPERS
   Vault workers are user-level (shared across compositions).
   A composition watcher references a vault entry by ID via _vaultRef.
   ───────────────────────────────────────────────────────────────────────────── */

/*
 * createVaultRegistryEntry(service, identifier, authType, tier)
 * Creates the registry metadata object — does NOT store credentials.
 * Call vaultRegistry.upsert(entry) after creating.
 */
function createVaultRegistryEntry(service, identifier, authType, tier) {
  var id = 'vault_' + service + '_' + Date.now();
  return {
    ID:           id,
    service:      service,
    identifier:   identifier  || null,
    authType:     authType    || 'oauth2',
    tier:         tier        || 'open',
    locked:       tier !== 'open',
    vaultStatus:  'pending',
    connectedAt:  null,
    lastRefresh:  null,
    lastUpdated:  Date.now(),
    byokClientId: null,
  };
}

function setWatcherPendingVault(watcherItem, vaultEntryId) {
  watcherItem._pendingVault     = true;
  watcherItem._vaultRef         = vaultEntryId;
  watcherItem._pollingSuspended = true;
}

function clearWatcherPendingVault(watcherItem) {
  watcherItem._pendingVault     = false;
  watcherItem._pollingSuspended = false;
}

/*
 * setWatcherPendingFlake(watcherItem)
 * Called when vault exists but is locked (flake expired).
 * Watcher pauses but keeps its _vaultRef — just needs re-auth.
 */
function setWatcherPendingFlake(watcherItem) {
  watcherItem._pendingFlake     = true;
  watcherItem._pollingSuspended = true;
}

function clearWatcherPendingFlake(watcherItem) {
  watcherItem._pendingFlake     = false;
  watcherItem._pollingSuspended = false;
}

/*
 * getWatchersNeedingFlake(compositions)
 * Scans all compositions for watchers that are paused waiting for a flake.
 * Used to build the "X agents need your flake" prompt.
 */
function getWatchersNeedingFlake(compositions) {
  var result = [];
  compositions = compositions || [];
  for (var i = 0; i < compositions.length; i++) {
    var workers = (compositions[i]._composite && compositions[i]._composite.worker) || [];
    for (var j = 0; j < workers.length; j++) {
      if (workers[j].workerType === 'watcher' && workers[j]._pendingFlake) {
        result.push({
          watcher:     workers[j],
          composition: compositions[i],
        });
      }
    }
  }
  return result;
}

/*
 * checkVaultAccess(vaultEntryId)
 * Returns: 'ok' | 'locked' | 'missing' | 'server'
 * Callers use this before attempting vaultFetch to decide what to show the user.
 */
async function checkVaultAccess(vaultEntryId) {
  var entry = vaultRegistry.getById(vaultEntryId);
  if (!entry) return 'missing';

  if (entry.tier === 'locked-vault') return 'server';

  var exists = await localVault.has(vaultEntryId);
  if (!exists) return 'missing';

  if (entry.tier === 'open') return 'ok';

  /* locked-local — check flake cache */
  return localVault.isUnlocked(vaultEntryId) ? 'ok' : 'locked';
}


/* ─────────────────────────────────────────────────────────────────────────────
   3. DETECT AUTH REQUIREMENT — heuristic + nano LLM fallback
   ───────────────────────────────────────────────────────────────────────────── */

var KNOWN_AUTH_SERVICES = [
  { patterns: [/mail\.google\.com/i, /gmail/i, /googleapis\.com\/gmail/i],
    service: 'gmail',  auth_type: 'oauth2', confidence: 1.0,
    reason: 'Gmail requires OAuth 2.0 for API access.' },
  { patterns: [/github\.com/i, /api\.github\.com/i],
    service: 'github', auth_type: 'oauth2', confidence: 1.0,
    reason: 'GitHub API requires OAuth or a personal access token.' },
  { patterns: [/linear\.app/i, /api\.linear\.app/i],
    service: 'linear', auth_type: 'oauth2', confidence: 0.95,
    reason: 'Linear requires OAuth 2.0 for API access.' },
  { patterns: [/notion\.com/i, /api\.notion\.com/i],
    service: 'notion', auth_type: 'oauth2', confidence: 0.95,
    reason: 'Notion requires OAuth 2.0 for API access.' },
  { patterns: [/slack\.com/i],
    service: 'slack',  auth_type: 'oauth2', confidence: 0.95,
    reason: 'Slack requires OAuth 2.0 for API access.' },
  { patterns: [/atlassian\.net/i, /jira/i],
    service: 'jira',   auth_type: 'oauth2', confidence: 0.90,
    reason: 'Jira requires OAuth 2.0 for API access.' },
];

var RSS_PATTERNS = [/\.rss$/i, /\/feed\/?$/i, /\/rss\/?$/i, /feedburner/i];

async function detectAuthRequirement(urlOrDescription) {
  /* Fast heuristic — known services */
  for (var i = 0; i < KNOWN_AUTH_SERVICES.length; i++) {
    var entry = KNOWN_AUTH_SERVICES[i];
    for (var j = 0; j < entry.patterns.length; j++) {
      if (entry.patterns[j].test(urlOrDescription)) {
        return { needs_auth: true, auth_type: entry.auth_type, service: entry.service,
                 confidence: entry.confidence, reason: entry.reason, vault_suggested: true };
      }
    }
  }

  /* Public RSS — no auth */
  for (var k = 0; k < RSS_PATTERNS.length; k++) {
    if (RSS_PATTERNS[k].test(urlOrDescription)) {
      return { needs_auth: false, auth_type: 'none', service: null,
               confidence: 0.95, reason: 'Public RSS feed — no auth needed.', vault_suggested: false };
    }
  }

  /* Nano LLM fallback */
  var SYSTEM = 'You are a URL authentication classifier. Given a URL or service description, '
    + 'determine if programmatic access requires authentication. '
    + 'Respond ONLY with valid JSON — no markdown. '
    + 'Shape: { "needs_auth": boolean, "auth_type": "oauth2"|"api_key"|"basic"|"session"|"none"|"unknown", '
    + '"service": string|null, "confidence": number, "reason": string, "vault_suggested": boolean }';

  try {
    if (window._webllmEngineReady && window._webllmEngine) {
      var reply = await window._webllmEngine.chat.completions.create({
        messages: [{ role: 'system', content: SYSTEM },
                   { role: 'user',   content: 'URL or service: ' + urlOrDescription }],
        temperature: 0, max_tokens: 200,
      });
      return JSON.parse(reply.choices[0].message.content.replace(/```json|```/g, '').trim());
    }

    var res  = await fetch('/newauth/api/agnts/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: SYSTEM, prompt: 'URL or service: ' + urlOrDescription, tier: 'nano' }),
    });
    var data = await res.json();
    return JSON.parse(data.content.replace(/```json|```/g, '').trim());

  } catch (err) {
    console.warn('[newauthOAuth] auth detection failed:', err);
    return { needs_auth: null, auth_type: 'unknown', service: null,
             confidence: 0, reason: 'Could not determine auth requirements.', vault_suggested: false };
  }
}


/* ─────────────────────────────────────────────────────────────────────────────
   POPUP HELPER — opens a centered popup window
   ───────────────────────────────────────────────────────────────────────────── */

function _centeredPopup(url, name, w, h) {
  var left = Math.round((window.screen.width  / 2) - (w / 2));
  var top  = Math.round((window.screen.height / 2) - (h / 2));
  return window.open(url, name,
    'width=' + w + ',height=' + h
    + ',left=' + left + ',top=' + top
    + ',scrollbars=yes,resizable=yes'
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. VAULT CONNECT — OAuth popup flow for agnts vault services
   ───────────────────────────────────────────────────────────────────────────── */

function vaultConnect(service, opts) {
  opts = opts || {};
  return new Promise(function(resolve, reject) {
    var context = JSON.stringify({
      compositionId: opts.compositionId || null,
      workerId:      opts.workerId      || null,
    });

    var params = new URLSearchParams({ tier: 'local', context: context });
    if (opts.byokClientId) params.set('client_id', opts.byokClientId);
    if (opts.scope)        params.set('scope',     opts.scope);

    fetch('/api/connect/' + service + '/init?' + params.toString(),
          { method: 'GET', credentials: 'include' })
      .then(function(res) {
        if (!res.ok) throw new Error('OAuth init failed: ' + res.status);
        return res.json();
      })
      .then(function(data) {
        var popup = _centeredPopup(data.authUrl, 'newauth_vault_' + service, 520, 640);
        if (!popup) reject(new Error('Popup blocked — please allow popups for this site.'));
        /* Resolution handled by _handleVaultCallback via postMessage listener */
      })
      .catch(reject);
  });
}


/* ─────────────────────────────────────────────────────────────────────────────
   5. VAULT FETCH — authenticated API call (local vault tier)
   ───────────────────────────────────────────────────────────────────────────── */

var _accessTokenCache = {};

var TOKEN_REFRESH_ENDPOINTS = {
  gmail: 'https://oauth2.googleapis.com/token',
};

/*
 * _getAccessToken(vaultWorker)
 * vaultWorker must have: { _vaultRef, service, byokClientId }
 * _vaultRef is the registry entry ID — used as IndexedDB key.
 * Throws { code: 'VAULT_LOCKED' } if locked tier and flake cache is cold.
 */
async function _getAccessToken(vaultWorker) {
  var entryId    = vaultWorker._vaultRef;
  var service    = vaultWorker.service;
  var byokClientId = vaultWorker.byokClientId || null;

  if (!entryId) throw new Error('[vault] No _vaultRef on watcher for ' + service);

  var entry = vaultRegistry.getById(entryId);
  if (!entry) throw new Error('[vault] Registry entry not found: ' + entryId);

  /* locked-vault tier — server returns credentials */
  if (entry.tier === 'locked-vault') {
    return _getAccessTokenFromServer(entryId, service, byokClientId);
  }

  /* Check in-memory access token cache first */
  var cached = _accessTokenCache[entryId];
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;

  /* GitHub PATs don't expire — stored as refreshToken, used directly */
  if (service === 'github') {
    var creds = await localVault.retrieve(entryId, entry.tier, null);
    if (!creds) throw new Error('[vault] No credentials for ' + entryId);
    return creds.refreshToken;
  }

  /* Retrieve from local vault (throws VAULT_LOCKED if locked and flake cold) */
  var credentials = await localVault.retrieve(entryId, entry.tier, null);
  if (!credentials) throw new Error('[vault] No credentials for ' + entryId);

  /* Refresh access token via backend */
  var body = { refreshToken: credentials.refreshToken };
  if (byokClientId || credentials.clientId)
    body.clientId = byokClientId || credentials.clientId;

  var res = await fetch('/api/connect/' + service + '/refresh', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) throw new Error('[vault] Token refresh failed: ' + res.status);
  var data = await res.json();

  _accessTokenCache[entryId] = {
    token:     data.accessToken,
    expiresAt: Date.now() + (parseInt(data.expiresIn) || 3600) * 1000,
  };

  /* Update registry lastRefresh */
  vaultRegistry.setStatus(entryId, 'connected');
  entry.lastRefresh = Date.now();
  vaultRegistry.upsert(entry);

  return data.accessToken;
}

async function _getAccessTokenFromServer(entryId, service, byokClientId) {
  /* locked-vault tier — server holds credentials encrypted by flake.
     Browser sends flake proof; server decrypts and returns access token. */
  var res = await fetch('/api/connect/' + service + '/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ entryId: entryId, clientId: byokClientId }),
    credentials: 'include',
  });
  if (res.status === 401) {
    throw { code: 'VAULT_LOCKED', entryId: entryId,
            message: 'Server vault requires flake re-authentication' };
  }
  if (!res.ok) throw new Error('[vault] Server token fetch failed: ' + res.status);
  var data = await res.json();
  return data.accessToken;
}

async function vaultFetch(vaultWorker, url, fetchOpts) {
  fetchOpts = fetchOpts || {};
  var entryId = vaultWorker._vaultRef;

  var token   = await _getAccessToken(vaultWorker);
  var headers = Object.assign({}, fetchOpts.headers || {},
    { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' });

  var res = await fetch(url, Object.assign({}, fetchOpts, { headers: headers }));

  /* On 401 — clear access token cache and retry once */
  if (res.status === 401 && entryId) {
    delete _accessTokenCache[entryId];
    var retryToken = await _getAccessToken(vaultWorker);
    headers['Authorization'] = 'Bearer ' + retryToken;
    return fetch(url, Object.assign({}, fetchOpts, { headers: headers }));
  }

  return res;
}


/* ─────────────────────────────────────────────────────────────────────────────
   6. GMAIL ADAPTER — Gmail API → agnts article shape
   ───────────────────────────────────────────────────────────────────────────── */

async function gmailFetch(vaultWorker, watcherItem) {
  var query      = watcherItem.gmailQuery      || 'is:unread in:inbox';
  var maxResults = watcherItem.gmailMaxResults || 20;

  var listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?'
    + new URLSearchParams({ q: query, maxResults: maxResults }).toString();

  var listRes  = await vaultFetch(vaultWorker, listUrl);
  if (!listRes.ok) throw new Error('Gmail list failed: ' + listRes.status);
  var listData = await listRes.json();
  var messages = listData.messages || [];
  if (!messages.length) return [];

  var articles = await Promise.all(messages.map(async function(m) {
    var msgUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + m.id
      + '?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date';
    var msgRes = await vaultFetch(vaultWorker, msgUrl);
    if (!msgRes.ok) return null;
    var msg     = await msgRes.json();
    var hdrs    = (msg.payload && msg.payload.headers) || [];
    var subject = (hdrs.find(function(h) { return h.name === 'Subject'; }) || {}).value || '(no subject)';
    var from    = (hdrs.find(function(h) { return h.name === 'From';    }) || {}).value || '';
    var dateStr = (hdrs.find(function(h) { return h.name === 'Date';    }) || {}).value || '';
    return _toArticle({
      id:        'gmail:' + m.id,
      title:     subject,
      summary:   msg.snippet || '',
      author:    from,
      published: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      url:       'https://mail.google.com/mail/u/0/#inbox/' + m.id,
      source:    'Gmail',
      raw:       msg,
    });
  }));

  return articles.filter(Boolean);
}

async function gmailFetchBody(vaultWorker, messageId) {
  var url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + messageId + '?format=full';
  var res = await vaultFetch(vaultWorker, url);
  if (!res.ok) throw new Error('Gmail fetch body failed: ' + res.status);
  var msg = await res.json();
  return _extractGmailBody(msg.payload);
}

function _extractGmailBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
    return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  if (payload.parts) {
    for (var i = 0; i < payload.parts.length; i++) {
      var text = _extractGmailBody(payload.parts[i]);
      if (text) return text;
    }
  }
  return '';
}


/* ─────────────────────────────────────────────────────────────────────────────
   7. GITHUB ADAPTER — GitHub API → agnts article shape
   ───────────────────────────────────────────────────────────────────────────── */

function _parseGithubUrl(url) {
  var match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/([^/?#]+))?/);
  if (!match) throw new Error('Cannot parse GitHub URL: ' + url);
  return { owner: match[1], repo: match[2], resource: match[3] || 'activity' };
}

async function githubFetch(vaultWorker, watcherItem) {
  var parsed   = _parseGithubUrl(watcherItem.targetUrl || '');
  var owner    = parsed.owner;
  var repo     = parsed.repo;
  var resource = parsed.resource;
  var base     = 'https://api.github.com/repos/' + owner + '/' + repo;

  var urls = {
    issues:   base + '/issues?state=open&per_page=20&sort=updated',
    pulls:    base + '/pulls?state=open&per_page=20&sort=updated',
    releases: base + '/releases?per_page=20',
    commits:  base + '/commits?per_page=20',
    activity: base + '/events?per_page=20',
  };

  var apiUrl = urls[resource] || urls.activity;
  var res    = await vaultFetch(vaultWorker, apiUrl);
  if (!res.ok) throw new Error('GitHub API failed: ' + res.status);
  var items  = await res.json();
  return items.map(function(item) { return _githubItemToArticle(item, resource, owner, repo); });
}

function _githubItemToArticle(item, resource, owner, repo) {
  if (resource === 'issues' || resource === 'pulls') {
    return _toArticle({
      id:        'github:' + resource + ':' + item.id,
      title:     '[' + (resource === 'pulls' ? 'PR' : 'Issue') + ' #' + item.number + '] ' + item.title,
      summary:   item.body ? item.body.slice(0, 400) : '',
      author:    (item.user && item.user.login) || '',
      published: item.updated_at || item.created_at,
      url:       item.html_url,
      source:    'GitHub ' + owner + '/' + repo,
      raw:       item,
    });
  }
  if (resource === 'releases') {
    return _toArticle({
      id:        'github:release:' + item.id,
      title:     '[Release] ' + (item.name || item.tag_name),
      summary:   item.body ? item.body.slice(0, 400) : '',
      author:    (item.author && item.author.login) || '',
      published: item.published_at || item.created_at,
      url:       item.html_url,
      source:    'GitHub ' + owner + '/' + repo,
      raw:       item,
    });
  }
  if (resource === 'commits') {
    return _toArticle({
      id:        'github:commit:' + item.sha,
      title:     '[Commit] ' + ((item.commit && item.commit.message && item.commit.message.split('\n')[0]) || item.sha.slice(0, 7)),
      summary:   (item.commit && item.commit.message) || '',
      author:    (item.commit && item.commit.author && item.commit.author.name) || (item.author && item.author.login) || '',
      published: (item.commit && item.commit.author && item.commit.author.date) || new Date().toISOString(),
      url:       item.html_url,
      source:    'GitHub ' + owner + '/' + repo,
      raw:       item,
    });
  }
  return _toArticle({
    id:        'github:event:' + item.id,
    title:     '[' + ((item.type && item.type.replace('Event', '')) || 'Activity') + '] ' + owner + '/' + repo,
    summary:   JSON.stringify(item.payload || {}).slice(0, 400),
    author:    (item.actor && item.actor.login) || '',
    published: item.created_at || new Date().toISOString(),
    url:       'https://github.com/' + owner + '/' + repo,
    source:    'GitHub ' + owner + '/' + repo,
    raw:       item,
  });
}

function _toArticle(o) {
  return {
    id:         o.id        || o.url || o.title,
    title:      (o.title    || '').trim(),
    summary:    (o.summary  || '').trim(),
    content:    (o.summary  || '').trim(),
    author:     o.author    || '',
    published:  o.published || new Date().toISOString(),
    link:       o.url       || '',
    url:        o.url       || '',
    source:     o.source    || '',
    _raw:       o.raw       || null,
    _fromVault: true,
  };
}


/* ─────────────────────────────────────────────────────────────────────────────
   8. _installOAuthListener — postMessage router (all apps)
   Call once from SchemaOrchestrator.init() finally block:
     _installOAuthListener(this);
   ───────────────────────────────────────────────────────────────────────────── */

function _installOAuthListener(orchestrator) {
  if (window._newauthOAuthListenerInstalled) return;
  window._newauthOAuthListenerInstalled = true;

  window.addEventListener('message', async function(event) {
    if (event.origin !== window.location.origin) return;
    var msg = event.data || {};
    if (msg.type !== 'agnts_oauth_callback') return;

    var service = msg.service;
    var payload = msg.payload;
    var error   = msg.error;
    var ctx     = {};
    try { ctx = msg.context ? JSON.parse(msg.context) : {}; } catch(e) {}

    if (error) {
      console.error('[newauthOAuth] OAuth error for', service, ':', error);
      if (orchestrator && orchestrator.showNotification) {
        orchestrator.showNotification('❌ ' + (service || 'Auth') + ' failed: ' + error, 'error');
      }
      return;
    }

    if (service === 'etsy') {
      await _handleEtsyCallback(orchestrator, payload, ctx);
    } else if (service === 'gmail' || service === 'github' || service === 'notion'
               || service === 'linear' || service === 'slack') {
      await _handleVaultCallback(service, payload, ctx);
    } else {
      console.warn('[newauthOAuth] Unhandled OAuth service:', service);
    }
  });
}


/* ─────────────────────────────────────────────────────────────────────────────
   9. _handleEtsyCallback — inventory app post-auth handler
   Replicates what handleEtsyCallback() used to do after page reload,
   now runs inline after popup postMessage.
   ───────────────────────────────────────────────────────────────────────────── */

async function _handleEtsyCallback(orchestrator, payload, ctx) {
  try {
    var seller = orchestrator._getCurrentSeller();

    if (ctx.sellerId) {
      var items = (orchestrator.data && orchestrator.data.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].ID === ctx.sellerId) { seller = items[i]; break; }
      }
    }

    if (!seller) {
      orchestrator.showNotification('⚠️ Seller not found after Etsy auth', 'error');
      return;
    }

    var etsyConfig = {
      connected:      true,
      shopId:         payload.shopId,
      accessToken:    payload.accessToken,
      refreshToken:   payload.refreshToken,
      tokenExpiresAt: Date.now() + (parseInt(payload.expiresIn || 3600) * 1000),
      lastSync:       Date.now(),
    };

    orchestrator._setIntegrationConfig(seller, 'etsy', etsyConfig);

    await orchestrator.db.saveAppData(
      orchestrator.currentApp.id,
      { items: [seller] }
    );

    orchestrator.showNotification(
      '✅ Etsy connected for ' + (ctx.sellerName || payload.identifier || 'seller') + '!',
      'success'
    );

    await orchestrator._syncEtsyOrders(seller);
    orchestrator.render();

  } catch (err) {
    console.error('[newauthOAuth] Etsy callback handling failed:', err);
    orchestrator.showNotification('❌ Etsy connection failed: ' + err.message, 'error');
  }
}


/* ─────────────────────────────────────────────────────────────────────────────
   10. _handleVaultCallback — agnts vault post-auth handler
   Stores tokens in localVault and clears _pendingVault on the watcher.
   ───────────────────────────────────────────────────────────────────────────── */

async function _handleVaultCallback(service, payload, ctx) {
  try {
    /* Determine tier from context (default open) */
    var tier    = ctx.tier || 'open';
    var entryId = ctx.entryId || null;

    /* Create or reuse registry entry */
    var entry = entryId
      ? vaultRegistry.getById(entryId)
      : vaultRegistry.getByService(service, payload.email || payload.username || null);

    if (!entry) {
      entry = createVaultRegistryEntry(
        service,
        payload.email || payload.username || payload.identifier || null,
        'oauth2',
        tier
      );
    }

    /* Store credentials in IndexedDB (tier-aware, no flake for open tier) */
    await localVault.store(entry.ID, {
      refreshToken: payload.refreshToken,
      accessToken:  payload.accessToken,
      expiresAt:    Date.now() + (parseInt(payload.expiresIn || 3600) * 1000),
      scope:        payload.scope    || '',
      email:        payload.email    || payload.identifier || null,
      username:     payload.username || payload.identifier || null,
      clientId:     payload.clientId || null,
    }, tier, null /* flakeObj — null for open tier */);

    /* Update registry */
    entry.vaultStatus  = 'connected';
    entry.connectedAt  = Date.now();
    entry.lastRefresh  = Date.now();
    entry.lastUpdated  = Date.now();
    vaultRegistry.upsert(entry);

    /* Update watcher _vaultRef to point to registry entry ID */
    if (ctx.compositionId && window.app) {
      var compositions = ((window.app.data && window.app.data.items && window.app.data.items[0])
                          && window.app.data.items[0].compositions) || [];
      for (var i = 0; i < compositions.length; i++) {
        if (compositions[i].ID !== ctx.compositionId) continue;
        var comp    = compositions[i];
        var workers = (comp._composite && comp._composite.worker) || [];
        for (var j = 0; j < workers.length; j++) {
          if (workers[j].workerType === 'watcher' && workers[j]._pendingVault) {
            workers[j]._vaultRef = entry.ID;
            clearWatcherPendingVault(workers[j]);
          }
        }
        if (typeof agntUpsertAndSave === 'function') {
          await agntUpsertAndSave(window.app, comp);
        }
        break;
      }
    }

    console.info('[newauthOAuth] Vault connected:', service, entry.identifier, 'tier:', tier);

  } catch (err) {
    console.error('[newauthOAuth] Vault callback handling failed:', err);
  }
}




/* ─────────────────────────────────────────────────────────────────────────────
   UX — VAULT AUTH CARD, FLAKE PROMPT, GMAIL CONFIG
   ───────────────────────────────────────────────────────────────────────────── */

(function _injectVaultStyles() {
  if (document.getElementById('agnts-vault-ux-styles')) return;
  var style = document.createElement('style');
  style.id  = 'agnts-vault-ux-styles';
  style.textContent = [
    /* Auth detection card */
    '.vault-auth-card{',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
      'background:#fff;border:1px solid #ede9fe;border-radius:12px;',
      'padding:14px;margin-top:10px;',
      'box-shadow:0 2px 12px rgba(108,92,231,0.08);',
      'animation:vaultCardIn 0.18s ease;',
    '}',
    '@keyframes vaultCardIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}',

    '.vault-auth-card .vault-service-row{',
      'display:flex;align-items:center;gap:10px;margin-bottom:12px;',
    '}',
    '.vault-auth-card .vault-service-icon{',
      'width:36px;height:36px;border-radius:10px;',
      'display:flex;align-items:center;justify-content:center;',
      'font-size:20px;flex-shrink:0;',
      'box-shadow:0 2px 8px rgba(0,0,0,0.08);',
    '}',
    '.vault-auth-card .vault-service-name{',
      'font-size:12px;font-weight:700;color:#1a1a2e;',
    '}',
    '.vault-auth-card .vault-service-sub{',
      'font-size:10px;color:#888;margin-top:1px;',
    '}',

    /* Tier picker */
    '.vault-tier-opts{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;margin-left:4px;}',
    '.vault-tier-opt{',
      'display:flex;align-items:flex-start;gap:9px;',
      'padding:9px 11px;border-radius:9px;cursor:pointer;',
      'border:1.5px solid #e8e8f0;background:#fafafa;',
      'transition:border-color 0.15s,background 0.15s;',
    '}',
    '.vault-tier-opt:hover{border-color:#a29bfe;background:#f5f3ff;}',
    '.vault-tier-opt.selected{border-color:#6c5ce7;background:#f0eeff;}',
    '.vault-tier-opt input[type=radio]{margin-top:2px;accent-color:#6c5ce7;flex-shrink:0;}',
    '.vault-tier-opt-label{font-size:11px;font-weight:600;color:#1a1a2e;}',
    '.vault-tier-opt-desc{font-size:10px;color:#888;margin-top:1px;line-height:1.4;}',

    /* Already connected banner */
    '.vault-existing-banner{',
      'display:flex;align-items:center;gap:8px;',
      'padding:8px 10px;border-radius:8px;',
      'background:#f0fdf4;border:1px solid #bbf7d0;',
      'margin-bottom:10px;',
    '}',
    '.vault-existing-banner .vault-existing-id{',
      'font-size:11px;font-weight:600;color:#166534;flex:1;',
    '}',

    /* Connect button */
    '.vault-connect-btn{',
      'width:100%;padding:9px;border:none;border-radius:8px;',
      'background:linear-gradient(135deg,#6c5ce7,#a29bfe);',
      'color:#fff;font-size:12px;font-weight:700;cursor:pointer;',
      'letter-spacing:0.02em;transition:opacity 0.15s;',
    '}',
    '.vault-connect-btn:hover{opacity:0.88;}',
    '.vault-connect-btn:disabled{opacity:0.5;cursor:not-allowed;}',

    /* ── Flow 2: Flake overlay — full screen immersive ── */
    /* Backdrop */
    '#agnts-flake-backdrop{',
      'position:fixed;inset:0;z-index:99998;',
      'background:rgba(10,8,24,0.6);',
      'backdrop-filter:blur(4px);',
      'animation:flakeOverlayIn 0.25s ease;',
    '}',
    '#agnts-flake-overlay{',
      'position:fixed;inset:32px;z-index:99999;',
      'background:#0a0818;',
      'border-radius:20px;',
      'display:flex;flex-direction:column;',
      'overflow:hidden;',
      'box-shadow:0 32px 80px rgba(0,0,0,0.6);',
      'animation:flakeOverlayIn 0.25s ease;',
    '}',
    '@keyframes flakeOverlayIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}',

    /* Intro card — appears near dot, pops in after dots render */
    '.flake-intro-card{',
      'position:fixed;z-index:9999;',
      'width:280px;',
      'background:#fff;border-radius:16px;',
      'box-shadow:0 12px 40px rgba(0,0,0,0.14),0 2px 8px rgba(108,92,231,0.1);',
      'border:1px solid #ede9fe;',
      'overflow:hidden;',
      'animation:ficPopIn 0.28s cubic-bezier(0.34,1.56,0.64,1);',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '}',
    '@keyframes ficPopIn{from{opacity:0;transform:scale(0.88) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}',
    '.fic-img-wrap{position:relative;width:100%;height:220px;overflow:hidden;background:#1a1a2e;}',
    '.fic-img-wrap .fic-img{width:100%;height:100%;object-fit:cover;display:block;opacity:0.92;transition:opacity 0.2s;}',
    '.fic-img-wrap:hover .fic-img{filter:brightness(0.5);}',
    '.fic-close{',
      'position:absolute;top:7px;right:7px;width:22px;height:22px;border-radius:50%;',
      'background:rgba(0,0,0,0.4);border:none;color:#fff;font-size:11px;',
      'cursor:pointer;display:flex;align-items:center;justify-content:center;',
      'z-index:3;transition:background 0.15s;line-height:1;',
    '}',
    '.fic-close:hover{background:rgba(220,38,38,0.75);}',
	'.fic-gradient{',
	  'position:absolute;inset:0;',
	  'background:linear-gradient(to bottom,rgba(10,8,24,0.0) 0%,rgba(10,8,24,0.0) 50%,rgba(10,8,24,0.45) 72%,rgba(10,8,24,0.75) 100%);',
	  'pointer-events:none;z-index:1;',
	'}',
	'.fic-lock{',
	  'position:absolute;top:10px;left:10px;z-index:3;',
	  'width:26px;height:26px;border-radius:50%;',
	  'background:rgba(108,92,231,0.85);',
	  'border:1.5px solid rgba(255,255,255,0.4);',
	  'display:flex;align-items:center;justify-content:center;',
	  'font-size:12px;',
	'}',
	'.fic-overlay-text{',
	  'position:absolute;bottom:0;left:0;right:0;z-index:2;',
	  'padding:12px 14px 14px;',
	'}',
	'.fic-agent-name{font-size:14px;font-weight:700;color:#fff;margin-bottom:3px;}',
	'.fic-sub{font-size:11px;color:rgba(255,255,255,0.65);line-height:1.4;}',
	'.fic-tap-hint{',
	  'display:inline-flex;align-items:center;gap:4px;',
	  'margin-top:8px;font-size:11px;font-weight:600;',
	  'color:rgba(255,255,255,0.5);',
	  'border:1px solid rgba(255,255,255,0.2);',
	  'padding:3px 8px;border-radius:20px;',
	  'transition:color 0.15s,border-color 0.15s;',
	'}',
	'.flake-intro-card:hover .fic-tap-hint{color:rgba(255,255,255,0.9);border-color:rgba(255,255,255,0.5);}',
	'@keyframes ficDotRing{',
	  '0%{box-shadow:0 0 0 0 rgba(108,92,231,0.6);}',
	  '70%{box-shadow:0 0 0 8px rgba(108,92,231,0);}',
	  '100%{box-shadow:0 0 0 0 rgba(108,92,231,0);}',
	'}',
	'.fic-dot-paused{',
	  'outline:2px dashed rgba(108,92,231,0.7)!important;',
	  'outline-offset:3px!important;',
	  'animation:ficDotRing 2s ease-in-out infinite!important;',
	'}',
    '.fic-expand{',
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);',
      'width:34px;height:34px;border-radius:8px;',
      'background:rgba(108,92,231,0.85);border:2px solid rgba(255,255,255,0.5);',
      'color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;',
      'opacity:0;transition:opacity 0.18s;pointer-events:none;z-index:2;',
    '}',
    '.fic-img-wrap:hover .fic-expand{opacity:1;}',
    '.fic-hover-labels{',
      'position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:5px;',
      'opacity:0;transition:opacity 0.18s;pointer-events:none;z-index:1;',
    '}',
    '.fic-img-wrap:hover .fic-hover-labels{opacity:1;}',
    '.fic-hover-label{font-size:10px;font-weight:600;color:#fff;background:rgba(0,0,0,0.4);padding:3px 9px;border-radius:20px;}',
    '.fic-hover-label.dismiss{color:rgba(255,255,255,0.5);}',
    '.flake-intro-card .fic-body{padding:11px 13px 13px;}',
    '.flake-intro-card .fic-title{font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:3px;}',
    '.flake-intro-card .fic-sub{font-size:10px;color:#888;line-height:1.5;}',

    /* Top bar — overlaid on image */
    '.flake-topbar{',
      'position:absolute;top:0;left:0;right:0;z-index:2;',
      'padding:20px 24px 16px;',
      'background:linear-gradient(to bottom,rgba(10,8,24,0.85) 0%,transparent 100%);',
      'display:flex;align-items:flex-start;justify-content:space-between;',
    '}',
    '.flake-topbar-left{flex:1;}',
    '.flake-title{',
      'font-size:17px;font-weight:700;color:#fff;margin-bottom:3px;',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '}',
    '.flake-subtitle{',
      'font-size:12px;color:rgba(255,255,255,0.6);line-height:1.4;',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '}',
    '.flake-agent-pills{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;}',
    '.flake-agent-pill{',
      'font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px;',
      'background:rgba(108,92,231,0.35);color:#c4b5fd;',
      'border:1px solid rgba(108,92,231,0.4);',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '}',

    /* Image — fills entire overlay */
	'.flake-image-wrap{',
	  'position:absolute;inset:0;user-select:none;',
	  'overflow:hidden;',
	  'background:#ffffff;',   
	'}',
	'.flake-image-wrap img{',
	  'width:100%;height:100%;object-fit:contain;display:block;',
	  'pointer-events:none;',
	  'cursor:default;',        
	  'transition:opacity 0.25s ease;',
	'}',
    '.flake-image-wrap.shake{animation:flakeShake 0.35s ease;}',
    '@keyframes flakeShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}60%{transform:translateX(8px)}}',

    /* Click dot */
    '.flake-click-dot{',
      'position:absolute;width:28px;height:28px;border-radius:50%;',
      'background:rgba(108,92,231,0.9);border:3px solid #fff;',
      'transform:translate(-50%,-50%);pointer-events:none;',
      'animation:dotPop 0.25s cubic-bezier(0.34,1.56,0.64,1);',
      'box-shadow:0 0 0 6px rgba(108,92,231,0.25),0 4px 16px rgba(0,0,0,0.4);',
    '}',
    '@keyframes dotPop{from{transform:translate(-50%,-50%) scale(0)}to{transform:translate(-50%,-50%) scale(1)}}',

    /* Ripple on click */
    '.flake-ripple{',
      'position:absolute;width:60px;height:60px;border-radius:50%;',
      'border:2px solid rgba(108,92,231,0.6);',
      'transform:translate(-50%,-50%);pointer-events:none;',
      'animation:rippleOut 0.5s ease-out forwards;',
    '}',
    '@keyframes rippleOut{from{opacity:1;transform:translate(-50%,-50%) scale(0.5)}to{opacity:0;transform:translate(-50%,-50%) scale(2)}}',

    /* Bottom bar */
    '.flake-bottombar{',
      'position:absolute;bottom:0;left:0;right:0;z-index:2;',
      'padding:16px 24px 28px;',
      'background:linear-gradient(to top,rgba(10,8,24,0.9) 0%,transparent 100%);',
      'display:flex;flex-direction:column;gap:10px;',
    '}',
    '.flake-progress-row{display:flex;align-items:center;gap:10px;}',
    '.flake-progress-track{',
      'flex:1;height:3px;background:rgba(255,255,255,0.15);border-radius:2px;overflow:hidden;',
    '}',
    '.flake-progress-fill{',
      'height:100%;background:linear-gradient(90deg,#6c5ce7,#a29bfe);',
      'border-radius:2px;transition:width 0.35s ease;',
    '}',
    '.flake-progress-label{',
      'font-size:11px;color:rgba(255,255,255,0.5);white-space:nowrap;',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '}',
    '.flake-hint{',
      'font-size:13px;font-weight:600;color:rgba(255,255,255,0.8);',
      'text-align:center;letter-spacing:0.02em;',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '}',
    '.flake-actions{display:flex;gap:10px;}',
    '.flake-skip{',
      'flex:1;padding:12px;border:1px solid rgba(255,255,255,0.15);border-radius:10px;',
      'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);',
      'font-size:12px;font-weight:600;cursor:pointer;',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '}',
    '.flake-submit{',
      'flex:2;padding:12px;border:none;border-radius:10px;',
      'background:linear-gradient(135deg,#6c5ce7,#a29bfe);',
      'color:#fff;font-size:12px;font-weight:700;cursor:pointer;',
      'opacity:0.35;transition:opacity 0.2s;',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '}',
    '.flake-submit.ready{opacity:1;}',

    /* ── Flow 3: Gmail config ── */
    '.gmail-config-panel{',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
      'background:#fff;border:1px solid #e8e8f0;border-radius:12px;',
      'padding:14px;margin-top:10px;',
      'animation:vaultCardIn 0.18s ease;',
    '}',
    '.gmail-config-panel .gc-label{',
      'font-size:10px;font-weight:700;color:#888;',
      'text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;',
    '}',
    '.gmail-presets{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}',
    '.gmail-preset{',
      'font-size:10px;font-weight:600;padding:4px 10px;border-radius:20px;',
      'border:1.5px solid #e8e8f0;background:#fafafa;color:#555;',
      'cursor:pointer;transition:border-color 0.12s,background 0.12s,color 0.12s;',
    '}',
    '.gmail-preset:hover{border-color:#a29bfe;background:#f0eeff;color:#6c5ce7;}',
    '.gmail-preset.active{border-color:#6c5ce7;background:#f0eeff;color:#6c5ce7;}',
    '.gmail-query-input{',
      'width:100%;box-sizing:border-box;',
      'padding:8px 10px;border:1.5px solid #e8e8f0;border-radius:8px;',
      'font-size:11px;font-family:inherit;color:#1a1a2e;',
      'outline:none;transition:border-color 0.15s;',
      'background:#fafafa;',
    '}',
    '.gmail-query-input:focus{border-color:#6c5ce7;background:#fff;}',
    '.gmail-query-input::placeholder{color:#bbb;}',
    '.gmail-config-footer{',
      'display:flex;align-items:center;justify-content:space-between;',
      'margin-top:10px;',
    '}',
    '.gmail-account-pill{',
      'display:flex;align-items:center;gap:5px;',
      'font-size:10px;color:#666;',
    '}',
    '.gmail-account-dot{',
      'width:7px;height:7px;border-radius:50%;background:#10B981;',
    '}',
    '.gmail-save-btn{',
      'padding:7px 14px;border:none;border-radius:7px;',
      'background:#6c5ce7;color:#fff;font-size:11px;font-weight:700;',
      'cursor:pointer;transition:opacity 0.15s;',
    '}',
    '.gmail-save-btn:hover{opacity:0.85;}',
  ].join('');
  document.head.appendChild(style);
})();


/* ─────────────────────────────────────────────────────────────────────────────
   FLOW 1 — URL AUTH DETECTION CARD
   Call renderVaultAuthCard(container, watcherItem, onConnected)
   container   — DOM element to append the card into
   watcherItem — the watcher being configured
   onConnected — callback(vaultEntryId) when auth succeeds
   ───────────────────────────────────────────────────────────────────────────── */

var SERVICE_META = {
  gmail:  { icon: '📧', label: 'Gmail',         color: '#ea4335' },
  github: { icon: '🐙', label: 'GitHub',        color: '#1a1a2e' },
  jira:   { icon: '🎯', label: 'Jira',          color: '#0052cc' },
  notion: { icon: '📝', label: 'Notion',        color: '#1a1a2e' },
  linear: { icon: '⚡', label: 'Linear',        color: '#5e6ad2' },
  slack:  { icon: '💬', label: 'Slack',         color: '#4a154b' },
  default:{ icon: '🔐', label: 'This service',  color: '#6c5ce7' },
};

function _serviceMeta(service) {
  return SERVICE_META[service] || SERVICE_META.default;
}

async function renderVaultAuthCard(container, watcherItem, onConnected) {
  /* Remove any existing card */
  var existing = container.querySelector('.vault-auth-card');
  if (existing) existing.remove();

  var url     = watcherItem.targetUrl || '';
  var authInfo = null;

  try {
    authInfo = await detectAuthRequirement(url);
  } catch(e) {
    console.warn('[vaultUX] detectAuthRequirement failed:', e);
    return;
  }

  if (!authInfo || !authInfo.needs_auth) return;

  var service = authInfo.service || 'unknown';
  var meta    = _serviceMeta(service);

  /* Check if already connected */
  var existing_entry = vaultRegistry.getByService(service, null);

  var card     = document.createElement('div');
  card.className = 'vault-auth-card';

  /* Already connected banner */
  var existingBanner = '';
  if (existing_entry && existing_entry.vaultStatus === 'connected') {
    existingBanner = '<div class="vault-existing-banner">' +
      '<span style="font-size:14px;">✅</span>' +
      '<div class="vault-existing-id">' + (existing_entry.identifier || service) + ' already connected</div>' +
      '<button class="vault-use-existing" style="font-size:10px;font-weight:700;' +
        'padding:3px 8px;border-radius:6px;border:1px solid #bbf7d0;' +
        'background:#f0fdf4;color:#166534;cursor:pointer;">Use this</button>' +
    '</div>';
  }

  card.innerHTML = existingBanner +
    /* Service row */
    '<div class="vault-service-row">' +
      '<div class="vault-service-icon" style="background:' + (meta.color || '#6c5ce7') + '18;border:1.5px solid ' + (meta.color || '#6c5ce7') + '33;">' + meta.icon + '</div>' +
      '<div>' +
        '<div class="vault-service-name">' + meta.label + ' needs authorization</div>' +
        '<div class="vault-service-sub">' + (authInfo.reason || 'This URL requires login to access') + '</div>' +
      '</div>' +
    '</div>' +

    /* Tier picker */
    '<div class="vault-tier-opts">' +
      '<label class="vault-tier-opt selected" data-tier="open">' +
        '<input type="radio" name="vault-tier" value="open" checked>' +
        '<div>' +
          '<div class="vault-tier-opt-label">🔓 This browser</div>' +
          '<div class="vault-tier-opt-desc">Fastest. Agents run 24/7 without interruption. Credentials stay on this device.</div>' +
        '</div>' +
      '</label>' +
      '<label class="vault-tier-opt" data-tier="locked-local">' +
        '<input type="radio" name="vault-tier" value="locked-local">' +
        '<div>' +
          '<div class="vault-tier-opt-label">🔒 This browser, flake-locked</div>' +
          '<div class="vault-tier-opt-desc">Agents pause when your session expires. You unlock with your image pattern.</div>' +
        '</div>' +
      '</label>' +
      '<label class="vault-tier-opt" data-tier="locked-vault">' +
        '<input type="radio" name="vault-tier" value="locked-vault">' +
        '<div>' +
          '<div class="vault-tier-opt-label">🏛 newauth vault</div>' +
          '<div class="vault-tier-opt-desc">Credentials sync across all your devices. Flake-protected.</div>' +
        '</div>' +
      '</label>' +
    '</div>' +

    /* BYOK — collapsed under Advanced */
    '<div style="margin-bottom:10px;">' +
      '<button id="vault-advanced-toggle" style="background:none;border:none;' +
        'font-size:10px;color:#aaa;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;">' +
        '<span id="vault-advanced-arrow" style="font-size:8px;">▶</span> Advanced' +
      '</button>' +
      '<div id="vault-byok-fields" style="display:none;margin-top:8px;">' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:6px;">' +
          '<input type="checkbox" id="vault-byok-toggle" style="accent-color:#6c5ce7;">' +
          '<span style="font-size:10px;color:#888;">Use my own ' + meta.label + ' app credentials (BYOK)</span>' +
        '</label>' +
        '<input id="vault-byok-client-id" type="text" placeholder="Client ID" ' +
          'style="width:100%;box-sizing:border-box;padding:7px 9px;border:1.5px solid #e8e8f0;' +
          'border-radius:7px;font-size:11px;outline:none;display:none;">' +
      '</div>' +
    '</div>' +

    /* Connect button */
    '<button class="vault-connect-btn">' +
      'Connect ' + meta.label + ' →' +
    '</button>';

  container.appendChild(card);

  /* ── Wire interactions ── */

  /* Tier selection highlight */
  var tierOpts = card.querySelectorAll('.vault-tier-opt');
  for (var i = 0; i < tierOpts.length; i++) {
    tierOpts[i].addEventListener('click', function() {
      for (var j = 0; j < tierOpts.length; j++) tierOpts[j].classList.remove('selected');
      this.classList.add('selected');
    });
  }

  /* Advanced toggle */
  var advancedBtn   = card.querySelector('#vault-advanced-toggle');
  var advancedArrow = card.querySelector('#vault-advanced-arrow');
  var byokFields    = card.querySelector('#vault-byok-fields');
  var byokToggle    = card.querySelector('#vault-byok-toggle');
  var byokClientId  = card.querySelector('#vault-byok-client-id');

  if (advancedBtn && byokFields) {
    advancedBtn.addEventListener('click', function() {
      var open = byokFields.style.display !== 'none';
      byokFields.style.display  = open ? 'none' : 'block';
      advancedArrow.textContent = open ? '▶' : '▼';
    });
  }
  if (byokToggle && byokClientId) {
    byokToggle.addEventListener('change', function() {
      byokClientId.style.display = this.checked ? 'block' : 'none';
    });
  }

  /* Use existing */
  var useExistingBtn = card.querySelector('.vault-use-existing');
  if (useExistingBtn && existing_entry) {
    useExistingBtn.addEventListener('click', function() {
      card.remove();
      if (typeof onConnected === 'function') onConnected(existing_entry.ID);
    });
  }

  /* Connect button */
  var connectBtn = card.querySelector('.vault-connect-btn');
  connectBtn.addEventListener('click', function() {
    var selectedTier = 'open';
    var radios = card.querySelectorAll('input[type=radio]');
    for (var r = 0; r < radios.length; r++) {
      if (radios[r].checked) { selectedTier = radios[r].value; break; }
    }

    var byokClientId = null;
    var byokIdInput  = card.querySelector('#vault-byok-client-id');
    if (byokToggle && byokToggle.checked && byokIdInput && byokIdInput.value.trim()) {
      byokClientId = byokIdInput.value.trim();
    }
    /* Re-grab byokToggle in case it was re-rendered */
    byokToggle = card.querySelector('#vault-byok-toggle');

    connectBtn.disabled    = true;
    connectBtn.textContent = 'Connecting…';

    /* Create registry entry now (pending) */
    var entry = createVaultRegistryEntry(service, null, authInfo.auth_type || 'oauth2', selectedTier);
    if (byokClientId) entry.byokClientId = byokClientId;
    vaultRegistry.upsert(entry);

    /* Update watcher */
    setWatcherPendingVault(watcherItem, entry.ID);

    /* Kick off OAuth */
    var ctx = JSON.stringify({
      entryId:  entry.ID,
      tier:     selectedTier,
    });

    fetch('/api/connect/' + service + '/init?context=' + encodeURIComponent(ctx)
        + (byokClientId ? '&client_id=' + encodeURIComponent(byokClientId) : ''),
      { method: 'GET', credentials: 'include' })
      .then(function(res) {
        if (!res.ok) throw new Error('Init failed: ' + res.status);
        return res.json();
      })
      .then(function(data) {
        _centeredPopup(data.authUrl, 'vault_' + service, 520, 640);
        connectBtn.textContent = 'Waiting for authorization…';

        /* Listen for completion */
        var done = false;
        window.addEventListener('message', function _waitForVault(event) {
          if (event.origin !== window.location.origin) return;
          var msg = event.data || {};
          if (msg.type !== 'agnts_oauth_callback' || msg.service !== service) return;
          if (done) return;
          done = true;
          window.removeEventListener('message', _waitForVault);

          if (msg.error) {
            connectBtn.disabled    = false;
            connectBtn.textContent = 'Retry →';
            vaultRegistry.setStatus(entry.ID, 'error');
            return;
          }

          /* Update entry with identifier */
          entry.identifier  = msg.payload.email || msg.payload.username || msg.payload.identifier || null;
          entry.vaultStatus = 'connected';
          entry.connectedAt = Date.now();
          vaultRegistry.upsert(entry);

          card.remove();
          if (typeof onConnected === 'function') onConnected(entry.ID);
        });
      })
      .catch(function(err) {
        connectBtn.disabled    = false;
        connectBtn.textContent = 'Retry →';
        console.error('[vaultUX] connect failed:', err);
      });
  });
}


/* ─────────────────────────────────────────────────────────────────────────────
   FLOW 2 — FLAKE PROMPT OVERLAY
   Call showFlakePrompt(compositions, onUnlocked, onSkip)
   compositions — all user compositions (to find paused agents)
   onUnlocked   — callback() when flake validated and vault keys warmed
   onSkip       — callback() if user dismisses (agents stay paused)

   NOTE: Image data comes from your registration system.
   showFlakePrompt expects window._agntFlakeImages to be set:
   window._agntFlakeImages = [
     { id: 'img_001', src: 'https://...', anchorForPrev: false },
     { id: 'img_002', src: 'https://...', anchorForPrev: true  },  ← repeated anchor
     ...
   ]
   ───────────────────────────────────────────────────────────────────────────── */


   /*
    * showFlakeIntroCard(compositions, onLaunch, onSkip)
    * Shows a small card near the first paused dot.
    * Card has the first flake image + a launch button.
    * Call this instead of showFlakePrompt directly.
    */
   function showFlakeIntroCard(compositions, onLaunch, onSkip) {
     if (document.getElementById('agnts-flake-intro')) return;
     
     // ── Wait for dots to render before positioning ──────────────────
     setTimeout(function() {
       _showFlakeIntroCardInner(compositions, onLaunch, onSkip);
     }, 500);
   }

   function _showFlakeIntroCardInner(compositions, onLaunch, onSkip) {
     
     if (document.getElementById('agnts-flake-intro')) return;
    
     var paused     = getWatchersNeedingFlake(compositions || []);
     if (!paused.length) return;
    
     var images     = window._agntFlakeImages || [];
     var firstImage = images[0] ? images[0].src : null;
     var agentNames = paused.map(function(p) { return p.composition.name || 'Agent'; });
     var MAX_SHOW   = 1;
     var title      = agentNames[0] || 'Your agent';
     var extra      = agentNames.length - MAX_SHOW;
     var titleStr   = extra > 0
       ? title + ' <span style="color:#6c5ce7;">+' + extra + ' more</span>'
       : title;
    
     /* Find the dot for the first paused composition */
     var firstComp  = paused[0].composition;
     var dot        = document.querySelector('.dot[data-id="' + firstComp.displayID + '"]');
    
     var card = document.createElement('div');
     card.id  = 'agnts-flake-intro';
     card.className = 'flake-intro-card';
    
     card.innerHTML =
       '<div class="fic-img-wrap" id="fic-img-wrap">' +
         (firstImage ? '<img class="fic-img" src="' + firstImage + '" draggable="false">' : '') +
         '<div class="fic-gradient"></div>' +
         '<div class="fic-lock">🔒</div>' +
         '<button class="fic-close" id="fic-close-btn">✕</button>' +
		 '<div class="fic-overlay-text">' +
		   '<div class="fic-agent-name">' + 
		     (agentNames.length === 1 ? 'Your agent needs your flake' : 'Your agents need your flake') + 
		   '</div>' +
		   '<div class="fic-sub">' + 
		     title + (extra > 0 ? ' <span style="color:rgba(255,255,255,0.5);">(+' + extra + ' more)</span>' : '') +
		   '</div>' +
		   '<div class="fic-tap-hint">🔒 Tap to unlock →</div>' +
		 '</div>'
       '</div>';
    
     /* Position below dot, or center if no dot found */
     if (dot) {
       var dotRect = dot.getBoundingClientRect();
       /* Try below dot first */
	   var left = dotRect.left + (dotRect.width / 2) - 140;  // ← 140 = half of 280px card
	   var top  = dotRect.bottom + 8;
       /* If no room below, go above */
       if (top + 210 > window.innerHeight) top = dotRect.top - 210 - 10;
       /* If no room above either, go right */
       if (top < 12) {
         left = dotRect.right + 12;
         top  = dotRect.top;
       }
       /* Keep horizontally on screen */
       if (left + 245 > window.innerWidth)  left = window.innerWidth - 250;
       if (left < 8)                         left = 8;
       if (top  < 8)                         top  = 8;
       card.style.left = left + 'px';
       card.style.top  = top  + 'px';
    
       /* Add pulsing dashed ring to paused dot */
       dot.classList.add('fic-dot-paused');
     } else {
       card.style.left      = '50%';
       card.style.top       = '50%';
       card.style.transform = 'translate(-50%, -50%)';
     }
    
     document.body.appendChild(card);
    
     function _removeDotRing() {
       if (dot) dot.classList.remove('fic-dot-paused');
     }
    
     /* Click image area → launch full overlay */
     card.querySelector('#fic-img-wrap').addEventListener('click', function(e) {
       if (e.target.closest('#fic-close-btn')) return;
       _removeDotRing();
       card.remove();
       if (typeof onLaunch === 'function') onLaunch();
     });
    
     /* Close (X) → pause agents, dismiss card */
     card.querySelector('#fic-close-btn').addEventListener('click', function(e) {
       e.stopPropagation();
       _removeDotRing();
       var needFlake = getWatchersNeedingFlake(compositions || []);
       for (var i = 0; i < needFlake.length; i++) {
         var w = needFlake[i].watcher;
         if (typeof WatcherPanel !== 'undefined' && WatcherPanel.stopPolling) {
           WatcherPanel.stopPolling(w.displayID);
         }
         w._pendingFlake     = true;
         w._pollingSuspended = true;
       }
       card.remove();
       if (typeof onSkip === 'function') onSkip();
     });
   }


   function showFlakePrompt(compositions, onUnlocked, onSkip) {
     if (document.getElementById('agnts-flake-overlay')) return;
    
     var paused    = getWatchersNeedingFlake(compositions);
     var images    = window._agntFlakeImages || [];
     var totalImgs = images.length;
    
     if (!totalImgs) {
       console.warn('[vaultUX] No flake images available — cannot show flake prompt');
       return;
     }
    
     var agentNames = paused.map(function(p) { return p.composition.name || 'Agent'; });
    
     /* Agent pill label — first name + count */
     var pillLabel = agentNames[0] || 'Agent';
     if (agentNames.length > 1) pillLabel += ' +' + (agentNames.length - 1);
    
     /* State */
     var currentImg = 0;
     var clickData  = [];
     var imgStartMs = Date.now();
     var hasClicked = false;
    
     /* Build overlay */
     var overlay = document.createElement('div');
     overlay.id  = 'agnts-flake-overlay';
    
     overlay.innerHTML =
       /* Full-screen image */
       '<div class="flake-image-wrap" id="flake-img-wrap">' +
         '<img id="flake-img" src="' + (images[0] ? images[0].src : '') + '" draggable="false">' +
       '</div>' +
    
       /* Minimal top bar — lock icon + agent pill + close */
	   '<div style="position:absolute;top:0;left:0;right:0;z-index:2;' +
	     'padding:14px 16px;' +
	     'background:linear-gradient(to bottom,rgba(10,8,24,0.65) 0%,transparent 100%);' +
	     'display:flex;align-items:center;justify-content:space-between;">' +
	     '<div style="display:flex;align-items:center;gap:8px;">' +
	       '<span style="font-size:15px;">🔒</span>' +
	       '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;' +
	         'background:rgba(108,92,231,0.55);color:#fff;border:1px solid rgba(108,92,231,0.4);">' +
	         pillLabel +
	       '</span>' +
	     '</div>' +
	     '<button class="flake-skip" style="width:24px;height:24px;border-radius:50%;' +
	       'background:rgba(0,0,0,0.4);border:none;color:#fff;font-size:12px;cursor:pointer;' +
	       'display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0;">✕</button>' +
	   '</div>';
    
     /* Backdrop */
     var backdrop = document.createElement('div');
     backdrop.id  = 'agnts-flake-backdrop';
     document.body.appendChild(backdrop);
     document.body.appendChild(overlay);
    
     /* ── Wire interactions ── */
     var imgWrap = overlay.querySelector('#flake-img-wrap');
     var imgEl   = overlay.querySelector('#flake-img');
    
     function _advanceImage() {
       currentImg++;
    
       if (currentImg >= totalImgs) {
         /* Last image clicked — auto-submit */
         _submitFlake();
         return;
       }
    
       /* Load next image silently */
       imgEl.style.opacity = '0';
       imgEl.src = images[currentImg].src;
       imgEl.onload = function() { imgEl.style.opacity = '1'; };
       hasClicked = false;
       imgStartMs = Date.now();
     }
    
     imgWrap.addEventListener('click', function(e) {
       if (hasClicked) return;
    
       /* Determine actual rendered image bounds (letterbox aware) */
       var imgRect  = imgEl.getBoundingClientRect();
       var wrapRect = imgWrap.getBoundingClientRect();
    
       /* object-fit:contain — compute rendered image area */
       var natW   = imgEl.naturalWidth  || 1;
       var natH   = imgEl.naturalHeight || 1;
       var scaleX = imgRect.width  / natW;
       var scaleY = imgRect.height / natH;
       var scale  = Math.min(scaleX, scaleY);
       var rendW  = natW * scale;
       var rendH  = natH * scale;
       var imgLeft = imgRect.left + (imgRect.width  - rendW) / 2;
       var imgTop  = imgRect.top  + (imgRect.height - rendH) / 2;
       var imgRight  = imgLeft + rendW;
       var imgBottom = imgTop  + rendH;
    
       /* Ignore clicks outside the actual image area */
       if (e.clientX < imgLeft || e.clientX > imgRight ||
           e.clientY < imgTop  || e.clientY > imgBottom) {
         return;
       }
    
       hasClicked = true;
    
       /* Record coordinates relative to image (0-1) */
       var x_pct  = (e.clientX - imgLeft) / rendW;
       var y_pct  = (e.clientY - imgTop)  / rendH;
       var timing = Date.now() - imgStartMs;
    
       /* Record silently — no dot shown */
       clickData.push({
         imageId:  images[currentImg].id,
         x_pct:    Math.round(x_pct * 1000) / 1000,
         y_pct:    Math.round(y_pct * 1000) / 1000,
         timingMs: timing,
       });
    
       /* Advance after short pause */
       setTimeout(_advanceImage, 320);
     });
    
     /* Auto-submit after last image click */
     async function _submitFlake() {
       try {
         /* Test mode — mock server response */
         var res;
         if (window._agntFlakeTestMode) {
           res = {
             ok:   true,
             json: async function() {
               return {
                 flakeObj:      { sessionId: 'test_' + Date.now(), clicks: clickData },
                 nextSessionId: 'test_session_' + Date.now(),
                 prevFlakeObj:  null,
               };
             }
           };
         } else {
           res = await fetch('/api/flake/validate', {
             method:  'POST',
             headers: { 'Content-Type': 'application/json' },
             credentials: 'include',
             body: JSON.stringify({
               clicks:    clickData,
               sessionId: localStorage.getItem('agnts_flake_session_id') || '',
             }),
           });
         }
    
         if (!res.ok) {
           /* Wrong pattern — shake and reset silently */
           overlay.style.animation = 'flakeShake 0.35s ease';
           setTimeout(function() { overlay.style.animation = ''; }, 400);
           currentImg = 0;
           clickData  = [];
           hasClicked = false;
           imgStartMs = Date.now();
           imgEl.style.opacity = '0';
           setTimeout(function() {
             imgEl.src = images[0].src;
             imgEl.style.opacity = '1';
           }, 200);
           return;
         }
    
         var flakeData = await res.json();
         /* flakeData: { flakeObj, nextSessionId, prevFlakeObj } */
    
         /* Store session ID for next images fetch */
         if (flakeData.nextSessionId) {
           localStorage.setItem('agnts_flake_session_id', flakeData.nextSessionId);
         }
         /* Clear cached images — next session gets a fresh set */
         window._agntFlakeImages = null;
    
         /* Unlock all locked-local entries using the flake */
         var allEntries = vaultRegistry.getAll();
         for (var i = 0; i < allEntries.length; i++) {
           var entry = allEntries[i];
           if (entry.tier !== 'locked-local') continue;
    
           /* Re-derive and cache the key — this is the unlock */
           try {
             await localVault.retrieve(entry.ID, 'locked-local', flakeData.flakeObj);
             /* retrieve() caches the key as a side-effect */
    
             /* Rekey with new flake (rotates encryption) */
             if (flakeData.prevFlakeObj) {
               await localVault.rekey(
                 entry.ID, 'locked-local', 'locked-local',
                 flakeData.prevFlakeObj, flakeData.flakeObj
               );
             }
           } catch(keyErr) {
             console.warn('[vaultUX] Could not unlock entry:', entry.ID, keyErr);
           }
         }
    
         /* Clear _pendingFlake on all paused watchers */
         for (var j = 0; j < paused.length; j++) {
           clearWatcherPendingFlake(paused[j].watcher);
         }
    
         /* Close overlay */
         overlay.style.animation = 'flakeOverlayIn 0.15s ease reverse';
         backdrop.style.animation = 'flakeOverlayIn 0.15s ease reverse';
         setTimeout(function() {
           overlay.remove();
           backdrop.remove();
           if (typeof onUnlocked === 'function') onUnlocked();
         }, 200);
    
       } catch(err) {
         console.error('[vaultUX] Flake validation error:', err);
         /* Reset silently so user can retry */
         currentImg = 0;
         clickData  = [];
         hasClicked = false;
         imgStartMs = Date.now();
         imgEl.style.opacity = '0';
         setTimeout(function() {
           imgEl.src = images[0].src;
           imgEl.style.opacity = '1';
         }, 200);
       }
     }
    
     /* Skip */
     overlay.querySelector('.flake-skip').addEventListener('click', function() {
       overlay.remove();
       backdrop.remove();
       if (typeof onSkip === 'function') onSkip();
     });
    
     /* No click-outside dismiss — image fills whole overlay, clicking IS the interaction */
   }



/* ─────────────────────────────────────────────────────────────────────────────
   FLOW 3 — GMAIL WATCHER CONFIG
   Call renderGmailConfig(container, watcherItem, vaultEntryId, onSave)
   container    — DOM element to append the config panel into
   watcherItem  — the watcher being configured
   vaultEntryId — the connected vault registry entry ID
   onSave       — callback(updatedWatcherItem) when user saves
   ───────────────────────────────────────────────────────────────────────────── */

var GMAIL_PRESETS = [
  { label: '📬 Unread inbox',  query: 'is:unread in:inbox'                 },
  { label: '⭐ Starred',        query: 'is:starred'                         },
  { label: '👤 From boss',      query: 'from:{boss@company.com} is:unread'  },
  { label: '📎 Has attachment', query: 'has:attachment is:unread'           },
  { label: '🔔 Mentions me',    query: 'to:me is:unread'                    },
  { label: '✏️ Custom…',        query: '__custom__'                         },
];

function renderGmailConfig(container, watcherItem, vaultEntryId, onSave) {
  /* Remove any existing config */
  var existing = container.querySelector('.gmail-config-panel');
  if (existing) existing.remove();

  var entry       = vaultRegistry.getById(vaultEntryId);
  var accountId   = (entry && entry.identifier) || 'Gmail account';
  var currentQuery = watcherItem.gmailQuery || 'is:unread in:inbox';
  var maxResults   = watcherItem.gmailMaxResults || 20;

  /* Determine active preset */
  var activePreset = '__custom__';
  for (var p = 0; p < GMAIL_PRESETS.length - 1; p++) {
    if (GMAIL_PRESETS[p].query === currentQuery) {
      activePreset = GMAIL_PRESETS[p].query;
      break;
    }
  }

  var panel = document.createElement('div');
  panel.className = 'gmail-config-panel';

  /* Build presets HTML */
  var presetsHtml = '';
  for (var i = 0; i < GMAIL_PRESETS.length; i++) {
    var pr = GMAIL_PRESETS[i];
    var isActive = (pr.query === activePreset || (pr.query === '__custom__' && activePreset === '__custom__'));
    presetsHtml += '<button class="gmail-preset' + (isActive ? ' active' : '') + '" ' +
      'data-query="' + pr.query + '">' + pr.label + '</button>';
  }

  var isCustom = (activePreset === '__custom__');

  panel.innerHTML =
    /* Account indicator */
    '<div class="gmail-config-footer" style="margin-bottom:12px;margin-top:0;">' +
      '<div class="gmail-account-pill">' +
        '<div class="gmail-account-dot"></div>' +
        '<span>' + accountId + '</span>' +
      '</div>' +
      '<button class="gmail-save-btn" style="background:transparent;color:#888;' +
        'border:1px solid #e8e8f0;font-size:10px;padding:4px 8px;" ' +
        'id="gmail-switch-account">Switch account</button>' +
    '</div>' +

    '<div class="gc-label">What to watch</div>' +
    '<div class="gmail-presets">' + presetsHtml + '</div>' +

    /* Query input — shown for custom */
    '<div id="gmail-query-wrap" style="margin-bottom:10px;' + (isCustom ? '' : 'display:none;') + '">' +
      '<input class="gmail-query-input" id="gmail-query-input" ' +
        'placeholder="Gmail search query e.g. from:boss is:unread" ' +
        'value="' + (isCustom ? currentQuery : '') + '">' +
      '<div style="font-size:9px;color:#aaa;margin-top:4px;">' +
        'Uses Gmail search syntax — ' +
        '<a href="https://support.google.com/mail/answer/7190" target="_blank" ' +
        'style="color:#6c5ce7;text-decoration:none;">syntax guide ↗</a>' +
      '</div>' +
    '</div>' +

    /* Max results */
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">' +
      '<span style="font-size:10px;color:#888;">Fetch up to</span>' +
      '<select id="gmail-max-results" style="font-size:11px;padding:4px 6px;' +
        'border:1.5px solid #e8e8f0;border-radius:6px;background:#fafafa;color:#333;outline:none;">' +
        [5,10,20,50].map(function(n) {
          return '<option value="' + n + '"' + (n === maxResults ? ' selected' : '') + '>' + n + ' messages</option>';
        }).join('') +
      '</select>' +
      '<span style="font-size:10px;color:#888;">per check</span>' +
    '</div>' +

    '<div class="gmail-config-footer">' +
      '<span style="font-size:10px;color:#aaa;">Checked every ' +
        (watcherItem.pollIntervalMin || 15) + ' min</span>' +
      '<button class="gmail-save-btn" id="gmail-save-btn">Save watcher →</button>' +
    '</div>';

  container.appendChild(panel);

  /* ── Wire interactions ── */

  var queryWrap  = panel.querySelector('#gmail-query-wrap');
  var queryInput = panel.querySelector('#gmail-query-input');
  var presetBtns = panel.querySelectorAll('.gmail-preset');
  var saveBtn    = panel.querySelector('#gmail-save-btn');
  var maxSel     = panel.querySelector('#gmail-max-results');

  var _activeQuery = isCustom ? currentQuery : activePreset;

  /* Preset clicks */
  for (var b = 0; b < presetBtns.length; b++) {
    presetBtns[b].addEventListener('click', function() {
      for (var x = 0; x < presetBtns.length; x++) presetBtns[x].classList.remove('active');
      this.classList.add('active');

      var q = this.getAttribute('data-query');
      if (q === '__custom__') {
        queryWrap.style.display = 'block';
        queryInput.focus();
        _activeQuery = queryInput.value || '';
      } else {
        queryWrap.style.display = 'none';
        _activeQuery = q;
      }
    });
  }

  queryInput.addEventListener('input', function() {
    _activeQuery = this.value;
  });

  /* Switch account */
  var switchBtn = panel.querySelector('#gmail-switch-account');
  if (switchBtn) {
    switchBtn.addEventListener('click', function() {
      panel.remove();
      /* Re-trigger vault connect for gmail */
      var authCard = container.querySelector('.vault-auth-card');
      if (!authCard) {
        renderVaultAuthCard(container, watcherItem, function(newEntryId) {
          renderGmailConfig(container, watcherItem, newEntryId, onSave);
        });
      }
    });
  }

  /* Save */
  saveBtn.addEventListener('click', function() {
    var finalQuery = _activeQuery === '__custom__'
      ? (queryInput.value.trim() || 'is:unread in:inbox')
      : _activeQuery;

    watcherItem.gmailQuery      = finalQuery;
    watcherItem.gmailMaxResults = parseInt(maxSel.value) || 20;
    watcherItem._vaultRef       = vaultEntryId;
    watcherItem.sourceType      = 'gmail';

    clearWatcherPendingVault(watcherItem);

    panel.remove();
    if (typeof onSave === 'function') onSave(watcherItem);
  });
}


/* ─────────────────────────────────────────────────────────────────────────────
   ORCHESTRATOR HOOK
   Call this from the watcher URL input onChange in agnts-app-ext.js:

   agntVaultUX.onWatcherUrlChange(container, watcherItem, function(entryId) {
     // vault connected — if gmail, show query config
     var entry = vaultRegistry.getById(entryId);
     if (entry && entry.service === 'gmail') {
       agntVaultUX.renderGmailConfig(container, watcherItem, entryId, function(w) {
         saveWatcher(w);
       });
     }
   });
   ───────────────────────────────────────────────────────────────────────────── */

function onWatcherUrlChange(container, watcherItem, onConnected) {
  var url = watcherItem.targetUrl || '';
  if (!url || url.length < 4) return;

  /* Debounce — wait for user to stop typing */
  clearTimeout(watcherItem._authDetectTimer);
  watcherItem._authDetectTimer = setTimeout(function() {
    renderVaultAuthCard(container, watcherItem, onConnected);
  }, 600);
}


/* ─────────────────────────────────────────────────────────────────────────────
   PAGE LOAD HOOK
   Call from orchestrator init after _installOAuthListener:

   agntVaultUX.checkAndShowFlakePrompt(compositions);
   ───────────────────────────────────────────────────────────────────────────── */

async function checkAndShowFlakePrompt(compositions, onUnlocked) {
  var paused = getWatchersNeedingFlake(compositions || []);
  if (!paused.length) return;

  var _onUnlocked = onUnlocked || function() {
    if (window.WatcherPanel && typeof WatcherPanel.resumeAll === 'function') {
      WatcherPanel.resumeAll();
    }
  };

  function _launchFull() {
    showFlakePrompt(compositions, _onUnlocked, function() { /* skipped */ });
  }

  /* Test mode or images already loaded — show intro card first */
  if (window._agntFlakeTestMode) {
    console.warn('[newauthOAuth] ⚠️ FLAKE TEST MODE IS ON — set window._agntFlakeTestMode=false for production');
    setTimeout(function() {
      showFlakeIntroCard(compositions, _launchFull, function() {});
    }, 1800);
    return;
  }
  if (window._agntFlakeImages && window._agntFlakeImages.length) {
    setTimeout(function() {
      showFlakeIntroCard(compositions, _launchFull, function() {});
    }, 1800);
    return;
  }

  /* Real mode — fetch images from server first */
  try {
    var sessionId = localStorage.getItem('agnts_flake_session_id') || '';
    var res = await fetch('/api/flake/images', {
      headers: { 'X-Flake-Session': sessionId },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Could not load flake images: ' + res.status);
    var data = await res.json();
    window._agntFlakeImages = data.images;
    setTimeout(function() {
      showFlakeIntroCard(compositions, _launchFull, function() {});
    }, 1800);
  } catch(err) {
    console.warn('[newauthOAuth] Could not load flake images — agents stay paused:', err);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXPORTS — single global namespace
   ───────────────────────────────────────────────────────────────────────────── */

window.newauthOAuth = {
  /* Vault registry — localStorage metadata */
  vaultRegistry:              vaultRegistry,

  /* Vault storage — IndexedDB encrypted credentials */
  localVault:                 localVault,

  /* Vault registry entry factory */
  createVaultRegistryEntry:   createVaultRegistryEntry,

  /* Watcher state helpers */
  setWatcherPendingVault:     setWatcherPendingVault,
  clearWatcherPendingVault:   clearWatcherPendingVault,
  setWatcherPendingFlake:     setWatcherPendingFlake,
  clearWatcherPendingFlake:   clearWatcherPendingFlake,
  getWatchersNeedingFlake:    getWatchersNeedingFlake,

  /* Vault access check */
  checkVaultAccess:           checkVaultAccess,

  /* Auth detection */
  detectAuthRequirement:      detectAuthRequirement,

  /* OAuth flow */
  vaultConnect:               vaultConnect,

  /* Authenticated fetch */
  vaultFetch:                 vaultFetch,

  /* Service adapters */
  gmailFetch:                 gmailFetch,
  gmailFetchBody:             gmailFetchBody,
  githubFetch:                githubFetch,

  /* Popup helper */
  centeredPopup:              _centeredPopup,

  /* Listener — call from orchestrator init */
  installOAuthListener:       _installOAuthListener,

  /* ── UX flows ── */
  renderVaultAuthCard:        renderVaultAuthCard,
  showFlakePrompt:            showFlakePrompt,
  renderGmailConfig:          renderGmailConfig,
  onWatcherUrlChange:         onWatcherUrlChange,
  checkAndShowFlakePrompt:    checkAndShowFlakePrompt,
  showFlakeIntroCard:         showFlakeIntroCard,
  showFlakePrompt:            showFlakePrompt,
};

/* Backward-compat aliases */
window.agntVault    = window.newauthOAuth;
window.agntVaultUX  = window.newauthOAuth;