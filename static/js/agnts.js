/**
 * agnts-init.js
 * 
 * Bootstraps the 'agnts' app inside the SchemaOrchestrator.
 * 
 * Flow:
 *  1. App ID === 'agnts'  →  force useLocalStorage = true
 *  2. Check localStorage for existing user identity (hashed email key)
 *  3. If found  →  render normally (existing data path)
 *  4. If not    →  show email onboarding screen
 *                  hash the email client-side  →  use as "tenantId" (displayID)
 *                  POST raw email to server for record-keeping / billing
 *                  save hashed key locally  →  proceed to render
 * 
 * Pattern mirrors the custsupport tenant flow exactly:
 *  - hashUUID()  →  replaced with hashEmail() (same FNV-1a algo)
 *  - sendTenantWelcomeEmail()  →  replaced with sendAgentUserRegistration()
 *  - showCreateTenantOption()  →  replaced with showEmailOnboarding()
 *  - localStorage key: savedContexts_agnts  (same shape as other apps)
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1.  CONSTANTS
  ───────────────────────────────────────────── */
  const APP_ID      = 'agnts';
  const STORAGE_KEY = `savedContexts_${APP_ID}`;          // [{path, timestamp, isOwnerAccess}]
  const USER_KEY    = `agnts_user`;                        // {email, hashedEmail, registeredAt}
  const API_REGISTER = '/newauth/api/agntsuserregister';   // POST — email + hashedEmail

  /* ─────────────────────────────────────────────
     2.  HASH HELPER  (FNV-1a 64-bit, same as orchestrator's hashUUID)
         Input: any string (email)
         Output: short base-36 string used as displayID / URL segment
  ───────────────────────────────────────────── */
  function hashEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const norm = email.trim().toLowerCase();
    const FNV_PRIME  = BigInt('0x100000001b3');
    const FNV_OFFSET = BigInt('0xcbf29ce484222325');
    let hash = FNV_OFFSET;
    for (let i = 0; i < norm.length; i++) {
      hash ^= BigInt(norm.charCodeAt(i));
      hash = BigInt.asUintN(64, hash * FNV_PRIME);
    }
    return hash.toString(36).toLowerCase();
  }

  /* ─────────────────────────────────────────────
     3.  LOCAL IDENTITY HELPERS
  ───────────────────────────────────────────── */
  function getStoredUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function storeUser(email, hashedEmail) {
    const user = { email, hashedEmail, registeredAt: Date.now() };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    // Also seed savedContexts so the orchestrator's existing redirect logic kicks in
    const ctx = [{
      path: [hashedEmail],
      timestamp: Date.now(),
      isOwnerAccess: false   // user owns their own slice but is not the app owner
    }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
    return user;
  }

  function hasExistingData() {
    // Check both the identity record and app data
    const user = getStoredUser();
    if (!user) return false;
    const dataKey = `schema_app_app_data_${APP_ID}`;
    try {
      const raw = localStorage.getItem(dataKey);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return Array.isArray(data?.items) && data.items.length > 0;
    } catch (_) { return false; }
  }

  /* ─────────────────────────────────────────────
     4.  SERVER REGISTRATION  (fire-and-forget with error swallow)
  ───────────────────────────────────────────── */
  async function registerWithServer(email, hashedEmail) {
    try {
      const res = await fetch(API_REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          hashedEmail,
          appId: APP_ID,
          registeredAt: new Date().toISOString()
        })
      });
      if (!res.ok) {
        console.warn('[agnts] Server registration returned', res.status, '— continuing locally');
      } else {
        console.log('[agnts] Server registration OK');
      }
    } catch (err) {
      // Non-blocking — local mode works regardless of server availability
      console.warn('[agnts] Server registration failed (offline?):', err.message);
    }
  }

  /* ─────────────────────────────────────────────
     5.  EMAIL ONBOARDING SCREEN
         Injected into #canvas-area, same mount point as showCreateTenantOption()
  ───────────────────────────────────────────── */
  function showEmailOnboarding(orchestratorInstance, onComplete) {
    const canvas = document.getElementById('canvas-area');
    if (!canvas) return;

    canvas.innerHTML = `
      <div id="agnts-onboarding" style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(420px, 90vw);
        font-family: 'IBM Plex Mono', 'Courier New', monospace;
        z-index: 1000;
      ">

        <!-- Terminal-style card -->
        <div style="
          background: #080C12;
          border: 1px solid #1E2D40;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 0 0 1px #0D1F33, 0 32px 80px rgba(0,0,0,0.7);
        ">

          <!-- Title bar -->
          <div style="
            background: #0D1820;
            padding: 12px 20px;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #1E2D40;
          ">
            <span style="width:10px;height:10px;border-radius:50%;background:#FF5F57;display:inline-block;"></span>
            <span style="width:10px;height:10px;border-radius:50%;background:#FEBC2E;display:inline-block;"></span>
            <span style="width:10px;height:10px;border-radius:50%;background:#28C840;display:inline-block;"></span>
            <span style="
              margin-left: 12px;
              font-size: 11px;
              letter-spacing: 0.15em;
              color: #3D5A73;
              text-transform: uppercase;
            ">agnts — initialize workspace</span>
          </div>

          <!-- Body -->
          <div style="padding: 32px 28px;">

            <!-- Prompt line -->
            <div style="
              font-size: 11px;
              letter-spacing: 0.2em;
              color: #00C8FF;
              margin-bottom: 6px;
              text-transform: uppercase;
            ">$ agnts --init</div>

            <div style="
              font-size: 22px;
              font-weight: 700;
              color: #E8F4FF;
              line-height: 1.3;
              margin-bottom: 8px;
            ">Your agents.<br>Your workspace.</div>

            <div style="
              font-size: 12px;
              color: #4A7A9B;
              line-height: 1.7;
              margin-bottom: 28px;
            ">
              Everything lives locally in your browser.<br>
              Your email creates your private workspace address.<br>
              <span style="color: #2D5A7A;">It is hashed — we never store it plain.</span>
            </div>

            <!-- Email input -->
            <div style="margin-bottom: 16px;">
              <label style="
                display: block;
                font-size: 10px;
                letter-spacing: 0.2em;
                color: #3D7A9B;
                text-transform: uppercase;
                margin-bottom: 8px;
              ">Your Email Address</label>

              <div style="position: relative;">
                <input
                  id="agnts-email-input"
                  type="email"
                  placeholder="you@example.com"
                  autocomplete="email"
                  style="
                    width: 100%;
                    box-sizing: border-box;
                    background: #0D1820;
                    border: 1px solid #1E3A52;
                    border-radius: 6px;
                    padding: 12px 14px;
                    color: #E8F4FF;
                    font-family: inherit;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s;
                  "
                />
              </div>

              <div id="agnts-email-error" style="
                display: none;
                font-size: 11px;
                color: #FF6B6B;
                margin-top: 6px;
              "></div>
            </div>

            <!-- Privacy note -->
            <div style="
              background: #0A1A26;
              border: 1px solid #142233;
              border-radius: 6px;
              padding: 12px 14px;
              margin-bottom: 24px;
              display: flex;
              gap: 10px;
              align-items: flex-start;
            ">
              <span style="color: #00C8FF; font-size: 14px; flex-shrink: 0;">🔒</span>
              <span style="font-size: 11px; color: #3D6A8A; line-height: 1.6;">
                Your email is hashed in the browser before any data is written.
                The hash is your workspace address. Your raw email is sent to our server
                <em style="color: #2D5A7A;">only once</em> for account records and future billing.
              </span>
            </div>

            <!-- Submit button -->
            <button
              id="agnts-start-btn"
              style="
                width: 100%;
                background: linear-gradient(135deg, #0A4D6E 0%, #0D3A5C 100%);
                border: 1px solid #1A6A9A;
                border-radius: 6px;
                color: #E8F4FF;
                font-family: inherit;
                font-size: 12px;
                letter-spacing: 0.15em;
                text-transform: uppercase;
                padding: 14px;
                cursor: pointer;
                transition: all 0.2s;
              "
              onmouseover="this.style.background='linear-gradient(135deg, #0D6A94 0%, #0A4D6E 100%)'; this.style.borderColor='#2A8ABE';"
              onmouseout="this.style.background='linear-gradient(135deg, #0A4D6E 0%, #0D3A5C 100%)'; this.style.borderColor='#1A6A9A';"
            >Initialize Workspace →</button>

            <!-- Loading state (hidden by default) -->
            <div id="agnts-loading" style="
              display: none;
              text-align: center;
              margin-top: 20px;
              font-size: 11px;
              color: #3D6A8A;
              letter-spacing: 0.15em;
            ">
              <span id="agnts-loading-text">Hashing email...</span>
              <div style="
                width: 100%;
                height: 2px;
                background: #0D1820;
                border-radius: 2px;
                margin-top: 10px;
                overflow: hidden;
              ">
                <div id="agnts-progress-bar" style="
                  height: 100%;
                  width: 0%;
                  background: linear-gradient(90deg, #00C8FF, #0A7ABE);
                  transition: width 0.4s ease;
                  border-radius: 2px;
                "></div>
              </div>
            </div>

          </div>
        </div>

        <!-- Footnote -->
        <div style="
          text-align: center;
          margin-top: 16px;
          font-size: 10px;
          color: #1E3A52;
          letter-spacing: 0.1em;
        ">YOUR AGENTS · YOUR DATA · YOUR BROWSER</div>

      </div>
    `;

    // — Input focus style
    const emailInput = document.getElementById('agnts-email-input');
    emailInput.addEventListener('focus', () => {
      emailInput.style.borderColor = '#00C8FF';
      emailInput.style.boxShadow = '0 0 0 2px rgba(0,200,255,0.1)';
    });
    emailInput.addEventListener('blur', () => {
      emailInput.style.borderColor = '#1E3A52';
      emailInput.style.boxShadow = 'none';
    });
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('agnts-start-btn').click();
    });

    // — Submit handler
    document.getElementById('agnts-start-btn').addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const errorEl = document.getElementById('agnts-email-error');
      const loadingEl = document.getElementById('agnts-loading');
      const loadingText = document.getElementById('agnts-loading-text');
      const progressBar = document.getElementById('agnts-progress-bar');
      const btn = document.getElementById('agnts-start-btn');

      // Validate
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRx.test(email)) {
        errorEl.textContent = 'Please enter a valid email address.';
        errorEl.style.display = 'block';
        emailInput.style.borderColor = '#FF6B6B';
        return;
      }
      errorEl.style.display = 'none';
      emailInput.style.borderColor = '#1E3A52';

      // Show loading UI
      btn.style.display = 'none';
      loadingEl.style.display = 'block';

      // Step 1 — Hash
      loadingText.textContent = 'Hashing email...';
      progressBar.style.width = '25%';
      await tick();

      const hashedEmail = hashEmail(email);
      console.log('[agnts] Email hashed to:', hashedEmail);

      // Step 2 — Store locally
      loadingText.textContent = 'Initializing local workspace...';
      progressBar.style.width = '55%';
      await tick();

      storeUser(email, hashedEmail);

      // Step 3 — Register with server (non-blocking)
      loadingText.textContent = 'Registering workspace...';
      progressBar.style.width = '80%';
      await registerWithServer(email, hashedEmail);

      // Step 4 — Done
      progressBar.style.width = '100%';
      loadingText.textContent = 'Workspace ready ✓';
      await delay(600);

      // Hand back to orchestrator
      onComplete(hashedEmail);
    });

    // Focus the input after render
    setTimeout(() => emailInput.focus(), 80);
  }

  /* ─────────────────────────────────────────────
     6.  PATCH THE ORCHESTRATOR  (called once after the class is available)
  ───────────────────────────────────────────── */
  function patchOrchestrator() {
    if (!window.SchemaOrchestrator) {
      console.warn('[agnts] SchemaOrchestrator not found on window — retrying in 200ms');
      setTimeout(patchOrchestrator, 200);
      return;
    }

    const proto = window.SchemaOrchestrator.prototype;

    /* ── 6a.  Wrap selectApp: force local storage for 'agnts' ── */
    const _selectApp = proto.selectApp;
    proto.selectApp = async function (appId) {
      if (appId === APP_ID) {
        this.db.useLocalStorage = true;
        console.log('[agnts] Storage mode: LOCAL');
      }
      return _selectApp.call(this, appId);
    };

    /* ── 6b.  Wrap init: inject agnts onboarding before render ── */
    const _init = proto.init;
    proto.init = async function () {
      // Parse URL to see if this is the agnts app
      const urlInfo = this.parseUrlForDataFetch ? this.parseUrlForDataFetch() : null;
      const isAgntApp = urlInfo && urlInfo.appId === APP_ID;

      if (!isAgntApp) {
        // Not our app — delegate normally
        return _init.call(this);
      }

      // Force local storage immediately (before initStorage runs inside _init)
      this.db.useLocalStorage = true;

      const user = getStoredUser();

      if (user && user.hashedEmail) {
        // ── RETURNING USER: data exists path ──
        console.log('[agnts] Returning user detected:', user.hashedEmail);

        // Make sure the saved context is still seeded correctly
        const ctx = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (ctx.length === 0) {
          // Re-seed if somehow wiped
          storeUser(user.email, user.hashedEmail);
        }

        // Let the orchestrator run normally — it will pick up savedContexts
        return _init.call(this);
      }

      // ── NEW USER: show onboarding, then proceed ──
      console.log('[agnts] New user — showing email onboarding');

      // We still need the orchestrator's internal setup to run first
      // (DB init, event listeners, etc.) — so we call _init but intercept
      // the render that would show showCreateTenantOption()
      const _showCreateTenantOption = this.showCreateTenantOption.bind(this);
      this.showCreateTenantOption = () => {
        // Instead of the generic "Create My Organization" dialog,
        // show our custom email onboarding
        showEmailOnboarding(this, async (hashedEmail) => {
          // Restore original method
          this.showCreateTenantOption = _showCreateTenantOption;

          // Now navigate to the user's hashed-email "tenant" path
          const newPath = [{
            id: hashedEmail,
            displayID: hashedEmail,
            shortName: hashedEmail.substring(0, 3).toUpperCase(),
            entityType: this.currentApp?.hierarchy?.[0] || 'user',
            asuuid: false
          }];

          this.currentPath = newPath;

          // Persist context
          if (this.saveLastViewedContext) {
            this.saveLastViewedContext(APP_ID, [hashedEmail]);
          }

          // Update URL to /t/apps/agnts/<hashedEmail>
          const newUrl = this.getAppUrl ? this.getAppUrl(newPath) : `/t/apps/${APP_ID}/${hashedEmail}`;
          window.history.pushState({ path: newPath }, '', newUrl);

          // Load data for this user (will be empty on first visit — that's fine)
          try {
            this.data = await this.db.getAppData(APP_ID, [hashedEmail]);
          } catch (_) {
            this.data = { items: [] };
          }

          this.render && this.render();
          this.updateBreadcrumb && this.updateBreadcrumb();
          this.updateWatermark && this.updateWatermark();
        });
      };

      return _init.call(this);
    };

    console.log('[agnts] Orchestrator patched successfully');
  }

  /* ─────────────────────────────────────────────
     7.  SCHEMA REGISTRATION
         Registers the 'agnts' app schema + native entities into the
         orchestrator's local storage so selectApp() can find it.
  ───────────────────────────────────────────── */
  async function ensureAgntSchema() {
    // Wait for DatabaseService to be available
    if (!window.DatabaseService) return;

    const db = new window.DatabaseService(null, true); // always local
    await db.initStorage();

    const schemas = await db.getAppSchemas();
    const exists = schemas.find(s => s.id === APP_ID);
    if (exists) {
      console.log('[agnts] Schema already registered');
      return;
    }

    // ── App schema ──
    const agntSchema = db.createCustomSchema(
      "agnts",
  "Agent Studio",
  "YOUR AGENTS, VISUALIZED — NOT HIDDEN IN CHAT",
      ['agntuser', 'agent'],
      {
        user: {
          labelField: 'name',
          idField: 'ID',
          childEntity: 'agent',
          childrenField: 'agents',
          disallowShareButton: true,
          sortConfig: { type: 'count' }
        },
        agent: {
          labelField: 'name',
          idField: 'ID',
          childEntity: null,
          childrenField: null,
          sortConfig: { type: 'count' }
        }
      }
    );

    await db.saveAppSchema(agntSchema);
    console.log('[agnts] App schema registered');

    // ── Native entities ──
    const entities = await db.getNativeEntities();

    if (!entities.user) {
      await db.saveNativeEntity('agntuser', {
        name: 'User',
        description: 'Workspace owner — identified by hashed email',
        fields: [
          { name: 'ID',          label: 'User ID',         type: 'text',     mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'displayID',   label: 'Workspace Address', type: 'text',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'name',        label: 'Display Name',    type: 'text',     mandatory: true,  writePermission: 'any',    dataSource: 'manual' },
          { name: 'dotLabel',    label: 'Dot Label',       type: 'text',     mandatory: true,  writePermission: 'any',    dataSource: 'manual' },
          { name: 'email',       label: 'Email',           type: 'email',    mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'timestamp',   label: 'Created',         type: 'number',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hidden',      label: 'Hidden',          type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hashed',      label: 'Hashed',          type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'writeAccess', label: 'Write Access',    type: 'select',   mandatory: false, writePermission: 'root',   dataSource: 'manual', options: ['owner', 'any'] },
          { name: 'readAccess',  label: 'Read Access',     type: 'select',   mandatory: false, writePermission: 'root',   dataSource: 'manual', options: ['owner', 'any'] }
        ]
      });
      console.log('[agnts] Native entity "user" registered');
    }

    if (!entities.agent) {
      await db.saveNativeEntity('agent', {
        name: 'Agent',
        description: 'An AI agent — one dot on the canvas',
        fields: [
          { name: 'ID',            label: 'Agent ID',         type: 'text',     mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'displayID',     label: 'Display ID',       type: 'text',     mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'name',          label: 'Agent Name',       type: 'text',     mandatory: true,  writePermission: 'any',    dataSource: 'manual' },
          { name: 'dotLabel',      label: 'Dot Label',        type: 'text',     mandatory: true,  writePermission: 'any',    dataSource: 'manual' },
          { name: 'agentType',     label: 'Agent Type',       type: 'select',   mandatory: true,  writePermission: 'any',    dataSource: 'manual',
            options: ['Researcher','Memory','Planner','Monitor','Coder','Extractor','Analyst','Writer','Classifier','Guardian','Chat','Watcher'] },
          { name: 'model',         label: 'Model',            type: 'text',     mandatory: false, writePermission: 'any',    dataSource: 'manual' },
          { name: 'provider',      label: 'Provider',         type: 'select',   mandatory: false, writePermission: 'any',    dataSource: 'manual',
            options: ['claude', 'gemini', 'openai', 'mistral', 'local', 'custom'] },
          { name: 'systemPrompt',  label: 'System Prompt',    type: 'textarea', mandatory: false, writePermission: 'any',    dataSource: 'manual' },
          { name: 'description',   label: 'Description',      type: 'textarea', mandatory: false, writePermission: 'any',    dataSource: 'manual' },
          { name: 'isExternal',    label: 'Calls External API', type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'timestamp',     label: 'Created',          type: 'number',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hidden',        label: 'Hidden',           type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hashed',        label: 'Hashed',           type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'writeAccess',   label: 'Write Access',     type: 'select',   mandatory: false, writePermission: 'root',   dataSource: 'manual', options: ['owner', 'any'] },
          { name: 'readAccess',    label: 'Read Access',      type: 'select',   mandatory: false, writePermission: 'root',   dataSource: 'manual', options: ['owner', 'any'] }
        ]
      });
      console.log('[agnts] Native entity "agent" registered');
    }
  }

  /* ─────────────────────────────────────────────
     8.  UTILITIES
  ───────────────────────────────────────────── */
  function tick() {
    return new Promise(r => requestAnimationFrame(r));
  }
  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /* ─────────────────────────────────────────────
     9.  BOOTSTRAP — runs after DOM + orchestrator are ready
  ───────────────────────────────────────────── */
  async function bootstrap() {
    console.log('[agnts] Bootstrap start');

    // Register schema first (idempotent)
    await ensureAgntSchema();

    // Patch the orchestrator class
    patchOrchestrator();

    console.log('[agnts] Bootstrap complete');
  }

  // Entry point
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();