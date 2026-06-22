/**
 * captable-app-ext.js
 *
 * Bootstraps the 'captable' app inside the SchemaOrchestrator.
 *
 * Hierarchy:  investor (tenant) → company → stakeholder (aggregate) → grant (append-only leaf)
 *
 * Key responsibilities:
 *   1. Investor (tenant) creation — fully generic, no captable-specific
 *      code: the platform's existing addItem(entityType, form) flow
 *      handles UUID generation, saveLastViewedContext, and navigation for
 *      the root-level "create your workspace" form. Owner-only tenant (no
 *      anonymous/voter roles, unlike Poll).
 *   2. Cap table import — "no template" header detection against an
 *      OCX-aligned synonym dictionary, an in-app column-mapping screen for
 *      anything unresolved, security-class / stakeholder-type normalization,
 *      entity construction (company / stakeholder / grant), and "Me"
 *      stakeholder fuzzy-matching.
 *   3. Import UI — file picker, column-mapping modal, "Me" picker modal.
 *   4. [STUBS — later build orders] Simulate menu, context-aware `+` menu,
 *      ownership/score-field toggles, scenario overlay. See spec §7-9.
 *
 * Mirrors the agnts-app-ext.js pattern: single IIFE, attaches methods onto
 * the live `orchestrator` instance via installCaptableExt(), bootstraps on
 * DOMContentLoaded (or immediately if the document is already ready).
 *
 * ASSUMPTIONS flagged inline with "ASSUMPTION:" — these mirror patterns
 * visible in agnts-app-ext.js (orchestrator.db.saveAppData, .render(),
 * .showNotification()) but a few captable-specific bits (how methods get
 * dispatched, orchestrator.data shape) are best-effort and should be
 * checked against the real orchestrator source.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1. CONSTANTS
  ───────────────────────────────────────────── */
  const APP_ID = 'captable';

  // The 6 fields required for v1 import, each anchored to its OCX/OCF
  // standard name. `synonyms` are normalized (lowercase, punctuation
  // stripped) for exact matching — see normalizeHeader().
  const REQUIRED_FIELDS = {
    holderName: {
      label: 'Holder Name',
      ocxName: 'Stakeholder Name',
      synonyms: [
        'stakeholder name', 'stakeholder',
        'name', 'holder', 'holder name',
        'stockholder', 'stockholder name',
        'shareholder', 'shareholder name',
        'investor name', 'owner', 'owner name',
        'entity name', 'security holder',
        'participant', 'participant name'
      ]
    },
    stakeholderType: {
      label: 'Stakeholder Type',
      ocxName: 'Stakeholder Type',
      synonyms: [
        'stakeholder type',
        'type', 'holder type', 'investor type', 'stockholder type',
        'category', 'role', 'class of holder', 'holder category',
        'participant type'
      ]
    },
    securityClass: {
      label: 'Security Class',
      ocxName: 'Stock Class',
      synonyms: [
        'stock class',
        'security class', 'security type', 'share class', 'class',
        'stock type', 'class of stock', 'security', 'instrument',
        'instrument type', 'equity type'
      ]
    },
    sharesFd: {
      label: 'Shares (FD)',
      ocxName: 'Quantity Issued',
      synonyms: [
        'quantity issued',
        'shares', 'shares fd', 'fully diluted shares', 'fd shares',
        'quantity', 'shares issued', 'number of shares',
        'shares outstanding', 'total shares', 'share count',
        'shares held', 'fully diluted', 'qty', 'shares granted'
      ]
    },
    issueDate: {
      label: 'Issue Date',
      ocxName: 'Issuance Date',
      synonyms: [
        'issuance date',
        'issue date', 'date', 'date issued', 'grant date',
        'date of issuance', 'transaction date', 'effective date'
      ]
    },
    amountInvested: {
      label: 'Amount Invested ($)',
      ocxName: 'Issuance Amount',
      synonyms: [
        'issuance amount',
        'amount invested', 'investment amount', 'investment', 'amount',
        'capital invested', 'total investment', 'purchase price',
        'cash invested', 'invested', 'consideration', 'price paid'
      ]
    }
  };

  // Second-pass "contains" keywords — pre-fill a suggestion in the mapping
  // modal but are always shown for confirmation, never silently accepted.
  const LOOSE_KEYWORDS = {
    holderName: ['name', 'holder', 'stockholder', 'shareholder', 'stakeholder', 'owner'],
    stakeholderType: ['type', 'category', 'role'],
    securityClass: ['class', 'security', 'instrument'],
    sharesFd: ['share', 'quantity', 'qty'],
    issueDate: ['date'],
    amountInvested: ['amount', 'invest', 'consideration', 'price', 'paid']
  };

  // "Me" fuzzy-match: token-overlap score below this is treated as
  // "no confident default" — the picker shows ranked candidates with none
  // pre-selected.
  const ME_MATCH_THRESHOLD = 0.3;

  // Same-company heuristic: when importing while already inside a company
  // that has existing stakeholders, the fraction of the FILE's holder names
  // that match existing stakeholder names. >= this -> default "update this
  // company"; below -> default "create new company". Either way the
  // investor is always asked (see showCompanyMatchModal) — this only
  // controls the pre-selected default.
  const COMPANY_MATCH_THRESHOLD = 0.3;

  /* ─────────────────────────────────────────────
     2. IMPORT ENGINE — header normalization + detection
  ───────────────────────────────────────────── */

  function normalizeHeader(str) {
    return String(str == null ? '' : str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * 3-tier column detection:
   *   tier 1 — exact synonym match (silent, "found it")
   *   tier 2 — loose keyword "contains" match (pre-filled suggestion,
   *            shown in the mapping modal for confirmation)
   *   tier 3 — unresolved (must be picked manually in the mapping modal)
   */
  function detectColumns(headers) {
    const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
    const mapping = {};
    const claimed = new Set();

    for (const field of Object.keys(REQUIRED_FIELDS)) {
      const synonymSet = new Set(REQUIRED_FIELDS[field].synonyms.map(normalizeHeader));
      const match = normalizedHeaders.find((h) => !claimed.has(h.raw) && synonymSet.has(h.norm));
      if (match) {
        mapping[field] = { header: match.raw, confidence: 'exact' };
        claimed.add(match.raw);
      }
    }

    for (const field of Object.keys(LOOSE_KEYWORDS)) {
      if (mapping[field]) continue;
      const keywords = LOOSE_KEYWORDS[field];
      const match = normalizedHeaders.find(
        (h) => !claimed.has(h.raw) && keywords.some((kw) => h.norm.includes(kw))
      );
      if (match) {
        mapping[field] = { header: match.raw, confidence: 'suggested' };
        claimed.add(match.raw);
      }
    }

    for (const field of Object.keys(REQUIRED_FIELDS)) {
      if (!mapping[field]) mapping[field] = { header: null, confidence: 'none' };
    }

    const remainingHeaders = headers.filter((h) => !claimed.has(h));
    const needsMapping = Object.keys(mapping).filter((f) => mapping[f].confidence === 'none');
    const suggestions = Object.keys(mapping).filter((f) => mapping[f].confidence === 'suggested');

    return { mapping, remainingHeaders, needsMapping, suggestions };
  }

  /** Apply column-mapping-modal choices on top of detectColumns() output. */
  function applyManualMapping(detected, overrides) {
    const mapping = {};
    for (const f of Object.keys(detected.mapping)) mapping[f] = Object.assign({}, detected.mapping[f]);
    for (const field of Object.keys(overrides || {})) {
      mapping[field] = { header: overrides[field], confidence: 'manual' };
    }
    const used = new Set(Object.keys(mapping).map((f) => mapping[f].header).filter(Boolean));
    return { mapping, remainingHeaders: detected.remainingHeaders.filter((h) => !used.has(h)) };
  }

  /* ─────────────────────────────────────────────
     3. ENUM NORMALIZATION — securityClass, stakeholderType
  ───────────────────────────────────────────── */

  function normalizeSecurityClass(raw) {
    const n = normalizeHeader(raw);
    if (!n) return { value: 'other', raw: raw, matched: false };

    if (/^(common( stock)?|founders? stock|cs)$/.test(n)) return { value: 'common', raw: raw, matched: true };
    if (/(option|iso|nso)/.test(n)) return { value: 'option', raw: raw, matched: true };
    if (/^safe/.test(n)) return { value: 'safe', raw: raw, matched: true };
    if (/(convertible note|promissory note|^note$|^notes$)/.test(n)) return { value: 'note', raw: raw, matched: true };
    if (/warrant/.test(n)) return { value: 'warrant', raw: raw, matched: true };

    const seriesMatch =
      n.match(/series ([a-z])\b/) ||
      n.match(/preferred ([a-z])\b/) ||
      n.match(/class ([a-z]) preferred/) ||
      n.match(/^([a-z]) preferred$/);
    if (seriesMatch) return { value: 'pref_' + seriesMatch[1], raw: raw, matched: true };
    if (/preferred/.test(n)) return { value: 'pref_unknown', raw: raw, matched: true };

    return { value: 'other', raw: raw, matched: false };
  }

  function normalizeStakeholderType(raw) {
    const n = normalizeHeader(raw);
    if (!n) return { value: 'other', raw: raw, matched: false };

    if (/found/.test(n)) return { value: 'founder', raw: raw, matched: true };
    if (/(option pool|unallocated|reserved|pool)/.test(n)) return { value: 'pool', raw: raw, matched: true };
    if (/(advisor|adviser|consultant)/.test(n)) return { value: 'advisor', raw: raw, matched: true };
    if (/(employee|staff|team member)/.test(n)) return { value: 'employee', raw: raw, matched: true };
    if (/(investor|vc|venture|fund|angel|series)/.test(n)) return { value: 'investor', raw: raw, matched: true };
    if (/(entity|llc|lp|ltd|corp|inc|trust|foundation|company|co\b)/.test(n)) return { value: 'entity', raw: raw, matched: true };

    return { value: 'other', raw: raw, matched: false };
  }

  /* ─────────────────────────────────────────────
     4. "ME" FUZZY MATCH
  ───────────────────────────────────────────── */

  function tokenize(str) {
    return new Set(normalizeHeader(str).split(' ').filter(Boolean));
  }

  function jaccard(a, b) {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    a.forEach((tok) => { if (b.has(tok)) inter++; });
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : inter / union;
  }

  /**
   * `identity` is { names: string[], email?: string } — separate candidate
   * identity strings (personal name, firm/fund name, email local-part), each
   * scored independently against a stakeholder's name; the BEST of the three
   * wins. Scoring a concatenated "name + firmName" blob as one token set
   * biases toward whichever field has more words (e.g. "Acme Ventures II,
   * LP" has 4 tokens vs "Charlie Put"'s 2 — concatenation would make ANY
   * candidate sharing tokens with the firm name outscore one sharing tokens
   * only with the personal name, regardless of which is the better match).
   * Scoring separately and taking the max avoids that artifact.
   */
  function findMeCandidate(stakeholders, identity) {
    identity = identity || {};
    const names = Array.isArray(identity.names) ? identity.names.filter(Boolean) : [];
    if (identity.email) names.push(identity.email.split('@')[0]);
    const identityTokenSets = names.map(tokenize);

    const scored = stakeholders
      .map((s) => {
        const sTokens = tokenize(s.name);
        let best = 0;
        identityTokenSets.forEach((idTokens) => { best = Math.max(best, jaccard(idTokens, sTokens)); });
        return { stakeholder: s, score: Math.round(best * 1000) / 1000 };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored.length && scored[0].score >= ME_MATCH_THRESHOLD ? scored[0] : null;
    return { best: best, candidates: scored.slice(0, 5), threshold: ME_MATCH_THRESHOLD };
  }

  /* ─────────────────────────────────────────────
     5. ROW TRANSFORM — messy headers -> generic-import-ready rows
     The generic CSV importer (_validateCSV/_buildImportItems/_executeImport)
     determines hierarchy level by column-name PREFIX (e.g. "variation_stock"
     for inventory's item->variation). This step turns our resolved 6-field
     mapping into that shape: root level = stakeholder (unprefixed `name`,
     `stakeholderType`), child level = grant (`grants.`-prefixed). One row in
     -> one row out; multiple rows sharing the same `name` get grouped into
     one stakeholder with multiple grant children by the generic
     _buildImportItems — which is exactly our old dedupe-by-holder-name logic,
     now happening for free downstream.
  ───────────────────────────────────────────── */

  function parseNumber(v) {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return v;
    const cleaned = String(v).replace(/[,$\s]/g, '');
    if (cleaned === '' || cleaned === '-') return 0;
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  function formatDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  }

  function round(n, decimals) {
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
  }

  /**
   * Transform one source row into the generic importer's expected shape for
   * entityType='stakeholder', levels=[stakeholder, grant].
   *
   * `grants.name` is a pure presence-sentinel — _buildImportItems checks
   * `row[grandchildLevel.prefix + 'name']` to decide whether a row has a
   * grandchild, but `grant` has no `name` field in natent (same as Poll's
   * `vote`), so this key never ends up on the saved entity. `grants.dotLabel`
   * carries the same string and DOES get persisted (grant.dotLabel exists).
   *
   * Values that should be SKIPPED by _buildImportItems (so the field is left
   * unset rather than written as null/NaN) use '' — matching _validateCSV's
   * `if (value === undefined || value === '') return;` guard. Using `null`
   * for an unset number field would fail that guard and trip the
   * `isNaN(parseFloat(value))` check.
   */
  function _transformRow(row, mapping, allHeaders, mappedHeaderSet) {
    const holderName = String(row[mapping.holderName.header] == null ? '' : row[mapping.holderName.header]).trim();
    if (!holderName) return null;

    const rawType = row[mapping.stakeholderType.header];
    const rawSecurity = row[mapping.securityClass.header];
    const rawShares = row[mapping.sharesFd.header];
    const rawDate = row[mapping.issueDate.header];
    const rawAmount = row[mapping.amountInvested.header];

    const shares = parseNumber(rawShares);
    const amountInvested = parseNumber(rawAmount);
    const secClass = normalizeSecurityClass(rawSecurity);
    const stType = normalizeStakeholderType(rawType);
    const pendingConversion = (secClass.value === 'safe' || secClass.value === 'note') && shares === 0;
    const dotLabel = holderName + ' — ' + secClass.value;

    const extraFields = {};
    allHeaders.forEach((h) => {
      if (mappedHeaderSet.has(h)) return;
      const v = row[h];
      if (v !== undefined && v !== '') extraFields[h] = v;
    });

    const out = {
      name: holderName,
      stakeholderType: stType.value,
      stakeholderTypeRaw: stType.matched ? '' : String(rawType == null ? '' : rawType),

      'grants.name': dotLabel,
      'grants.dotLabel': dotLabel,
      'grants.grantType': 'issuance',
      'grants.securityClass': secClass.value,
      'grants.securityClassRaw': secClass.matched ? '' : String(rawSecurity == null ? '' : rawSecurity),
      'grants.shares': shares,
      'grants.amountInvested': amountInvested,
      'grants.pricePerShare': shares > 0 ? round(amountInvested / shares, 6) : '',
      'grants.noConsideration': amountInvested === 0 && shares > 0,
      'grants.pendingConversion': pendingConversion,
      'grants.issueDate': formatDate(rawDate) || ''
    };
    if (Object.keys(extraFields).length) out['grants.extraFields'] = JSON.stringify(extraFields);

    return { row: out, pendingConversion: pendingConversion, dotLabel: dotLabel };
  }

  /**
   * Transform all source rows. Returns { headers, rows, warnings,
   * skippedBlankRows } ready for orchestrator._validateCSV(headers, rows,
   * 'stakeholder').
   */
  function transformRowsForImport(rows, headers, mapping) {
    const mappedHeaderSet = new Set(Object.keys(mapping).map((f) => mapping[f].header).filter(Boolean));
    const outRows = [];
    const warnings = [];
    let skippedBlankRows = 0;
    let rowNum = 0;

    rows.forEach((row) => {
      rowNum++;
      const t = _transformRow(row, mapping, headers, mappedHeaderSet);
      if (!t) { skippedBlankRows++; return; }
      if (t.pendingConversion) {
        warnings.push(
          'Row ' + rowNum + ' (' + t.row.name + '): ' + t.row['grants.securityClass'].toUpperCase() +
          ' with no share count — recorded as a pending instrument, no FD shares added. ' +
          'Conversion modeling is Phase 2.'
        );
      }
      outRows.push(t.row);
    });

    // Stable header set across all rows: union of keys (grant_extraFields is
    // optional per-row), so _buildImportLevels sees a consistent shape.
    const outHeaderSet = new Set();
    outRows.forEach((r) => Object.keys(r).forEach((k) => outHeaderSet.add(k)));
    outRows.forEach((r) => { if (!('grants.extraFields' in r)) r['grants.extraFields'] = ''; });
    outHeaderSet.add('grants.extraFields');

    return { headers: Array.from(outHeaderSet), rows: outRows, warnings: warnings, skippedBlankRows: skippedBlankRows };
  }

  /**
   * Lightweight single-entity creation for the `company` — mirrors
   * _executeImport's new-root-item branch (generateUUID + hashUUID +
   * ensureBaseEntityFields + saveEntityData) but for exactly one entity, so
   * we can hand off to the generic 2-level (stakeholder/grant) importer
   * afterward without needing _executeImport to support a 3rd level.
   */
  /**
   * Builds a saveEntityData path. The tenant segment (currentPath[0]) uses
   * `.id` (the raw UUID, when available) rather than `.displayID` — the
   * server's saveEntityData rehashes this one segment itself before
   * storage (mirroring getAppData's existing tenantId rehash), using the
   * pre-rehash value purely to prove tenant ownership for
   * writeAccess:'owner' checks. Every other segment (and any trailing IDs
   * passed in `extraSegments`) stays `.displayID` — only the tenant slot
   * is ever treated as a bearer credential. If currentPath[0].id isn't a
   * real UUID (e.g. a non-owner session that never had it), it's already
   * equal to .displayID, so this naturally falls back to sending the
   * hash — no isRealUuid check needed client-side, the server decides
   * whether what it received counts as proof.
   */
  function _buildSavePath(orchestrator, extraSegments) {
    const path = orchestrator.currentPath || [];
    const tenantSegment = path.length > 0 ? (path[0].id || path[0].displayID) : null;
    const restSegments = path.slice(1).map(function (p) { return p.displayID; });
    const tail = (extraSegments || []).filter(Boolean);
    return ['apps', APP_ID]
      .concat(tenantSegment !== null ? [tenantSegment].concat(restSegments) : [])
      .concat(tail)
      .join('/');
  }

  async function _createCompanyEntity(orchestrator, nativeEntities, companyMeta) {
    const rawUUID = orchestrator.db.generateUUID();
    const company = {
      name: companyMeta.name,
      snapshotAsOf: companyMeta.snapshotAsOf,
      currency: 'USD',
      importSource: 'manual',
      ownershipView: 'fully_diluted',
      scoreField: 'economic',
      entityType: 'company',
      timestamp: Date.now(),
      hidden: false,
      hashed: false,
      writeAccess: 'owner',
      readAccess: 'owner',
      myStakeholderId: null
    };
    company.ID = rawUUID;
    company.displayID = orchestrator.db.hashUUID(rawUUID);

    if (typeof orchestrator.ensureBaseEntityFields === 'function') {
      orchestrator.ensureBaseEntityFields(company, 'company', nativeEntities.company);
    }
    if (typeof orchestrator.processItemID === 'function') {
      orchestrator.processItemID(company, 'company');
    }

    const companyPath = _buildSavePath(orchestrator, [company.displayID]);
    await orchestrator.db.saveEntityData(companyPath, company, false);

    if (typeof orchestrator._insertItemIntoTree === 'function') {
      orchestrator._insertItemIntoTree(company);
    }

    return company;
  }

  /* ─────────────────────────────────────────────
     6. SHEETJS — lazy CDN load + workbook reading
  ───────────────────────────────────────────── */

  let _xlsxLoadPromise = null;
  function ensureXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (_xlsxLoadPromise) return _xlsxLoadPromise;
    _xlsxLoadPromise = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = function () { resolve(window.XLSX); };
      script.onerror = function () { reject(new Error('Failed to load SheetJS (XLSX) from CDN')); };
      document.head.appendChild(script);
    });
    return _xlsxLoadPromise;
  }

  function readWorkbook(XLSX, file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          const headers = rows.length ? Object.keys(rows[0]) : [];
          resolve({ headers: headers, rows: rows });
        } catch (err) { reject(err); }
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ─────────────────────────────────────────────
     7. IMPORT UI — styles + column-mapping modal + "Me" picker modal
  ───────────────────────────────────────────── */

  let _stylesInjected = false;
  function _injectCaptableStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const style = document.createElement('style');
    style.textContent =
      '.captable-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;' +
      'align-items:center;justify-content:center;z-index:9999;}' +
      '.captable-modal{background:#fff;border-radius:12px;padding:24px;max-width:480px;width:90%;' +
      'max-height:85vh;overflow-y:auto;font-family:-apple-system,BlinkMacSystemFont,sans-serif;' +
      'box-shadow:0 10px 40px rgba(0,0,0,.2);}' +
      '.captable-modal h2{margin:0 0 8px;font-size:18px;}' +
      '.captable-modal p.captable-sub{color:#666;font-size:13px;margin:0 0 16px;}' +
      '.captable-field-row{display:flex;align-items:center;justify-content:space-between;' +
      'margin-bottom:10px;gap:12px;}' +
      '.captable-field-row label{font-size:13px;font-weight:600;flex:0 0 160px;}' +
      '.captable-field-row select{flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:6px;' +
      'font-size:13px;}' +
      '.captable-confidence-exact{color:#16a34a;font-size:11px;font-weight:400;}' +
      '.captable-confidence-suggested{color:#d97706;font-size:11px;font-weight:400;}' +
      '.captable-confidence-none{color:#dc2626;font-size:11px;font-weight:400;}' +
      '.captable-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;}' +
      '.captable-btn{padding:8px 16px;border-radius:6px;border:1px solid #ccc;background:#fff;' +
      'cursor:pointer;font-size:13px;}' +
      '.captable-btn-primary{background:#4f46e5;color:#fff;border-color:#4f46e5;}' +
      '.captable-btn-primary:disabled{opacity:.5;cursor:not-allowed;}' +
      '.captable-me-option{display:flex;align-items:center;gap:10px;padding:10px;' +
      'border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;cursor:pointer;}' +
      '.captable-me-option.selected{border-color:#4f46e5;background:#eef2ff;}' +
      '.captable-me-option .name{font-weight:600;font-size:14px;}' +
      '.captable-me-option .score{margin-left:auto;font-size:11px;color:#999;}';
    document.head.appendChild(style);
  }

  function _createModal() {
    const overlay = document.createElement('div');
    overlay.className = 'captable-modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'captable-modal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    return { overlay: overlay, modal: modal, close: function () { overlay.remove(); } };
  }

  function _escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /**
   * Shown only when at least one field is 'suggested' or 'none'. All 6
   * fields are listed (including exact matches, for visibility), each as
   * a dropdown over every header in the file. "Continue" is disabled until
   * all 6 have a value. Resolves to an overrides object, or null if cancelled.
   */
  function showColumnMappingModal(detected, headers, onResolve) {
    _injectCaptableStyles();
    const m = _createModal();
    const fieldOrder = Object.keys(REQUIRED_FIELDS);
    const confLabels = { exact: 'auto-detected', suggested: 'suggested — confirm', manual: 'selected', none: 'select a column' };

    let html = '<h2>Confirm column mapping</h2>' +
      '<p class="captable-sub">We matched most columns automatically. Please confirm or adjust the rest — nothing else needs to change in your file.</p>';

    fieldOrder.forEach(function (field) {
      const info = detected.mapping[field];
      const confClass = 'captable-confidence-' + info.confidence;
      html += '<div class="captable-field-row">' +
        '<label>' + _escapeHtml(REQUIRED_FIELDS[field].label) + '<br><span class="' + confClass + '">' + confLabels[info.confidence] + '</span></label>' +
        '<select data-field="' + field + '">' +
        '<option value="">— choose column —</option>' +
        headers.map(function (h) {
          const sel = h === info.header ? ' selected' : '';
          return '<option value="' + _escapeHtml(h) + '"' + sel + '>' + _escapeHtml(h) + '</option>';
        }).join('') +
        '</select>' +
        '</div>';
    });

    html += '<div class="captable-modal-actions">' +
      '<button class="captable-btn" data-action="cancel">Cancel</button>' +
      '<button class="captable-btn captable-btn-primary" data-action="continue" disabled>Continue</button>' +
      '</div>';

    m.modal.innerHTML = html;

    const continueBtn = m.modal.querySelector('[data-action="continue"]');
    const selects = Array.prototype.slice.call(m.modal.querySelectorAll('select'));

    function checkValid() {
      continueBtn.disabled = selects.some(function (s) { return !s.value; });
    }
    selects.forEach(function (s) { s.addEventListener('change', checkValid); });
    checkValid();

    m.modal.querySelector('[data-action="cancel"]').addEventListener('click', function () {
      m.close();
      onResolve(null);
    });
    continueBtn.addEventListener('click', function () {
      const overrides = {};
      selects.forEach(function (s) { overrides[s.dataset.field] = s.value; });
      m.close();
      onResolve(overrides);
    });
  }

  /**
   * Shown when importing while already inside a company (currentPath.length
   * === 2) that has existing stakeholders, to disambiguate "this file is an
   * updated version of the company I'm viewing" vs "this file is a
   * different company entirely." `info` = { companyName, overlapCount,
   * fileNameCount, existingNameCount }. Pre-selects based on
   * COMPANY_MATCH_THRESHOLD but always shows both options. Resolves to
   * 'update' | 'new' | null (cancel).
   */
  function showCompanyMatchModal(info, onResolve) {
    _injectCaptableStyles();
    const m = _createModal();

    const overlapRatio = info.fileNameCount > 0 ? info.overlapCount / info.fileNameCount : 0;
    const defaultChoice = overlapRatio >= COMPANY_MATCH_THRESHOLD ? 'update' : 'new';

    const overlapLine = info.overlapCount > 0
      ? info.overlapCount + ' of ' + info.fileNameCount + ' names in this file match stakeholders already in ' + _escapeHtml(info.companyName) + '.'
      : 'None of the ' + info.fileNameCount + ' names in this file match the ' + info.existingNameCount + ' stakeholder(s) already in ' + _escapeHtml(info.companyName) + '.';

    const html = '<h2>Which company is this?</h2>' +
      '<p class="captable-sub">You\u2019re viewing <strong>' + _escapeHtml(info.companyName) + '</strong>, which already has stakeholders. ' + overlapLine + '</p>' +
      '<div class="captable-me-option" data-choice="update">' +
      '<div class="name">Update ' + _escapeHtml(info.companyName) + ' \u2014 this file is its cap table</div>' +
      '</div>' +
      '<div class="captable-me-option" data-choice="new">' +
      '<div class="name">Create a new company from this file</div>' +
      '</div>' +
      '<div class="captable-modal-actions">' +
      '<button class="captable-btn" data-action="cancel">Cancel</button>' +
      '<button class="captable-btn captable-btn-primary" data-action="continue">Continue</button>' +
      '</div>';

    m.modal.innerHTML = html;

    let selected = defaultChoice;
    function renderSelection() {
      m.modal.querySelectorAll('.captable-me-option').forEach(function (el) {
        el.classList.toggle('selected', el.dataset.choice === selected);
      });
    }
    m.modal.querySelectorAll('.captable-me-option').forEach(function (el) {
      el.addEventListener('click', function () {
        selected = el.dataset.choice;
        renderSelection();
      });
    });
    renderSelection();

    m.modal.querySelector('[data-action="cancel"]').addEventListener('click', function () {
      m.close();
      onResolve(null);
    });
    m.modal.querySelector('[data-action="continue"]').addEventListener('click', function () {
      m.close();
      onResolve(selected);
    });
  }

  /**
   * Ranked "Me" picker. Pre-selects meMatch.best if it cleared the
   * confidence threshold; always includes "I'm not in this cap table yet"
   * (-> myStakeholderId = null). Resolves to a stakeholder displayID or null.
   * `meMatch` is the output of findMeCandidate() run against the REAL
   * created stakeholder entities (post _executeImport), so .displayID is
   * the server-assigned hashUUID — what company.myStakeholderId references.
   */
  function showMePickerModal(meMatch, onResolve) {
    _injectCaptableStyles();
    const m = _createModal();

    let html = '<h2>Which row is you?</h2>' +
      '<p class="captable-sub">This highlights your position and sizes the company dot in your portfolio. You can change this later.</p>' +
      '<div data-list></div>' +
      '<div class="captable-me-option" data-id="">' +
      '<div class="name">I\u2019m not in this cap table yet</div>' +
      '</div>' +
      '<div class="captable-modal-actions">' +
      '<button class="captable-btn captable-btn-primary" data-action="continue">Continue</button>' +
      '</div>';

    m.modal.innerHTML = html;
    const list = m.modal.querySelector('[data-list]');
    meMatch.candidates.forEach(function (c) {
      const opt = document.createElement('div');
      opt.className = 'captable-me-option';
      opt.dataset.id = c.stakeholder.displayID;
      opt.innerHTML = '<div class="name">' + _escapeHtml(c.stakeholder.name) + '</div>' +
        '<div class="score">match ' + Math.round(c.score * 100) + '%</div>';
      list.appendChild(opt);
    });

    let selectedId = meMatch.best ? meMatch.best.stakeholder.displayID : '';
    function renderSelection() {
      m.modal.querySelectorAll('.captable-me-option').forEach(function (el) {
        el.classList.toggle('selected', el.dataset.id === selectedId);
      });
    }
    m.modal.querySelectorAll('.captable-me-option').forEach(function (el) {
      el.addEventListener('click', function () {
        selectedId = el.dataset.id;
        renderSelection();
      });
    });
    renderSelection();

    m.modal.querySelector('[data-action="continue"]').addEventListener('click', function () {
      m.close();
      onResolve(selectedId || null);
    });
  }

  /* ─────────────────────────────────────────────
     8. importCapTable(file) — orchestrates the whole import flow
  ───────────────────────────────────────────── */

  function _notify(orchestrator, message, type) {
    if (orchestrator && typeof orchestrator.showNotification === 'function') {
      orchestrator.showNotification(message, type);
    } else {
      console[type === 'error' ? 'error' : 'log']('[captable] ' + message);
    }
  }

  // CONFIRMED: investor identity lives on the investor (tenant) entity at
  // currentPath[0] — the same entity creatorDisplayID is read from. `name`
  // and `firmName` ("Company / VC Name") are both writePermission:"any"
  // self-registration fields (tenant-creation is the existing generic
  // pattern, mirrors Poll's `creator`). firmName matters because cap tables
  // list the fund ("Acme Ventures Fund II, LP"), not the person.
  function _getInvestorIdentity(orchestrator) {
    const root = orchestrator && orchestrator.currentPath && orchestrator.currentPath[0];
    if (!root) return {};
    return {
      names: [root.name, root.firmName].filter(Boolean),
      email: root.contactemail
    };
  }

  // CONFIRMED PATH FORMAT — from Poll's saveEntityData call sites:
  //   pollPath       = ['apps','poll', creatorDisplayID, pollDisplayID].join('/')
  //   prevAnswerPath = ['apps','poll', creatorDisplayID, pollDisplayID, answerDisplayID].join('/')
  // i.e. apps/<appId>/<creatorDisplayID>/<entityDisplayID>/<childDisplayID>/...
  // — paths are built from `displayID` fields. _executeImport itself builds
  // entityPath as ['apps', this.currentApp.id, ...this.currentPath.map(p =>
  // p.displayID), targetItem.displayID].join('/') — generalizing this to
  // ALL of currentPath, not just currentPath[0]. _createCompanyEntity below
  // mirrors that exactly. Tenant (investor) creation at currentPath[0] is
  // the existing generic "create my workspace" pattern (same as Poll's
  // `creator`) — nothing new needed there.

  /**
   * Run "Me" matching against the just-created stakeholder entities and, if
   * the investor confirms a match (or picks one manually), persist
   * company.myStakeholderId with a single follow-up saveEntityData (isUpdate:
   * true). Called from _showImportPreviewModal's onComplete callback — see
   * note above importCapTable for the 2-line addition that makes this fire.
   */
  async function _finishCaptableImport(orchestrator, company, previewItems) {
    // fdShares/outstandingShares/investedAmount are now computed from grant
    // children BEFORE _buildImportItems and saved in the initial batch —
    // no post-import aggregation pass needed here.

    // Me picker — only if not already set
    if (!company.myStakeholderId) {
      const stakeholders = (previewItems || []).map(function (p) { return p._targetItem; }).filter(Boolean);
      const investorIdentity = _getInvestorIdentity(orchestrator);
      const meMatch = findMeCandidate(stakeholders, investorIdentity);

      const myStakeholderId = await new Promise(function (resolve) {
        showMePickerModal(meMatch, resolve);
      });

      if (myStakeholderId) {
        company.myStakeholderId = myStakeholderId;
        const companyPath = _buildSavePath(orchestrator, []);
        try {
          await orchestrator.db.saveEntityData(companyPath, company, true);
        } catch (err) {
          _notify(orchestrator, 'Import succeeded, but saving your position failed: ' + err.message, 'error');
        }
      }
    }

    // No re-fetch needed — in-memory data is correct after import.
    // _executeImport built this.data with fdShares in previewItem.fields,
    // and the batch save's parent-before-child ordering ensures the topic
    // index is correct for subsequent page reloads.
    // A re-fetch here would overwrite correct in-memory data with stale
    // server POSTS cache data (the cache eviction in saveEntityDataBatch
    // Phase 4 may not have propagated before a re-fetch fires).
    orchestrator.showNotification('✅ Import complete', 'success');

    if (typeof orchestrator.render === 'function') orchestrator.render();
    if (typeof orchestrator.updateBreadcrumb === 'function') orchestrator.updateBreadcrumb();
  }

  /**
   * Entry point wired to the "Import cap table" affordance (spec §9, +
   * menu at depth 0/1). `this` is the orchestrator instance (see
   * installCaptableExt — attached via Object.assign).
   *
   * Flow: read file -> resolve the 6 required fields (detection + mapping
   * modal, unchanged) -> create the `company` as a single lightweight
   * entity (mirrors _executeImport's new-root-item branch) -> push it onto
   * currentPath -> transform rows into the generic importer's
   * stakeholder(+grants.-prefixed grant) shape -> hand off to
   * _validateCSV/_buildImportItems/_showImportPreviewModal/_executeImport
   * (all reused, unmodified) -> "Me" follow-up.
   *
   * REQUIRES ONE SMALL ADDITION to _showImportPreviewModal for the "Me"
   * follow-up to run automatically — confirmBtn.onclick currently does:
   *   overlay.remove();
   *   await this._executeImport(previewItems, entityType, levels);
   * Change to:
   *   overlay.remove();
   *   await this._executeImport(previewItems, entityType, levels);
   *   if (typeof onComplete === 'function') await onComplete(previewItems);
   * with `onComplete` as a new optional 5th parameter to
   * _showImportPreviewModal(previewItems, warnings, entityType, levels, onComplete).
   * Backward compatible — existing callers passing 4 args are unaffected.
   * WITHOUT this change, the import itself still fully succeeds (company +
   * stakeholders + grants all created); only the "Me" picker + automatic
   * myStakeholderId won't fire, degrading to "not yet matched" (null), same
   * as the "I'm not in this cap table yet" choice.
   */
  async function importCapTable(file) {
    const orchestrator = this;
    _injectCaptableStyles();

    let XLSX;
    try {
      XLSX = await ensureXLSX();
    } catch (err) {
      _notify(orchestrator, 'Could not load spreadsheet engine: ' + err.message, 'error');
      return;
    }

    let parsed;
    try {
      parsed = await readWorkbook(XLSX, file);
    } catch (err) {
      _notify(orchestrator, 'Could not read file: ' + err.message, 'error');
      return;
    }
    const headers = parsed.headers, rows = parsed.rows;
    if (!headers.length) {
      _notify(orchestrator, 'No data found in the first sheet.', 'error');
      return;
    }

    const detected = detectColumns(headers);

    const overrides = await new Promise(function (resolve) {
      if (detected.needsMapping.length === 0 && detected.suggestions.length === 0) {
        resolve({});
      } else {
        showColumnMappingModal(detected, headers, resolve);
      }
    });
    if (overrides === null) return; // user cancelled the mapping screen

    const resolved = applyManualMapping(detected, overrides);
    const missing = Object.keys(resolved.mapping).filter(function (f) { return !resolved.mapping[f].header; });
    if (missing.length) {
      _notify(orchestrator, 'Missing required columns: ' + missing.map(function (f) { return REQUIRED_FIELDS[f].label; }).join(', '), 'error');
      return;
    }

    if (!orchestrator.db || typeof orchestrator.db.getNativeEntities !== 'function') {
      _notify(orchestrator, 'orchestrator.db.getNativeEntities is not available — cannot import.', 'error');
      return;
    }
    const nativeEntities = await orchestrator.db.getNativeEntities();

    // 1. Transform rows -> generic importer shape (root=stakeholder, child=grant).
    const transformed = transformRowsForImport(rows, headers, resolved.mapping);
    transformed.warnings.forEach(function (w) { console.warn('[captable import] ' + w); });

    // 2. Resolve the `company` for this import.
    //
    // currentPath.length < 2 -> depth 0/1 (/.apps/captable[/<investor>]):
    //   no company in scope yet. Create one as a single lightweight entity
    //   (mirrors _executeImport's new-root-item branch), push onto
    //   currentPath, so the generic importer nests stakeholders/grants
    //   under it.
    //
    // currentPath.length >= 2 -> depth 2 (.../<investor>/<company>):
    //   investor is already inside an existing company.
    //     - If it has NO stakeholders yet (just created manually, nothing
    //       imported), there's nothing to confuse this file with: reuse it
    //       silently (the common "create company, then import its cap
    //       table" flow).
    //     - If it DOES have stakeholders, this file could be (a) an
    //       updated/additional cap table for THIS company, or (b) an
    //       entirely different company the investor wants to track
    //       separately — e.g. viewing Strange Widgets and importing
    //       cool-widgets.xlsx. Only the investor can disambiguate; ask via
    //       showCompanyMatchModal, defaulting based on name-overlap between
    //       the file and this company's existing stakeholders (high overlap
    //       -> likely an update; low/zero -> likely a different company).
    //
    // "Create a new company" creates a SIBLING of the company currently
    // being viewed (apps/captable/<investor>/<newCompany>, not nested under
    // the old one) — currentPath is truncated to [investor] first so
    // _createCompanyEntity's path construction lands at that level, then the
    // new company replaces the old one as currentPath[1].
    async function createNewCompany() {
      const companyMeta = {
        name: (file.name || 'Imported Company').replace(/\.(xlsx|xls|csv)$/i, ''),
        snapshotAsOf: formatDate(new Date())
      };
      try {
        const c = await _createCompanyEntity(orchestrator, nativeEntities, companyMeta);
        orchestrator.currentPath.push({
          id: c.ID,
          displayID: c.displayID,
          shortName: orchestrator.getShortName ? orchestrator.getShortName(c, 'company') : (c.name || c.displayID).substring(0, 8),
          entityType: 'company'
        });
        return c;
      } catch (err) {
        _notify(orchestrator, 'Could not create company: ' + err.message, 'error');
        return null;
      }
    }

    let company;
    if (orchestrator.currentPath.length < 2) {
      // Check if a company with the same name already exists on this canvas
      // before creating a new one — re-importing the same CSV should update
      // the existing company, not create a duplicate dot.
      const importedName = (file.name || '').replace(/\.(xlsx|xls|csv)$/i, '').toLowerCase().trim();
      // At depth 1 (investor canvas), this.data.items[0] is the investor entity.
      // Companies are nested under items[0][companiesField], not in items directly.
      const investorEntity = orchestrator.data?.items?.[0];
      const companiesField = orchestrator.currentApp?.entityConfigs?.investor?.childrenField || 'companies';
      const existingCompanies = (investorEntity?.[companiesField]) || orchestrator.data?.items || [];
      const matchingCompany = existingCompanies.find(function (item) {
        return (item.name || '').toLowerCase().trim() === importedName;
      });

      if (matchingCompany) {
        // Reuse existing company — push its path entry and continue
        orchestrator.currentPath.push({
          id: matchingCompany.ID,
          displayID: matchingCompany.displayID,
          shortName: orchestrator.getShortName
            ? orchestrator.getShortName(matchingCompany, 'company')
            : (matchingCompany.name || matchingCompany.displayID).substring(0, 8),
          entityType: 'company'
        });
        company = matchingCompany;
      } else {
        company = await createNewCompany();
        if (!company) return;
      }
    } else {
      // currentPath[last] is a path entry {id, displayID, shortName, entityType}
      // not the full entity. Find the actual entity from this.data.
      const currentPathEntry = orchestrator.currentPath[orchestrator.currentPath.length - 1];
      const currentEntity = orchestrator.data?.items?.find(function (item) {
        return item.ID === currentPathEntry.id || item.displayID === currentPathEntry.displayID;
      }) || currentPathEntry; // fallback to path entry if entity not in data

      const childrenField = (orchestrator.currentApp && orchestrator.currentApp.entityConfigs &&
        orchestrator.currentApp.entityConfigs.company && orchestrator.currentApp.entityConfigs.company.childrenField) || 'stakeholders';
      const existingNames = new Set((currentEntity[childrenField] || []).map(function (s) { return s.name; }));

      if (existingNames.size === 0) {
        company = currentEntity;
      } else {
        const newNames = new Set(transformed.rows.map(function (r) { return r.name; }));
        let overlapCount = 0;
        newNames.forEach(function (n) { if (existingNames.has(n)) overlapCount++; });

        const choice = await new Promise(function (resolve) {
          showCompanyMatchModal({
            companyName: currentEntity.name || currentPathEntry.shortName,
            overlapCount: overlapCount,
            fileNameCount: newNames.size,
            existingNameCount: existingNames.size
          }, resolve);
        });

        if (choice === null) return; // user cancelled
        if (choice === 'new') {
          orchestrator.currentPath.length = orchestrator.currentPath.length - 1; // truncate to [..., investor]
          company = await createNewCompany();
          if (!company) return;
        } else {
          company = currentEntity;
        }
      }
    }

    // 3. Hand off to the generic CSV import pipeline.
    const validation = await orchestrator._validateCSV(transformed.headers, transformed.rows, 'stakeholder');
    if (!validation.valid) {
      orchestrator._showImportErrorModal(validation.errors, validation.warnings.concat(transformed.warnings));
      return;
    }

    const previewItems = orchestrator._buildImportItems(transformed.rows, validation.levels, nativeEntities, 'stakeholder');

    // Compute fdShares/outstandingShares/investedAmount from grant children
    // right here — all the data is available, and including these in previewItem.fields
    // means _executeImport saves them as part of the stakeholder in the initial
    // batch, eliminating the 19 post-import HTTP requests in _finishCaptableImport.
    // Also embed grants directly into stakeholder fields so saveEmbeddedEntity
    // doesn't need to fetch the parent stakeholder from Cassandra during import
    // (which could race with the batch write).
    previewItems.forEach(function (item) {
      if (!item.children || !item.children.length) return;
      const fdShares = item.children.reduce(function (sum, c) {
        return sum + (parseFloat(c.fields.shares) || 0);
      }, 0);
      const investedAmount = item.children.reduce(function (sum, c) {
        return sum + (parseFloat(c.fields.amountInvested) || 0);
      }, 0);
      item.fields.fdShares = fdShares;
      item.fields.outstandingShares = fdShares;
      item.fields.investedAmount = investedAmount;
      // Embed grants array directly into stakeholder fields.
      // Since grant.distributed=false, grants live inside the stakeholder blob.
      // Including them here means the stakeholder is saved complete in one write —
      // no separate saveEmbeddedEntity calls needed per grant.
      item.fields.grants = item.children.map(function (c) { return c.fields; });
    });

    orchestrator._showImportPreviewModal(
      previewItems,
      validation.warnings.concat(transformed.warnings),
      'stakeholder',
      validation.levels,
      function (items) { return _finishCaptableImport(orchestrator, company, items); }
    );
  }

  /* ─────────────────────────────────────────────
     9. _getCurrentCompany() — company is currentPath[1] per spec §8's
     depth table (/.apps/captable/<investorUUID>/<companyID>/...). Entities
     now live directly in currentPath (populated by _insertItemIntoTree /
     navigation), not a separate data blob — much simpler than the earlier
     orchestrator.data.tenants[...] draft, which assumed the now-abandoned
     saveAppData blob architecture.
  ───────────────────────────────────────────── */

  function _getCurrentCompany(orchestrator) {
    const path = orchestrator && orchestrator.currentPath;
    if (!path || path.length < 2) return null;
    return path[1];
  }

  /* ─────────────────────────────────────────────
     10. STUBS — later build orders (spec §6, §7, §9)
     Each logs a console.warn so a tap doesn't silently no-op during
     development. Replace bodies as those build orders are tackled.
  ───────────────────────────────────────────── */

  function _notImplemented(name, specRef) {
    console.warn('[captable] ' + name + '() not yet implemented — see spec ' + specRef);
  }

  // §9 — depth 0/1: "Import cap table" / "New company (manual)";
  // depth 2: "Add holder" / "Import cap table"; depth 3: "Add grant".
  function _openCaptableAddMenu() { _notImplemented('_openCaptableAddMenu', '§9 (+ button)'); }
  function _showCaptableAddPicker(options) { _notImplemented('_showCaptableAddPicker', '§9 (+ button)'); }

  // §7 — context-bar "▶ Simulate" picker at company depth.
  // ── Simulation panel ─────────────────────────────────────────────────────

  function _showSimulationPanel(orchestrator) {
    // Don't open twice
    if (document.getElementById('captable-sim-panel')) return;

    const PANEL_WIDTH = 320;

    // ── Slide canvas left ───────────────────────────────────────────────
    const canvas = document.getElementById('canvas-area');
    if (!canvas) return;
    const canvasParent = canvas.parentElement;

    function fixContextBar() { /* no-op */ }
    function restoreContextBar() { /* no-op */ }

    // Canvas is position:relative so we must use width, not right
    canvas.style.transition = 'width 0.3s ease';
    canvas.style.width = `calc(100% - ${PANEL_WIDTH}px)`;

    setTimeout(() => {
      orchestrator.render();
    }, 310);

    // ── Build panel ─────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'captable-sim-panel';
    // Position panel below breadcrumb + context bar
    const breadcrumb = document.getElementById('breadcrumb');
    const contextBarEl = document.getElementById('context-bar');
    const topOffset = (breadcrumb?.offsetHeight || 0) + (contextBarEl?.offsetHeight || 32);

    panel.style.cssText = `
      position: fixed; top: ${topOffset}px; right: -${PANEL_WIDTH}px;
      width: ${PANEL_WIDTH}px; height: calc(100vh - ${topOffset}px);
      background: white; border-left: 1px solid #eee;
      box-shadow: -4px 0 20px rgba(0,0,0,0.08);
      z-index: 2000; display: flex; flex-direction: column;
      transition: right 0.3s ease; font-family: inherit;
      overflow-y: auto;
    `;

    // Resolve target company once — reused in updateSimulation
    const dataItem = orchestrator.data?.items?.[0];
    const targetCompany = dataItem
      ? (dataItem.entityType === 'company'
          ? dataItem
          : dataItem.companies?.find(c => c.displayID === orchestrator.currentPath[1]?.displayID))
      : null;
    const stakeholders = targetCompany?.stakeholders || [];
    const totalFdShares = stakeholders.reduce((s, sh) => s + (parseFloat(sh.fdShares) || 0), 0);

    // Default price from last round's most recent grant
    let defaultPrice = 0;
    for (const sh of stakeholders) {
      for (const g of (sh.grants || [])) {
        const p = parseFloat(g.pricePerShare) || 0;
        if (p > defaultPrice) defaultPrice = p;
      }
    }
    const defaultPreMoney = defaultPrice > 0
      ? Math.round(defaultPrice * totalFdShares)
      : 0;

    function fmt(n) {
      if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
      if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
      if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
      return '$' + n.toFixed(2);
    }

    panel.innerHTML = `
      <div style="padding:20px; border-bottom:1px solid #eee; background:#fafafa;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:15px; font-weight:700; color:#2d3436;">⚡ Scenario Planning</div>
            <div style="font-size:11px; color:#999; margin-top:2px;">Dilution modeling — not saved</div>
          </div>
          <button id="sim-close" style="
            background:none; border:none; cursor:pointer; font-size:18px;
            color:#636e72; padding:4px 8px; border-radius:6px;
          ">✕</button>
        </div>
      </div>

      <div style="padding:20px; flex:1;">

        <div style="margin-bottom:16px;">
          <label style="font-size:11px; font-weight:600; color:#636e72; text-transform:uppercase; letter-spacing:0.5px;">
            New Investor Name
          </label>
          <input id="sim-investor-name" type="text"
            style="width:100%; margin-top:6px; border:1px solid #ddd; border-radius:8px;
                   padding:8px 10px; font-size:13px; outline:none; box-sizing:border-box;"
            placeholder="e.g. Series A Fund">
        </div>

        <div style="margin-bottom:16px;">
          <label style="font-size:11px; font-weight:600; color:#636e72; text-transform:uppercase; letter-spacing:0.5px;">
            Pre-money Valuation
          </label>
          <div style="display:flex; align-items:center; margin-top:6px; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
            <span style="padding:8px 10px; background:#f8f8f8; color:#636e72; font-size:13px; border-right:1px solid #ddd;">$</span>
            <input id="sim-premoney" type="number" min="0" step="100000"
              value="${defaultPreMoney}"
              style="flex:1; border:none; padding:8px 10px; font-size:13px; outline:none; width:100%;"
              placeholder="e.g. 10000000">
          </div>
          <div id="sim-premoney-fmt" style="font-size:12px; color:#6c5ce7; margin-top:5px; font-weight:700; letter-spacing:0.3px;">
            ${defaultPreMoney > 0 ? fmt(defaultPreMoney) : ''}
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="font-size:11px; font-weight:600; color:#636e72; text-transform:uppercase; letter-spacing:0.5px;">
            Price Per Share
          </label>
          <div style="display:flex; align-items:center; margin-top:6px; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
            <span style="padding:8px 10px; background:#f8f8f8; color:#636e72; font-size:13px; border-right:1px solid #ddd;">$</span>
            <input id="sim-pps" type="number" min="0" step="0.01"
              value="${defaultPrice > 0 ? defaultPrice.toFixed(4) : ''}"
              style="flex:1; border:none; padding:8px 10px; font-size:13px; outline:none; width:100%;"
              placeholder="auto">
          </div>
          <div style="font-size:10px; color:#636e72; margin-top:4px;">
            Synced with pre-money ÷ ${totalFdShares.toLocaleString()} shares
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="font-size:11px; font-weight:600; color:#636e72; text-transform:uppercase; letter-spacing:0.5px;">
            Raise Amount
          </label>
          <div style="display:flex; align-items:center; margin-top:6px; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
            <span style="padding:8px 10px; background:#f8f8f8; color:#636e72; font-size:13px; border-right:1px solid #ddd;">$</span>
            <input id="sim-raise" type="number" min="0" step="100000"
              style="flex:1; border:none; padding:8px 10px; font-size:13px; outline:none; width:100%;"
              placeholder="e.g. 2000000">
          </div>
          <div id="sim-raise-fmt" style="font-size:12px; color:#6c5ce7; margin-top:5px; font-weight:700; letter-spacing:0.3px;"></div>
        </div>

        <div id="sim-summary" style="
          background:#f8f6ff; border:1px solid #e0d8ff; border-radius:10px;
          padding:14px; margin-bottom:20px; display:none;
        ">
          <div style="font-size:11px; font-weight:700; color:#6c5ce7; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">
            Round Summary
          </div>
          <div id="sim-summary-rows" style="font-size:12px; color:#2d3436; line-height:1.8;"></div>
        </div>

      </div>

      <div style="padding:16px; border-top:1px solid #eee;">
        <button id="sim-exit" style="
          width:100%; padding:10px; border-radius:8px; font-size:13px;
          font-weight:600; cursor:pointer; border:1px solid #ddd;
          background:#f0f0f0; color:#636e72;
        ">✕ Exit Simulation</button>
      </div>
    `;

    document.body.appendChild(panel);

    // Slide in
    requestAnimationFrame(() => { panel.style.right = '0'; });

    // ── Wire up synced inputs ───────────────────────────────────────────
    const premoneyEl = panel.querySelector('#sim-premoney');
    const ppsEl      = panel.querySelector('#sim-pps');
    const raiseEl    = panel.querySelector('#sim-raise');
    const nameEl     = panel.querySelector('#sim-investor-name');
    const summary    = panel.querySelector('#sim-summary');
    const summaryRows = panel.querySelector('#sim-summary-rows');

    let _updating = false;

    function syncFromPreMoney() {
      if (_updating) return;
      _updating = true;
      const pm = parseFloat(premoneyEl.value) || 0;
      if (pm > 0 && totalFdShares > 0) {
        ppsEl.value = (pm / totalFdShares).toFixed(4);
      }
      panel.querySelector('#sim-premoney-fmt').textContent = pm > 0 ? fmt(pm) : '';
      _updating = false;
      updateSimulation();
    }

    function syncFromPPS() {
      if (_updating) return;
      _updating = true;
      const pps = parseFloat(ppsEl.value) || 0;
      if (pps > 0 && totalFdShares > 0) {
        const pm = Math.round(pps * totalFdShares);
        premoneyEl.value = pm;
        panel.querySelector('#sim-premoney-fmt').textContent = fmt(pm);
      }
      _updating = false;
      updateSimulation();
    }

    function updateSimulation() {
      const preMoney   = parseFloat(premoneyEl.value) || 0;
      const pps        = parseFloat(ppsEl.value) || 0;
      const raise      = parseFloat(raiseEl.value) || 0;
      const investorName = nameEl.value.trim() || 'New Investor';

      panel.querySelector('#sim-raise-fmt').textContent = raise > 0 ? fmt(raise) : '';

      if (preMoney <= 0 || pps <= 0 || raise <= 0) {
        summary.style.display = 'none';
        orchestrator._scenarioOverlay = null;
        orchestrator._scenarioMode = false;
        orchestrator.render();
        return;
      }

      const newShares   = raise / pps;
      const newTotal    = totalFdShares + newShares;
      const postMoney   = preMoney + raise;
      const newInvPct   = (newShares / newTotal * 100).toFixed(1);
      const dilution    = (newShares / newTotal * 100).toFixed(1);

      // Build overlay items
      const overlayItems = stakeholders.map(sh => ({
        ...sh,
        _simFdShares: parseFloat(sh.fdShares) || 0,
        _simOwnership: ((parseFloat(sh.fdShares) || 0) / newTotal * 100),
        _simValue: ((parseFloat(sh.fdShares) || 0) * pps),
        _isSimulated: false
      }));

      // Add new investor dot — gray with dashed border = "in the air"
      overlayItems.push({
        name: investorName,
        dotLabel: investorName.substring(0, 3).toUpperCase(),
        displayID: '__sim_new_investor__',
        ID: '__sim_new_investor__',
        fdShares: newShares,
        _simFdShares: newShares,
        _simOwnership: parseFloat(newInvPct),
        _simValue: raise,
        _isSimulated: true,
        entityType: 'stakeholder',
        timestamp: Date.now(),
        hidden: false,
        metadata: { displayConfig: { color: '#636e72', border: '3px dashed #636e72' } }
      });

      orchestrator._scenarioOverlay = overlayItems;
      orchestrator._scenarioMode = true;
      orchestrator._scenarioPPS = pps;

      // Keep overlay permanently in company.stakeholders while in sim mode.
      // The original is saved once (first call) and restored only on exit.
      if (targetCompany) {
        if (!orchestrator._simOrigStakeholders) {
          orchestrator._simOrigStakeholders = targetCompany.stakeholders;
        }
        targetCompany.stakeholders = overlayItems;
      }
      orchestrator.render();

      // Style the simulated investor dot — gray + dashed border = "in the air"
      // Applied after render since the dot is recreated on each render call
      requestAnimationFrame(function() {
        const simDot = document.querySelector('.dot[data-id="__sim_new_investor__"]');
        if (simDot) {
          simDot.style.backgroundColor = '#636e72';
          simDot.style.border = '3px dashed #2d3436';
          simDot.style.color = '#fff';
          simDot.style.boxShadow = 'none';
          simDot.style.opacity = '1';
        }
      });

      // Update summary
      summary.style.display = 'block';
      summaryRows.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#636e72;">Post-money</span>
          <span style="font-weight:600;">${fmt(postMoney)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#636e72;">Price / share</span>
          <span style="font-weight:600;">$${pps.toFixed(4)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#636e72;">New shares</span>
          <span style="font-weight:600;">${Math.round(newShares).toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#636e72;">New investor</span>
          <span style="font-weight:600;">${newInvPct}%</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#636e72;">Dilution</span>
          <span style="font-weight:600; color:#e17055;">${dilution}% of existing</span>
        </div>
      `;
    }

    premoneyEl.addEventListener('input', syncFromPreMoney);
    ppsEl.addEventListener('input', syncFromPPS);
    raiseEl.addEventListener('input', updateSimulation);
    nameEl.addEventListener('input', updateSimulation);

    // ── Close handlers ──────────────────────────────────────────────────
    function closePanel() {
      panel.style.right = `-${PANEL_WIDTH}px`;
      canvas.style.width = '100%';
      setTimeout(() => {
        panel.remove();
        orchestrator.render();
      }, 310);
      // Restore original stakeholders
      if (targetCompany && orchestrator._simOrigStakeholders) {
        targetCompany.stakeholders = orchestrator._simOrigStakeholders;
        orchestrator._simOrigStakeholders = null;
      }
      orchestrator._scenarioOverlay = null;
      orchestrator._scenarioMode = false;
      orchestrator.render();
    }

    panel.querySelector('#sim-close').onclick = closePanel;
    panel.querySelector('#sim-exit').onclick = closePanel;

    // Exit simulation when navigating away
    orchestrator._simCleanup = closePanel;
  }

  function _openSimulateMenu(orchestrator) {
    _showSimulationPanel(orchestrator);
  }

  function _showSimulatePicker(options) {
    // No picker needed — simulation panel handles everything
  }

  function _exitScenario(orchestrator) {
    const panel = document.getElementById('captable-sim-panel');
    if (panel) panel.querySelector('#sim-exit')?.click();
  }

  function runSimulation(type, inputs) {
    // Simulation runs live via panel inputs — no explicit run needed
  }

  function _renderScenarioOverlay() {
    // Handled by preComputeScore reading _scenarioOverlay
  }
  // §7.1/7.2/7.3 — pure, non-destructive compute over the snapshot.
  // type: 'newRoundDilution' | 'exitWaterfall' | 'dilutionTrajectory'
  function runSimulation(type, inputs) {
    const refs = { newRoundDilution: '§7.1', exitWaterfall: '§7.2', dilutionTrajectory: '§7.3' };
    _notImplemented('runSimulation', refs[type] || '§7');
  }

  // §7/§10 — enter/exit a derived scenario view; never mutates source.
  function _renderScenarioOverlay() { _notImplemented('_renderScenarioOverlay', '§7/§10 (Simulate overlay)'); }
  function _exitScenario() { _notImplemented('_exitScenario', '§7/§10 (Simulate overlay)'); }

  // §6 — re-score without re-layout.
  function toggleOwnershipView(view) { _notImplemented('toggleOwnershipView(' + view + ')', '§6 (FD <-> outstanding)'); }
  function toggleScoreField(field) { _notImplemented('toggleScoreField(' + field + ')', '§6 (economic <-> voting)'); }

  // §4 — "Create your workspace": NO custom captable code needed here at
  // all. The generic platform addItem(entityType, form) flow (called when
  // the investor submits the standard "create" form for entityType:
  // 'investor') already does everything: mints the real UUID via
  // this.db.generateUUID(), calls saveLastViewedContext(appId, [newItem.ID])
  // itself when !isowner (true for every captable investor, since
  // investors have no real platform login), sets currentPath, and
  // navigates via window.history.pushState(getAppUrl(currentPath)) — which
  // builds the URL from displayID (the hash), never the raw ID.
  //
  // An earlier draft of this file had a separate _onCreateWorkspaceClick
  // that re-derived a UUID from a captable-specific _getCaptableUserId()
  // helper and navigated to a URL built from THAT value. This was wrong:
  // addItem's this.db.generateUUID() is the only source of truth for the
  // investor entity's real ID — _getCaptableUserId()'s independently
  // self-generated value is never the same UUID and never becomes the
  // saved entity's ID, so navigating based on it would point at a path
  // nothing was ever saved under. Both that function and
  // _getCaptableUserId() (which had no other consumer) have been removed.

  /* ─────────────────────────────────────────────
     11. INSTALL + BOOTSTRAP
  ───────────────────────────────────────────── */

  function installCaptableExt(orchestrator) {
    _injectCaptableStyles();

    const _origExecuteImport = orchestrator._executeImport?.bind(orchestrator);

    const _origRenderContextBar = orchestrator.renderContextBar.bind(orchestrator);
    Object.assign(orchestrator, {
      _getCurrentCompany: function () { return _getCurrentCompany(orchestrator); },
      importCapTable: importCapTable,

      // Override _executeImport to sort entitiesToSave by path depth before
      // the batch save — parents must be indexed before children so that
      // createUpdateAppTopic finds the parent TOPICS entry when processing
      // each child, keeping the grant paths in the topic index.
      // We intercept db.saveEntitiesBatch via a temporary wrapper since
      // _executeImport calls this.db.saveEntitiesBatch directly.
      _executeImport: async function (previewItems, entityType, levels) {
        const origSave = orchestrator.db.saveEntitiesBatch.bind(orchestrator.db);
        orchestrator.db.saveEntitiesBatch = async function (entities, onProgress) {
          const sorted = entities.slice().sort(function (a, b) {
            return a.path.split('/').length - b.path.split('/').length;
          });
          orchestrator.db.saveEntitiesBatch = origSave;
          return origSave(sorted, onProgress);
        };
        await _origExecuteImport(previewItems, entityType, levels);

        // Only run _finishCaptableImport if _executeImport succeeded —
        // _executeImport catches its own errors internally and shows a
        // notification without re-throwing, so we check whether _targetItem
        // was set on the first item as a proxy for success.
        const importSucceeded = previewItems.length > 0 && previewItems[0]._targetItem != null;
        if (!importSucceeded) {
          console.warn('[captable] _executeImport appears to have failed — skipping _finishCaptableImport');
          return;
        }

        if (entityType === 'stakeholder' && previewItems.some(function (p) { return p.children?.length > 0; })) {
          const company = orchestrator.currentPath.length >= 2
            ? (orchestrator.data?.items?.[0] || null)
            : null;
          if (company) {
            await _finishCaptableImport(orchestrator, company, previewItems);
          }
        }
      },

      // Override the generic _triggerCSVImport so that the "Import CSV"
      // button in the add-modal routes directly to importCapTable (which
      // has its own REQUIRED_FIELDS detection, column-mapping modal, company
      // creation, and "Me" matching) rather than the generic _processCSVImport
      // flow (which validates against whatever nextEntityType is — "company"
      // at depth 1 — and knows nothing about captable's multi-level import).
      // Compute derived score fields at render time rather than reading from
      // stored entity data. Called by calculateVisualScores for each item.
      // Returns a numeric value to use instead of item[scoreField], or null
      // to fall back to the stored field value.
      preComputeScore: function(item, entityType, scoreField) {
        // ── Scenario mode — use overlay values ──────────────────────────
        if (this._scenarioMode && this._scenarioOverlay && entityType === 'stakeholder') {
          const overlayItem = this._scenarioOverlay.find(function (o) {
            return o.ID === item.ID || o.displayID === item.displayID;
          });
          if (overlayItem) {
            if (scoreField === 'fdShares' || scoreField === 'outstandingShares') {
              return overlayItem._simFdShares || 0;
            }
            if (scoreField === 'payout' || scoreField === 'myStakeValue') {
              return overlayItem._simValue || 0;
            }
          }
          // New simulated investor dot — use its _simValue
          if (item._isSimulated) {
            return item._simValue || 0;
          }
        }

        // ── Normal mode ─────────────────────────────────────────────────
        if (entityType === 'company' && scoreField === 'myStakeValue') {
          if (!item.myStakeholderId || !item.stakeholders) return 0;
          const me = item.stakeholders.find(function (s) {
            return s.ID === item.myStakeholderId;
          });
          return me ? (parseFloat(me.fdShares) || 0) : 0;
        }
        if (entityType === 'company' && scoreField === 'totalFdShares') {
          if (!item.stakeholders) return 0;
          return item.stakeholders.reduce(function (sum, s) {
            return sum + (parseFloat(s.fdShares) || 0);
          }, 0);
        }
        if (entityType === 'company' && scoreField === 'totalInvestedAmount') {
          if (!item.stakeholders) return 0;
          return item.stakeholders.reduce(function (sum, s) {
            return sum + (parseFloat(s.investedAmount) || 0);
          }, 0);
        }
        return null;
      },

      // depth 1 (investor canvas). At deeper levels, actively remove it
      // if present — the generic implementation never removes it, so
      // navigating from depth 1 → depth 2 would leave a stale button.
      _injectImportButton: function (entityType) {
        const modal = document.getElementById('add-modal');
        if (!modal) return;
        const existingBtn = modal.querySelector('.import-csv-btn');
        if (orchestrator.currentPath.length !== 1) {
          if (existingBtn) existingBtn.remove();
          return;
        }
        if (!orchestrator.isDataOwner()) return;
        if (existingBtn) return;
        const modalTitle = document.getElementById('modal-title');
        if (!modalTitle) return;
        if (!modalTitle.querySelector('.modal-title-text')) {
          const textSpan = document.createElement('span');
          textSpan.className = 'modal-title-text';
          textSpan.textContent = modalTitle.textContent;
          modalTitle.textContent = '';
          modalTitle.appendChild(textSpan);
        }
        modalTitle.style.cssText = 'display:flex; justify-content:space-between; align-items:center; width:100%;';
        const btn = document.createElement('button');
        btn.className = 'import-csv-btn';
        btn.title = 'Import cap table from CSV';
        btn.style.cssText = `
          background: none; border: 1px solid #6c5ce7; border-radius: 6px;
          padding: 4px 10px; font-size: 12px; color: #6c5ce7; cursor: pointer;
          display: flex; align-items: center; gap: 4px; font-weight: 600;
          margin-left: auto;
        `;
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import Cap Table
        `;
        btn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          orchestrator._triggerCSVImport(entityType);
        };
        modalTitle.appendChild(btn);
      },

      _triggerCSVImport: function (entityType) {
        if (orchestrator.currentPath.length !== 1) return;
        const input = document.createElement('input');
        const MAX_FILE_SIZE_MB = 5;
        input.type = 'file';
        input.accept = '.csv,text/csv';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = async function (e) {
          const file = e.target.files?.[0];
          document.body.removeChild(input);
          if (!file) return;
          if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            orchestrator.showNotification('❌ File too large. Maximum size is ' + MAX_FILE_SIZE_MB + 'MB', 'error');
            return;
          }
          if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
            orchestrator.showNotification('❌ Please select a valid CSV file', 'error');
            return;
          }
          try {
            await orchestrator.importCapTable(file);
          } catch (err) {
            orchestrator.showNotification('❌ Import failed: ' + (err.message || 'Unknown error'), 'error');
          }
        };
        input.click();
      },

      _openCaptableAddMenu: _openCaptableAddMenu,
      _showCaptableAddPicker: _showCaptableAddPicker,
      _openSimulateMenu: _openSimulateMenu,
      _showSimulatePicker: _showSimulatePicker,
      runSimulation: runSimulation,
      _renderScenarioOverlay: _renderScenarioOverlay,
      _exitScenario: _exitScenario,
      toggleOwnershipView: toggleOwnershipView,
      toggleScoreField: toggleScoreField
    });

    // Save original renderContextBar before overriding
    orchestrator.renderContextBar = function(items, entityType, visualScores) {
      _origRenderContextBar(items, entityType, visualScores);

      if (entityType !== 'stakeholder') return;
      const bar = document.getElementById('context-bar');
      if (!bar) return;
      bar.querySelector('.captable-sim-btn')?.remove();

      const simBtn = document.createElement('button');
      simBtn.className = 'captable-sim-btn';
      const self = this;

      if (this._scenarioMode) {
        simBtn.textContent = '🔮 Simulation Mode';
        simBtn.style.cssText = `
          padding:3px 12px; border-radius:12px; font-size:12px; font-weight:600;
          cursor:pointer; border:1px solid #6c5ce7; background:#f0ebff;
          color:#6c5ce7; margin-left:8px;
        `;
        simBtn.onclick = function() { self._exitScenario(self); };
      } else {
        simBtn.textContent = '⚡ Simulate';
        simBtn.style.cssText = `
          padding:3px 12px; border-radius:12px; font-size:12px; font-weight:600;
          cursor:pointer; border:1px solid #636e72; background:#f8f8f8;
          color:#636e72; margin-left:8px; transition:all 0.15s;
        `;
        simBtn.onmouseenter = function() {
          simBtn.style.background = '#f0ebff';
          simBtn.style.borderColor = '#6c5ce7';
          simBtn.style.color = '#6c5ce7';
        };
        simBtn.onmouseleave = function() {
          simBtn.style.background = '#f8f8f8';
          simBtn.style.borderColor = '#636e72';
          simBtn.style.color = '#636e72';
        };
        simBtn.onclick = function() { _showSimulationPanel(self); };
      }
      bar.appendChild(simBtn);
    };
  }

  // CONFIRMED from the JSP: `window.app = new SchemaOrchestrator(...)` runs
  // in a <script defer> block, which executes AFTER non-deferred scripts
  // (this file included, loaded the same way as agnts-app-ext.js) have
  // already run during initial parse. So `window.app` is NOT yet defined
  // when this file first executes — polling is required, not optional.
  function bootstrap() {
    if (!window.app) {
      setTimeout(bootstrap, 50);
      return;
    }
    installCaptableExt(window.app);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();