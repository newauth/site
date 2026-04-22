/**
 * agnts-app-ext.js
 *
 * Bootstraps the 'agnts' app inside the SchemaOrchestrator.
 *
 * Hierarchy:  agntuser → composition → worker
 *
 * Key responsibilities:
 *   1. Force localStorage for 'agnts' app
 *   2. Email onboarding for new users (hashed email as workspace address)
 *   3. Composition creation — reads compositionTemplates from server JSON config,
 *      spawns one worker instance per template entry
 *   4. Worker cloning — multiplicity:true workers get a clone affordance on the dot
 *   5. Worker tap routing — routes to the right panel based on workerType
 *      (chat → openChatView, others → stub panels ready for implementation)
 *   6. hit++ on worker run — keeps canvas dot sizing meaningful
 *   7. Schema + native entity registration (idempotent)
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1.  CONSTANTS
  ───────────────────────────────────────────── */
  const APP_ID       = 'agnts';
  const STORAGE_KEY  = `savedContexts_${APP_ID}`;
  const USER_KEY     = `agnts_user`;
  const API_REGISTER = '/newauth/api/agntsuserregister';

  /* ─────────────────────────────────────────────
     2.  HASH HELPER  (FNV-1a 64-bit)
  ───────────────────────────────────────────── */
  function hashEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const norm       = email.trim().toLowerCase();
    const FNV_PRIME  = BigInt('0x100000001b3');
    const FNV_OFFSET = BigInt('0xcbf29ce484222325');
    let hash = FNV_OFFSET;
    for (let i = 0; i < norm.length; i++) {
      hash ^= BigInt(norm.charCodeAt(i));
      hash  = BigInt.asUintN(64, hash * FNV_PRIME);
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
    const ctx = [{
      path: [hashedEmail],
      timestamp: Date.now(),
      isOwnerAccess: false
    }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
    return user;
  }

  /* ─────────────────────────────────────────────
     4.  SERVER REGISTRATION  (fire-and-forget)
  ───────────────────────────────────────────── */
  async function registerWithServer(email, hashedEmail) {
    try {
      const res = await fetch(API_REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, hashedEmail, appId: APP_ID, registeredAt: new Date().toISOString() })
      });
      if (!res.ok) console.warn('[agnts] Server registration returned', res.status, '— continuing locally');
      else         console.log('[agnts] Server registration OK');
    } catch (err) {
      console.warn('[agnts] Server registration failed (offline?):', err.message);
    }
  }

  /* ─────────────────────────────────────────────
     5.  CONFIG ACCESSORS
         All template/workerType data read from the
         live app config on the orchestrator — never
         hardcoded in this file.
  ───────────────────────────────────────────── */
  function getCompositionTemplates(orchestrator) {
    return orchestrator.currentApp?.compositionTemplates || {};
  }

  // workerBehavior is the ONLY worker-type data that lives in the app config.
  // Everything else (fields, labels, descriptions, icons) lives in the
  // native entity definition for 'worker', read by the orchestrator's form renderer.
  function getWorkerBehavior(orchestrator, workerType) {
    return orchestrator.currentApp?.workerBehavior?.[workerType] || {};
  }

  // Read worker display metadata from the native entity definition.
  // Falls back gracefully if not found.
  function getWorkerNativeMeta(orchestrator, workerType) {
    const nativeEntities = orchestrator.currentApp?.nativeEntities || {};
    const workerEntity   = nativeEntities['worker'] || {};
    // Icon and color aren't in the field list — those come from workerBehavior
    return workerEntity;
  }

  /* ─────────────────────────────────────────────
     6.  WORKER SPAWNING
         Called when a new composition is created.
         Reads the template from config, spawns one
         worker instance per entry.
  ───────────────────────────────────────────── */
  async function spawnWorkersForComposition(orchestrator, compositionItem) {
    const templates   = getCompositionTemplates(orchestrator);
    const template    = templates[compositionItem.compositionType];
    if (!template) {
      console.warn('[agnts] No template found for compositionType:', compositionItem.compositionType);
      return;
    }

    const workers = template.workers.map((workerDef, idx) => ({
      ID:          generateId(),
      displayID:   `${compositionItem.displayID}-${workerDef.workerType}-1`,
      name:        workerDef.name,
      dotLabel:    workerDef.dotLabel,
      workerType:  workerDef.workerType,
      instance:    1,
      multiplicity: workerDef.multiplicity || false,
      hit:         0,
      lastRun:     null,
      alertThreshold: 0,
      convid:      null,
      timestamp:   Date.now() + idx   // slight offset so entrance animation staggers
    }));

    // Persist workers under this composition
    compositionItem.workers = workers;
    await orchestrator.db.saveEntity(APP_ID, compositionItem, 'composition');
    console.log('[agnts] Spawned', workers.length, 'workers for', compositionItem.name);
  }

  /* ─────────────────────────────────────────────
     7.  WORKER CLONING
         Adds a new instance of a multiplicity:true
         worker to an existing composition.
  ───────────────────────────────────────────── */
  async function cloneWorker(orchestrator, compositionItem, sourceWorker) {
    const siblings    = (compositionItem.workers || []).filter(w => w.workerType === sourceWorker.workerType);
    const nextInstance = siblings.length + 1;

    const clone = {
      ID:           generateId(),
      displayID:    `${compositionItem.displayID}-${sourceWorker.workerType}-${nextInstance}`,
      name:         `${sourceWorker.name}-${nextInstance}`,
      dotLabel:     `${sourceWorker.dotLabel.replace(/\d+$/, '')}${nextInstance}`,
      workerType:   sourceWorker.workerType,
      instance:     nextInstance,
      multiplicity: true,
      hit:          0,
      lastRun:      null,
      alertThreshold: sourceWorker.alertThreshold || 0,
      convid:       null,
      timestamp:    Date.now()
    };

    compositionItem.workers = [...(compositionItem.workers || []), clone];
    await orchestrator.db.saveEntity(APP_ID, compositionItem, 'composition');
    console.log('[agnts] Cloned worker:', clone.name);

    // Ripple the composition dot so the user sees activity
    orchestrator._pendingRipples = orchestrator._pendingRipples || new Map();
    orchestrator._pendingRipples.set(compositionItem.displayID, Date.now() + 10000);
    orchestrator.render && orchestrator.render();
  }

  /* ─────────────────────────────────────────────
     8.  HIT INCREMENT
         Called by panels when a worker actually runs.
         Keeps dot sizes meaningful on the canvas.
  ───────────────────────────────────────────── */
  async function incrementWorkerHit(orchestrator, compositionItem, workerItem) {
    workerItem.hit      = (workerItem.hit || 0) + 1;
    workerItem.lastRun  = Date.now();
    workerItem.timestamp = Date.now();

    // Also bubble up to composition so its aggregate score updates
    compositionItem.hit = Math.max(...(compositionItem.workers || []).map(w => w.hit || 0));

    await orchestrator.db.saveEntity(APP_ID, compositionItem, 'composition');

    // Queue ripple on the composition dot
    orchestrator._pendingRipples = orchestrator._pendingRipples || new Map();
    orchestrator._pendingRipples.set(compositionItem.displayID, Date.now() + 10000);
  }

  /* ─────────────────────────────────────────────
     9.  PANEL REGISTRY
         Maps workerType → handler function.
         Each handler receives (orchestrator, compositionItem, workerItem).
         Add real panel implementations here as they are built.
         chat is fully wired — others are stubs.
  ───────────────────────────────────────────── */
  const PANEL_REGISTRY = {

    chat: (orchestrator, compositionItem, workerItem) => {
      // Reuse existing openChatView — wire up convid, create one if missing
      if (!workerItem.convid) {
        workerItem.convid = `agnts-chat-${workerItem.displayID}-${Date.now()}`;
        orchestrator.db.saveEntity(APP_ID, compositionItem, 'composition');
      }
      orchestrator.openChatView(workerItem.convid, 'worker', workerItem);
      incrementWorkerHit(orchestrator, compositionItem, workerItem);
    },

    researcher: (orchestrator, compositionItem, workerItem) => {
      console.log('[agnts] ResearcherPanel — stub for', workerItem.name);
      // TODO: implement ResearcherPanel
      // ResearcherPanel.open(orchestrator, compositionItem, workerItem, {
      //   onRun: () => incrementWorkerHit(orchestrator, compositionItem, workerItem)
      // });
      showStubPanel(orchestrator, workerItem, '#00C8FF');
    },

    watcher: (orchestrator, compositionItem, workerItem) => {
      console.log('[agnts] WatcherPanel — stub for', workerItem.name);
      // TODO: implement WatcherPanel
      showStubPanel(orchestrator, workerItem, '#10B981');
    },

    reviewer: (orchestrator, compositionItem, workerItem) => {
      console.log('[agnts] ReviewerPanel — stub for', workerItem.name);
      showStubPanel(orchestrator, workerItem, '#8B5CF6');
    },

    pm: (orchestrator, compositionItem, workerItem) => {
      console.log('[agnts] PlannerPanel — stub for', workerItem.name);
      showStubPanel(orchestrator, workerItem, '#7C3AED');
    },

    coder: (orchestrator, compositionItem, workerItem) => {
      console.log('[agnts] CoderPanel — stub for', workerItem.name);
      showStubPanel(orchestrator, workerItem, '#22C55E');
    },

    tester: (orchestrator, compositionItem, workerItem) => {
      console.log('[agnts] TesterPanel — stub for', workerItem.name);
      showStubPanel(orchestrator, workerItem, '#84CC16');
    },

    extractor: (orchestrator, compositionItem, workerItem) => {
      showStubPanel(orchestrator, workerItem, '#F59E0B');
    },

    analyst: (orchestrator, compositionItem, workerItem) => {
      showStubPanel(orchestrator, workerItem, '#06B6D4');
    },

    writer: (orchestrator, compositionItem, workerItem) => {
      showStubPanel(orchestrator, workerItem, '#EC4899');
    },

    guardian: (orchestrator, compositionItem, workerItem) => {
      showStubPanel(orchestrator, workerItem, '#EF4444');
    },

    monitor: (orchestrator, compositionItem, workerItem) => {
      showStubPanel(orchestrator, workerItem, '#64748B');
    },

    classifier: (orchestrator, compositionItem, workerItem) => {
      showStubPanel(orchestrator, workerItem, '#8B5CF6');
    },

    memory: (orchestrator, compositionItem, workerItem) => {
      showStubPanel(orchestrator, workerItem, '#14B8A6');
    }
  };

  /* stub panel — terminal-style placeholder shown until real panel is built */
  function showStubPanel(orchestrator, workerItem, accentColor) {
    const typeDef  = getWorkerBehavior(orchestrator, workerItem.workerType);
    const canvas   = document.getElementById('canvas-area');
    if (!canvas) return;

    // Remove any existing stub
    document.getElementById('agnts-stub-panel')?.remove();

    const panel = document.createElement('div');
    panel.id = 'agnts-stub-panel';
    panel.style.cssText = `
      position: absolute; inset: 0;
      background: #080C12;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      z-index: 500;
    `;
    panel.innerHTML = `
      <div style="text-align:center; max-width: 360px;">
        <div style="font-size: 48px; margin-bottom: 16px;">${typeDef.icon || '🤖'}</div>
        <div style="font-size: 11px; letter-spacing: 0.3em; color: ${accentColor}; margin-bottom: 8px; text-transform: uppercase;">
          ${workerItem.workerType} · instance ${workerItem.instance || 1}
        </div>
        <div style="font-size: 22px; font-weight: 700; color: #E8F4FF; margin-bottom: 12px;">
          ${workerItem.name}
        </div>
        <div style="font-size: 13px; color: #4A7A9B; line-height: 1.7; margin-bottom: 32px;">
          ${typeDef.description || 'Panel coming soon.'}
        </div>
        <div style="
          background: #0A1A26; border: 1px solid ${accentColor}30;
          border-radius: 6px; padding: 14px 18px;
          font-size: 11px; color: #2D5A7A; line-height: 1.8; margin-bottom: 28px;
        ">
          runs: <span style="color:${accentColor}">${workerItem.hit || 0}</span> &nbsp;·&nbsp;
          last run: <span style="color:${accentColor}">${workerItem.lastRun ? new Date(workerItem.lastRun).toLocaleTimeString() : 'never'}</span>
        </div>
        <button id="agnts-stub-close" style="
          background: transparent; border: 1px solid ${accentColor}60;
          color: ${accentColor}; font-family: inherit; font-size: 11px;
          letter-spacing: 0.2em; text-transform: uppercase;
          padding: 10px 24px; border-radius: 4px; cursor: pointer;
        ">← Back to Canvas</button>
      </div>
    `;
    canvas.appendChild(panel);
    document.getElementById('agnts-stub-close').onclick = () => panel.remove();
  }

  /* ─────────────────────────────────────────────
     10. CLONE BUTTON
         Injected onto worker dots where multiplicity:true
  ───────────────────────────────────────────── */
  function attachCloneButton(dot, orchestrator, compositionItem, workerItem) {
    const btn = document.createElement('span');
    btn.title = `Clone ${workerItem.name}`;
    btn.style.cssText = `
      position: absolute; bottom: -6px; right: -6px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #1A6A9A; border: 2px solid #0A0F16;
      font-size: 11px; display: flex; align-items: center; justify-content: center;
      color: white; font-weight: bold; cursor: pointer;
      pointer-events: all; z-index: 201;
    `;
    btn.textContent = '+';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await cloneWorker(orchestrator, compositionItem, workerItem);
    });
    dot.style.overflow = 'visible';
    dot.appendChild(btn);
  }

  /* ─────────────────────────────────────────────
     11. EMAIL ONBOARDING SCREEN
  ───────────────────────────────────────────── */
  function showEmailOnboarding(orchestratorInstance, onComplete) {
    const canvas = document.getElementById('canvas-area');
    if (!canvas) return;

    canvas.innerHTML = `
      <div id="agnts-onboarding" style="
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: min(420px, 90vw);
        font-family: 'IBM Plex Mono', 'Courier New', monospace;
        z-index: 1000;
      ">
        <div style="
          background: #080C12; border: 1px solid #1E2D40;
          border-radius: 10px; overflow: hidden;
          box-shadow: 0 0 0 1px #0D1F33, 0 32px 80px rgba(0,0,0,0.7);
        ">
          <div style="
            background: #0D1820; padding: 12px 20px;
            display: flex; align-items: center; gap: 8px;
            border-bottom: 1px solid #1E2D40;
          ">
            <span style="width:10px;height:10px;border-radius:50%;background:#FF5F57;display:inline-block;"></span>
            <span style="width:10px;height:10px;border-radius:50%;background:#FEBC2E;display:inline-block;"></span>
            <span style="width:10px;height:10px;border-radius:50%;background:#28C840;display:inline-block;"></span>
            <span style="margin-left:12px;font-size:11px;letter-spacing:0.15em;color:#3D5A73;text-transform:uppercase;">
              agnts — initialize workspace
            </span>
          </div>
          <div style="padding: 32px 28px;">
            <div style="font-size:11px;letter-spacing:0.2em;color:#00C8FF;margin-bottom:6px;text-transform:uppercase;">
              $ agnts --init
            </div>
            <div style="font-size:22px;font-weight:700;color:#E8F4FF;line-height:1.3;margin-bottom:8px;">
              Your agents.<br>Your workspace.
            </div>
            <div style="font-size:12px;color:#4A7A9B;line-height:1.7;margin-bottom:28px;">
              Build compositions of AI agents. Visualize their activity.<br>
              Scale workers as needed. Everything stays in your browser.<br>
              <span style="color:#2D5A7A;">Your email creates your private workspace address. It is hashed — we never store it plain.</span>
            </div>
            <div style="margin-bottom:16px;">
              <label style="display:block;font-size:10px;letter-spacing:0.2em;color:#3D7A9B;text-transform:uppercase;margin-bottom:8px;">
                Your Email Address
              </label>
              <input id="agnts-email-input" type="email" placeholder="you@example.com" autocomplete="email" style="
                width:100%;box-sizing:border-box;background:#0D1820;
                border:1px solid #1E3A52;border-radius:6px;
                padding:12px 14px;color:#E8F4FF;font-family:inherit;
                font-size:14px;outline:none;transition:border-color 0.2s;
              "/>
              <div id="agnts-email-error" style="display:none;font-size:11px;color:#FF6B6B;margin-top:6px;"></div>
            </div>
            <div style="
              background:#0A1A26;border:1px solid #142233;border-radius:6px;
              padding:12px 14px;margin-bottom:24px;display:flex;gap:10px;align-items:flex-start;
            ">
              <span style="color:#00C8FF;font-size:14px;flex-shrink:0;">🔒</span>
              <span style="font-size:11px;color:#3D6A8A;line-height:1.6;">
                Your email is hashed in the browser before any data is written.
                The hash is your workspace address. Your raw email is sent to our server
                <em style="color:#2D5A7A;">only once</em> for account records.
              </span>
            </div>
            <button id="agnts-start-btn" style="
              width:100%;background:linear-gradient(135deg,#0A4D6E 0%,#0D3A5C 100%);
              border:1px solid #1A6A9A;border-radius:6px;color:#E8F4FF;
              font-family:inherit;font-size:12px;letter-spacing:0.15em;
              text-transform:uppercase;padding:14px;cursor:pointer;transition:all 0.2s;
            ">Initialize Workspace →</button>
            <div id="agnts-loading" style="display:none;text-align:center;margin-top:20px;font-size:11px;color:#3D6A8A;letter-spacing:0.15em;">
              <span id="agnts-loading-text">Hashing email...</span>
              <div style="width:100%;height:2px;background:#0D1820;border-radius:2px;margin-top:10px;overflow:hidden;">
                <div id="agnts-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#00C8FF,#0A7ABE);transition:width 0.4s ease;border-radius:2px;"></div>
              </div>
            </div>
          </div>
        </div>
        <div style="text-align:center;margin-top:16px;font-size:10px;color:#1E3A52;letter-spacing:0.1em;">
          YOUR AGENTS · YOUR DATA · YOUR BROWSER
        </div>
      </div>
    `;

    const emailInput = document.getElementById('agnts-email-input');
    emailInput.addEventListener('focus', () => {
      emailInput.style.borderColor = '#00C8FF';
      emailInput.style.boxShadow   = '0 0 0 2px rgba(0,200,255,0.1)';
    });
    emailInput.addEventListener('blur', () => {
      emailInput.style.borderColor = '#1E3A52';
      emailInput.style.boxShadow   = 'none';
    });
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('agnts-start-btn').click();
    });

    document.getElementById('agnts-start-btn').addEventListener('click', async () => {
      const email    = emailInput.value.trim();
      const errorEl  = document.getElementById('agnts-email-error');
      const loadingEl = document.getElementById('agnts-loading');
      const loadingText = document.getElementById('agnts-loading-text');
      const progressBar = document.getElementById('agnts-progress-bar');
      const btn      = document.getElementById('agnts-start-btn');

      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRx.test(email)) {
        errorEl.textContent    = 'Please enter a valid email address.';
        errorEl.style.display  = 'block';
        emailInput.style.borderColor = '#FF6B6B';
        return;
      }
      errorEl.style.display    = 'none';
      emailInput.style.borderColor = '#1E3A52';

      btn.style.display        = 'none';
      loadingEl.style.display  = 'block';

      loadingText.textContent  = 'Hashing email...';
      progressBar.style.width  = '25%';
      await tick();

      const hashedEmail = hashEmail(email);
      console.log('[agnts] Email hashed to:', hashedEmail);

      loadingText.textContent  = 'Initializing local workspace...';
      progressBar.style.width  = '55%';
      await tick();

      storeUser(email, hashedEmail);

      loadingText.textContent  = 'Registering workspace...';
      progressBar.style.width  = '80%';
      await registerWithServer(email, hashedEmail);

      progressBar.style.width  = '100%';
      loadingText.textContent  = 'Workspace ready ✓';
      await delay(600);

      onComplete(hashedEmail);
    });

    setTimeout(() => emailInput.focus(), 80);
  }

  /* ─────────────────────────────────────────────
     12. ORCHESTRATOR PATCH
  ───────────────────────────────────────────── */
  function patchOrchestrator() {
    if (!window.SchemaOrchestrator) {
      console.warn('[agnts] SchemaOrchestrator not found — retrying in 200ms');
      setTimeout(patchOrchestrator, 200);
      return;
    }

    const proto = window.SchemaOrchestrator.prototype;

    /* ── 12a. selectApp: force localStorage for agnts ── */
    const _selectApp = proto.selectApp;
    proto.selectApp = async function (appId) {
      if (appId === APP_ID) {
        this.db.useLocalStorage = true;
        console.log('[agnts] Storage mode: LOCAL');
      }
      return _selectApp.call(this, appId);
    };

    /* ── 12b. init: inject onboarding for new users ── */
    const _init = proto.init;
    proto.init = async function () {
      const urlInfo   = this.parseUrlForDataFetch ? this.parseUrlForDataFetch() : null;
      const isAgntApp = urlInfo && urlInfo.appId === APP_ID;

      if (!isAgntApp) return _init.call(this);

      this.db.useLocalStorage = true;
      const user = getStoredUser();

      if (user && user.hashedEmail) {
        console.log('[agnts] Returning user:', user.hashedEmail);
        const ctx = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (ctx.length === 0) storeUser(user.email, user.hashedEmail);
        return _init.call(this);
      }

      console.log('[agnts] New user — showing email onboarding');

      const _showCreateTenantOption = this.showCreateTenantOption.bind(this);
      this.showCreateTenantOption = () => {
        showEmailOnboarding(this, async (hashedEmail) => {
          this.showCreateTenantOption = _showCreateTenantOption;

          const newPath = [{
            id:         hashedEmail,
            displayID:  hashedEmail,
            shortName:  hashedEmail.substring(0, 3).toUpperCase(),
            entityType: this.currentApp?.hierarchy?.[0] || 'agntuser',
            asuuid:     false
          }];

          this.currentPath = newPath;
          if (this.saveLastViewedContext) this.saveLastViewedContext(APP_ID, [hashedEmail]);

          const newUrl = this.getAppUrl ? this.getAppUrl(newPath) : `/t/apps/${APP_ID}/${hashedEmail}`;
          window.history.pushState({ path: newPath }, '', newUrl);

          try {
            this.data = await this.db.getAppData(APP_ID, [hashedEmail]);
          } catch (_) {
            this.data = { items: [] };
          }

          this.render          && this.render();
          this.updateBreadcrumb && this.updateBreadcrumb();
          this.updateWatermark  && this.updateWatermark();
        });
      };

      return _init.call(this);
    };

    /* ── 12c. Wrap openAddDialog: intercept at composition level to show template picker ── */
    const _openAddDialog = proto.openAddDialog;
    proto.openAddDialog = function (...args) {
      if (this.currentApp?.id !== APP_ID) return _openAddDialog.apply(this, args);

      const depth = this.currentPath.length;

      // At composition level (depth=1): show template picker instead of generic add dialog
      if (depth === 1) {
        showCompositionPicker(this);
        return;
      }

      // At worker level (depth=2): workers are spawned by templates, not manually added
      // So we block the generic add dialog — cloning handles new instances
      if (depth === 2) {
        console.log('[agnts] Workers are added via clone button, not manually');
        return;
      }

      return _openAddDialog.apply(this, args);
    };

    /* ── 12d. Wrap navigateTo: handle worker tap (leaf node routing) ── */
    const _navigateTo = proto.navigateTo;
    proto.navigateTo = function (item, entityType) {
      if (this.currentApp?.id !== APP_ID) {
        this._pendingRipples?.delete(item.displayID);
        return _navigateTo.call(this, item, entityType);
      }

      const depth = this.currentPath.length;

      // Tapping a worker (depth=2, leaf) → route to panel, don't navigate deeper
      if (depth === 2 && entityType === 'worker') {
        this._pendingRipples?.delete(item.displayID);
        const compositionItem = this._getCurrentComposition();
        if (!compositionItem) return;
        const handler = PANEL_REGISTRY[item.workerType];
        if (handler) {
          handler(this, compositionItem, item);
        } else {
          console.warn('[agnts] No panel registered for workerType:', item.workerType);
          showStubPanel(this, item, '#667eea');
        }
        return;
      }

      // Tapping a composition (depth=1) → navigate in, consume ripple
      this._pendingRipples?.delete(item.displayID);
      return _navigateTo.call(this, item, entityType);
    };

    /* ── 12e. Wrap afterEntityCreated: spawn workers when a composition is saved ── */
    const _afterEntityCreated = proto.afterEntityCreated;
    proto.afterEntityCreated = async function (item, entityType) {
      if (this.currentApp?.id === APP_ID && entityType === 'composition') {
        await spawnWorkersForComposition(this, item);
      }
      if (_afterEntityCreated) return _afterEntityCreated.call(this, item, entityType);
    };

    /* ── 12f. Wrap render: inject clone buttons onto multiplicity worker dots ── */
    const _render = proto.render;
    proto.render = function (...args) {
      const result = _render.apply(this, args);

      if (this.currentApp?.id !== APP_ID) return result;
      if (this.currentPath.length !== 2) return result;  // only at worker level

      const compositionItem = this._getCurrentComposition();
      if (!compositionItem) return result;

      // Find all rendered dots and attach clone buttons where applicable
      requestAnimationFrame(() => {
        const canvas = document.getElementById('canvas-area');
        if (!canvas) return;
        canvas.querySelectorAll('.dot').forEach(dot => {
          const workerItem = dot.itemData;
          if (!workerItem || dot.dataset.cloneAttached) return;
          if (workerItem.multiplicity) {
            attachCloneButton(dot, this, compositionItem, workerItem);
            dot.dataset.cloneAttached = 'true';
          }
        });
      });

      return result;
    };

    console.log('[agnts] Orchestrator patched successfully');
  }

  /* ─────────────────────────────────────────────
     13. COMPOSITION PICKER
         Terminal-style modal shown when user taps +
         at the composition level. Lists all
         compositionTemplates from the server config.
  ───────────────────────────────────────────── */
  function showCompositionPicker(orchestrator) {
    const templates = getCompositionTemplates(orchestrator);
    const entries   = Object.entries(templates);
    if (!entries.length) {
      console.warn('[agnts] No composition templates found in app config');
      return;
    }

    document.getElementById('agnts-composition-picker')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'agnts-composition-picker';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.75);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; font-family: 'IBM Plex Mono','Courier New',monospace;
    `;

    const cards = entries.map(([key, tpl]) => {
      const workerSummary = tpl.workers
        .map(w => `<span style="color:#4A7A9B;">${w.name}${w.multiplicity ? ' <span style="color:#00C8FF">×N</span>' : ''}</span>`)
        .join(' · ');
      return `
        <div class="agnts-tpl-card" data-key="${key}" style="
          background:#0A0F16; border:1px solid #1A2233;
          border-radius:6px; padding:18px 20px; cursor:pointer;
          transition:all 0.15s; position:relative; overflow:hidden;
        ">
          <div style="position:absolute;top:0;left:0;width:3px;height:100%;background:${tpl.color || '#667eea'};opacity:0.5;"></div>
          <div style="padding-left:12px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <span style="font-size:20px;">${tpl.icon || '🤖'}</span>
              <span style="font-size:15px;font-weight:700;color:#F1F5F9;">${tpl.name}</span>
              <span style="margin-left:auto;font-size:9px;letter-spacing:0.15em;color:#334155;background:#111827;padding:2px 8px;border-radius:2px;border:1px solid #1E293B;">
                ${tpl.workers.length} WORKERS
              </span>
            </div>
            <div style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:10px;">${tpl.description}</div>
            <div style="font-size:11px;">${workerSummary}</div>
          </div>
        </div>
      `;
    }).join('');

    overlay.innerHTML = `
      <div style="
        background:#080C12; border:1px solid #1E2D40;
        border-radius:10px; width:min(560px,92vw); max-height:85vh;
        overflow-y:auto; box-shadow:0 32px 80px rgba(0,0,0,0.7);
      ">
        <div style="
          background:#0D1820; padding:14px 20px;
          display:flex; justify-content:space-between; align-items:center;
          border-bottom:1px solid #1E2D40; position:sticky; top:0; z-index:1;
        ">
          <span style="font-size:11px;letter-spacing:0.2em;color:#3D5A73;text-transform:uppercase;">
            $ agnts --new-composition
          </span>
          <button id="agnts-picker-close" style="
            background:transparent;border:none;color:#3D5A73;
            font-size:18px;cursor:pointer;line-height:1;
          ">✕</button>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:10px;">
          ${cards}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Hover effect
    overlay.querySelectorAll('.agnts-tpl-card').forEach(card => {
      card.addEventListener('mouseenter', () => { card.style.borderColor = '#2D3748'; card.style.background = '#0D1117'; });
      card.addEventListener('mouseleave', () => { card.style.borderColor = '#1A2233'; card.style.background = '#0A0F16'; });
    });

    // Selection
    overlay.addEventListener('click', async (e) => {
      const card = e.target.closest('.agnts-tpl-card');
      if (!card) return;

      const key = card.dataset.key;
      const tpl = templates[key];
      overlay.remove();

      // Build the new composition item
      const compositionItem = {
        ID:              generateId(),
        displayID:       `${key}-${Date.now()}`,
        name:            tpl.name,
        dotLabel:        tpl.dotLabel,
        compositionType: key,
        hit:             0,
        timestamp:       Date.now(),
        workers:         []
      };

      // Save it — afterEntityCreated hook will spawn workers
      try {
        await orchestrator.db.saveEntity(APP_ID, compositionItem, 'composition');
        await spawnWorkersForComposition(orchestrator, compositionItem);
        if (orchestrator.data?.items) {
          orchestrator.data.items.push(compositionItem);
        }
        orchestrator._pendingRipples = orchestrator._pendingRipples || new Map();
        orchestrator._pendingRipples.set(compositionItem.displayID, Date.now() + 10000);
        orchestrator.render && orchestrator.render();
      } catch (err) {
        console.error('[agnts] Failed to save composition:', err);
      }
    });

    document.getElementById('agnts-picker-close').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  /* ─────────────────────────────────────────────
     14. HELPER: get current composition from path
  ───────────────────────────────────────────── */
  function attachGetCurrentComposition(proto) {
    proto._getCurrentComposition = function () {
      if (!this.data?.items || this.currentPath.length < 2) return null;
      const compositionPathEntry = this.currentPath[1];
      return this.data.items.find(item =>
        item.displayID === compositionPathEntry.displayID ||
        item.ID        === compositionPathEntry.id
      ) || null;
    };
  }

  /* ─────────────────────────────────────────────
     15. SCHEMA REGISTRATION  (idempotent)
  ───────────────────────────────────────────── */
  async function ensureAgntSchema() {
    if (!window.DatabaseService) return;

    const db = new window.DatabaseService(null, true);
    await db.initStorage();

    const schemas = await db.getAppSchemas();
    const exists  = schemas.find(s => s.id === APP_ID);
    if (exists) {
      console.log('[agnts] Schema already registered');
      return;
    }

    const agntSchema = db.createCustomSchema(
      'agnts',
      'Agent Studio',
      'YOUR AGENTS, VISUALIZED — NOT HIDDEN IN CHAT',
      ['agntuser', 'composition', 'worker'],
      {
        agntuser: {
          labelField:          'dotLabel',
          idField:             'ID',
          childEntity:         'composition',
          childrenField:       'compositions',
          disallowShareButton: false,
          sortConfig: { type: 'aggregate', aggregateField: 'hit', aggregateFunction: 'max' }
        },
        composition: {
          distributed:   true,
          labelField:    'dotLabel',
          idField:       'ID',
          childEntity:   'worker',
          childrenField: 'workers',
          sortConfig: { type: 'aggregate', aggregateField: 'hit', aggregateFunction: 'max' }
        },
        worker: {
          labelField: 'dotLabel',
          idField:    'ID',
          sortConfig: { type: 'field', scoreField: 'hit', alertThresholdField: 'alertThreshold', alertDirection: 'below' }
        }
      }
    );

    await db.saveAppSchema(agntSchema);
    console.log('[agnts] App schema registered');

    // ── Native entity definitions ──────────────────────────────────────────
    // These mirror the agnts-native-entities.json file on the server.
    // The orchestrator's form renderer reads these field definitions to build
    // the add/edit dialogs — exactly the same pattern as seller/customer/concern.
    // writePermission values:
    //   'system' — set by code only, never shown in form
    //   'any'    — editable by the user who owns this entity
    //   'parent' — editable by the parent entity owner
    //   'owner'  — editable only by the root workspace owner

    const entities = await db.getNativeEntities();

    if (!entities.agntuser) {
      await db.saveNativeEntity('agntuser', {
        name: 'Agent User',
        description: 'Workspace owner — identified by hashed email',
        fields: [
          { name: 'ID',          label: 'User ID',           type: 'text',     mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'displayID',   label: 'Display ID',        type: 'text',     mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'name',        label: 'Display Name',      type: 'text',     mandatory: true,  writePermission: 'any',    dataSource: 'manual' },
          { name: 'dotLabel',    label: 'Dot Label',         type: 'text',     mandatory: true,  writePermission: 'any',    dataSource: 'manual' },
          { name: 'email',       label: 'Email',             type: 'email',    mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hit',         label: 'Total Runs',        type: 'number',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'timestamp',   label: 'Created',           type: 'number',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hidden',      label: 'Hidden',            type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hashed',      label: 'Use Hashed URL',    type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'writeAccess', label: 'Write Access',      type: 'select',   mandatory: false, writePermission: 'owner',  dataSource: 'manual', options: ['owner', 'any'] },
          { name: 'readAccess',  label: 'Read Access',       type: 'select',   mandatory: false, writePermission: 'owner',  dataSource: 'manual', options: ['owner', 'any'] }
        ]
      });
      console.log('[agnts] Native entity "agntuser" registered');
    }

    if (!entities.composition) {
      await db.saveNativeEntity('composition', {
        name: 'Composition',
        description: 'A named team of agent workers — spawned from a template',
        fields: [
          { name: 'ID',              label: 'Composition ID',   type: 'text',     mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'displayID',       label: 'Display ID',       type: 'text',     mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'name',            label: 'Composition Name', type: 'text',     mandatory: true,  writePermission: 'any',    dataSource: 'manual' },
          { name: 'dotLabel',        label: 'Dot Label',        type: 'text',     mandatory: true,  writePermission: 'any',    dataSource: 'manual' },
          { name: 'compositionType', label: 'Composition Type', type: 'select',   mandatory: true,  writePermission: 'any',    dataSource: 'manual',
            options: ['researcher', 'coder', 'analyst', 'guardian', 'chat'] },
          { name: 'description',     label: 'Description',      type: 'textarea', mandatory: false, writePermission: 'any',    dataSource: 'manual' },
          { name: 'hit',             label: 'Max Worker Runs',  type: 'number',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'timestamp',       label: 'Created',          type: 'number',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hidden',          label: 'Hidden',           type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hashed',          label: 'Use Hashed URL',   type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'writeAccess',     label: 'Write Access',     type: 'select',   mandatory: false, writePermission: 'any',    dataSource: 'manual', options: ['owner', 'any'] },
          { name: 'readAccess',      label: 'Read Access',      type: 'select',   mandatory: false, writePermission: 'any',    dataSource: 'manual', options: ['owner', 'any'] }
        ]
      });
      console.log('[agnts] Native entity "composition" registered');
    }

    if (!entities.worker) {
      await db.saveNativeEntity('worker', {
        name: 'Worker',
        description: 'A single agent instance within a composition',
        fields: [
          // ── System-managed identity fields (never shown in form) ──
          { name: 'ID',             label: 'Worker ID',        type: 'text',     mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'displayID',      label: 'Display ID',       type: 'text',     mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'workerType',     label: 'Worker Type',      type: 'select',   mandatory: true,  writePermission: 'system', dataSource: 'manual',
            options: ['researcher','watcher','reviewer','pm','coder','tester','extractor','analyst','writer','guardian','monitor','classifier','memory','chat'] },
          { name: 'instance',       label: 'Instance #',       type: 'number',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'multiplicity',   label: 'Can Be Cloned',    type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hit',            label: 'Run Count',        type: 'number',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'lastRun',        label: 'Last Run',         type: 'number',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'convid',         label: 'Conversation ID',  type: 'text',     mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'timestamp',      label: 'Created',          type: 'number',   mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hidden',         label: 'Hidden',           type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          { name: 'hashed',         label: 'Use Hashed URL',   type: 'checkbox', mandatory: false, writePermission: 'system', dataSource: 'manual' },
          // ── User-editable fields (shown in edit form) ──
          { name: 'name',           label: 'Worker Name',      type: 'text',     mandatory: true,  writePermission: 'any',    dataSource: 'manual' },
          { name: 'dotLabel',       label: 'Dot Label',        type: 'text',     mandatory: true,  writePermission: 'any',    dataSource: 'manual' },
          { name: 'description',    label: 'Description',      type: 'textarea', mandatory: false, writePermission: 'any',    dataSource: 'manual' },
          { name: 'systemPrompt',   label: 'System Prompt',    type: 'textarea', mandatory: false, writePermission: 'any',    dataSource: 'manual' },
          { name: 'model',          label: 'Model',            type: 'text',     mandatory: false, writePermission: 'any',    dataSource: 'manual' },
          { name: 'provider',       label: 'Provider',         type: 'select',   mandatory: false, writePermission: 'any',    dataSource: 'manual',
            options: ['claude', 'openai', 'gemini', 'mistral', 'local', 'custom'] },
          { name: 'apiKey',         label: 'API Key (local)',  type: 'text',     mandatory: false, writePermission: 'any',    dataSource: 'manual' },
          { name: 'alertThreshold', label: 'Min Run Alert',    type: 'number',   mandatory: false, writePermission: 'any',    dataSource: 'manual' },
          // ── Access control ──
          { name: 'writeAccess',    label: 'Write Access',     type: 'select',   mandatory: false, writePermission: 'parent', dataSource: 'manual', options: ['owner', 'parent', 'any'] },
          { name: 'readAccess',     label: 'Read Access',      type: 'select',   mandatory: false, writePermission: 'parent', dataSource: 'manual', options: ['owner', 'parent', 'any'] }
        ]
      });
      console.log('[agnts] Native entity "worker" registered');
    }
  }

  /* ─────────────────────────────────────────────
     16. UTILITIES
  ───────────────────────────────────────────── */
  function generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`;
  }
  function tick()      { return new Promise(r => requestAnimationFrame(r)); }
  function delay(ms)   { return new Promise(r => setTimeout(r, ms)); }

  /* ─────────────────────────────────────────────
     17. BOOTSTRAP
  ───────────────────────────────────────────── */
  async function bootstrap() {
    console.log('[agnts] Bootstrap start');
    await ensureAgntSchema();
    patchOrchestrator();

    // Attach _getCurrentComposition helper once orchestrator is available
    if (window.SchemaOrchestrator) {
      attachGetCurrentComposition(window.SchemaOrchestrator.prototype);
    }

    console.log('[agnts] Bootstrap complete');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();