/**
inventory-extension.js
App-specific extension for the Inventory Manager app.
Patches onto SchemaOrchestrator.prototype.
Load AFTER schema-orchestrator.min.js, only on inventory app pages.
ES5-compatible — no optional chaining, no arrow functions in prototype methods.
*/
(function() {
'use strict';

if (typeof SchemaOrchestrator === 'undefined') {
    console.error('[InventoryExtension] SchemaOrchestrator not found — load after schema-orchestrator.min.js');
    return;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
SchemaOrchestrator.prototype._getCurrentSeller = function() {
    if (this.currentPath.length === 0) return null;
    var sellerId = this.currentPath[0].id;
    if (!this.data || !this.data.items) return null;
    return this.data.items.find(function(s) {
        return s.ID === sellerId || s.displayID === sellerId;
    }) || null;
};

SchemaOrchestrator.prototype._getSellerItems = function() {
    if (!this.data || !this.data.items || this.currentPath.length === 0) return [];
    var sellerEntityType = this.currentApp.hierarchy[0];
    var sellerConfig = this.currentApp.entityConfigs[sellerEntityType];
    var itemsField = sellerConfig && sellerConfig.childrenField;

    var seller = this._getCurrentSeller();
    if (!seller) return [];
    return seller[itemsField] || [];
};

// Helper to safely get integration config
SchemaOrchestrator.prototype._getIntegrationConfig = function(seller, provider) {
    if (!seller || !seller.integrations) return null;
    return seller.integrations[provider] || null;
};

// Helper to set integration config
SchemaOrchestrator.prototype._setIntegrationConfig = function(seller, provider, config) {
    if (!seller.integrations) seller.integrations = {};
    seller.integrations[provider] = config;
};

// ─────────────────────────────────────────────
// ETSY OAuth Initiation
// ─────────────────────────────────────────────
SchemaOrchestrator.prototype.initEtsyAuth = async function() {
    var self = this;
    var seller = this._getCurrentSeller();
    if (!seller) {
        this.showNotification('⚠️ No seller selected', 'error');
        return;
    }

    try {
        this.showNotification('🔐 Redirecting to Etsy...', 'info');
        
        var etsySellerId = seller.ID;
        
        var response = await 		fetch('/newauth/api/connect/etsy/init?context=' + encodeURIComponent(JSON.stringify({
		    sellerId: etsySellerId,
		    sellerName: seller.name || seller.dotLabel
		})), { method: 'GET', credentials: 'include' });
        
        if (!response.ok) {
            throw new Error('Auth init failed: ' + response.status);
        }
        
        var data = await response.json();
        
        sessionStorage.setItem('etsy_auth_state', data.state);
        sessionStorage.setItem('etsy_seller_id', etsySellerId);
        sessionStorage.setItem('etsy_seller_name', seller.name || seller.dotLabel);
        
        var popup = newauthOAuth.centeredPopup(data.authUrl, 'etsy_oauth', 560, 680);
        
    } catch (err) {
        console.error('[InventoryExtension] Etsy auth init failed:', err);
        this.showNotification('❌ Etsy auth failed: ' + err.message, 'error');
    }
};


// ─────────────────────────────────────────────
// ETSY SYNC (auto on page load)
// ─────────────────────────────────────────────
SchemaOrchestrator.prototype.maybeEtsySync = async function() {
    if (!this.currentApp || this.currentApp.id !== 'inventory') return;
    
    // Check for OAuth callback first-- 
    //await this.handleEtsyCallback();
    
    var seller = this._getCurrentSeller();
    var etsyConfig = this._getIntegrationConfig(seller, 'etsy');
    
    if (!seller || !etsyConfig || !etsyConfig.connected) return;

    var lastSync = etsyConfig.lastSync || 0;
    var oneDayMs = 24 * 60 * 60 * 1000;

    if (Date.now() - lastSync > oneDayMs) {
        this.showNotification('🔄 Syncing with Etsy...', 'info');
        try {
            await this._syncEtsyOrders(seller);
        } catch (err) {
            console.error('[InventoryExtension] Etsy sync failed:', err);
            if (err.message && err.message.includes('TOKEN_EXPIRED')) {
                etsyConfig.connected = false;
                await this.db.savePartialAppData(
                    this.currentApp.id,
                    { items: [seller] },
                    { operation: 'update', entityType: 'seller', appId: this.currentApp.id, isPartial: true }
                );
                this.showNotification('⚠️ Etsy connection expired — please reconnect', 'warning');
            } else {
                this.showNotification('⚠️ Etsy sync failed — showing last known data', 'warning');
            }
        }
        this.render();
    }
};

SchemaOrchestrator.prototype._syncEtsyOrders = async function(seller) {
    var self = this;
    var etsyConfig = this._getIntegrationConfig(seller, 'etsy');
    var etsySellerId = seller.ID;
    var lastSync = etsyConfig.lastSync || 0;

    var response = await fetch('/newauth/api/connect/etsy/data?etsySellerId=' + encodeURIComponent(etsySellerId) + 
                               '&tenantId=' + encodeURIComponent(this.currentUserId || 'default') +
                               '&lastSyncTimestamp=' + lastSync +
                               '&accessToken=' + encodeURIComponent(etsyConfig.accessToken) +
                               '&refreshToken=' + encodeURIComponent(etsyConfig.refreshToken) +
                               '&tokenExpiresAt=' + etsyConfig.tokenExpiresAt, {
        method: 'GET',
        credentials: 'include'
    });

    if (response.status === 401) {
        var error = await response.json();
        if (error.requiresReauth) {
            throw new Error('TOKEN_EXPIRED');
        }
        throw new Error('Authentication failed');
    }

    if (!response.ok) {
        var errorData = await response.json().catch(function() { return {}; });
        throw new Error(errorData.error || 'Sync failed: ' + response.status);
    }

    var etsyData = await response.json();

    // Update tokens if refreshed
    if (etsyData.accessToken) {
        etsyConfig.accessToken = etsyData.accessToken;
        etsyConfig.refreshToken = etsyData.refreshToken;
        etsyConfig.tokenExpiresAt = etsyData.tokenExpiresAt;
    }

    var localItems = this._getSellerItems();
    var itemsToUpdate = [];

    etsyData.listings.forEach(function(etsyListing) {
        var match = self._findMatchingItem(localItems, etsyListing);
        
        if (match.item) {
            match.item.etsyListingId = etsyListing.listingId;
            match.item.etsyListingUrl = etsyListing.url;

            if (match.item.variations) {
                match.item.variations.forEach(function(variation) {
                    if (variation.sku && etsyData.soldBySku[variation.sku]) {
                        var sold = etsyData.soldBySku[variation.sku];
                        var currentStock = parseFloat(variation.stock) || 0;
                        var newStock = Math.max(0, currentStock - sold);

                        if (sold > 0) {
                            variation.stock = newStock;
                            variation._etsySoldSinceSync = sold;
                            variation.etsyVariationId = self._getVariationIdBySku(etsyListing, variation.sku);
                        }
                    }
                });
            }
            itemsToUpdate.push(match.item);
        } else {
            var newItem = self._createItemFromEtsy(etsyListing);
            localItems.push(newItem);
            itemsToUpdate.push(newItem);
        }
    });

    if (itemsToUpdate.length > 0) {
        await self.db.savePartialAppData(
            self.currentApp.id,
            { items: itemsToUpdate },
            { operation: 'update', entityType: 'item', appId: self.currentApp.id, isPartial: true }
        );
    }

    etsyConfig.lastSync = Date.now();
    await self.db.savePartialAppData(
        self.currentApp.id,
        { items: [seller] },
        { operation: 'update', entityType: 'seller', appId: self.currentApp.id, isPartial: true }
    );

    this.showNotification('✅ Synced ' + etsyData.totalListings + ' listings, ' + 
                         etsyData.totalOrders + ' orders from Etsy', 'success');
};

// ─────────────────────────────────────────────
// Matching Helpers
// ─────────────────────────────────────────────
SchemaOrchestrator.prototype._findMatchingItem = function(localItems, etsyListing) {
    for (var i = 0; i < localItems.length; i++) {
        var item = localItems[i];
        if (item.variations) {
            for (var j = 0; j < item.variations.length; j++) {
                if (item.variations[j].sku && 
                    item.variations[j].sku === etsyListing.sku) {
                    return { item: item, matchType: 'sku' };
                }
            }
        }
    }

    var normalizedEtsy = this._normalizeTitle(etsyListing.title);
    for (var i = 0; i < localItems.length; i++) {
        var item = localItems[i];
        var normalizedLocal = this._normalizeTitle(item.name || item.dotLabel);
        if (this._similarityScore(normalizedEtsy, normalizedLocal) > 0.7) {
            return { item: item, matchType: 'title' };
        }
    }

    return { item: null, matchType: 'none' };
};

SchemaOrchestrator.prototype._normalizeTitle = function(title) {
    if (!title) return '';
    return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
};

SchemaOrchestrator.prototype._similarityScore = function(s1, s2) {
    var distance = this._levenshteinDistance(s1, s2);
    var maxLen = Math.max(s1.length, s2.length);
    return maxLen === 0 ? 1.0 : 1.0 - distance / maxLen;
};

SchemaOrchestrator.prototype._levenshteinDistance = function(s1, s2) {
    var dp = [];
    for (var i = 0; i <= s1.length; i++) {
        dp[i] = [i];
    }
    for (var j = 0; j <= s2.length; j++) {
        dp[0][j] = j;
    }
    for (var i = 1; i <= s1.length; i++) {
        for (var j = 1; j <= s2.length; j++) {
            var cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[s1.length][s2.length];
};

SchemaOrchestrator.prototype._getVariationIdBySku = function(etsyListing, sku) {
    if (!etsyListing.variations) return null;
    for (var i = 0; i < etsyListing.variations.length; i++) {
        if (etsyListing.variations[i].sku === sku) {
            return etsyListing.variations[i].variationId;
        }
    }
    return null;
};

SchemaOrchestrator.prototype._createItemFromEtsy = function(etsyListing) {
    var item = {
        ID: this.db.generateUUID(),
        displayID: etsyListing.listingId,
        name: etsyListing.title,
        dotLabel: etsyListing.title.substring(0, Math.min(20, etsyListing.title.length)),
        etsyListingId: etsyListing.listingId,
        etsyListingUrl: etsyListing.url,
        alertThreshold: 5,
        timestamp: Date.now(),
        variations: []
    };

    if (etsyListing.variations) {
        var self = this;
        etsyListing.variations.forEach(function(etsyVar) {
            item.variations.push({
                ID: self.db.generateUUID(),
                displayID: etsyVar.variationId,
                name: etsyVar.title,
                dotLabel: etsyVar.title.substring(0, Math.min(15, etsyVar.title.length)),
                stock: etsyVar.quantity,
                sku: etsyVar.sku,
                price: etsyVar.price,
                etsyVariationId: etsyVar.variationId,
                timestamp: Date.now()
            });
        });
    }

    return item;
};

// ─────────────────────────────────────────────
// RECONCILIATION MODAL
// ─────────────────────────────────────────────
SchemaOrchestrator.prototype.openReconcileModal = function() {
    var self = this;
    var items = this._getSellerItems();
    
    if (!items.length) {
        this.showNotification('No items found to reconcile', 'info');
        return;
    }

    var existingOverlay = document.querySelector('.reconcile-overlay');
    if (existingOverlay) existingOverlay.remove();

    var overlay = document.createElement('div');
    overlay.className = 'reconcile-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:10001; display:flex; align-items:center; justify-content:center;';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:white; border-radius:12px; padding:24px; width:680px; max-width:95vw; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    // ── Header ──
    var header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;';
    header.innerHTML = '<h2 style="margin:0; font-size:18px;">📦 Reconcile Inventory</h2>' +
        '<button class="reconcile-close" style="background:none; border:none; font-size:20px; cursor:pointer; color:#636e72; line-height:1;">✕</button>';
    modal.appendChild(header);

    // ── Item selector row ──
    var selectorRow = document.createElement('div');
    selectorRow.style.cssText = 'display:flex; align-items:center; gap:12px; margin-bottom:20px;';

    var select = document.createElement('select');
    select.style.cssText = 'flex:1; padding:8px 12px; border-radius:8px; border:1px solid #ddd; font-size:14px; color:#2d3436; cursor:pointer;';

    items.forEach(function(item, idx) {
        var opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = item.name || item.dotLabel || ('Item ' + (idx + 1));
        select.appendChild(opt);
    });

    var etsyBadge = document.createElement('span');
    etsyBadge.style.cssText = 'padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; white-space:nowrap;';

    var etsyActionBtn = document.createElement('button');
    etsyActionBtn.style.cssText = 'padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; border:none;';
    
    var seller = this._getCurrentSeller();
    var etsyConfig = this._getIntegrationConfig(seller, 'etsy');
    var isEtsyConnected = !!(etsyConfig && etsyConfig.connected);
    
    if (isEtsyConnected) {
        etsyBadge.textContent = '🟢 Etsy Connected';
        etsyBadge.style.background = '#e8f5e9';
        etsyBadge.style.color = '#2e7d32';
        
        etsyActionBtn.textContent = '🔄 Sync Now';
        etsyActionBtn.style.background = '#00b894';
        etsyActionBtn.style.color = 'white';
        etsyActionBtn.onclick = function() {
            self._syncEtsyOrders(seller).then(function() {
                self.render();
                renderItemTable(parseInt(select.value));
            }).catch(function(err) {
                self.showNotification('Sync failed: ' + err.message, 'error');
            });
        };
    } else {
        etsyBadge.textContent = '⚪ Manual Mode';
        etsyBadge.style.background = '#f0f0f0';
        etsyBadge.style.color = '#636e72';
        
        etsyActionBtn.textContent = '🔗 Connect Etsy';
        etsyActionBtn.style.background = '#f57c00';
        etsyActionBtn.style.color = 'white';
        etsyActionBtn.onclick = function() {
            overlay.remove();
            self.initEtsyAuth();
        };
    }

    selectorRow.appendChild(select);
    selectorRow.appendChild(etsyBadge);
    selectorRow.appendChild(etsyActionBtn);
    modal.appendChild(selectorRow);

    // ── Table container ──
    var tableContainer = document.createElement('div');
    modal.appendChild(tableContainer);

    // ── Action row ──
    var actionRow = document.createElement('div');
    actionRow.style.cssText = 'display:flex; gap:10px; justify-content:flex-end; margin-top:20px;';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:9px 20px; border-radius:8px; font-size:14px; cursor:pointer; border:1px solid #ddd; background:#f0f0f0; font-weight:600;';
    cancelBtn.onclick = function() { overlay.remove(); };

    var confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm Reconciliation';
    confirmBtn.style.cssText = 'padding:9px 20px; border-radius:8px; font-size:14px; cursor:pointer; border:none; background:#6c5ce7; color:white; font-weight:600;';

    actionRow.appendChild(cancelBtn);
    actionRow.appendChild(confirmBtn);
    modal.appendChild(actionRow);

    // ── Render table for selected item ──
    var renderItemTable = function(itemIdx) {
        var item = items[itemIdx];
        var seller = self._getCurrentSeller();
        var etsyConfig = self._getIntegrationConfig(seller, 'etsy');
        var isEtsyConnected = !!(etsyConfig && etsyConfig.connected);
        var isEtsyLinked = !!(item.etsyListingId);

        etsyBadge.textContent = isEtsyConnected ? 
            (isEtsyLinked ? '🟢 Etsy Linked' : '🟢 Etsy Connected') : '⚪ Manual Mode';
        etsyBadge.style.background = isEtsyConnected ? '#e8f5e9' : '#f0f0f0';
        etsyBadge.style.color = isEtsyConnected ? '#2e7d32' : '#636e72';

        var entityConfigs = self.currentApp.entityConfigs;
        var itemConfig = entityConfigs && entityConfigs['item'];
        var childrenField = itemConfig && itemConfig.childrenField;
        var variations = (childrenField && item[childrenField]) || item.variations || [];

        tableContainer.innerHTML = '';

        if (!variations.length) {
            tableContainer.innerHTML = '<div style="text-align:center; color:#999; padding:24px;">No variations found for this item</div>';
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            return;
        }

        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    
        // ── Last reconciliation info ──
        var reconciliations = item.reconciliations;
        if (reconciliations && reconciliations.length > 0) {
            var lastRecon = reconciliations[reconciliations.length - 1];
            var lastReconDiv = document.createElement('div');
            lastReconDiv.style.cssText = 'font-size:12px; color:#636e72; margin-bottom:12px; padding:8px 12px; background:#f8f8f8; border-radius:6px; display:flex; justify-content:space-between; align-items:center;';
            var source = lastRecon.source === 'etsy' ? '🟢 Etsy' : '✋ Manual';
            var changesCount = (lastRecon.changes && lastRecon.changes.length) || 0;
            lastReconDiv.innerHTML =
                '<span>Last reconciled: ' + new Date(lastRecon.timestamp).toLocaleString() + '</span>' +
                '<span>' + source + ' · ' + changesCount + ' variation' + (changesCount !== 1 ? 's' : '') + ' updated</span>';
            tableContainer.appendChild(lastReconDiv);
        }

        // ── Variations table ──
        var alertThreshold = parseFloat(item.alertThreshold) || 0;

        var table = document.createElement('table');
        table.style.cssText = 'width:100%; border-collapse:collapse; font-size:13px;';
        table.innerHTML =
            '<thead>' +
                '<tr style="background:#f8f8f8; border-bottom:2px solid #eee;">' +
                    '<th style="padding:8px; text-align:left; color:#636e72; font-size:11px; font-weight:600;">VARIATION</th>' +
                    '<th style="padding:8px; text-align:center; color:#636e72; font-size:11px; font-weight:600;">CURRENT</th>' +
                    '<th style="padding:8px; text-align:center; color:#e17055; font-size:11px; font-weight:600;">− SOLD</th>' +
                    '<th style="padding:8px; text-align:center; color:#00b894; font-size:11px; font-weight:600;">+ RESTOCK</th>' +
                    '<th style="padding:8px; text-align:center; color:#6c5ce7; font-size:11px; font-weight:600;">NEW STOCK</th>' +
                '</tr>' +
            '</thead>';

        var tbody = document.createElement('tbody');

        variations.forEach(function(variation, vIdx) {
            var currentStock = parseFloat(variation.stock) || 0;
            var etsySold = variation._etsySoldSinceSync || 0;

            var stockColor = currentStock === 0
                ? '#e53935'
                : currentStock <= alertThreshold
                    ? '#ffa726'
                    : '#2d3436';

            var etsyBadgeHtml = variation.etsyVariationId
                ? '<span style="font-size:10px;color:#00b894;margin-left:4px;font-weight:600;">E</span>'
                : '';

            var tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom:1px solid #f0f0f0;';
            tr.innerHTML =
                '<td style="padding:8px; color:#2d3436; font-weight:500;">' +
                    (variation.name || variation.dotLabel) + etsyBadgeHtml +
                '</td>' +
                '<td style="padding:8px; text-align:center; font-weight:700; color:' + stockColor + ';">' +
                    currentStock +
                '</td>' +
                '<td style="padding:8px; text-align:center;">' +
                    '<input type="number" class="recon-sold" data-vidx="' + vIdx + '"' +
                           ' value="' + etsySold + '" min="0" max="' + currentStock + '"' +
                           ' style="width:60px; text-align:center; padding:4px 2px; border:1px solid #ddd; border-radius:6px; font-size:13px; font-weight:600; color:#e17055;">' +
                '</td>' +
                '<td style="padding:8px; text-align:center;">' +
                    '<input type="number" class="recon-restock" data-vidx="' + vIdx + '"' +
                           ' value="0" min="0"' +
                           ' style="width:60px; text-align:center; padding:4px 2px; border:1px solid #ddd; border-radius:6px; font-size:13px; font-weight:600; color:#00b894;">' +
                '</td>' +
                '<td class="new-stock-cell" data-vidx="' + vIdx + '"' +
                    ' style="padding:8px; text-align:center; font-weight:700;">' +
                    (currentStock - etsySold) +
                '</td>';
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);

        // ── Live new stock calculation ──
        var updateNewStock = function(vIdx) {
            var currentStock = parseFloat(variations[vIdx].stock) || 0;
            var soldEl = table.querySelector('.recon-sold[data-vidx="' + vIdx + '"]');
            var restockEl = table.querySelector('.recon-restock[data-vidx="' + vIdx + '"]');
            var sold = soldEl ? (parseFloat(soldEl.value) || 0) : 0;
            var restock = restockEl ? (parseFloat(restockEl.value) || 0) : 0;
            var newStock = Math.max(0, currentStock - sold + restock);

            var cell = table.querySelector('.new-stock-cell[data-vidx="' + vIdx + '"]');
            if (cell) {
                cell.textContent = newStock;
                cell.style.color = newStock === 0
                    ? '#e53935'
                    : newStock <= alertThreshold
                        ? '#ffa726'
                        : '#6c5ce7';
            }
        };

        var inputs = table.querySelectorAll('.recon-sold, .recon-restock');
        inputs.forEach(function(input) {
            input.addEventListener('input', function() {
                updateNewStock(parseInt(input.dataset.vidx));
            });
        });

        // ── Confirm handler ──
        confirmBtn.onclick = async function() {
            await self._executeReconciliation(item, variations, table, overlay);
        };
    };

    select.addEventListener('change', function() {
        renderItemTable(parseInt(select.value));
    });
    renderItemTable(0);

    modal.querySelector('.reconcile-close').onclick = function() { overlay.remove(); };
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
};

// ─────────────────────────────────────────────
// EXECUTE RECONCILIATION
// ─────────────────────────────────────────────
SchemaOrchestrator.prototype._executeReconciliation = async function(item, variations, table, overlay) {
    var self = this;
    var changes = [];
    var seller = this._getCurrentSeller();
    
    variations.forEach(function(variation, vIdx) {
        var currentStock = parseFloat(variation.stock) || 0;
        var soldEl = table.querySelector('.recon-sold[data-vidx="' + vIdx + '"]');
        var restockEl = table.querySelector('.recon-restock[data-vidx="' + vIdx + '"]');
        var sold = soldEl ? (parseFloat(soldEl.value) || 0) : 0;
        var restock = restockEl ? (parseFloat(restockEl.value) || 0) : 0;

        if (sold === 0 && restock === 0) return;

        var newStock = Math.max(0, currentStock - sold + restock);

        changes.push({
            variationId: variation.ID,
            variationName: variation.name || variation.dotLabel,
            soldQty: sold,
            restockedQty: restock,
            stockBefore: currentStock,
            stockAfter: newStock
        });

        variation.stock = newStock;
        delete variation._etsySoldSinceSync;
    });

    if (!changes.length) {
        self.showNotification('No changes to reconcile', 'info');
        overlay.remove();
        return;
    }

    if (!item.reconciliations) item.reconciliations = [];
    item.reconciliations.push({
        ID: self.db.generateUUID(),
        timestamp: Date.now(),
        source: (seller && self._getIntegrationConfig(seller, 'etsy')) ? 'etsy' : 'manual',
        changes: changes
    });

    overlay.remove();
    self.render();

    try {
        var metadata = {
            path: self.currentPath.map(function(p) { return p.displayID; }),
            operation: 'update',
            entityType: 'item',
            appId: self.currentApp.id,
            isPartial: true
        };

        await self.db.savePartialAppData(
            self.currentApp.id,
            { items: [item] },
            metadata
        );

        var count = changes.length;
        self.showNotification(
            '✅ Reconciled ' + count + ' variation' + (count !== 1 ? 's' : '') + ' — stock updated',
            'success'
        );
    } catch (err) {
        console.error('[InventoryExtension] Reconciliation save failed:', err);
        self.showNotification('❌ Reconciliation failed: ' + err.message, 'error');
    }
};

// ─────────────────────────────────────────────
// Hook into render to trigger Etsy sync on app load
// ─────────────────────────────────────────────
var originalRender = SchemaOrchestrator.prototype.render;
SchemaOrchestrator.prototype.render = function() {
    var self = this;
    originalRender.apply(self, arguments);
    
    if (this.currentApp && this.currentApp.id === 'inventory' && !this._etsySyncChecked) {
        this._etsySyncChecked = true;
        this.maybeEtsySync();
    }
};

console.log('[InventoryExtension] loaded ✓');
})();