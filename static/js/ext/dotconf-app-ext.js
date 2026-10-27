(function () {
  "use strict";
  var APP_ID = "conference";

  // ─────────────────────────────────────────────────────────────────────────────
  // Constants
  // ─────────────────────────────────────────────────────────────────────────────

  var PRESENCE_STATE = {
    ADDED:      "added",
    INVITED:    "invited",
    VIEWED:     "viewed",
    JOINING:    "joining",
    LISTENING:  "listening",
    AUDIO_ONLY: "audio_only",
    LIVE:       "live",
    LEFT:       "left"
  };
  
  var DOTCONF_PRESENCE_STYLES = {
    added:      { background: 'transparent', border: '2px solid #a9a0a6', color: '#faa0a6', opacity: 1,   useFrozenFrame: false },
    invited:    { background: '#b2bec3',     border: 'none',              color: '#fff',     opacity: 1,   useFrozenFrame: true  },
    viewed:     { background: '#74b9ff',     border: 'none',              color: '#fff',     opacity: 1,   useFrozenFrame: true  },
    joining:    { background: '#fdcb6e',     border: '2px solid #e17055', color: '#fff',     opacity: 1,   useFrozenFrame: true  },
    listening:  { background: '#00b894',     border: 'none',              color: '#fff',     opacity: 1,   useFrozenFrame: true  },
    audio_only: { background: '#00b894',     border: 'none',              color: '#fff',     opacity: 1,   useFrozenFrame: true  },
    live:       { background: '#00b894',     border: 'none',              color: '#fff',     opacity: 1,   useFrozenFrame: true  },
    left:       { background: '#dfe6e9',     border: 'none',              color: '#636e72',  opacity: 0.5, useFrozenFrame: false }
  };

  var DOTCONF_NAME_PALETTE = [
    '#6c5ce7', '#5f3dc4', '#4834d4', '#30336b', '#130f40',
    '#be2edd', '#c2185b', '#e84393', '#d63031', '#b33939',
    '#b71540', '#eb4d4b', '#e17055', '#cc8e35', '#827717',
    '#6c3483', '#4b6584', '#535c68', '#2d3436', '#636e72',
    '#00cec9', '#0a3d62', '#079992', '#8e44ad', '#7f8c8d'
  ];

  function _dotconfNameColor(name) {
    if (!name) return null;
    var str = name.trim().toLowerCase();
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return DOTCONF_NAME_PALETTE[Math.abs(hash) % DOTCONF_NAME_PALETTE.length];
  }

  var VIDEO_SLOTS_BY_N = (n) => {
    if (n <= 6)  return n;
    if (n <= 12) return 4;
    return 5;                  // 13–18
  };

  var WARN_AT  = 10;
  var HARD_CAP = 18;

  var PROMOTE_MS = 200;
  var DEMOTE_MS  = 2000;
  // STICKY_MS defined in layout varants below

  // ─────────────────────────────────────────────────────────────────────────────
  // State — all ephemeral, never written to the store
  // ─────────────────────────────────────────────────────────────────────────────

  let _sseSource       = null;   // EventSource for lobby + in-call roster
  let _peerConnection  = null;   // RTCPeerConnection to Cloudflare SFU
  let _localStream     = null;   // getUserMedia result
  let _audioCtx        = null;   // WebAudio context (speaker detection + recording)
  
  var _cachedMyId = null;
  
  var _initialNegotiationDone = false; // set true after _joinDotConf's manual publish completes

  // trackId → { kind, participantDisplayID, analyser, audioLevel, promotedAt, demotedAt }
  let _tracks          = {};

  // participantDisplayID → { videoTrackId, audioTrackId, presenceState, stickyUntil }
  let _roster          = {};

  // Set of participantDisplayIDs currently occupying a video slot
  let _videoSlots      = new Set();

  // Recording
  let _mediaRecorder   = null;
  let _recordingChunks = [];     // IndexedDB in Phase 4; plain array for Phase 2 skeleton

  let _largeMeetingWarned = false;
  
  let _mySessionId        = null;   // our own Cloudflare session id
  let _myLocalTracks      = null;   // [{ trackName, mid, kind }] — our own published tracks
  let _mySpeakingSec      = 0;      // accumulated locally, written once on leave
  let _cheapLevelInterval = null;   // getStats()-based polling, runs for ALL audio tracks
  let _layoutInterval     = null;   // 200ms layout ticker
  let _videoSubscribedTier = new Set(); // participantDisplayIDs we currently hold a video pull for
  let _pinnedUntil        = new Map();  // participantDisplayID -> expiresAt (ms epoch)
  const PIN_DURATION_MS   = 20000;      // must match server's DotConfUtils.PIN_DURATION_MS
  
  var _audioLevelUpdateInterval = null; // near other module-level interval handles
  var _midToTrackName = {}; // filled from each pull response; ontrack reads it

  function _recordPulledMids(pullResp) {
    (pullResp && pullResp.tracks || []).forEach(t => {
      if (t.mid != null && t.trackName) _midToTrackName[String(t.mid)] = t.trackName;
    });
  }
  

  function _startAudioLevelUpdates() {
    if (_audioLevelUpdateInterval) return;
    _audioLevelUpdateInterval = setInterval(_updateAudioLevels, 100); // matches the comment's stated 100ms design
  }

  function _stopAudioLevelUpdates() {
    if (_audioLevelUpdateInterval) {
      clearInterval(_audioLevelUpdateInterval);
      _audioLevelUpdateInterval = null;
    }
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Identity — mirrors poll's _getPollUserId() pattern
  // ─────────────────────────────────────────────────────────────────────────────

  function _getDotConfUserId() {
    try {
      let id = localStorage.getItem("dotconf_user_id");
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : _uuidv4();
        localStorage.setItem("dotconf_user_id", id);
      }
      return id;
    } catch (e) {
      try {
        let id = sessionStorage.getItem("dotconf_user_id");
        if (!id) { id = _uuidv4(); sessionStorage.setItem("dotconf_user_id", id); }
        return id;
      } catch (e2) {
        return _uuidv4();
      }
    }
  }

  function _uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  
  // Hide the platform's "+" (add participant) for participants, who can't add
  // anyone, and for everyone during a live call, where it would cover a tile.
  function _dotconfSyncAddButton(orchestrator) {
    if (!document.getElementById('dotconf-add-btn-style')) {
      var st = document.createElement('style');
      st.id = 'dotconf-add-btn-style';
      st.textContent = 'body.dotconf-hide-add .orb-add-btn { display: none !important; }';
      document.head.appendChild(st);
    }
    var inConf = orchestrator.currentApp?.id === 'conf' && orchestrator.currentPath?.length === 2;
    var hide   = inConf && (!orchestrator.isDataOwner() || orchestrator._dotconfCallLive === true);
    document.body.classList.toggle('dotconf-hide-add', !!hide);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // preComputeScore — audioLevel as a render-time field (never stored)
  // ─────────────────────────────────────────────────────────────────────────────

  function preComputeScore(item, entityType, scoreField) {
    if (entityType !== "participant" || scoreField !== "audioLevel") return null;
    var entry = _roster[item.displayID];
    if (!entry) return null;
    var track = _tracks[entry.audioTrackId];
    return track ? (track.audioLevel || 0) : null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SSE — lobby presence and in-call roster
  // ─────────────────────────────────────────────────────────────────────────────

  function _openSSE(orchestrator, tenantId, dotconfDisplayID, participantDisplayID) {
    if (_sseSource) { _sseSource.close(); _sseSource = null; }

    // Build SSE URL with tenantId (needed by server to varruct entity paths)
    // and participantDisplayID if we know who this person is
    var qs = new URLSearchParams({ tenantId });
    if (participantDisplayID) qs.set('participantDisplayID', participantDisplayID);
    var url = `/newauth/api/conf/sse/${dotconfDisplayID}?${qs.toString()}`;
    _sseSource = new EventSource(url);
    
    _sseSource.addEventListener('open', () => {
      // Runs on every (re)connect. If we're mid-call, re-assert live in case a long
      // outage got us marked left by the server's disconnect check.
      if (orchestrator._dotconfCallLive && _mySessionId) {
        var hasVideo = !!(_localStream && _localStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live'));
        var hasAudio = !!(_localStream && _localStream.getAudioTracks().length);
        _cfApi('POST /' + dotconfDisplayID + '/participant/live?tenantId=' + tenantId,
          { sessionId: _mySessionId, hasVideo: hasVideo, hasAudio: hasAudio })
          .catch(err => console.warn('[dotconf] re-assert live failed:', err));
      }
    });

    _sseSource.addEventListener("participant.viewed", e => {
      var { participantDisplayID } = JSON.parse(e.data);
      _updateParticipantPresence(orchestrator, participantDisplayID, PRESENCE_STATE.VIEWED);
    });
    
    _sseSource.addEventListener("participant.invited", e => {
      var { participantDisplayID } = JSON.parse(e.data);
      _updateParticipantPresence(orchestrator, participantDisplayID, PRESENCE_STATE.INVITED);
    });
    
    _sseSource.addEventListener("conference.status", e => {
      var data = JSON.parse(e.data);
      var conf = _getCurrentDotConf(orchestrator);
      if (conf) {
        conf.status = data.status;
        conf.autoEndAt = 0;
      }
      if (data.status === 'ended' && orchestrator._dotconfCallLive) {
        _leaveDotConf(orchestrator);
        if (!_dotconfEndingByMe && typeof orchestrator.showNotification === 'function') {
          orchestrator.showNotification(data.reason === 'auto'
            ? 'The call ended because everyone left.'
            : 'The host ended the call.');
        }
      }
      _dotconfEndingByMe = false;
      _dotconfRenderAutoEnd(orchestrator);
      if (typeof orchestrator.refreshContextBar === 'function') orchestrator.refreshContextBar();
    });

    _sseSource.addEventListener("conference.autoend", e => {
      var { at } = JSON.parse(e.data);
      var conf = _getCurrentDotConf(orchestrator);
      if (conf) conf.autoEndAt = at;
      _dotconfRenderAutoEnd(orchestrator);
    });

    _sseSource.addEventListener("participant.joined", e => {
      var payload = JSON.parse(e.data);
      var participantDisplayID = payload.participantDisplayID;
      var audioTrackId = payload.audioTrackId;
      var videoTrackId = payload.videoTrackId;
      var cfSessionId  = payload.cfSessionId; // requires the markJoining broadcast update above
     
      _roster[participantDisplayID] = Object.assign({}, _roster[participantDisplayID], {
        audioTrackId: audioTrackId,
        videoTrackId: videoTrackId,
        cfSessionId:  cfSessionId
      });
      _updateParticipantPresence(orchestrator, participantDisplayID, PRESENCE_STATE.JOINING);
     
      var myId = _getMyDotConfParticipantDisplayID(orchestrator);
      if (orchestrator._dotconfCallLive && participantDisplayID !== myId) {
        var conf = _getCurrentDotConf(orchestrator);
        if (conf) {
          _subscribeAudioForParticipant(orchestrator, _getTenantId(orchestrator), conf.displayID, _mySessionId, participantDisplayID)
            .catch(err => console.error('[dotconf] auto audio-subscribe on join failed:', err));
          // Video is intentionally NOT pulled here — the next _tickLayout run
          // (within 200ms) will pull it if/when this participant earns a tier.
        }
      }
    });


    _sseSource.addEventListener("participant.live", e => {
      var { participantDisplayID } = JSON.parse(e.data);
      _updateParticipantPresence(orchestrator, participantDisplayID, PRESENCE_STATE.LIVE);
    });

    _sseSource.addEventListener("participant.left", e => {
      var { participantDisplayID } = JSON.parse(e.data);
      _handlePeerLeft(orchestrator, participantDisplayID);
    });
    
    _sseSource.addEventListener("participant.screen", e => {
      _onScreenEvent(orchestrator, JSON.parse(e.data));
    });

    _sseSource.addEventListener("roster", e => {
       var payload = JSON.parse(e.data);
       var share = null;

       (payload.participants || []).forEach(p => {
         _roster[p.displayID] = Object.assign({}, _roster[p.displayID], {
           audioTrackId: p.cfAudioTrackId,
           videoTrackId: p.cfVideoTrackId,
           cfSessionId:  p.cfSessionId,
           isHost:       !!p.isHost
         });
         
         var conf  = _getCurrentDotConf(orchestrator);
         var local = conf?.participants?.find(x => x.displayID === p.displayID);
         if (local && p.presenceState && local.presenceState !== p.presenceState) {
           _updateParticipantPresence(orchestrator, p.displayID, p.presenceState);
         }

         // Remember an in-progress screen share so a late joiner picks it up.
         if (p.cfScreenTrackId) {
           share = {
             participantDisplayID: p.displayID, active: true, cfSessionId: p.cfSessionId,
             screenTrackId: p.cfScreenTrackId, screenAudioTrackId: p.cfScreenAudioTrackId || null,
             layout: p.screenLayout || 'split'
           };
         }
         
         _mediaState[p.displayID] = { micMuted: !!p.micMuted, cameraOff: !!p.cameraOff };
         
       });

       if (payload.pinned && typeof payload.pinned === 'object') {
         Object.keys(payload.pinned).forEach(pid => {
           _pinnedUntil.set(pid, payload.pinned[pid]);
         });
       }

       _rosterShare = share;
       if (orchestrator._dotconfCallLive) _dotconfResumeShare(orchestrator);
     });
    
    _sseSource.addEventListener("participant.pinned", e => {
      var { participantDisplayID, pinned, expiresAt } = JSON.parse(e.data);
      if (pinned) {
        _pinnedUntil.set(participantDisplayID, expiresAt);
      } else {
        _pinnedUntil.delete(participantDisplayID);
      }
    });

    _sseSource.addEventListener("participant.snapshot", e => {
      var s = JSON.parse(e.data);
      if (s.cleared) { _dotconfDropSnapshot(s.participantDisplayID); _dotconfRenderPreviews(orchestrator); return; }
      if (orchestrator._dotconfCallLive || !_dotconfIsViewer(orchestrator)) return;
      _dotconfFetchSnapshot(orchestrator, s.participantDisplayID);
    });
    
    _sseSource.addEventListener("recording.consent.request", e => {
      _showConsentBanner(orchestrator);
    });
    
    _sseSource.addEventListener("participant.media", e => {
      var m = JSON.parse(e.data);
      _mediaState[m.participantDisplayID] = { micMuted: !!m.micMuted, cameraOff: !!m.cameraOff };
      _dotconfRefreshTileLabel(m.participantDisplayID);
      _dotconfRefreshCard(orchestrator, m.participantDisplayID);
    });

    _sseSource.addEventListener("participant.removed", e => {
      _dotconfHandleRemoved(orchestrator, JSON.parse(e.data).participantDisplayID);
    });

    _sseSource.onerror = () => {
      // EventSource reconnects automatically; log for diagnostics only
      console.warn("[dotconf] SSE error — browser will retry");
    };
    
    _dotconfRenderAutoEnd(orchestrator);
  }

  function _closeSSE() {
    if (_sseSource) { _sseSource.close(); _sseSource = null; }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Presence helpers
  // ─────────────────────────────────────────────────────────────────────────────

  function _updateParticipantPresence(orchestrator, participantDisplayID, state) {
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf || !conf.participants) return;
    var p = conf.participants.find(p => p.displayID === participantDisplayID);
    if (!p) return;
    p.presenceState = state;
    // Lightweight in-place update — do NOT call orchestrator.render(), which
    // destroys and rebuilds every dot on the canvas (exit-animates, wipes
    // canvas.innerHTML, repaints from the generic engagement-scoring loop).
    // This was causing a full canvas rebuild on every presence SSE message.
    if (typeof orchestrator.dotconfApplyStaticPresenceStyles === 'function') {
      orchestrator.dotconfApplyStaticPresenceStyles(orchestrator);
    }
  }

  function _applyRoster(orchestrator, participants) {
    // Full roster snapshot from SSE — sync _roster and re-render
    participants.forEach(p => {
      _roster[p.displayID] = _roster[p.displayID] || {};
      Object.assign(_roster[p.displayID], p);
    });
    orchestrator.render();
  }

  function _handlePeerLeft(orchestrator, participantDisplayID) {
    var entry = _roster[participantDisplayID];
    if (entry) {
      _videoSlots.delete(participantDisplayID);
      // Close subscribed tracks for this peer
      if (entry.audioTrackId) delete _tracks[entry.audioTrackId];
      if (entry.videoTrackId) delete _tracks[entry.videoTrackId];
      delete _roster[participantDisplayID];
    }
    _updateParticipantPresence(orchestrator, participantDisplayID, PRESENCE_STATE.LEFT);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Join flow — Phase 2 skeleton
  // These methods will be fleshed out in Phase 2 when RTCPeerConnection
  // and Cloudflare SFU proxy endpoints are ready.
  // ─────────────────────────────────────────────────────────────────────────────


  function _stopAllMedia() {
    console.log('[diag] _stopAllMedia called, _localStream:', _localStream,
          _localStream?.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState })));
    _dotconfScreenTeardown(); // the peer connection is closing anyway; the server clears the share on markLeft
    if (_localStream) {
      _localStream.getTracks().forEach(t => t.stop());
      _localStream = null;
    }
    if (_peerConnection) {
      _peerConnection.close();
      _peerConnection = null;
    }
    if (_audioCtx) {
      _audioCtx.close();
      _audioCtx = null;
    }
    _tracks  = {};
    _roster  = {};
    _videoSlots = new Set();
  }
  
  function _dotconfShouldShowInviteButton(orchestrator) {
    if (!orchestrator.isDataOwner()) return false; // host only

    var conf = _getCurrentDotConf(orchestrator);
    var hasAddedParticipants = !!(conf?.participants || [])
      .some(p => !p.isHost && p.presenceState === PRESENCE_STATE.ADDED);

    var contacts = orchestrator.dotconfGetContacts
      ? orchestrator.dotconfGetContacts(orchestrator)
      : [];
    var hasContacts = Array.isArray(contacts) && contacts.length > 0;

    return hasAddedParticipants || hasContacts;
  }
  
  function _dotconfHandleInviteClick(orchestrator) {
    _renderDotConfInviteModal(orchestrator);
  }

  function _dotconfPendingParticipants(orchestrator) {
    var conf = _getCurrentDotConf(orchestrator);
    return (conf?.participants || []).filter(
      p => !p.isHost && p.presenceState === PRESENCE_STATE.ADDED
    );
  }

  async function _dotconfMarkInvited(orchestrator, ids) {
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf || !ids.length) return 0;
    var tenantId = _getTenantId(orchestrator);
    var resp = await _cfApi(
      'POST /' + conf.displayID + '/participant/invite?tenantId=' + tenantId,
      { participantDisplayIDs: ids }
    );
    ids.forEach(id => _updateParticipantPresence(orchestrator, id, PRESENCE_STATE.INVITED));
    return (resp && resp.invited) || 0;
  }
  
  function _dotconfSetJoining(orchestrator, on) {
    orchestrator._dotconfJoining = on;
    document.querySelectorAll('[data-dotconf-join]').forEach(b => {
      b.disabled = on;
      b.style.opacity = on ? '0.5' : '';
      b.style.cursor  = on ? 'default' : 'pointer';
    });
  }


  function _renderDotConfInviteModal(orchestrator) {
    var pending = _dotconfPendingParticipants(orchestrator);
    var notify = msg => typeof orchestrator.showNotification === 'function' && orchestrator.showNotification(msg);
    if (!pending.length) { notify('Everyone has already been invited.'); return; }

    var conf       = _getCurrentDotConf(orchestrator);
    var confUrl = _dotconfGuestUrl(orchestrator);
    var parentName = orchestrator.currentPath[0]?.shortName
      || orchestrator.currentPath[0]?.displayID || 'Conference host';
    var message    = "You're invited to " + (conf.name || 'a call') + ": " + confUrl;

    document.getElementById('dotconf-invite-modal')?.remove();

    var overlay = document.createElement('div');
    overlay.id = 'dotconf-invite-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;';

    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:12px;width:100%;max-width:440px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

    var title = document.createElement('div');
    title.textContent = 'Invite participants';
    title.style.cssText = 'padding:16px 20px;font-size:16px;font-weight:700;color:#2d3436;border-bottom:1px solid #eee;';

    var sub = document.createElement('div');
    sub.textContent = 'Add an email or phone if you have one, or just share the link yourself.';
    sub.style.cssText = 'padding:10px 20px 0;font-size:12px;color:#636e72;';

    var list = document.createElement('div');
    list.style.cssText = 'padding:4px 20px 10px;overflow-y:auto;';

    var inputCss = 'width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid #dfe6e9;border-radius:8px;font-size:13px;';
    var btnCss   = 'border:1px solid #b2bec3;background:#fff;color:#2d3436;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:600;cursor:pointer;';

    var rows = pending.map(function(p) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid #f1f2f6;';

      var nameEl = document.createElement('div');
      nameEl.textContent = p.name || 'Unnamed';          // textContent: names are user-supplied
      nameEl.style.cssText = 'font-size:14px;font-weight:600;color:#2d3436;';

      var email = document.createElement('input');
      email.type = 'email'; email.placeholder = 'Email (optional)';
      email.value = p.contactemail || ''; email.style.cssText = inputCss;

      var phoneWrap = document.createElement('div');
      phoneWrap.style.cssText = 'display:flex;gap:6px;';
      var phone = document.createElement('input');
      phone.type = 'tel'; phone.placeholder = 'Phone for WhatsApp (optional)';
      phone.value = p.contactphone || ''; phone.style.cssText = inputCss;
      var wa = document.createElement('button');
      wa.textContent = 'WhatsApp'; wa.style.cssText = btnCss + 'white-space:nowrap;';
      wa.onclick = async function() {
        var digits = phone.value.replace(/\D/g, '');
        if (!digits) { phone.focus(); return; }
        window.open('https://wa.me/' + digits + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
        try { await _dotconfMarkInvited(orchestrator, [p.displayID]); row.style.opacity = '0.5'; }
        catch (e) { console.error('[dotconf] mark invited failed:', e); _showError('Could not mark as invited.'); }
      };
      phoneWrap.append(phone, wa);

      row.append(nameEl, email, phoneWrap);
      list.appendChild(row);
      return { p: p, email: email };
    });

    var footer = document.createElement('div');
    footer.style.cssText = 'padding:12px 20px;border-top:1px solid #eee;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;';

    var close = () => overlay.remove();
    var allIds = pending.map(p => p.displayID);

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel'; cancelBtn.style.cssText = btnCss; cancelBtn.onclick = close;

    var copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy link'; copyBtn.style.cssText = btnCss;
    copyBtn.onclick = async function() {
      try {
        await navigator.clipboard.writeText(confUrl);
        await _dotconfMarkInvited(orchestrator, allIds);
        notify('Link copied — participants marked as invited.');
        close();
      } catch (e) { console.error('[dotconf] copy link failed:', e); _showError('Could not copy the link.'); }
    };

    var shareBtn = null;
    if (navigator.share) {
      shareBtn = document.createElement('button');
      shareBtn.textContent = 'Share…'; shareBtn.style.cssText = btnCss;
      shareBtn.onclick = async function() {
        try {
          await navigator.share({ title: conf.name || 'Invitation', text: message, url: confUrl });
          await _dotconfMarkInvited(orchestrator, allIds);
          close();
        } catch (e) { if (e.name !== 'AbortError') { console.error('[dotconf] share failed:', e); _showError('Could not share the link.'); } }
      };
    }

    var sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send invites';
    sendBtn.style.cssText = btnCss + 'background:#4c6ef5;border-color:#4c6ef5;color:#fff;';
    sendBtn.onclick = async function() {
      sendBtn.disabled = true; sendBtn.textContent = 'Sending…';
      try {
        await _dotconfMarkInvited(orchestrator, allIds);
        var sent = 0, failed = 0;
        for (var r of rows) {
          var addr = r.email.value.trim();
          if (!addr) continue;
          try {
            await orchestrator.sendSubtenantNotificationEmail(
              Object.assign({}, r.p, { contactemail: addr }), parentName, confUrl);
            sent++;
          } catch (e) { failed++; console.error('[dotconf] invite email failed for', r.p.name, e); }
        }
        notify('✅ ' + allIds.length + ' invited' + (sent ? ', ' + sent + ' emailed' : '') +
               (failed ? ' (' + failed + ' emails failed)' : ''));
        close();
      } catch (e) {
        console.error('[dotconf] invite failed:', e);
        _showError('Could not send invites — please try again.');
        sendBtn.disabled = false; sendBtn.textContent = 'Send invites';
      }
    };

    footer.append(cancelBtn, copyBtn);
    if (shareBtn) footer.appendChild(shareBtn);
    footer.appendChild(sendBtn);

    card.append(title, sub, list, footer);
    overlay.appendChild(card);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }
  
  async function _cfApi(methodAndPath, body) {
    var spaceIdx = methodAndPath.indexOf(' ');
    var method   = methodAndPath.slice(0, spaceIdx);
    var path     = methodAndPath.slice(spaceIdx + 1);
    var url      = '/newauth/api/conf' + path;
   
    var res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: (method === 'GET') ? undefined : JSON.stringify(body || {})
    });
   
    if (!res.ok) {
      var errText = '';
      try { errText = await res.text(); } catch (ignore) {}
      throw new Error('[dotconf] _cfApi ' + method + ' ' + path + ' failed: ' + res.status + ' ' + errText);
    }
    return res.json();
  }
   
  // Cloudflare returns not_found_track_error if we pull a track a moment before its
  // publisher's packets arrive (right after they go live). Retry briefly; a failed
  // pull returns no SDP, so it leaves our session's signaling state untouched.
  async function _pullWithRetry(confDisplayID, tenantId, body) {
    var delays = [0, 1000, 2000, 4000, 6000];
    for (var i = 0; i < delays.length; i++) {
      if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
      try {
        return await _cfApi('POST /' + confDisplayID + '/tracks/pull?tenantId=' + tenantId, body);
      } catch (e) {
        var retryable = /not_found_track_error|empty_track_error/.test(String(err && err.message));
        if (!retryable || i === delays.length - 1) throw e;
        console.log('[dotconf] track not ready yet, retrying pull in', delays[i + 1], 'ms');
      }
    }
  }
  
  async function getIceServers() {
    const resp = await fetch('/newauth/api/getIceServers', {
      method: 'POST',
      credentials: 'include', // sends the flake cookie automatically
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}) // or { flake: '...' } for the non-cookie fallback path
    });

    if (!resp.ok) {
      console.warn('[dotconf] getIceServers request failed, falling back to STUN-only');
      return [{ urls: ['stun:stun.cloudflare.com:3478'] }];
    }

    var data = await resp.json();

    if (!data.turnEnabled) {
      console.warn('[dotconf] TURN unavailable for this session — STUN-only, may fail on restrictive networks');
    }

    return data.iceServers; // pass straight through, whatever shape it's in
  }
  
  function _waitForIceGatheringComplete(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(resolve => {
      function check() {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      }
      pc.addEventListener('icegatheringstatechange', check);
      // Safety timeout — don't hang forever if gathering stalls
      setTimeout(resolve, 8000);
    });
  }
  
  var PREVIEW_REFRESH_MS = 25000; // refresh prepared connection if preview stays open this long
  var _previewRefreshTimer = null;
  
  async function _startDotConfPreview(orchestrator) {
        if (orchestrator._dotconfCallLive || document.getElementById('dotconf-preview-widget')) return;
        if (orchestrator._dotconfJoining || orchestrator._dotconfCallLive) return;
        _dotconfSetJoining(orchestrator, true);
        
        var conf = _getCurrentDotConf(orchestrator);
        if (!conf) return;

        var n = (conf.participants || []).filter(
          p => !p.isHost &&
               p.presenceState !== PRESENCE_STATE.INVITED &&
               p.presenceState !== PRESENCE_STATE.LEFT
        ).length;

        if (n >= HARD_CAP) {
          _showError("This conference is full (max " + HARD_CAP + " participants).");
          return;
        }

        var tenantId = _getTenantId(orchestrator);
        var myId     = _getMyDotConfParticipantDisplayID(orchestrator);
        if (!myId) {
          console.error("[dotconf] _startDotConfPreview — no identified participant, aborting");
          return;
        }
        _cachedMyId = myId;

        // Unlock the AudioContext HERE, synchronously, while we're still inside
        // the original click's user-activation window. Doing this after the
        // getUserMedia await (and its permission prompt) is too late — browsers
        // will silently leave the context suspended, and the preview audio
        // meter never animates even though the mic itself works fine.
        if (!_audioCtx || _audioCtx.state === 'closed') {
          _audioCtx = new AudioContext();
        }
        if (_audioCtx.state === 'suspended') {
          _audioCtx.resume().catch(function(e) {
            console.warn('[dotconf] AudioContext resume failed at preview start:', e);
          });
        }

        try {
          _localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

          var myName = (conf.participants.find(p => p.displayID === myId) || {}).name || 'You';

          _renderDotConfPreview(orchestrator, _localStream, myName, () => {
            _finishDotConfConnect(orchestrator, conf, tenantId, myId, n);
          });

          _prepareDotConfConnection(orchestrator, tenantId, conf.displayID);

            _previewRefreshTimer = setInterval(() => {
              console.log('[dotconf] preview dwell exceeded threshold — refreshing prepared connection');
              _teardownPreparedConnection();
              _prepareDotConfConnection(orchestrator, tenantId, conf.displayID);
            }, PREVIEW_REFRESH_MS);

        } catch (e) {
          console.error('[dotconf] _startDotConfPreview failed:', e);
          _showError('Could not access camera/microphone. Please check permissions and try again.');
          _stopAllMedia();
        }
    }
  
  function _teardownPreparedConnection() {
    if (_peerConnection) {
      try { _peerConnection.close(); } catch (e) {}
      _peerConnection = null;
    }
    _preparedOfferSdp = null;
    _prepareInProgress = null;
  }

  function _stopPreviewRefreshTimer() {
    if (_previewRefreshTimer) {
      clearInterval(_previewRefreshTimer);
      _previewRefreshTimer = null;
    }
  }
  
  // Invite links must never carry the real tenant UUID — it's the server's proof of
  // host identity. Build the URL from display IDs only, whatever the host's own path uses.
  function _dotconfGuestUrl(orchestrator) {
    var guestPath = (orchestrator.currentPath || []).map(seg => Object.assign({}, seg, { asuuid: false }));
    return orchestrator.getAppUrl(guestPath);
  }

  var _preparedOfferSdp = null;
  var _prepareInProgress = null; // the in-flight promise, so the click handler can await it if not yet done

  function _prepareDotConfConnection(orchestrator, tenantId, confDisplayID) {
    _prepareInProgress = (async () => {
      var iceServers = await getIceServers();
      _peerConnection = new RTCPeerConnection({ iceServers: iceServers });
      _peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      _attachPeerConnectionHandlers(orchestrator, tenantId, confDisplayID);

      _localStream.getTracks().forEach(track => _peerConnection.addTrack(track, _localStream));

      var offer = await _peerConnection.createOffer();
      await _peerConnection.setLocalDescription(offer);
      await _waitForIceGatheringComplete(_peerConnection);
      _preparedOfferSdp = _peerConnection.localDescription.sdp;
    })();
    return _prepareInProgress;
  }

  async function _finishDotConfConnect(orchestrator, conf, tenantId, myId, participantCountAtPreviewTime) {
        _initialNegotiationDone = false;

        if (participantCountAtPreviewTime >= WARN_AT && !_largeMeetingWarned) {
          _largeMeetingWarned = true;
          _showNotice("Large call — video will be limited to active speakers.");
        }

        var myAudioTrack = _localStream.getAudioTracks()[0];
        if (myAudioTrack) {
          _attachAudioAnalyser(myAudioTrack.id, myAudioTrack);
        }

        try {
          // Prep may still be running if the user clicked unusually fast —
          // wait for it rather than assume it's done.
          if (_prepareInProgress) await _prepareInProgress;
          if (!_preparedOfferSdp || !_peerConnection) {
            throw new Error('connection was not prepared successfully');
          }

          // Ensure SSE is live for this join — it may have been closed by a
          // prior leave and never reopened (only the platform's initial
          // page-load hook calls dotconfOpenSSE otherwise). Without an active
          // SSE connection, local presenceState never updates on
          // participant.live, and the center tile never appears even though
          // the peer connection itself succeeds. _openSSE safely replaces any
          // existing connection, so calling this unconditionally is fine.
          orchestrator.dotconfOpenSSE(orchestrator, tenantId, conf.displayID, myId);

          // 1. Create session on server
          var sessionResp = await _cfApi(
            'POST /' + conf.displayID + '/session/new?tenantId=' + tenantId,
            { participantDisplayID: myId }
          );
          _mySessionId = sessionResp.sessionId;

          // 2. Publish tracks — using the offer prepared during preview
          var publishResp = await _cfApi(
            'POST /' + conf.displayID + '/tracks/publish?tenantId=' + tenantId,
            { sessionId: _mySessionId, offerSdp: _preparedOfferSdp }
          );

          // 3. Set remote description
          await _peerConnection.setRemoteDescription({ type: 'answer', sdp: publishResp.answerSdp });
          _initialNegotiationDone = true;

          _myLocalTracks = [
            { trackName: publishResp.audioTrackId, mid: '0', kind: 'audio' },
            { trackName: publishResp.videoTrackId, mid: '1', kind: 'video' }
          ];

          _roster[myId] = Object.assign({}, _roster[myId], {
            audioTrackId: publishResp.audioTrackId,
            videoTrackId: publishResp.videoTrackId,
            cfSessionId:  _mySessionId
          });

          await _subscribeAudioForRoster(orchestrator, tenantId, conf.displayID, _mySessionId);

          _startCheapAudioLevelPolling();
          _startAudioLevelUpdates();

          orchestrator.dotconfStartLayout(orchestrator);

          orchestrator._dotconfCallLive = true;
          _dotconfSetJoining(orchestrator, false);
          _dotconfClearAllPreviews();               // you're in — real video takes over
          Object.keys(_previewSnaps).forEach(pid => _dotconfDropSnapshot(pid));
          _previewFetchedAt = {};
          _dotconfStartSnapshotUploads(orchestrator);
          _dotconfSyncAddButton(orchestrator);
          _dotconfResumeShare(orchestrator); // someone was already sharing when we joined
          if (typeof orchestrator.refreshContextBar === 'function') orchestrator.refreshContextBar();

      } catch (e) {
        console.error('[dotconf] _finishDotConfConnect failed:', e);
        _showError('Could not join the call. Please check your connection and try again.');

        // Put the user back where they started: no dead preview, button usable again.
        _stopPreviewAudioMeter();
        _stopPreviewRefreshTimer();
        document.getElementById('dotconf-preview-widget')?.remove();
        _teardownPreparedConnection();
        _stopAllMedia();

        _mySessionId      = null;
        _myLocalTracks    = null;
        _preparedOfferSdp = null;
        orchestrator._dotconfCallLive = false;
        _dotconfSetJoining(orchestrator, false);
        if (typeof orchestrator.refreshContextBar === 'function') orchestrator.refreshContextBar();
      }
    }


   
   
  // ── A3. _leaveDotConf — REPLACE your existing stub. ──
   
  async function _leaveDotConf(orchestrator) {
      var conf     = _getCurrentDotConf(orchestrator);
      var tenantId = conf ? _getTenantId(orchestrator) : null;

      try {
        if (_mySessionId && conf) {
          await _cfApi(
            'PUT /' + conf.displayID + '/tracks/close?tenantId=' + tenantId,
            { sessionId: _mySessionId, tracks: _myLocalTracks || [], speakingSec: Math.round(_mySpeakingSec) }
          );
        }
      } catch (e) {
        console.error('[dotconf] _leaveDotConf close call failed:', e);
      }

      // Release camera/mic first and unconditionally — the most user-visible,
      // privacy-sensitive step must not be skippable by a failure anywhere
      // else in this teardown sequence.
      try {
        _stopAllMedia();
      } catch (e) {
        console.error('[dotconf] _stopAllMedia failed during leave:', e);
      }

      try {
        var hostDisplayID = _getHostDisplayID(orchestrator);
        var hostDot = hostDisplayID ? _getDotElement(hostDisplayID) : null;
        if (hostDot) { hostDot.remove(); _dotElCache.delete(hostDisplayID); }
        _removeCallControls();
        orchestrator.dotconfStopLayout(orchestrator);
        _stopCheapAudioLevelPolling();
        _stopAudioLevelUpdates();
        _closeSSE();
        // Drop every video tile (they'd otherwise freeze on their last frame) and
        // rebuild the canvas as plain presence dots.
        document.querySelectorAll('#canvas-area .dot').forEach(d => {
          if (d.dataset.morphed === 'true' || d.dataset.tier === 'feedDot') _removeTileVideo(d);
        });
        _dotconfStopSnapshotUploads();            // the server clears your snapshot in markLeft
        _midToTrackName = {};
      } catch (e) {
        console.error('[dotconf] _leaveDotConf teardown failed partway:', e);
      }

      orchestrator._dotconfCallLive   = false;
      _dotconfSetJoining(orchestrator, false);
      _dotconfSyncAddButton(orchestrator);
      if (typeof orchestrator.refreshContextBar === 'function') orchestrator.refreshContextBar();
      if (typeof orchestrator.render === 'function') orchestrator.render();
      _mySessionId                    = null;
      _myLocalTracks                  = null;
      _mySpeakingSec                  = 0;
      _videoSubscribedTier            = new Set();
      _initialNegotiationDone         = false;
  }
   
   
  // ── A4. _attachPeerConnectionHandlers — new. ──
  // ontrack no longer unconditionally attaches the fine-grained AnalyserNode
  // to every audio track — that only happens once a participant enters a
  // video tier (see _subscribeVideoForParticipant). Everyone else's level
  // comes from the cheap getStats() poll.
   
  function _attachPeerConnectionHandlers(orchestrator, tenantId, confDisplayID) {
   
    _peerConnection.ontrack = (event) => {
      if (_screenPullExpect) { _screenPullExpect.captured.push(event); return; } // screen share — handled by _pullScreen
      var track = event.track;
      var mid   = event.transceiver ? event.transceiver.mid : null;

      // Cloudflare replaces track/stream IDs with its own, so track.id never equals our
      // trackName. Match by mid instead, using the trackName → mid list from the pull.
      var trackName = mid != null ? _midToTrackName[String(mid)] : null;

      var ownerId = null;
      if (trackName) {
        for (var pid in _roster) {
          var r = _roster[pid];
          if (r && (r.audioTrackId === trackName || r.videoTrackId === trackName)) { ownerId = pid; break; }
        }
      }
      if (!ownerId) console.warn('[dotconf] ontrack: no owner for mid', mid, 'trackName', trackName);

      var entry = Object.assign({}, (trackName && _tracks[trackName]) || _tracks[track.id], {
        kind: track.kind,
        participantDisplayID: ownerId,
        mediaStreamTrack: track,
        mid: mid,
        trackName: trackName
      });
      // Same entry under both keys: tile code looks up by Cloudflare trackName,
      // stats/analyser code by the browser's track id.
      _tracks[track.id] = entry;
      if (trackName) _tracks[trackName] = entry;

      // Record which mid a participant's video landed on — needed to close
      // exactly that track when the tier system demotes them.
      if (track.kind === 'video' && ownerId && _roster[ownerId]) {
        _roster[ownerId]._videoMid = mid;
      }
      
      // The tile may have been created before this track arrived, and the morph
      // functions only attach video when they run — attach now so it doesn't stay blank.
      if (track.kind === 'video' && ownerId && trackName) {
        var tileEl = _getDotElement(ownerId);
        if (tileEl && (tileEl.dataset.morphed === 'true' || tileEl.dataset.tier === 'feedDot')) {
          _attachVideoToTile(tileEl, ownerId, trackName, orchestrator);
        }
      }

      if (ownerId && typeof _attachTrackEvents === 'function') {
        _attachTrackEvents(ownerId, track);
      }
    };
    
    _peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[dotconf] candidate:', event.candidate.type, event.candidate.address || event.candidate.candidate);
      } else {
        console.log('[dotconf] candidate gathering finished (null candidate)');
      }
    };
    
    _peerConnection.onicecandidateerror = (event) => {
      console.error('[dotconf] ICE candidate error:', event.errorCode, event.errorText, event.url);
    };
   
    _peerConnection.onconnectionstatechange = () => {
      var state = _peerConnection.connectionState;
      console.log('[dotconf] connectionState:', state);
   
      if (state === 'connected') {
        console.log('[diag] live call with sessionId:', _mySessionId);
        var hasVideo = _localStream ? _localStream.getVideoTracks().length > 0 : false;
        var hasAudio = _localStream ? _localStream.getAudioTracks().length > 0 : false;
        _cfApi(
          'POST /' + confDisplayID + '/participant/live?tenantId=' + tenantId,
          { sessionId: _mySessionId, hasVideo: hasVideo, hasAudio: hasAudio }
        ).catch(e => console.error('[dotconf] participant/live failed:', e));

        _renderCallControls(orchestrator);
        
        document.getElementById('dotconf-preview-widget')?.remove();
        
        // Host's own tile is now eligible to render as the center rect (see
        // _tickLayout's isHost&&isLive branch) — the corner self-view widget
        // is redundant from this point on. Non-host participants keep theirs,
        // since they have no other on-canvas view of themselves.
        var myId = _getMyDotConfParticipantDisplayID(orchestrator);
        if (myId && myId === _getHostDisplayID(orchestrator) &&
            typeof orchestrator.dotconfRemoveSelfView === 'function') {
          orchestrator.dotconfRemoveSelfView();
        }
      }
   
      if (state === 'disconnected') {
        setTimeout(() => {
          if (_peerConnection && _peerConnection.connectionState === 'disconnected') {
            console.warn('[dotconf] still disconnected after 5s — attempting ICE restart');
            _peerConnection.restartIce();
          }
        }, 5000);
      }
   
      if (state === 'failed') {
        console.error('[dotconf] connection failed — leaving call');
        _leaveDotConf(orchestrator);
      }
    };
   
    // Safety net only — pulling remote tracks does NOT go through this
    // (see A5/A6: explicit pull → answer → renegotiate). Only fires if
    // something adds a local track/transceiver after the initial publish,
    // which Phase 2 doesn't do.


    _peerConnection.onnegotiationneeded = async () => {
      if (!_initialNegotiationDone) {
        console.log('[dotconf] onnegotiationneeded — skipping, initial publish in progress');
        return;
      }
      try {
        var offer = await _peerConnection.createOffer();
        await _peerConnection.setLocalDescription(offer);
        await _cfApi(
          'PUT /' + confDisplayID + '/tracks/renegotiate?tenantId=' + tenantId,
          { sessionId: _mySessionId, answerSdp: offer.sdp }
        );
      } catch (e) {
        console.error('[dotconf] onnegotiationneeded failed:', e);
      }
    };
  }
   
   
  // ── A5. Audio subscription — new. Broad, for everyone. ──
  // Feeds tier-eligibility detection for the whole roster.
   
  async function _subscribeAudioForRoster(orchestrator, tenantId, confDisplayID, sessionId) {
    var myId = _getMyDotConfParticipantDisplayID(orchestrator);
    var conf = _getCurrentDotConf(orchestrator);
    var activeIds = new Set((conf?.participants || [])
      .filter(p => ['joining', 'live', 'audio_only', 'listening'].includes(p.presenceState))
      .map(p => p.displayID));

    var ids = Object.keys(_roster).filter(pid => {
      var r = _roster[pid];
      return pid !== myId && activeIds.has(pid) && r && r.audioTrackId && r.cfSessionId;
    });

    // One pull per participant, each going through the shared _negotiationQueue
    // inside _subscribeAudioForParticipant, so this can never interleave with a
    // video, audio or screen negotiation on the same session.
    for (var pid of ids) {
      await _subscribeAudioForParticipant(orchestrator, tenantId, confDisplayID, sessionId, pid);
    }
  }
   
  async function _subscribeAudioForParticipant(orchestrator, tenantId, confDisplayID, sessionId, participantDisplayID) {
      var r = _roster[participantDisplayID];
      if (!r || !r.audioTrackId || !r.cfSessionId) {
        console.warn('[dotconf] cannot subscribe audio for', participantDisplayID, '— missing cfSessionId in roster');
        return;
      }
      if (r._audioSubscribed || r._audioSubscribing) return;
      r._audioSubscribing = true;

      _negotiationQueue = _negotiationQueue.then(async function() {
        try {
          var track = { trackName: r.audioTrackId, sessionId: r.cfSessionId };

          var pullResp = await _pullWithRetry(confDisplayID, tenantId,
            { sessionId: sessionId, tracks: [track] }
          );
          _recordPulledMids(pullResp);
          await _peerConnection.setRemoteDescription({ type: 'offer', sdp: pullResp.offerSdp });
          var answer = await _peerConnection.createAnswer();
          await _peerConnection.setLocalDescription(answer);
          await _cfApi(
            'PUT /' + confDisplayID + '/tracks/renegotiate?tenantId=' + tenantId,
            { sessionId: sessionId, answerSdp: answer.sdp }
          );

          _roster[participantDisplayID]._audioSubscribed = true;
        } catch (e) {
          console.error('[dotconf] _subscribeAudioForParticipant failed for', participantDisplayID, e);
        } finally {
          if (_roster[participantDisplayID]) _roster[participantDisplayID]._audioSubscribing = false;
        }
      }, function(e) {
        console.error('[dotconf] _subscribeAudioForParticipant queue error for', participantDisplayID, e);
        if (_roster[participantDisplayID]) _roster[participantDisplayID]._audioSubscribing = false;
      });

      return _negotiationQueue;
    }
   
   
  // ── A6. Video subscription — new. Tier-gated, called only from _tickLayout. ──
  // Pairs with attaching/detaching the fine-grained AnalyserNode: only
  // visible (rect/feed-dot) participants get the finer real-time level data
  // used for the visual size-pulse.
   
  var _negotiationQueue = Promise.resolve(); // module-level, shared across all participants

  async function _subscribeVideoForParticipant(orchestrator, tenantId, confDisplayID, participantDisplayID, tier) {
      var r = _roster[participantDisplayID];
      if (!r || !r.videoTrackId || !r.cfSessionId) return;
      if (r._videoSubscribed || r._videoSubscribing) return;
      r._videoSubscribing = true;

      // Cloudflare's Realtime API requires one offer/answer cycle on a session
      // to fully resolve before the next starts. Multiple fake participants
      // going live close together previously fired overlapping pull+renegotiate
      // calls against the same shared _peerConnection/_mySessionId, corrupting
      // its signaling state ("API requests were possibly made out-of-order" —
      // Cloudflare's own error). Chain all negotiations through one queue so
      // they run strictly one at a time, regardless of which participant.
      var runNegotiation = async function() {
        var preferredRid = (tier === 'rect') ? null : 'q';
        var track = { trackName: r.videoTrackId, sessionId: r.cfSessionId };
        if (preferredRid) track.simulcast = { preferredRid: preferredRid };

        var pullResp = await _pullWithRetry(confDisplayID, tenantId, { sessionId: _mySessionId, tracks: [track] });
        _recordPulledMids(pullResp);
        await _peerConnection.setRemoteDescription({ type: 'offer', sdp: pullResp.offerSdp });
        var answer = await _peerConnection.createAnswer();
        await _peerConnection.setLocalDescription(answer);
        await _cfApi(
          'PUT /' + confDisplayID + '/tracks/renegotiate?tenantId=' + tenantId,
          { sessionId: _mySessionId, answerSdp: answer.sdp }
        );

        _roster[participantDisplayID]._videoSubscribed = true;

        var audioEntry = _tracks[r.audioTrackId];
        if (audioEntry && audioEntry.mediaStreamTrack && !audioEntry.analyser) {
          _attachAudioAnalyser(r.audioTrackId, audioEntry.mediaStreamTrack);
        }
      };

      // Chain with BOTH handlers so one failed negotiation doesn't permanently
      // wedge the queue for every participant after it.
      _negotiationQueue = _negotiationQueue.then(runNegotiation, runNegotiation);

      try {
        await _negotiationQueue;
      } catch (e) {
        console.error('[dotconf] _subscribeVideoForParticipant failed for', participantDisplayID, e);
      } finally {
        if (_roster[participantDisplayID]) _roster[participantDisplayID]._videoSubscribing = false;
      }
  }
   
  async function _unsubscribeVideoForParticipant(orchestrator, tenantId, confDisplayID, participantDisplayID) {
      var r = _roster[participantDisplayID];
      if (!r || !r._videoSubscribed) return;

      var mid = r._videoMid;
      if (!mid) {
        console.warn('[dotconf] cannot unsubscribe video for', participantDisplayID, '— mid unknown yet');
        return;
      }

      // Same shared queue as _subscribeVideoForParticipant — see the comment
      // there. Closing tracks still mutates this session on Cloudflare's
      // side, so it needs to serialize against any in-flight pull/renegotiate
      // too, not just against other unsubscribes.
      var runClose = async function() {
        await _cfApi(
          'PUT /' + confDisplayID + '/tracks/close?tenantId=' + tenantId,
          { sessionId: _mySessionId, tracks: [{ trackName: r.videoTrackId, mid: mid }] }
        );
        _roster[participantDisplayID]._videoSubscribed = false;
        _roster[participantDisplayID]._videoMid = null;

        if (r.audioTrackId && _tracks[r.audioTrackId]) {
          delete _tracks[r.audioTrackId].analyser;
        }
      };

      _negotiationQueue = _negotiationQueue.then(runClose, runClose);

      try {
        await _negotiationQueue;
      } catch (e) {
        console.error('[dotconf] _unsubscribeVideoForParticipant failed for', participantDisplayID, e);
      }
  }
   
   
  // ── A7. Cheap audio level polling — new. Runs for ALL audio tracks that ──
  // don't already have a fine-grained analyser attached.
   
  function _startCheapAudioLevelPolling() {
    if (_cheapLevelInterval) return;
   
    _cheapLevelInterval = setInterval(async () => {
      if (!_peerConnection) return;
      try {
        var stats = await _peerConnection.getStats();
        stats.forEach(report => {
          if (report.type !== 'inbound-rtp' || report.kind !== 'audio') return;
          if (typeof report.audioLevel !== 'number') return; // not all browsers expose this
   
          var trackId = report.trackIdentifier || report.trackId;
          if (!trackId || !_tracks[trackId]) return;
   
          if (!_tracks[trackId].analyser) { // skip if the fine-grained path already owns this track
            var prev = _tracks[trackId].audioLevel || 0;
            _tracks[trackId].audioLevel = prev * 0.7 + report.audioLevel * 0.3;
          }
        });
   
        // Accumulate our own speaking time locally (written once on leave)
        var myAudioTrack = _localStream ? _localStream.getAudioTracks()[0] : null;
        if (myAudioTrack && _tracks[myAudioTrack.id] && _tracks[myAudioTrack.id].audioLevel > NOISE_FLOOR) {
          _mySpeakingSec += 0.5; // this loop runs every 500ms
        }
      } catch (e) {
        console.error('[dotconf] cheap audio level poll failed:', e);
      }
    }, 500);
  }
   
  function _stopCheapAudioLevelPolling() {
    if (_cheapLevelInterval) {
      clearInterval(_cheapLevelInterval);
      _cheapLevelInterval = null;
    }
  }
   
   
  // ── A8. Elastic tier sizing — new. ──
   
  function _maxRectsFor(n) {
    if (n <= 6)   return 4;   // current default — includes host
    if (n <= 20)  return 3;
    if (n <= 50)  return 2;
    return 1;                 // host only, above 50
  }
   
  function _maxFeedDotsFor(n) {
    if (n <= 6)   return 2;   // current default
    if (n <= 20)  return 2;
    if (n <= 50)  return 1;
    return 0;                 // above 50, only rects (+ pinned) get video
  }
   
   
  // ── A9. dotconfStartLayout / dotconfStopLayout — new (confirmed absent). ──
   
  function dotconfStartLayout(orchestrator) {
    if (_layoutInterval) return;
    _layoutInterval = setInterval(() => _tickLayout(orchestrator), 200);
  }
   
  function dotconfStopLayout() {
    if (_layoutInterval) {
      clearInterval(_layoutInterval);
      _layoutInterval = null;
    }
  }
   
   
  // ── A10. Pin/promote — new. Host action, auto-expiring, no manual unpin. ──
   
  async function _dotconfPinParticipant(orchestrator, participantDisplayID) {
    if (!orchestrator.isDataOwner()) return; // host only, enforced server-side too
   
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf) return;
   
    var tenantId = _getTenantId(orchestrator);
   
    try {
      await _cfApi(
        'POST /' + conf.displayID + '/participant/pin?tenantId=' + tenantId,
        { participantDisplayID: participantDisplayID }
      );
      // _pinnedUntil updates via the SSE echo (see PART B) — not optimistically here.
    } catch (e) {
      console.error('[dotconf] _dotconfPinParticipant failed:', e);
    }
  }
   
   
  // ── A11. Pin countdown ring — new. Self-expires locally as a safety net. ──
   
  function _tickPinRings(orchestrator) {
    var now = Date.now();
   
    for (var [participantDisplayID, expiresAt] of _pinnedUntil) {
      if (now >= expiresAt) {
        _pinnedUntil.delete(participantDisplayID);
        _removePinRing(participantDisplayID);
        continue;
      }
      var remainingFrac = (expiresAt - now) / PIN_DURATION_MS; // 1.0 -> 0.0
      _renderPinRing(participantDisplayID, remainingFrac);
    }
  }
   
  function _renderPinRing(participantDisplayID, remainingFrac) {
    var dotEl = _getDotElement(participantDisplayID);
    if (!dotEl) return;
   
    var degrees = Math.round(remainingFrac * 360);
    dotEl.style.setProperty('--pin-ring-deg', degrees + 'deg');
    dotEl.classList.add('dotconf-pinned');
  }
   
  function _removePinRing(participantDisplayID) {
    var dotEl = _getDotElement(participantDisplayID);
    if (!dotEl) return;
    dotEl.classList.remove('dotconf-pinned');
    dotEl.style.removeProperty('--pin-ring-deg');
  }
   
  // NOTE: the pin CLICK trigger is intentionally not here. An earlier
  // version wired it as a raw click listener on the dot itself, which would
  // have broken the existing "click opens detail card" behavior. That's
  // retracted — pending the detail card's DOM structure so the trigger can
  // be a button inside that card instead. Everything else about pin (server
  // call, tier reservation, ring rendering) works regardless of how it gets
  // triggered — this is the one loose end in the whole build.
   
   
  // ── A12. _getSlotAllocation — REPLACE your existing function. ──
  // Wired to the elastic _maxRectsFor/_maxFeedDotsFor instead of fixed
  // MAX_RECTS/MAX_FEED_DOTS constants.
   
  function _getSlotAllocation(liveCount) {
    // liveCount excludes host — host always gets a rect.
    // _maxRectsFor/_maxFeedDotsFor already account for the host in their
    // return value (same convention the old fixed MAX_RECTS constant used),
    // so pass liveCount + 1.
    var totalCount   = liveCount + 1;
    var maxRects     = _maxRectsFor(totalCount);
    var maxFeedDots  = _maxFeedDotsFor(totalCount);
   
    var rectSlots    = Math.max(0, Math.min(liveCount, maxRects - 1));
    var feedDotSlots = liveCount <= (maxRects - 1)
      ? 0
      : Math.min(liveCount - rectSlots, maxFeedDots);
    return { rectSlots, feedDotSlots };
  }
   
   
  // ── A13. _tickLayout — REPLACE your existing function. ──
  // Two blocks inserted into your real tier-assignment logic: pin override
  // (Block A) and selective video subscription (Block B). Also fixes the
  // "alwaysShowAll" line to use the elastic function instead of the fixed
  // MAX_RECTS constant, so it can't drift out of sync with A12 above.
   
  function _tickLayout(orchestrator) {
    if (document.hidden) return; // tab hidden — skip entirely
   
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf?.participants) return;
   
    var canvas = document.getElementById('canvas-area');
    if (!canvas) return;
   
    var W            = canvas.offsetWidth  || 800;
    var H            = canvas.offsetHeight || 600;
    var shorter      = Math.min(W, H);
    var minDotSize   = shorter * 0.06;
    var maxRectW     = shorter * 0.38;
    var hostMinRectW = shorter * HOST_MIN_RECT_W;
    var feedDotSize  = shorter * FEED_DOT_SIZE;
   
    var hostDisplayID = _getHostDisplayID(orchestrator);
    var now           = Date.now();
   
    // ── Step 1: split participants into host + live non-host ──────────────────
    var live = conf.participants.filter(p =>
      p.presenceState === 'live' || p.presenceState === 'audio_only'
    );
   
    var levels = {};
    live.forEach(p => { levels[p.displayID] = _getAudioLevel(p.displayID); });
   
    // ── Update confirmation state ─────────────────────────────────────────────
    live.forEach(p => {
      var id    = p.displayID;
      var level = levels[id];
   
      if (level > NOISE_FLOOR) {
        _slotLastActive[id] = now;
        if (!_speakingStarted[id]) {
          _speakingStarted[id] = now;
        }
        if (!_speakingConfirmed[id] &&
            (now - _speakingStarted[id]) >= CONFIRM_MS) {
          _speakingConfirmed[id] = now;
        }
      } else {
        _speakingStarted[id]   = null;
        _speakingConfirmed[id] = null;
      }
    });
   
    var nonHost = live.filter(p => p.displayID !== hostDisplayID);
    var { rectSlots, feedDotSlots } = _getSlotAllocation(nonHost.length);
   
    // ── Step 2: rank non-host, assign tiers ──────────────────────────────────
    var ranked = [...nonHost].sort((a, b) => {
      var aScore = _rankScore(a.displayID, levels[a.displayID], now);
      var bScore = _rankScore(b.displayID, levels[b.displayID], now);
      return bScore - aScore;
    });
   
    // FIXED: was `nonHost.length <= (MAX_RECTS - 1)` — now uses the same
    // elastic function as rectSlots/feedDotSlots so they can't disagree.
    var alwaysShowAll = nonHost.length <= (_maxRectsFor(nonHost.length + 1) - 1);
   
    var rectSet = new Set(
      alwaysShowAll
        ? nonHost.map(p => p.displayID)
        : ranked
            .slice(0, rectSlots)
            .filter(p => {
              var id = p.displayID;
              var isConfirmed = !!_speakingConfirmed[id];
              var isSticky    = (now - (_slotLastActive[id] || 0)) < STICKY_MS &&
                                  _getDotElement(id)?.dataset.tier === 'rect';
              return isConfirmed || isSticky;
            })
            .map(p => p.displayID)
    );
   
    var feedDotSet = new Set(
      ranked
        .slice(rectSlots, rectSlots + feedDotSlots)
        .filter(p => {
          var id = p.displayID;
          var isConfirmed = !!_speakingConfirmed[id];
          var isSticky    = (now - (_slotLastActive[id] || 0)) < STICKY_MS &&
                              _getDotElement(id)?.dataset.tier === 'feedDot';
          return isConfirmed || isSticky;
        })
        .map(p => p.displayID)
    );
   
    // ═══════════════════════════════════════════════════════════════════════
    // BLOCK A — pin override. Guaranteed feed-dot slot for pinned
    // participants regardless of audio confirmation. Never downgrades
    // someone already in rectSet. Evicts the lowest-ranked NON-pinned
    // feed-dot occupant if capacity is exceeded — never a pinned one.
    // ═══════════════════════════════════════════════════════════════════════
   
    var pinnedNonHostIds = nonHost
      .map(p => p.displayID)
      .filter(id => _pinnedUntil.has(id) && _pinnedUntil.get(id) > now);
   
    pinnedNonHostIds.forEach(id => {
      if (!rectSet.has(id)) {
        feedDotSet.add(id);
      }
    });
   
    if (feedDotSet.size > feedDotSlots) {
      var evictable = [...feedDotSet]
        .filter(id => !pinnedNonHostIds.includes(id))
        .sort((a, b) => _rankScore(a, levels[a] || 0, now) - _rankScore(b, levels[b] || 0, now));
   
      var overflow = feedDotSet.size - feedDotSlots;
      for (var i = 0; i < overflow && i < evictable.length; i++) {
        feedDotSet.delete(evictable[i]);
      }
    }
   
    // ── Confirming set: above NOISE_FLOOR but not yet confirmed ──────────────
    var confirmingSet = new Set(
      live
        .filter(p => {
          var id = p.displayID;
          return levels[id] > NOISE_FLOOR &&
                 _speakingStarted[id] &&
                 !_speakingConfirmed[id] &&
                 !rectSet.has(id) &&
                 !feedDotSet.has(id);
        })
        .map(p => p.displayID)
    );
   
    // ═══════════════════════════════════════════════════════════════════════
    // BLOCK B — selective video subscription. Only rect/feed-dot tier
    // (+ live host, from everyone else's perspective) gets a pulled video
    // track. Diffed against last tick's set — only pulls/closes on actual
    // tier changes.
    // ═══════════════════════════════════════════════════════════════════════
   
    var myId = _cachedMyId;
    var desiredVideoIds = new Set();
   
    var hostIsLiveAndNotMe = hostDisplayID && hostDisplayID !== myId &&
      conf.participants.some(p => p.displayID === hostDisplayID &&
        (p.presenceState === 'live' || p.presenceState === 'audio_only'));
    if (hostIsLiveAndNotMe) desiredVideoIds.add(hostDisplayID);
   
    rectSet.forEach(id    => { if (id !== myId) desiredVideoIds.add(id); });
    feedDotSet.forEach(id => { if (id !== myId) desiredVideoIds.add(id); });
   
    var tenantId      = _getTenantId(orchestrator);
    var confDisplayID = conf.displayID;
   
    desiredVideoIds.forEach(id => {
      if (!_videoSubscribedTier.has(id)) {
        var tier = (id === hostDisplayID || rectSet.has(id)) ? 'rect' : 'feedDot';
        _subscribeVideoForParticipant(orchestrator, tenantId, confDisplayID, id, tier)
          .catch(e => console.error('[dotconf] tier-driven subscribe failed for', id, e));
      }
    });
    _videoSubscribedTier.forEach(id => {
      if (!desiredVideoIds.has(id)) {
        _unsubscribeVideoForParticipant(orchestrator, tenantId, confDisplayID, id)
          .catch(e => console.error('[dotconf] tier-driven unsubscribe failed for', id, e));
      }
    });
    _videoSubscribedTier = desiredVideoIds; // set synchronously — don't wait for async completion
   
    // ── Step 3: apply sizes ───────────────────────────────────────────────────
    _maxSizeDelta = 0;
   
    conf.participants.forEach(p => {
      var isHost = p.displayID === hostDisplayID;
      var isLive = p.presenceState === 'live' || p.presenceState === 'audio_only';

      var dot;
      if (isHost) {
        dot = _getDotElement(p.displayID);
        if (!dot && isLive) {
          // Host has no base-renderer dot at all (filtered out of items) —
          // create its one tile ourselves, only once, right when first live.
          dot = _createHostCenterTile(p.displayID, p.dotLabel, p.metadata?.displayConfig?.color);
        }
        if (!dot) return; // not live yet, nothing to create or show
      } else {
        dot = _getDotElement(p.displayID);
        if (!dot) return;
      }

      var level  = levels[p.displayID] || 0;

      if (isHost && isLive) {
        dot.style.display = '';

        // Hold-then-decay envelope — grow instantly on rising level, but hold
        // the peak for HOLD_MS after speech stops before slowly shrinking back
        // down. Prevents the rect visibly shrinking during normal speech pauses.
        var HOLD_MS     = 1500; // how long to hold the peak size after last loud moment
        var DECAY_ALPHA = 0.25; // smaller = slower shrink once decay starts

        if (level > _hostDisplayLevel) {
          _hostDisplayLevel = level;       // rise immediately — stay responsive to onset
          _hostLastPeakTime = now;
        } else if (now - _hostLastPeakTime > HOLD_MS) {
          _hostDisplayLevel = _hostDisplayLevel * (1 - DECAY_ALPHA) + level * DECAY_ALPHA;
        }
        // else: within hold window — leave _hostDisplayLevel untouched, don't shrink yet

        var ALONE_MAX_W       = shorter * 0.80;
        var ALONE_TAPER_COUNT = 4;
        var aloneFactor       = Math.max(0, 1 - (nonHost.length / ALONE_TAPER_COUNT));
        var effectiveMaxRectW = maxRectW + (ALONE_MAX_W - maxRectW) * aloneFactor;

        var rW = hostMinRectW + (effectiveMaxRectW - hostMinRectW) * Math.pow(_hostDisplayLevel, 0.5);
        
        var rH = rW / TILE_ASPECT;

        var curW = parseFloat(dot.style.width)  || rW;
        var curH = parseFloat(dot.style.height) || rH;
        dot.style.left = `${W / 2 - curW / 2}px`;
        dot.style.top  = `${H / 2 - curH / 2}px`;

        var prevW = parseFloat(dot.dataset.prevW) || 0;
        var delta = Math.abs(rW - prevW);
        if (delta < 1) return;
        _maxSizeDelta = Math.max(_maxSizeDelta, delta);
        _morphToRect(dot, p.displayID, rW, rH, orchestrator);
      } else if (rectSet.has(p.displayID)) {
        var minRW = hostMinRectW * 0.9;
        var rW    = minRW + (maxRectW - minRW) * Math.pow(level, 0.5);
        var rH    = rW / TILE_ASPECT;
        var prevW = parseFloat(dot.dataset.prevW) || 0;
        var delta = Math.abs(rW - prevW);
        if (delta < 1) return;
        _maxSizeDelta = Math.max(_maxSizeDelta, delta);
        _morphToRect(dot, p.displayID, rW, rH, orchestrator);
   
      } else if (feedDotSet.has(p.displayID)) {
        var size  = feedDotSize * (0.85 + 0.15 * Math.pow(level, 0.5));
        var prevW = parseFloat(dot.dataset.prevW) || 0;
        var delta = Math.abs(size - prevW);
        if (delta < 1 && dot.dataset.tier === 'feedDot') return;
        _maxSizeDelta = Math.max(_maxSizeDelta, delta);
        _morphToFeedDot(dot, p.displayID, size, orchestrator);
   
      } else if (confirmingSet.has(p.displayID)) {
        var progress = Math.min(1,
          (now - (_speakingStarted[p.displayID] || now)) / CONFIRM_MS
        );
        _pulseConfirming(dot, p.displayID, minDotSize, progress, level);
   
        } else {
          // isHost case removed — host never reaches this branch now;
          // handled entirely by the early return above when not live.
          var size  = isLive
            ? minDotSize * (1 + 0.2 * Math.pow(level, 0.6))
            : minDotSize;
          var prevW = parseFloat(dot.dataset.prevW) || 0;
          var delta = Math.abs(size - prevW);
          if (delta < 1 && dot.dataset.morphed !== 'true' && dot.dataset.tier !== 'feedDot') return;
          _maxSizeDelta = Math.max(_maxSizeDelta, delta);
          _morphToPresenceDot(dot, p.displayID, size, p.presenceState, false, orchestrator, p.name);
        }
    });
   
    // ── Step 4: repulsion only when meaningful growth occurred ────────────────
    if (_maxSizeDelta >= 3) {
      _repelIfNeeded(orchestrator, canvas, W, H);
    }
   
    _tickPinRings(orchestrator);
  }
   
   
  // ── A14. Host-as-participant — new. ──
  // Auto-creates the host's own participant row right after a conference is
  // created, with displayID FORCED to currentPath[0].displayID (see
  // _getHostDisplayID) rather than a fresh random one. Can't go through
  // addItem() — it unconditionally mints a new ID whenever the entity config
  // has an ID field, which participant does.
  //
  // Hooks db.saveEntityData (not the add-form) to get direct access to the
  // exact conference object addItem just built and saved.
   
  function _dotconfInstallHostParticipantHook(orchestrator) {
    if (!orchestrator.db || orchestrator.db._dotconfSaveHooked) return;
    orchestrator.db._dotconfSaveHooked = true;
   
    var origSave = orchestrator.db.saveEntityData.bind(orchestrator.db);
   
    orchestrator.db.saveEntityData = async function(entityPath, data, isUpdate) {
      // NEW — force presenceState to "added" on brand-new, non-host
      // participants. Originally this only filled in a MISSING value, but
      // testing showed presenceState arrives already set to "invited" —
      // something upstream (likely ensureBaseEntityFields) actively sets
      // it, rather than leaving it blank. So this now unconditionally
      // overwrites it for real participant creates.
      //
      // The isHost exclusion matters: _dotconfCreateHostParticipant also
      // creates a participant through this same saveEntityData call, and
      // deliberately sets presenceState to "invited" for the host (see that
      // function's own comment on why "added" is wrong there) — this guard
      // makes sure that value survives rather than getting clobbered here.
      if (!isUpdate && data?.entityType === 'participant' && !data.isHost) {
        data.presenceState = 'added';
      }
   
      var result = await origSave(entityPath, data, isUpdate);
   
      if (!isUpdate && data?.entityType === 'conference' && orchestrator.currentApp?.id === 'conf') {
        try {
          await _dotconfCreateHostParticipant(orchestrator, data);
        } catch (e) {
          console.error('[dotconf] auto-create host participant failed:', e);
          // Not fatal to conference creation — that save already succeeded.
          // Worst case, the host's own row is missing and they can't join
          // their own call, needing manual follow-up.
        }
      }
   
      return result;
    };
  }

   
  async function _dotconfCreateHostParticipant(orchestrator, conferenceItem) {
    var hostDisplayID = orchestrator.currentPath?.[0]?.displayID;
    var hostRawID     = orchestrator.currentPath?.[0]?.id;
    if (!hostDisplayID || !hostRawID) {
      console.error('[dotconf] cannot create host participant — no host in currentPath');
      return;
    }
   
    // ASSUMPTION: field name for the host/tenant's own display name, inferred
    // from addItem's own fallback chain for the root entity. Confirm this is
    // right for however the host's name is actually stored.
    var hostName = orchestrator.data?.items?.[0]?.name
                || orchestrator.data?.items?.[0]?.orgname
                || 'Host';
   
    var entityConfig = await orchestrator.getEntityConfig('participant');
    var readField  = entityConfig?.fields?.find(f => f.name === 'readAccess');
    var writeField = entityConfig?.fields?.find(f => f.name === 'writeAccess');
   
    var hostParticipant = {
      ID: hostRawID,
      displayID: hostDisplayID,           // ← the forced field — must match _getHostDisplayID's expectation
      entityType: 'participant',
      timestamp: Date.now(),
      hidden: false,
      hashed: false,
      readAccess:  readField?.default  || 'parent',
      writeAccess: writeField?.default || 'any',
      name: hostName,
      isHost: true,
      presenceState: 'invited' // normal _joinDotConf flow (session/new → markJoining) transitions this once the host actually joins
    };
   
    // Reuse the platform's own base-field filler for fidelity.
    if (typeof orchestrator.ensureBaseEntityFields === 'function') {
      orchestrator.ensureBaseEntityFields(hostParticipant, 'participant', entityConfig);
    }
   
    // NOTE: addItem also calls this.processItemID(newItem, entityType) on
    // every normally-created item. Deliberately NOT called here — unknown
    // whether it re-derives/reformats displayID/ID, which would silently
    // defeat the one guarantee this function exists to provide. If it only
    // touches something harmless (a dotLabel?) without touching the IDs,
    // it's safe to add back in — worth confirming first.
   
    var tenantSegment = orchestrator.currentPath[0].id || orchestrator.currentPath[0].displayID;
    var entityPath = [
      'apps',
      orchestrator.currentApp.id,
      tenantSegment,
      conferenceItem.displayID,
      hostParticipant.displayID
    ].join('/');
   
    // conferenceItem is the SAME object already living in
    // orchestrator.data.items[0].conferences (addItem pushed it there before
    // saving) — mutating it here updates the real tree in place.
    if (!conferenceItem.participants) conferenceItem.participants = [];
    conferenceItem.participants.push(hostParticipant);
   
    await orchestrator.db.saveEntityData(entityPath, hostParticipant, false);
   
    console.log('[dotconf] auto-created host participant — conf:' + conferenceItem.displayID + ' host:' + hostDisplayID);
  }

  
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Call controls — fixed bottom bar, independent of tile position.
  // Built once when the local participant goes live. Desktop: always visible
  // (or hover-reveal, see CONTROLS_ALWAYS_VISIBLE below). Mobile: tap canvas
  // to reveal, auto-hides after inactivity.
  // ─────────────────────────────────────────────────────────────────────────────

  var CONTROLS_ALWAYS_VISIBLE = true; // set false to require hover/tap-reveal on all platforms
  var CONTROLS_AUTOHIDE_MS    = 4000;
  var _controlsHideTimer      = null;
  var _controlsBarEl          = null;
  var _micBtnEl    = null;
  var _cameraBtnEl = null;

  function _renderCallControls(orchestrator) {
    if (_controlsBarEl) return;

    var bar = document.createElement('div');
    bar.id = 'dotconf-controls-bar';
    bar.style.cssText = `
      position: fixed;
      bottom: 24px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 12px;
      padding: 10px 16px;
      background: rgba(0,0,0,0.6);
      border-radius: 32px;
      z-index: 1000;
      opacity: ${CONTROLS_ALWAYS_VISIBLE ? '1' : '0'};
      pointer-events: ${CONTROLS_ALWAYS_VISIBLE ? 'auto' : 'none'};
      transition: opacity 0.2s ease;
    `;

    var micBtn    = _makeControlButton('mic', () => _toggleLocalAudio(orchestrator));
    var cameraBtn = _makeControlButton('camera', () => _toggleLocalVideo(orchestrator));
    var leaveBtn  = _makeControlButton('leave', () => _confirmAndLeave(orchestrator), true);

    var shareBtn = _makeControlButton('share', () => _onShareButtonClick(orchestrator));
    if (!_dotconfCanShareScreen()) shareBtn.style.display = 'none';   // e.g. iOS / most mobile browsers

    bar.appendChild(micBtn);
    bar.appendChild(cameraBtn);
    bar.appendChild(shareBtn);
    bar.appendChild(leaveBtn);

    _shareBtnEl = shareBtn;
    _updateShareButton(orchestrator);
    clearInterval(_shareBtnTimer);
    _shareBtnTimer = setInterval(() => _updateShareButton(orchestrator), 1000);
    
    document.body.appendChild(bar);
    _controlsBarEl = bar;
    _dotconfAutoHideControls(bar);
    _micBtnEl      = micBtn;
    _cameraBtnEl   = cameraBtn;

    if (!CONTROLS_ALWAYS_VISIBLE) {
      var canvas = document.getElementById('canvas-area');
      if (canvas) {
        canvas.addEventListener('mouseenter', () => _showControls());
        canvas.addEventListener('mouseleave', () => _hideControls());
        canvas.addEventListener('click', (e) => {
          if (e.target.closest('#dotconf-controls-bar')) return;
          _showControls();
          clearTimeout(_controlsHideTimer);
          _controlsHideTimer = setTimeout(() => _hideControls(), CONTROLS_AUTOHIDE_MS);
        });
      }
    }
  }

  function _removeCallControls() {
    if (_controlsBarEl) {
      _dotconfStopAutoHideControls();
      _controlsBarEl.remove();
      _controlsBarEl = null;
    }
    clearTimeout(_controlsHideTimer);
    
    clearInterval(_shareBtnTimer);
    _shareBtnTimer = null;
    _shareBtnEl = null;
  }

  function _showControls() {
    if (!_controlsBarEl) return;
    _controlsBarEl.style.opacity = '1';
    _controlsBarEl.style.pointerEvents = 'auto';
  }

  function _hideControls() {
    if (!_controlsBarEl) return;
    _controlsBarEl.style.opacity = '0';
    _controlsBarEl.style.pointerEvents = 'none';
  }

  function _makeControlButton(kind, onClick, isDanger) {
    var btn = document.createElement('button');
    btn.className = 'dotconf-control-btn dotconf-control-' + kind;
    btn.style.cssText = `
      width: 44px; height: 44px;
      border-radius: 50%;
      border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      background: ${isDanger ? '#e03131' : 'rgba(255,255,255,0.15)'};
      color: #fff;
    `;
    btn.innerHTML = _controlIconSvg(kind);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  function _controlIconSvg(kind, isOff) {
    var icons = {
      share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M12 13V8M9.5 10.5 12 8l2.5 2.5"/></svg>',
      mic:       '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>',
      'mic-off': '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>',
      camera:       '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>',
      'camera-off': '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5l-4 4V7a1 1 0 0 0-1-1H9.83l-2-2H16a1 1 0 0 1 1 1v3.5l4-4v11l-1.17-1.17L21 6.5zM3.27 2L2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12c.2 0 .39-.06.54-.16L19.73 21 21 19.73 3.27 2zM6 8.27L13.73 16H6V8.27z"/></svg>',
      leave:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a1.003 1.003 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>'
    };
    return icons[isOff ? kind + '-off' : kind] || icons[kind] || '';
  }
  
  var _ctrlAutoHide = null;

  function _dotconfAutoHideControls(bar) {
    _dotconfStopAutoHideControls();
    if (!bar) return;
    var base  = bar.style.transform || '';   // keep any existing centring transform
    var state = { bar: bar, base: base, thin: false, timer: null };

    bar.style.transformOrigin = 'center bottom';
    bar.style.transition = (bar.style.transition ? bar.style.transition + ', ' : '') + 'transform .25s ease';

    function expand() {
      clearTimeout(state.timer); state.timer = null;
      if (state.thin) { state.thin = false; bar.style.transform = base; }
    }
    function collapseSoon(ms) {
      if (state.timer) return;
      state.timer = setTimeout(() => {
        state.timer = null;
        if (bar.matches(':hover')) return collapseSoon(1500);
        state.thin = true;
        bar.style.transform = base + ' scaleY(' + (3 / Math.max(bar.offsetHeight, 3)) + ')';
      }, ms);
    }
    state.onMove = e => {
      var r = bar.getBoundingClientRect();
      var near = e.clientX >= r.left - 10 && e.clientX <= r.right + 10 &&
                 e.clientY >= r.top - (state.thin ? 20 : 10) && e.clientY <= r.bottom + 10;
      if (near) expand(); else if (!state.thin) collapseSoon(2500);
    };
    document.addEventListener('mousemove', state.onMove, { passive: true });
    _ctrlAutoHide = state;
    collapseSoon(4000);   // show fully on join, thin out after 4 s
  }

  function _dotconfStopAutoHideControls() {
    if (!_ctrlAutoHide) return;
    var s = _ctrlAutoHide;
    clearTimeout(s.timer);
    document.removeEventListener('mousemove', s.onMove);
    s.bar.style.transform = s.base;
    _ctrlAutoHide = null;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Screen share — one sharer at a time. Published as extra sendonly
  // transceivers on our existing peer connection; viewers pull it like any
  // other track. All SDP work goes through _negotiationQueue.
  // ─────────────────────────────────────────────────────────────────────────────

  var SCREEN_STRIP_H = 150;       // "Full" layout: height of the participant strip under the screen
  var _shareBtnEl        = null;
  var _shareBtnTimer     = null;
  var _myScreen          = null;  // { stream, videoTx, audioTx, layout } — while WE are sharing
  var _activeShare       = null;  // { participantDisplayID, cfSessionId, screenTrackId, screenAudioTrackId, layout }
  var _rosterShare       = null;  // share found in the roster snapshot (late join)
  var _screenRecv        = null;  // { txs, stream, videoId, audioId } — what we pulled as a viewer
  var _screenPullExpect  = null;  // set while a screen pull is negotiating (see ontrack guard)
  var _stageEl           = null;
  var _canvasSaved       = null;
  var _floatPos          = null;
  var _stageResizeTimer  = null;

  function _dotconfCanShareScreen() {
    return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function');
  }

  function _dotconfCanShareAudio() {
    var ua = navigator.userAgent;
    return /Chrome\/|Edg\//.test(ua) && !/Firefox\/|OPR\//.test(ua); // Chromium: tab audio (+ system audio on Windows)
  }

  function _dotconfNameOf(orchestrator, pid) {
    var c = _getCurrentDotConf(orchestrator);
    var p = (c?.participants || []).find(x => x.displayID === pid);
    return (p && p.name) || 'Someone';
  }

  function _dotconfInCallCount(orchestrator) {
    var c = _getCurrentDotConf(orchestrator);
    return (c?.participants || []).filter(p =>
      ['joining', 'live', 'audio_only', 'listening'].includes(p.presenceState)).length;
  }

  function _queueNegotiation(fn) {
    _negotiationQueue = _negotiationQueue.then(fn, fn);
    return _negotiationQueue;
  }

  // ── Share button ──────────────────────────────────────────────────────────────

  function _updateShareButton(orchestrator) {
    var btn = _shareBtnEl;
    if (!btn) return;
    var mine   = !!_myScreen;
    var other  = !!(_activeShare && _activeShare.participantDisplayID !== _cachedMyId);
    var enough = _dotconfInCallCount(orchestrator) >= 2;
    var enabled = mine || (!other && enough);

    var title = mine   ? 'Stop sharing'
              : other  ? _dotconfNameOf(orchestrator, _activeShare.participantDisplayID) + ' is sharing'
              : !enough ? 'Available once someone else joins'
              : 'Share your screen';

    btn.disabled = !enabled;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.style.opacity    = enabled ? '1' : '0.4';
    btn.style.cursor     = enabled ? 'pointer' : 'not-allowed';
    btn.style.background = mine ? '#4c6ef5' : 'rgba(255,255,255,0.15)';
  }

  function _onShareButtonClick(orchestrator) {
    if (_myScreen) { _stopScreenShare(orchestrator); return; }
    if (_shareBtnEl && _shareBtnEl.disabled) return;
    _openSharePicker(orchestrator);
  }

  // ── Layout picker (before sharing) ────────────────────────────────────────────

  var DOTCONF_LAYOUT_ICONS = {
    full:  '<rect x="1" y="1" width="46" height="30" rx="3" fill="#4c6ef5"/><rect x="1" y="26" width="46" height="5" rx="1" fill="#b2bec3"/>',
    split: '<rect x="1" y="1" width="22" height="30" rx="3" fill="#b2bec3"/><rect x="25" y="1" width="22" height="30" rx="3" fill="#4c6ef5"/>',
    float: '<rect x="1" y="1" width="46" height="30" rx="3" fill="#b2bec3"/><rect x="27" y="17" width="17" height="11" rx="2" fill="#4c6ef5"/>'
  };
  var DOTCONF_LAYOUT_LABELS = { full: 'Full', split: 'Split', float: 'Floating' };

  function _openSharePicker(orchestrator) {
    if (document.getElementById('dotconf-share-picker')) return;
    var chosen = 'split';

    var overlay = document.createElement('div');
    overlay.id = 'dotconf-share-picker';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;';

    var card = document.createElement('div');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Share your screen');
    card.style.cssText = 'background:#fff;border-radius:12px;padding:20px;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

    var title = document.createElement('div');
    title.textContent = 'Share your screen';
    title.style.cssText = 'font-size:16px;font-weight:700;color:#2d3436;margin-bottom:4px;';
    var sub = document.createElement('div');
    sub.textContent = 'How should everyone see it?';
    sub.style.cssText = 'font-size:13px;color:#636e72;margin-bottom:14px;';

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;margin-bottom:14px;';
    var cards = {};
    Object.keys(DOTCONF_LAYOUT_ICONS).forEach(function(k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<svg width="48" height="32" viewBox="0 0 48 32" aria-hidden="true">' + DOTCONF_LAYOUT_ICONS[k] + '</svg>' +
                    '<div style="font-size:12px;font-weight:600;margin-top:6px;color:#2d3436;">' + DOTCONF_LAYOUT_LABELS[k] + '</div>';
      b.style.cssText = 'flex:1;padding:10px 4px;border-radius:10px;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;';
      b.onclick = () => { chosen = k; paint(); };
      cards[k] = b;
      row.appendChild(b);
    });
    function paint() {
      Object.keys(cards).forEach(k => {
        cards[k].style.border = (k === chosen) ? '2px solid #4c6ef5' : '2px solid #dfe6e9';
        cards[k].setAttribute('aria-pressed', k === chosen ? 'true' : 'false');
      });
    }
    paint();

    var audioWrap = null, audioBox = null;
    if (_dotconfCanShareAudio()) {
      audioWrap = document.createElement('label');
      audioWrap.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;color:#2d3436;margin-bottom:16px;cursor:pointer;';
      audioBox = document.createElement('input');
      audioBox.type = 'checkbox';
      audioWrap.append(audioBox, document.createTextNode('Also share audio (tick "Share audio" in the next window)'));
    }

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
    var cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid #dfe6e9;background:#fff;color:#2d3436;font-weight:600;cursor:pointer;';
    var go = document.createElement('button');
    go.textContent = 'Choose what to share';
    go.style.cssText = 'padding:8px 14px;border-radius:8px;border:none;background:#4c6ef5;color:#fff;font-weight:600;cursor:pointer;';

    var close = () => overlay.remove();
    cancel.onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    // getDisplayMedia must run inside this click — _startScreenShare calls it before any other await.
    go.onclick = () => { close(); _startScreenShare(orchestrator, chosen, !!(audioBox && audioBox.checked)); };

    btns.append(cancel, go);
    card.append(title, sub, row);
    if (audioWrap) card.appendChild(audioWrap);
    card.appendChild(btns);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // ── Sharer side ───────────────────────────────────────────────────────────────

  async function _startScreenShare(orchestrator, layout, wantAudio) {
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf || !_peerConnection || !_mySessionId) return;
    var tenantId = _getTenantId(orchestrator);

    var stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: wantAudio,
        systemAudio: wantAudio ? 'include' : 'exclude'
      });
    } catch (e) {
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
        console.error('[dotconf] getDisplayMedia failed:', e);
        _showError('Could not start screen sharing.');
      }
      return; // user cancelled the browser's picker — nothing to do
    }

    var vTrack = stream.getVideoTracks()[0];
    var aTrack = stream.getAudioTracks()[0] || null;
    if ('contentHint' in vTrack) vTrack.contentHint = 'detail'; // favour sharp text over smooth motion

    try {
      await _queueNegotiation(async function() {
        var videoTx = _peerConnection.addTransceiver(vTrack, { direction: 'sendonly', streams: [stream] });
        var audioTx = aTrack ? _peerConnection.addTransceiver(aTrack, { direction: 'sendonly', streams: [stream] }) : null;
        var offer = await _peerConnection.createOffer();
        await _peerConnection.setLocalDescription(offer);
        try {
          var resp = await _cfApi('POST /' + conf.displayID + '/screen/start?tenantId=' + tenantId, {
            sessionId: _mySessionId,
            offerSdp:  _peerConnection.localDescription.sdp,
            videoMid:  videoTx.mid,
            audioMid:  audioTx ? audioTx.mid : null,
            layout:    layout
          });
          await _peerConnection.setRemoteDescription({ type: 'answer', sdp: resp.answerSdp });
          _myScreen = { stream: stream, videoTx: videoTx, audioTx: audioTx, layout: layout };
        } catch (err) {
          try { await _peerConnection.setLocalDescription({ type: 'rollback' }); } catch (_) {}
          [videoTx, audioTx].forEach(tx => { if (tx) { try { tx.stop(); } catch (_) {} } });
          throw err;
        }
        // Bitrate/framerate cap — only valid once the sender has been negotiated.
        try {
          var p = videoTx.sender.getParameters();
          if (!p.encodings || !p.encodings.length) p.encodings = [{}];
          p.encodings[0].maxBitrate   = 2500000;
          p.encodings[0].maxFramerate = 15;
          await videoTx.sender.setParameters(p);
        } catch (_) { /* best effort */ }
      });
    } catch (e) {
      stream.getTracks().forEach(t => t.stop());
      var busy = /\b409\b/.test(String(e && e.message));
      console.error('[dotconf] screen share failed:', e);
      _showError(busy ? 'Someone else is already sharing.' : 'Could not start screen sharing — please try again.');
      _updateShareButton(orchestrator);
      return;
    }

    vTrack.onended = () => _stopScreenShare(orchestrator); // browser's own "Stop sharing" bar
    _renderSharerBanner(orchestrator);
    _updateShareButton(orchestrator);
  }

  async function _stopScreenShare(orchestrator) {
    if (!_myScreen) return;
    var mine = _myScreen;
    _myScreen = null;
    mine.stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
    _removeSharerBanner();
    _updateShareButton(orchestrator);

    var conf = _getCurrentDotConf(orchestrator);
    if (!conf || !_mySessionId) return;
    var tenantId = _getTenantId(orchestrator);
    await _queueNegotiation(async function() {
      try {
        await _cfApi('POST /' + conf.displayID + '/screen/stop?tenantId=' + tenantId, { sessionId: _mySessionId });
      } catch (e) {
        console.warn('[dotconf] screen/stop failed:', e);
      }
      [mine.videoTx, mine.audioTx].forEach(tx => { if (tx) { try { tx.stop(); } catch (_) {} } });
    });
  }

  async function _setShareLayout(orchestrator, layout) {
    if (!_myScreen || _myScreen.layout === layout) return;
    var conf = _getCurrentDotConf(orchestrator);
    try {
      await _cfApi('POST /' + conf.displayID + '/screen/layout?tenantId=' + _getTenantId(orchestrator),
        { sessionId: _mySessionId, layout: layout });
      _myScreen.layout = layout;
      _renderSharerBanner(orchestrator);
    } catch (e) {
      console.error('[dotconf] screen layout change failed:', e);
      _showError('Could not change the layout.');
    }
  }

  function _renderSharerBanner(orchestrator) {
    if (!_myScreen) { _removeSharerBanner(); return; }
    var bar = document.getElementById('dotconf-sharer-banner');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'dotconf-sharer-banner';
      bar.setAttribute('role', 'status');
      bar.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:1100;display:flex;align-items:center;gap:10px;padding:6px 8px 6px 14px;background:#2d3436;color:#fff;border-radius:20px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.25);max-width:calc(100vw - 32px);flex-wrap:wrap;';
      document.body.appendChild(bar);
    }
    bar.innerHTML = '';
    var label = document.createElement('span');
    label.textContent = "You're sharing your screen";
    bar.appendChild(label);

    var seg = document.createElement('div');
    seg.style.cssText = 'display:flex;background:rgba(255,255,255,0.12);border-radius:14px;padding:2px;';
    Object.keys(DOTCONF_LAYOUT_LABELS).forEach(function(k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = DOTCONF_LAYOUT_LABELS[k];
      var on = _myScreen.layout === k;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.style.cssText = 'border:none;border-radius:12px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;' +
        (on ? 'background:#fff;color:#2d3436;' : 'background:transparent;color:#fff;');
      b.onclick = () => _setShareLayout(orchestrator, k);
      seg.appendChild(b);
    });
    bar.appendChild(seg);

    var stop = document.createElement('button');
    stop.type = 'button';
    stop.textContent = 'Stop';
    stop.style.cssText = 'border:none;border-radius:14px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;background:#e03131;color:#fff;';
    stop.onclick = () => _stopScreenShare(orchestrator);
    bar.appendChild(stop);
  }

  function _removeSharerBanner() {
    document.getElementById('dotconf-sharer-banner')?.remove();
  }

  // ── Viewer side ───────────────────────────────────────────────────────────────

  function _onScreenEvent(orchestrator, s) {
    if (s.active) {
      var trackChanged = !_activeShare || _activeShare.screenTrackId !== s.screenTrackId;
      _activeShare = {
        participantDisplayID: s.participantDisplayID, cfSessionId: s.cfSessionId,
        screenTrackId: s.screenTrackId, screenAudioTrackId: s.screenAudioTrackId || null,
        layout: s.layout || 'split'
      };
      if (s.participantDisplayID === _cachedMyId) {
        if (_myScreen) { _myScreen.layout = _activeShare.layout; _renderSharerBanner(orchestrator); }
      } else if (orchestrator._dotconfCallLive) {
        if (trackChanged) { _dropScreenRecv(orchestrator); _pullScreen(orchestrator, _activeShare); }
        else _renderScreenStage(orchestrator); // layout change only
      }
    } else {
      if (_activeShare && _activeShare.participantDisplayID === s.participantDisplayID) {
        _activeShare = null;
        _dropScreenRecv(orchestrator);
      }
      if (s.participantDisplayID === _cachedMyId && _myScreen) {
        // Server ended our share (e.g. after a long disconnect) — clean up locally.
        var mine = _myScreen; _myScreen = null;
        mine.stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
        _removeSharerBanner();
      }
    }
    _rosterShare = null;
    _updateShareButton(orchestrator);
  }

  function _dotconfResumeShare(orchestrator) {
    if (_rosterShare && !_activeShare) _onScreenEvent(orchestrator, _rosterShare);
  }

  function _pullScreen(orchestrator, share) {
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf || !_peerConnection || !_mySessionId) return;
    var tenantId = _getTenantId(orchestrator);
    var tracks = [{ trackName: share.screenTrackId, sessionId: share.cfSessionId }];
    if (share.screenAudioTrackId) tracks.push({ trackName: share.screenAudioTrackId, sessionId: share.cfSessionId });

    _queueNegotiation(async function() {
      if (!_activeShare || _activeShare.screenTrackId !== share.screenTrackId) return; // superseded meanwhile
      var expect = { captured: [] };
      _screenPullExpect = expect;
      try {
        var pullResp = await _cfApi('POST /' + conf.displayID + '/tracks/pull?tenantId=' + tenantId,
          { sessionId: _mySessionId, tracks: tracks });
        await _peerConnection.setRemoteDescription({ type: 'offer', sdp: pullResp.offerSdp });
        var answer = await _peerConnection.createAnswer();
        await _peerConnection.setLocalDescription(answer);
        await _cfApi('PUT /' + conf.displayID + '/tracks/renegotiate?tenantId=' + tenantId,
          { sessionId: _mySessionId, answerSdp: answer.sdp });
      } catch (e) {
        console.error('[dotconf] screen pull failed:', e);
        return;
      } finally {
        _screenPullExpect = null;
      }
      if (!_activeShare || _activeShare.screenTrackId !== share.screenTrackId) return; // ended while negotiating
      _screenRecv = {
        txs:     expect.captured.map(ev => ev.transceiver),
        stream:  new MediaStream(expect.captured.map(ev => ev.track)),
        videoId: share.screenTrackId,
        audioId: share.screenAudioTrackId
      };
      _renderScreenStage(orchestrator);
    });
  }

  function _dropScreenRecv(orchestrator) {
    _clearScreenStage(orchestrator);
    var recv = _screenRecv;
    _screenRecv = null;
    if (!recv || !_peerConnection) return;

    var conf = _getCurrentDotConf(orchestrator);
    var closeList = recv.txs
      .filter(tx => tx.mid && tx.receiver && tx.receiver.track)
      .map(tx => ({ trackName: tx.receiver.track.kind === 'audio' ? recv.audioId : recv.videoId, mid: tx.mid }));
    if (!conf || !closeList.length) return;

    _queueNegotiation(async function() {
      try {
        // No speakingSec → never treated as a leave.
        await _cfApi('PUT /' + conf.displayID + '/tracks/close?tenantId=' + _getTenantId(orchestrator),
          { sessionId: _mySessionId, tracks: closeList });
      } catch (e) {
        console.warn('[dotconf] closing pulled screen tracks failed (harmless if the share already ended):', e);
      }
    });
  }

  // ── Stage: where viewers see the shared screen ────────────────────────────────
  
  var _relayoutTimer = null;
  function _dotconfRelayout(orchestrator) {
    if (!orchestrator || typeof orchestrator.render !== 'function') return;
    clearTimeout(_relayoutTimer);
    _relayoutTimer = setTimeout(() => orchestrator.render(), 100);
  }

  function _renderScreenStage(orchestrator) {
    if (!_activeShare || !_screenRecv) { _clearScreenStage(); return; }
    var canvas = document.getElementById('canvas-area');
    if (!canvas) return;
    var layout = _activeShare.layout || 'split';

    _restoreCanvas(canvas);
    var rect = canvas.getBoundingClientRect();
    _canvasSaved = {
      width: canvas.style.width, height: canvas.style.height,
      marginTop: canvas.style.marginTop, overflow: canvas.style.overflow
    };

    if (!_stageEl) {
      _stageEl = document.createElement('div');
      _stageEl.id = 'dotconf-screen-stage';
      _stageEl.innerHTML =
        '<div class="dotconf-stage-head" style="display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:12px;font-weight:600;color:#fff;background:rgba(0,0,0,0.55);"></div>' +
        '<video autoplay playsinline style="flex:1;min-height:0;width:100%;object-fit:contain;background:#111;display:block;"></video>';
      document.body.appendChild(_stageEl);
      window.addEventListener('resize', _onStageResize);
      _stageEl._orchestrator = orchestrator;
    }
    var video = _stageEl.querySelector('video');
    if (video.srcObject !== _screenRecv.stream) video.srcObject = _screenRecv.stream; // carries screen audio too
    _stageEl.querySelector('.dotconf-stage-head').textContent =
      '🖥  ' + _dotconfNameOf(orchestrator, _activeShare.participantDisplayID) + ' is sharing';

    var base = 'position:fixed;z-index:900;display:flex;flex-direction:column;background:#111;overflow:hidden;box-sizing:border-box;';
    if (layout === 'full') {
      var stageH = Math.max(120, rect.height - SCREEN_STRIP_H);
      _stageEl.style.cssText = base + 'left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + stageH + 'px;';
      canvas.style.marginTop = stageH + 'px';
      canvas.style.height    = SCREEN_STRIP_H + 'px';
      canvas.style.overflow  = 'hidden';
    } else if (layout === 'split') {
      _stageEl.style.cssText = base + 'left:' + (rect.left + rect.width / 2) + 'px;top:' + rect.top + 'px;width:' + (rect.width / 2) + 'px;height:' + rect.height + 'px;';
      canvas.style.width    = '50%';
      canvas.style.overflow = 'hidden';
    } else { // float
      var w = Math.min(420, rect.width * 0.4), h = Math.round(w * 9 / 16) + 28;
      var pos = _floatPos || { left: rect.right - w - 24, top: rect.bottom - h - 96 };
      _stageEl.style.cssText = base + 'left:' + pos.left + 'px;top:' + pos.top + 'px;width:' + w + 'px;height:' + h + 'px;' +
        'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.35);resize:both;min-width:200px;min-height:140px;';
      _makeStageDraggable();
    }
    
    if (_stageEl._lastLayout !== layout) { _stageEl._lastLayout = layout; _dotconfRelayout(orchestrator); }
  }

  function _makeStageDraggable() {
    var head = _stageEl.querySelector('.dotconf-stage-head');
    if (head.dataset.drag) return;
    head.dataset.drag = '1';
    head.style.cursor = 'move';
    head.addEventListener('pointerdown', function(e) {
      if (!_activeShare || _activeShare.layout !== 'float') return;
      var startX = e.clientX, startY = e.clientY;
      var r = _stageEl.getBoundingClientRect();
      head.setPointerCapture(e.pointerId);
      function move(ev) {
        var left = Math.max(0, Math.min(window.innerWidth - 80,  r.left + ev.clientX - startX));
        var top  = Math.max(0, Math.min(window.innerHeight - 40, r.top  + ev.clientY - startY));
        _stageEl.style.left = left + 'px';
        _stageEl.style.top  = top + 'px';
        _floatPos = { left: left, top: top };
      }
      function up() { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); }
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
    });
  }

  function _onStageResize() {
    clearTimeout(_stageResizeTimer);
    _stageResizeTimer = setTimeout(() => {
      if (_stageEl && _stageEl._orchestrator) _renderScreenStage(_stageEl._orchestrator);
    }, 150);
  }

  function _restoreCanvas(canvas) {
    if (!_canvasSaved || !canvas) return;
    canvas.style.width     = _canvasSaved.width;
    canvas.style.height    = _canvasSaved.height;
    canvas.style.marginTop = _canvasSaved.marginTop;
    canvas.style.overflow  = _canvasSaved.overflow;
    _canvasSaved = null;
  }

  function _clearScreenStage(orchestrator) {
    var hadStage = !!_stageEl;
    var orch = orchestrator || (_stageEl && _stageEl._orchestrator);
    _restoreCanvas(document.getElementById('canvas-area'));
    if (_stageEl) {
      var v = _stageEl.querySelector('video');
      if (v) v.srcObject = null;
      _stageEl.remove();
      _stageEl = null;
      window.removeEventListener('resize', _onStageResize);
    }
    if (hadStage) _dotconfRelayout(orch);
  }
  
  // ── Leave / call end ──────────────────────────────────────────────────────────

  function _dotconfScreenTeardown() {
    if (_myScreen) {
      _myScreen.stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
      _myScreen = null;
    }
    _removeSharerBanner();
    _activeShare = null;
    _screenRecv = null;
    _screenPullExpect = null;
    _clearScreenStage();
    document.getElementById('dotconf-share-picker')?.remove();
  }

  // ── Toggle handlers ─────────────────────────────────────────────────────────

  var _micMuted  = false;
  var _cameraOff = false;

  function _toggleLocalAudio(orchestrator) {
    if (!_localStream) return;
    _micMuted = !_micMuted;
    _localStream.getAudioTracks().forEach(t => t.enabled = !_micMuted);
    _updateMuteBadge(orchestrator);
    _setButtonState(_micBtnEl, 'mic', _micMuted);
    _dotconfReportMedia(orchestrator);
  }

  function _toggleLocalVideo(orchestrator) {
    if (!_localStream) return;
    _cameraOff = !_cameraOff;
    _localStream.getVideoTracks().forEach(t => t.enabled = !_cameraOff);
    var tile = _cachedMyId ? _getDotElement(_cachedMyId) : null;
    if (tile) {
      tile.style.filter = _cameraOff ? 'grayscale(40%) brightness(0.9)' : '';
    }
    _setButtonState(_cameraBtnEl, 'camera', _cameraOff);
    _dotconfReportMedia(orchestrator);
  }

  function _setButtonState(btnEl, kind, isOff) {
    if (!btnEl) return;
    btnEl.innerHTML = _controlIconSvg(kind, isOff);
    btnEl.style.background = isOff ? '#e03131' : 'rgba(255,255,255,0.15)';
  }

  function _confirmAndLeave(orchestrator) {
    if (document.getElementById('dotconf-leave-confirm-overlay')) return; // already open

    var overlay = document.createElement('div');
    overlay.id = 'dotconf-leave-confirm-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000;
    `;

    var dialog = document.createElement('div');
    dialog.style.cssText = `
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      width: 280px;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    `;

    var title = document.createElement('div');
    title.textContent = 'Leave the call?';
    title.style.cssText = `
      font-size: 16px; font-weight: 600;
      margin-bottom: 20px;
      color: #1a1a1a;
    `;

    var btnRow = document.createElement('div');
    btnRow.style.cssText = `display: flex; gap: 10px; justify-content: center;`;

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      flex: 1; padding: 10px 0;
      border-radius: 8px; border: 1px solid #ddd;
      background: #fff; color: #333;
      cursor: pointer; font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => overlay.remove());

    var leaveBtn = document.createElement('button');
    leaveBtn.textContent = 'Leave';
    leaveBtn.style.cssText = `
      flex: 1; padding: 10px 0;
      border-radius: 8px; border: none;
      background: #e03131; color: #fff;
      cursor: pointer; font-size: 14px; font-weight: 600;
    `;
    leaveBtn.addEventListener('click', () => {
      overlay.remove();
      _leaveDotConf(orchestrator);
    });

    dialog.appendChild(title);

    if (orchestrator.isDataOwner()) {
      title.textContent = 'Leave or end the call?';
      title.style.marginBottom = '8px';

      var sub = document.createElement('div');
      sub.textContent = 'Others can keep talking without you, or you can end the call for everyone.';
      sub.style.cssText = 'font-size:13px;color:#636e72;margin-bottom:18px;line-height:1.4;';
      dialog.appendChild(sub);

      var endBtn = document.createElement('button');
      endBtn.textContent = 'End for everyone';
      endBtn.style.cssText = leaveBtn.style.cssText;   // copy the red style before Leave is restyled
      endBtn.addEventListener('click', () => { overlay.remove(); _dotconfEndCall(orchestrator); });

      leaveBtn.textContent = 'Just leave';
      leaveBtn.style.background = '#495057';

      btnRow.style.flexDirection = 'column';
      [endBtn, leaveBtn, cancelBtn].forEach(b => {
        b.style.flex = 'none';
        b.style.width = '100%';
        btnRow.appendChild(b);
      });
    } else {
      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(leaveBtn);
    }

    dialog.appendChild(btnRow);
    
    overlay.appendChild(dialog);

    // Dismiss on backdrop click, same as Cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }
  
  // ── End call / auto-end ─────────────────────────────────────────────────────

  var _dotconfEndingByMe = false;
  var _autoEndTicker     = null;

  async function _dotconfEndCall(orchestrator) {
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf) return;
    _dotconfEndingByMe = true;
    try {
      await _cfApi('POST /' + conf.displayID + '/end?tenantId=' + _getTenantId(orchestrator), {});
      conf.status = 'ended';
      conf.autoEndAt = 0;
      if (orchestrator._dotconfCallLive) await _leaveDotConf(orchestrator);
      if (typeof orchestrator.showNotification === 'function') orchestrator.showNotification('Call ended for everyone.');
      _dotconfRenderAutoEnd(orchestrator);
      if (typeof orchestrator.refreshContextBar === 'function') orchestrator.refreshContextBar();
    } catch (e) {
      _dotconfEndingByMe = false;
      console.error('[dotconf] end call failed:', e);
      _showError('Could not end the call — please try again.');
    }
  }

  function _dotconfConfirmEndCall(orchestrator) {
    if (document.getElementById('dotconf-end-confirm-overlay')) return;

    var conf   = _getCurrentDotConf(orchestrator);
    var myId   = _getMyDotConfParticipantDisplayID(orchestrator);
    var others = (conf?.participants || []).filter(p =>
      p.displayID !== myId && ['joining', 'live', 'audio_only', 'listening'].includes(p.presenceState)
    ).length;

    var overlay = document.createElement('div');
    overlay.id = 'dotconf-end-confirm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px;';

    var dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.style.cssText = 'background:#fff;border-radius:12px;padding:24px;width:100%;max-width:300px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.25);';

    var title = document.createElement('div');
    title.textContent = 'End the call for everyone?';
    title.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:8px;color:#1a1a1a;';

    var sub = document.createElement('div');
    sub.textContent = others
      ? others + (others === 1 ? ' participant' : ' participants') + ' will be disconnected.'
      : 'Nobody else is in the call.';
    sub.style.cssText = 'font-size:13px;color:#636e72;margin-bottom:20px;';

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;';

    var close = () => overlay.remove();

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'flex:1;padding:10px 0;border-radius:8px;border:1px solid #ddd;background:#fff;color:#333;cursor:pointer;font-size:14px;';
    cancelBtn.onclick = close;

    var endBtn = document.createElement('button');
    endBtn.textContent = 'End call';
    endBtn.style.cssText = 'flex:1;padding:10px 0;border-radius:8px;border:none;background:#e03131;color:#fff;cursor:pointer;font-size:14px;font-weight:600;';
    endBtn.onclick = () => { close(); _dotconfEndCall(orchestrator); };

    btnRow.append(cancelBtn, endBtn);
    dialog.append(title, sub, btnRow);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }

  // Floating "No one in the call — ending in 1:45" pill, for people viewing the page.
  function _dotconfRenderAutoEnd(orchestrator) {
    var conf = _getCurrentDotConf(orchestrator);
    var at   = conf && conf.status === 'live' ? (conf.autoEndAt || 0) : 0;
    var pill = document.getElementById('dotconf-autoend-pill');

    if (!at) {
      clearInterval(_autoEndTicker);
      _autoEndTicker = null;
      pill?.remove();
      return;
    }

    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'dotconf-autoend-pill';
      pill.setAttribute('role', 'status');
      pill.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:1600;display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;background:#2d3436;color:#fff;border-radius:20px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.25);max-width:calc(100vw - 32px);';

      var text = document.createElement('span');
      text.id = 'dotconf-autoend-text';
      pill.appendChild(text);

      var pillBtnCss = 'border:none;border-radius:14px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;';

      if (!orchestrator._dotconfCallLive) {
        var join = document.createElement('button');
        join.textContent = 'Join';
        join.style.cssText = pillBtnCss + 'background:#00b894;color:#fff;';
        join.onclick = () => _startDotConfPreview(orchestrator);
        pill.appendChild(join);
      }
      if (orchestrator.isDataOwner()) {
        var endNow = document.createElement('button');
        endNow.textContent = 'End now';
        endNow.style.cssText = pillBtnCss + 'background:#fff;color:#2d3436;';
        endNow.onclick = () => _dotconfEndCall(orchestrator);
        pill.appendChild(endNow);
      }
      document.body.appendChild(pill);
    }

    var textEl = pill.querySelector('#dotconf-autoend-text');
    function tick() {
      var ms = at - Date.now();
      if (ms <= 0) { textEl.textContent = 'No one in the call — ending…'; return; }
      var s = Math.ceil(ms / 1000);
      textEl.textContent = 'No one in the call — ending in ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }
    tick();
    clearInterval(_autoEndTicker);
    _autoEndTicker = setInterval(tick, 1000);
  }

  function _updateMuteBadge(orchestrator) {
    var tile = _cachedMyId ? _getDotElement(_cachedMyId) : null;
    if (!tile) return;

    var badge = tile.querySelector('.dotconf-mute-badge');
    if (_micMuted) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'dotconf-mute-badge';
        badge.style.cssText = `
          position: absolute; top: 8px; right: 8px;
          width: 24px; height: 24px;
          border-radius: 50%;
          background: rgba(224,49,49,0.9);
          display: flex; align-items: center; justify-content: center;
          z-index: 12;
        `;
        badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>';
        tile.appendChild(badge);
      }
    } else {
      badge?.remove();
    }
  }
  
  var _previewAnalyser    = null;
  var _previewLevelRaf    = null;
  var _previewSilentGain  = null;

  function _renderDotConfPreview(orchestrator, stream, name, onConfirm) {
      document.getElementById('dotconf-preview-widget')?.remove();

      var wrapper = document.createElement('div');
      wrapper.id = 'dotconf-preview-widget';
      wrapper.style.cssText = `
        position: fixed;
        bottom: ${SELF_VIEW_MARGIN}px;
        right:  ${SELF_VIEW_MARGIN}px;
        width: ${SELF_VIEW_EXPANDED_W}px;
        z-index: 1500;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        background: #2d3436;
      `;

      var videoWrap = document.createElement('div');
      videoWrap.style.cssText = `
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
      `;

      var video = document.createElement('video');
      video.autoplay    = true;
      video.playsInline = true;
      video.muted       = true;
      video.srcObject   = stream;
      video.style.cssText = `
        width: 100%; height: 100%;
        object-fit: cover;
        display: block;
        transform: scaleX(-1);
      `;

      var barsContainer = document.createElement('div');
      barsContainer.style.cssText = `
        position: absolute; bottom: 10px; left: 0; right: 0;
        display: flex; justify-content: center; align-items: flex-end;
        gap: 4px; height: 24px; pointer-events: none;
      `;
      var BAR_COUNT = 4;
      var bars = [];
      for (var bi = 0; bi < BAR_COUNT; bi++) {
        var bar = document.createElement('div');
        bar.style.cssText = `
          width: 4px; height: 4px; min-height: 4px;
          background: rgba(255,255,255,0.9);
          border-radius: 2px;
          transition: height 0.05s linear;
        `;
        bars.push(bar);
        barsContainer.appendChild(bar);
      }

      var hint = document.createElement('div');
      hint.textContent = 'Say something';
      hint.style.cssText = `
          position: absolute; top: 6px; left: 0; right: 0;
          text-align: center;
          color: #fff; font-size: 13px; font-weight: 600;
          text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      `;

      videoWrap.appendChild(video);
      videoWrap.appendChild(barsContainer);
      videoWrap.appendChild(hint);
      
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.setAttribute('aria-label', 'Cancel');
      closeBtn.style.cssText = `
        position: absolute; top: 6px; right: 8px;
        width: 24px; height: 24px;
        border: none; border-radius: 50%;
        background: rgba(0,0,0,0.4);
        color: #fff; font-size: 14px; line-height: 1;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        z-index: 13;
      `;
      closeBtn.addEventListener('click', () => {
          _stopPreviewAudioMeter();
          _stopPreviewRefreshTimer();
          _teardownPreparedConnection();
          _stopAllMedia();
          wrapper.remove();
      });
      videoWrap.appendChild(closeBtn);

      var ctaBtn = document.createElement('button');
      ctaBtn.textContent = 'Looks good, take me to the call';
      ctaBtn.style.cssText = `
        display: block;
        width: 100%;
        padding: 10px 0;
        border: none;
        background: #4c6ef5;
        color: #fff; font-size: 13px; font-weight: 600;
        cursor: pointer;
      `;
      ctaBtn.addEventListener('click', () => {
          _pendingSnap = _dotconfCaptureFrame(video);
          _stopPreviewAudioMeter();
          _stopPreviewRefreshTimer();
          ctaBtn.textContent = 'Connecting…';
          ctaBtn.disabled = true;
          ctaBtn.style.opacity = '0.7';
          onConfirm();
      });

      wrapper.appendChild(videoWrap);
      wrapper.appendChild(ctaBtn);
      document.body.appendChild(wrapper);

      _startPreviewAudioMeter(stream, bars);
  }

  function _startPreviewAudioMeter(stream, bars) {
      var audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      if (!_audioCtx || _audioCtx.state === 'closed') {
        _audioCtx = new AudioContext();
      }
      if (_audioCtx.state === 'suspended') {
        _audioCtx.resume().catch(function(e) {
          console.warn('[dotconf] AudioContext resume failed:', e);
        });
      }

      var source   = _audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      var analyser = _audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      // Analyser must have a path to destination or some browsers never
      // actually pull audio through it — route through a silent gain node
      // so we don't hear ourselves, but the graph still processes.
      var silentGain = _audioCtx.createGain();
      silentGain.gain.value = 0;
      analyser.connect(silentGain);
      silentGain.connect(_audioCtx.destination);

      _previewAnalyser = analyser;
      _previewSilentGain = silentGain; // stash so _stopPreviewAudioMeter can disconnect it

      var freqData = new Uint8Array(analyser.frequencyBinCount);
      var BAR_COUNT = bars.length;
      var MAX_BAR_HEIGHT = 24;

      function tick() {
        analyser.getByteFrequencyData(freqData);
       // console.log('[diag] audioCtx.state:', _audioCtx.state, 'freqData:', Array.from(freqData.slice(0, 8)));

        var binsPerBar = Math.floor(freqData.length / BAR_COUNT);
        for (var b = 0; b < BAR_COUNT; b++) {
          var sum = 0;
          for (var i = 0; i < binsPerBar; i++) {
            sum += freqData[b * binsPerBar + i];
          }
          var avg = sum / binsPerBar;
          var level = Math.min(1, (avg / 255) * 3);
          var height = 4 + level * MAX_BAR_HEIGHT;
          bars[b].style.height = height + 'px';
          bars[b].style.opacity = (0.5 + level * 0.5).toFixed(2);
        }

        _previewLevelRaf = requestAnimationFrame(tick);
      }
      tick();
  }

  function _stopPreviewAudioMeter() {
      if (_previewLevelRaf) { cancelAnimationFrame(_previewLevelRaf); _previewLevelRaf = null; }
      if (_previewSilentGain) { _previewSilentGain.disconnect(); _previewSilentGain = null; }
      _previewAnalyser = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Active-speaker detection — Phase 3 skeleton
  // ─────────────────────────────────────────────────────────────────────────────

  function _attachAudioAnalyser(trackId, mediaStreamTrack) {
    if (!_audioCtx) _audioCtx = new AudioContext();
    var stream   = new MediaStream([mediaStreamTrack]);
    var source   = _audioCtx.createMediaStreamSource(stream);
    var analyser = _audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    _tracks[trackId] = { ..._tracks[trackId], analyser, audioLevel: 0 };
  }

  function _updateAudioLevels() {
    // Called on a 100ms interval while in-call.
    // Reads RMS from each analyser, applies EMA smoothing.
    var EMA_ALPHA = 0.3;
    var buf = new Uint8Array(64);
    Object.entries(_tracks).forEach(([id, t]) => {
      if (!t.analyser) return;
      t.analyser.getByteTimeDomainData(buf);
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        var v = (buf[i] - 128) / 128;
        sumSq += v * v;
      }
      var rms = Math.sqrt(sumSq / buf.length);
      t.audioLevel = EMA_ALPHA * rms + (1 - EMA_ALPHA) * (t.audioLevel || 0);
    });
    // Phase 3: _evaluateVideoSlots()
  }

  function _evaluateVideoSlots(orchestrator) {
    // Phase 3: apply hysteresis, compare current slots vs desired,
    // call _promoteToVideoSlot / _demoteFromVideoSlot as needed.
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf) return;
    var n      = Object.keys(_roster).length;
    var target = VIDEO_SLOTS_BY_N(n);
    // ... Phase 3 implementation
    void target;
  }

  async function _promoteToVideoSlot(orchestrator, participantDisplayID) {
    // Phase 3: POST /conf/{id}/tracks/pull for that participant's videoTrackId
    // Then trigger dot→rect morph on the canvas
    console.log("[dotconf] promote", participantDisplayID, "— Phase 3");
  }

  async function _demoteFromVideoSlot(orchestrator, participantDisplayID) {
    // Phase 3: PUT /conf/{id}/tracks/close for that participant's videoTrackId
    // CLOSE, do not hide — hiding still bills egress
    // Then trigger rect→dot morph on the canvas
    console.log("[dotconf] demote", participantDisplayID, "— Phase 3");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Recording — Phase 4 skeleton
  // ─────────────────────────────────────────────────────────────────────────────

  async function _startRecording(orchestrator) {
    // Phase 4:
    // 1. Broadcast consent request over SSE
    // 2. Wait for all live participants to consent
    // 3. canvas.captureStream(24) + WebAudio mix → MediaRecorder
    // 4. Write chunks to IndexedDB, not a JS array
    console.log("[dotconf] _startRecording — Phase 4");
  }

  function _stopRecording() {
    if (_mediaRecorder && _mediaRecorder.state !== "inactive") {
      _mediaRecorder.stop();
    }
  }

  function _showConsentBanner(orchestrator) {
    // Phase 4: show a persistent banner + red ring on all dots
    console.log("[dotconf] consent banner — Phase 4");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UI helpers
  // ─────────────────────────────────────────────────────────────────────────────

  function _showError(msg) {
    console.error("[dotconf]", msg);
    // TODO: surface in the context bar or a toast
  }

  function _showNotice(msg) {
    console.info("[dotconf]", msg);
    // TODO: one-time dismissible banner in the context bar
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────────────────────────────────────

  function _getTenantId(orchestrator) {
      // tenantId is currentPath[0].id — the host's real (un-hashed) UUID,
      // which is what the server's NewAuthUtils.isRealUuid() check requires.
      return orchestrator.currentPath?.[0]?.id || null;
    }
    
  function _getCurrentDotConf(orchestrator) {
      var path  = orchestrator.currentPath;
      var items = orchestrator.data && orchestrator.data.items;
      if (!path || path.length < 2 || !items || !items.length) return null;

      var firstItem = items[0];
      if (!firstItem) return null;

      var conf = null;

      // Case 1: fetched at conference level — items[0] IS the conference
      if (firstItem.entityType === 'conference') {
          conf = firstItem;
      } else {
          // Case 2: fetched at host level — conferences nested under host
          var conferences = firstItem.dotconfs || [];
          conf = conferences.find(function(c) {
              return c.displayID === path[1].displayID || c.ID === path[1].id;
          }) || null;
      }

      // Normalise missing presenceState — field not written at creation time
      // since writePermission:system means addItem skips it entirely
      if (conf && conf.participants) {
          conf.participants.forEach(function(p) {
              if (!p.presenceState) p.presenceState = 'invited';
          });
      }

      return conf;
  }

  function _dotconfMetaOnly(confItem) {
    // Strip participants[] before any dotconf metadata save.
    // Mirrors poll's _pollMetaOnly() — prevents duplicate-children bug (Poll §14).
    var copy = Object.assign({}, confItem);
    delete copy.participants;
    return copy;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Viewed state — participant loads the dotconf URL
  // ─────────────────────────────────────────────────────────────────────────────

  function _markDotConfViewed(orchestrator) {
    // Called when a non-owner lands at dotconf depth.
    // Identity model: device UUID (localStorage) hashed = participant displayID,
    // which is embedded in the invite URL as currentPath[2].
    // email/phone are contact attributes only — not used for identification.
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf) return;

    // The participant displayID comes from the URL path segment (currentPath[2])
    // set when the invitee clicks their personalised invite link.
    var path = orchestrator.currentPath;
    var participantDisplayID = path[2]?.displayID;
    if (!participantDisplayID) return;

    var p = (conf.participants || []).find(
      p => p.displayID === participantDisplayID
    );
    if (!p || p.presenceState !== PRESENCE_STATE.INVITED) return;

    // Persist their UUID → displayID mapping so they are recognised on return visits
    _saveDotConfContext(orchestrator, participantDisplayID);

    // Phase 1: saveEntityData with presenceState=viewed, viewedAt=Date.now()
    console.log("[dotconf] _markDotConfViewed — save presenceState=viewed for", p.displayID);
  }

  function _saveDotConfContext(orchestrator, participantDisplayID) {
    // Scope the saved context per dotconf so a person invited to multiple
    // dotconfs has independent entries — key: dotconf_participant_{confDisplayID}
    // Same pattern as Poll's saveContextIfApplicable / isOwnerAccess.
    var confDisplayID = orchestrator.currentPath[1]?.displayID;
    if (!confDisplayID) return;
    try {
      var key = `dotconf_participant_${confDisplayID}`;
      var contexts = JSON.parse(localStorage.getItem("savedContexts") || "{}");
      contexts[key] = participantDisplayID;
      localStorage.setItem("savedContexts", JSON.stringify(contexts));
    } catch (e) {
      // localStorage unavailable — session only, acceptable
    }
  }

  function _getMyDotConfParticipantDisplayID(orchestrator) {
      // Host: own participant row's displayID always equals path[0]'s tenant-level
      // displayID — forced at creation time, see §11.5. Host never goes through
      // the identify-UI flow, so the localStorage-based lookups below don't apply.
      if (orchestrator.isDataOwner()) {
          return orchestrator.currentPath[0]?.displayID || null;
      }

      // Returns the participant displayID for the current device, in priority order:
      // 1. currentPath[2] — the participantHash from the invite URL (freshest)
      // 2. savedContexts[dotconf_participant_{confDisplayID}] — recognised return visit
      // 3. null — device not identified for this dotconf
      var path = orchestrator.currentPath;
      if (path[2]?.displayID) return path[2].displayID;
      var confDisplayID = path[1]?.displayID;
      if (!confDisplayID) return null;
      try {
        var key = `dotconf_participant_${confDisplayID}`;
        var contexts = JSON.parse(localStorage.getItem("savedContexts") || "{}");
        return contexts[key] || null;
      } catch (e) {
        return null;
      }
  }



  function _hookParticipantEmail(orchestrator) {
    var addBtn = document.querySelector('.orb-add-btn');
    if (!addBtn || addBtn.dataset.dotconfEmailHooked) return;
    addBtn.dataset.dotconfEmailHooked = 'true';

    addBtn.addEventListener('click', () => {
      setTimeout(() => {
        var form = document.getElementById('add-form');
        if (!form || form.dataset.dotconfHooked) return;
        form.dataset.dotconfHooked = 'true';

        var origSubmit = form.onsubmit;
        form.onsubmit = async function(e) {
          if (origSubmit) await origSubmit.call(this, e);
         // await _sendParticipantInviteEmail(orchestrator);
        };
      }, 150);
    });
  }

  async function _sendParticipantInviteEmail(orchestrator) {
    try {
      var conf = _getCurrentDotConf(orchestrator);
      if (!conf?.participants || conf.participants.length === 0) return;

      var newest = [...conf.participants]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];

      if (!newest?.contactemail) return;

      var confUrl = _dotconfGuestUrl(orchestrator);
      var parentName = orchestrator.currentPath[0]?.shortName
        || orchestrator.currentPath[0]?.displayID
        || 'Conference host';

      await orchestrator.sendSubtenantNotificationEmail(newest, parentName, confUrl);
      console.log('[dotconf] invite email sent to', newest.contactemail);
    } catch (err) {
      console.error('[dotconf] invite email failed:', err.message || err);
    }
  }
  
  function _getDotConfContacts(orchestrator) {
    // Read from the host entity already in data.items[0]
    var host = orchestrator.data?.items?.[0];
    if (!host) return [];
    try {
      var raw = host.contacts;
      if (!raw) return [];
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      console.warn("[dotconf] contacts parse error", e);
      return [];
    }
  }

  function _findDotConfContactByEmailOrPhone(contacts, email, phone) {
    if (email) {
      var found = contacts.find(c => c.email &&
        c.email.toLowerCase() === email.toLowerCase());
      if (found) return found;
    }
    if (phone) {
      var normalised = phone.replace(/\D/g, '');
      var found = contacts.find(c => c.phone &&
        c.phone.replace(/\D/g, '') === normalised);
      if (found) return found;
    }
    return null;
  }

  async function _upsertDotConfContact(orchestrator, { name, email, phone }) {
    // Add or update a contact in host.contacts.
    // Called when the host adds a participant to a dotconf —
    // we silently keep the contact list up to date.
    if (!name) { console.warn("[dotconf] upsertContact: name required"); return; }
    if (!email && !phone) { console.warn("[dotconf] upsertContact: email or phone required"); return; }

    var contacts = _getDotConfContacts(orchestrator);
    var existing = _findDotConfContactByEmailOrPhone(contacts, email, phone);

    if (existing) {
      // Update name if it changed — email/phone are the stable identity
      if (existing.name !== name) {
        existing.name = name;
        await _saveDotConfContacts(orchestrator, contacts);
      }
      // else: no change, skip the write
      return existing;
    }

    // New contact
    var contact = {
      id:    _uuidv4(),
      name,
      email: email  || "",
      phone: phone  || ""
    };
    contacts.push(contact);
    await _saveDotConfContacts(orchestrator, contacts);
    return contact;
  }

  async function _removeDotConfContact(orchestrator, contactId) {
    var contacts = _getDotConfContacts(orchestrator).filter(c => c.id !== contactId);
    await _saveDotConfContacts(orchestrator, contacts);
  }

  async function _saveDotConfContacts(orchestrator, contacts) {
    // Write host.contacts back via saveEntityData.
    // Uses _dotconfMetaOnly pattern — strip children before save.
    var host = orchestrator.data?.items?.[0];
    if (!host) return;
    var payload = Object.assign({}, host, {
      contacts: JSON.stringify(contacts)
    });
    // Remove any nested dotconf arrays before saving host
    delete payload.dotconfs;
    // Phase 1: call orchestrator's saveEntityData for the host entity
    // Adjust to match your platform's save method signature
    if (typeof orchestrator.saveEntityData === 'function') {
      await orchestrator.saveEntityData('host', payload);
    } else {
      console.warn("[dotconf] _saveDotConfContacts: no saveEntityData found on orchestrator");
    }
  }

  function _dotconfContactsAsParticipantDefaults(contacts) {
    // Convert contacts array to the shape expected by the Add Participant form.
    // Used to pre-populate the form when host picks from their contact list.
    return contacts.map(c => ({
      name:         c.name,
      contactemail: c.email || "",
      contactphone: c.phone || ""
    }));
  }

  // ─── expose contact helpers in install ───────────────────────────────────────
  // Add these lines to the install() function's Object.assign block:
  //
  //   dotconfGetContacts:               (o) => _getDotConfContacts(o || orchestrator),
  //   dotconfUpsertContact:             (o, contact) => _upsertDotConfContact(o || orchestrator, contact),
  //   dotconfRemoveContact:             (o, id) => _removeDotConfContact(o || orchestrator, id),
  //   dotconfContactsAsParticipantDefaults: (o) => _dotconfContactsAsParticipantDefaults(_getDotConfContacts(o || orchestrator)),
  //
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // Participant identification — name-matching UI for non-owners
  //
  // Flow:
  //   1. Non-owner lands at dotconf depth
  //   2. _isDotConfIdentified() checks localStorage — if known, skip to markViewed
  //   3. If not known, show _renderDotConfIdentifyUI()
  //   4. As they type, _matchDotConfParticipants() searches the loaded participant list
  //   5. On match selection, _saveDotConfContext() + markViewed()
  //   6. On no match, _renderDotConfKnockUI() — message the organiser
  // ─────────────────────────────────────────────────────────────────────────────

  function _isDotConfIdentified(orchestrator) {
        if (typeof _getMyDotConfParticipantDisplayID !== 'function') return false;
    return !!_getMyDotConfParticipantDisplayID(orchestrator);
  }

  // ── Fuzzy name matching ────────────────────────────────────────────────────

  function _dotconfNormalise(str) {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip diacritics — María → maria
      .trim();
  }

  function _dotconfEditDistance(a, b) {
    // Standard Levenshtein — used for fuzzy catch (typos, short name variants)
    var m = a.length, n = b.length;
    var dp = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n];
  }

  function _matchDotConfParticipants(orchestrator, query) {
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf || !conf.participants) return [];

    var q = _dotconfNormalise(query);
    if (q.length < 2) return [];

    // Only match against unjoined participants — already live/left are identified
    var candidates = conf.participants.filter(p =>
      p.presenceState === PRESENCE_STATE.INVITED ||
      p.presenceState === PRESENCE_STATE.VIEWED ||
      p.presenceState === PRESENCE_STATE.LEFT
    );

    return candidates
      .map(p => {
        var name = _dotconfNormalise(p.name);
        if (name === q)                  return { p, score: 4 }; // exact
        if (name.startsWith(q))          return { p, score: 3 }; // prefix
        if (q.length >= 3 && name.includes(q)) return { p, score: 2 }; // substring
        // Fuzzy: only kick in for query ≥ 3 chars to avoid false positives on short input
        if (q.length >= 3 && _dotconfEditDistance(name, q) <= Math.floor(q.length / 3))
                                         return { p, score: 1 }; // typo tolerance
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map(x => x.p);
  }

  // ── Identify UI — rendered over the canvas when participant is unknown ──────

  function _renderDotConfIdentifyUI(orchestrator) {
    var canvas = document.getElementById('canvas-area');
    if (!canvas) return;

    // Remove any existing identify overlay
    document.getElementById('dotconf-identify-overlay')?.remove();

    var conf = _getCurrentDotConf(orchestrator);
    var confName = conf?.name || "this dotconf";

    var overlay = document.createElement('div');
    overlay.id = 'dotconf-identify-overlay';
    overlay.style.cssText = `
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
      z-index: 500; gap: 16px; padding: 32px;
    `;

    overlay.innerHTML = `
      <div style="color:#fff;font-size:22px;font-weight:700;text-align:center;">
        You're invited to<br><span style="color:#00b894;">${confName}</span>
      </div>
      <div style="color:#b2bec3;font-size:15px;">Start typing your name to join</div>
      <input id="dotconf-name-input" type="text" placeholder="Your name…"
        autocomplete="off" autocorrect="off" spellcheck="false"
        style="
          width:260px; padding:12px 16px; border-radius:24px;
          border:2px solid #636e72; background:#2d3436; color:#fff;
          font-size:16px; outline:none; text-align:center;
        "/>
      <div id="dotconf-match-list" style="
        display:flex; flex-direction:column; gap:8px;
        width:260px; max-height:220px; overflow-y:auto;
      "></div>
      <div id="dotconf-no-match" style="display:none;color:#b2bec3;font-size:14px;text-align:center;">
        No match found —
        <span id="dotconf-knock-link" style="color:#74b9ff;cursor:pointer;text-decoration:underline;">
          message the organiser
        </span>
      </div>
    `;

    canvas.appendChild(overlay);

    var input     = overlay.querySelector('#dotconf-name-input');
    var matchList = overlay.querySelector('#dotconf-match-list');
    var noMatch   = overlay.querySelector('#dotconf-no-match');
    var knockLink = overlay.querySelector('#dotconf-knock-link');

    let debounceTimer = null;

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        var query   = input.value;
        var matches = _matchDotConfParticipants(orchestrator, query);
        _renderDotConfMatchList(orchestrator, matchList, noMatch, matches, query, overlay);
      }, 180); // debounce — don't fire on every keystroke
    });

    knockLink.addEventListener('click', () => {
      _renderDotConfKnockUI(orchestrator, overlay, input.value);
    });

    input.focus();
  }

  function _renderDotConfMatchList(orchestrator, matchList, noMatch, matches, query, overlay) {
    matchList.innerHTML = '';

    if (query.trim().length < 2) {
      noMatch.style.display = 'none';
      return;
    }

    if (matches.length === 0) {
      noMatch.style.display = 'block';
      return;
    }

    noMatch.style.display = 'none';

    matches.forEach(p => {
      var chip = document.createElement('div');
      chip.style.cssText = `
        padding:10px 20px; border-radius:20px;
        background:#00b894; color:#fff;
        font-size:15px; font-weight:600;
        cursor:pointer; text-align:center;
        transition: background 0.15s;
      `;
      chip.textContent = p.name;
      chip.addEventListener('mouseenter', () => chip.style.background = '#00cec9');
      chip.addEventListener('mouseleave', () => chip.style.background = '#00b894');
      chip.addEventListener('click', () => _dotconfConfirmIdentity(orchestrator, p, overlay));
      matchList.appendChild(chip);
    });

    // Auto-select if only one match and query is long enough to be confident
    if (matches.length === 1 && query.trim().length >= 4) {
      setTimeout(() => {
        // Check the overlay is still showing (user hasn't typed more)
        if (document.getElementById('dotconf-identify-overlay')) {
          chip = matchList.querySelector('div');
          if (chip) chip.style.background = '#00cec9'; // visual hint
          // Don't auto-confirm — let user click. Just highlight.
        }
      }, 400);
    }
  }

  async function _dotconfConfirmIdentity(orchestrator, participant, overlay) {
    // Participant has identified themselves
    _saveDotConfContext(orchestrator, participant.displayID);

    // Animate overlay out
    overlay.style.transition = 'opacity 0.3s';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);

    // Mark viewed — writes to entity store + triggers SSE to host
    await _markDotConfViewed(orchestrator);

    // Re-render so the canvas shows normally
    orchestrator.render();
  }

  // ── Knock UI — shown when no participant match found ──────────────────────

  function _renderDotConfKnockUI(orchestrator, overlay, typedName) {
    // Replace match list content with the knock form
    // The overlay stays, only inner content changes
    var inner = overlay.querySelector('#dotconf-match-list');
    var noMatch = overlay.querySelector('#dotconf-no-match');
    var input   = overlay.querySelector('#dotconf-name-input');

    if (inner)   inner.innerHTML = '';
    if (noMatch) noMatch.style.display = 'none';
    if (input)   input.disabled = true;

    var knockForm = document.createElement('div');
    knockForm.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:260px;';
    knockForm.innerHTML = `
      <div style="color:#fdcb6e;font-size:14px;text-align:center;">
        You're not on the invite list.<br>Send a message to the organiser:
      </div>
      <textarea id="dotconf-knock-msg" rows="3" placeholder="Hi, it's ${typedName || 'me'} — can you add me?"
        style="
          padding:10px 14px; border-radius:12px;
          border:2px solid #636e72; background:#2d3436; color:#fff;
          font-size:14px; outline:none; resize:none; width:100%; box-sizing:border-box;
        ">${typedName ? `Hi, it's ${typedName} — can you add me?` : ''}</textarea>
      <div style="display:flex;gap:8px;">
        <button id="dotconf-knock-back" style="
          flex:1; padding:10px; border-radius:20px; border:2px solid #636e72;
          background:transparent; color:#b2bec3; font-size:14px; cursor:pointer;
        ">Back</button>
        <button id="dotconf-knock-send" style="
          flex:2; padding:10px; border-radius:20px; border:none;
          background:#6c5ce7; color:#fff; font-size:14px;
          font-weight:600; cursor:pointer;
        ">Send message</button>
      </div>
      <div id="dotconf-knock-status" style="color:#b2bec3;font-size:13px;text-align:center;display:none;"></div>
    `;

    overlay.appendChild(knockForm);

    knockForm.querySelector('#dotconf-knock-back').addEventListener('click', () => {
      knockForm.remove();
      if (input) input.disabled = false;
      if (noMatch) noMatch.style.display = 'none';
    });

    knockForm.querySelector('#dotconf-knock-send').addEventListener('click', async () => {
      var msg    = knockForm.querySelector('#dotconf-knock-msg').value.trim();
      var status = knockForm.querySelector('#dotconf-knock-status');
      if (!msg) return;

      knockForm.querySelector('#dotconf-knock-send').disabled = true;

      try {
        var conf = _getCurrentDotConf(orchestrator);
        await _sendDotConfKnock(tenantId, conf.displayID, typedName, msg);
        status.style.display  = 'block';
        status.style.color    = '#00b894';
        status.textContent    = '✓ Message sent — the organiser will add you shortly.';

        // Poll the participant list every 5s — when the organiser adds them,
        // re-show the identify UI so they can confirm their name
        _waitForDotConfInvite(orchestrator, typedName);

      } catch (e) {
        status.style.display = 'block';
        status.style.color   = '#e17055';
        status.textContent   = 'Could not send — please try again.';
        knockForm.querySelector('#dotconf-knock-send').disabled = false;
      }
    });
  }

  async function _sendDotConfKnock(tenantId, confDisplayID, name, message) {
    // POST to Spring Boot which broadcasts guest.knock via SSE to the host
    var resp = await fetch(`/newauth/api/conf/${confDisplayID}/knock?tenantId=${tenantId}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, message })
    });
    if (!resp.ok) throw new Error('knock failed');
  }

  function _waitForDotConfInvite(orchestrator, typedName) {
    // Poll the app data every 5s after knocking.
    // When a new participant appears whose name fuzzy-matches typedName,
    // dismiss the knock UI and re-show the identify UI.
    let attempts = 0;
    var MAX_ATTEMPTS = 24; // 2 minutes

    var poll = setInterval(async () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(poll);
        return;
      }

      // Re-fetch the dotconf data
      if (typeof orchestrator.fetchData === 'function') {
        await orchestrator.fetchData();
      }

      var matches = _matchDotConfParticipants(orchestrator, typedName);
      if (matches.length > 0) {
        clearInterval(poll);
        // Remove knock overlay and show identify UI fresh
        document.getElementById('dotconf-identify-overlay')?.remove();
        _renderDotConfIdentifyUI(orchestrator);
      }
    }, 5000);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Updated _markDotConfViewed — now works from saved context, not URL path
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // Self-view — bottom-right, minimisable to a live video dot
  //
  // States:
  //   expanded  — 16:9 rect, ~240×135px, shows name label + minimise button
  //   minimised — circular dot, ~56px, live video still playing inside
  //
  // Position: fixed bottom-right, 16px margin.
  // State persisted in localStorage so it survives page refresh.
  // ─────────────────────────────────────────────────────────────────────────────

  var SELF_VIEW_EXPANDED_W  = 240;
  var SELF_VIEW_EXPANDED_H  = 135;   // 16:9
  var SELF_VIEW_MIN_SIZE    = 56;    // minimised dot diameter
  var SELF_VIEW_MARGIN      = 16;
  var SELF_VIEW_STORAGE_KEY = 'dotconf_selfview_minimised';

  function _isDotConfSelfViewMinimised() {
    try {
      return localStorage.getItem(SELF_VIEW_STORAGE_KEY) === '1';
    } catch (e) { return false; }
  }

  function _setDotConfSelfViewMinimised(val) {
    try {
      localStorage.setItem(SELF_VIEW_STORAGE_KEY, val ? '1' : '0');
    } catch (e) {}
  }

  /**
   * Create and attach the self-view element.
   * Call once after getUserMedia succeeds (Phase 2).
   * The element is appended to document.body (not the canvas)
   * so it survives canvas.innerHTML = '' on re-render.
   *
   * @param {MediaStream} stream  — local getUserMedia stream
   * @param {string}      name   — participant's display name
   */
  function _renderDotConfSelfView(stream, name) {
    // Remove any existing self-view
    document.getElementById('dotconf-self-view')?.remove();

    var minimised = _isDotConfSelfViewMinimised();

    var wrapper = document.createElement('div');
    wrapper.id = 'dotconf-self-view';
    wrapper.style.cssText = `
      position: fixed;
      bottom: ${SELF_VIEW_MARGIN}px;
      right:  ${SELF_VIEW_MARGIN}px;
      z-index: 1000;
      cursor: pointer;
      transition: width 0.3s ease, height 0.3s ease, border-radius 0.3s ease;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      overflow: hidden;
      background: #2d3436;
      user-select: none;
    `;

    // Video element — always present, always playing
    var video = document.createElement('video');
    video.autoplay    = true;
    video.playsInline = true;
    video.muted       = true;   // always muted — never echo your own audio
    video.srcObject   = stream;
    video.style.cssText = `
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
      transform: scaleX(-1);  /* mirror — feels more natural */
    `;

    // Minimise/expand button — only visible in expanded state
    var minBtn = document.createElement('div');
    minBtn.id = 'dotdotconf-self-view-minbtn';
    minBtn.title = 'Minimise';
    minBtn.style.cssText = `
      position: absolute; top: 6px; right: 6px;
      width: 22px; height: 22px; border-radius: 50%;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 13px; line-height: 1;
      transition: opacity 0.2s;
      z-index: 2;
    `;
    minBtn.textContent = '–';

    // Name label — only visible in expanded state
    var label = document.createElement('div');
    label.id = 'dotdotconf-self-view-label';
    label.style.cssText = `
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 4px 8px;
      background: linear-gradient(transparent, rgba(0,0,0,0.6));
      color: #fff; font-size: 11px; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      z-index: 2;
    `;
    label.textContent = `${name} (you)`;

    wrapper.appendChild(video);
    wrapper.appendChild(minBtn);
    wrapper.appendChild(label);
    document.body.appendChild(wrapper);

    // Apply initial state
    _applyDotConfSelfViewState(wrapper, minimised);

    // Toggle on click anywhere on the wrapper
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      var nowMinimised = !_isDotConfSelfViewMinimised();
      _setDotConfSelfViewMinimised(nowMinimised);
      _applyDotConfSelfViewState(wrapper, nowMinimised);
    });

    // Prevent the minimise button click bubbling twice
    minBtn.addEventListener('click', (e) => e.stopPropagation());

    return wrapper;
  }

  function _applyDotConfSelfViewState(wrapper, minimised) {
    var minBtn = wrapper.querySelector('#dotdotconf-self-view-minbtn');
    var label  = wrapper.querySelector('#dotdotconf-self-view-label');

    if (minimised) {
      // Circular dot — live video inside
      wrapper.style.width        = `${SELF_VIEW_MIN_SIZE}px`;
      wrapper.style.height       = `${SELF_VIEW_MIN_SIZE}px`;
      wrapper.style.borderRadius = '50%';
      wrapper.title              = 'Expand self-view';
      if (minBtn) minBtn.style.display = 'none';
      if (label)  label.style.display  = 'none';
    } else {
      // Expanded 16:9 rect
      wrapper.style.width        = `${SELF_VIEW_EXPANDED_W}px`;
      wrapper.style.height       = `${SELF_VIEW_EXPANDED_H}px`;
      wrapper.style.borderRadius = '12px';
      wrapper.title              = 'Click to minimise';
      if (minBtn) minBtn.style.display = 'flex';
      if (label)  label.style.display  = 'block';
    }
  }

  function _updateDotConfSelfViewStream(stream) {
    // Call when track changes (e.g. camera switch) — Phase 2+
    var video = document.querySelector('#dotconf-self-view video');
    if (video) video.srcObject = stream;
  }

  function _removeDotConfSelfView() {
    document.getElementById('dotconf-self-view')?.remove();
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Video tile layout — pre-render position override
  //
  // We override orchestrator.generateDotPositions() for conf at depth 2.
  // Promoted participants get tile center positions assigned upfront.
  // Their "dot size" passed to _repelPositions is the tile half-diagonal —
  // so the existing repulsion engine pushes all other dots away from tile
  // zones automatically. No post-render repositioning needed.
  //
  // The dot→rect morph is then a pure CSS transition on the same element
  // at the same position. Organic, no jumping.
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // Layout varants
  // ─────────────────────────────────────────────────────────────────────────────

  var TILE_ASPECT        = 16 / 9;
  var NOISE_FLOOR        = 0.08;
  var MORPH_HYSTERESIS   = 0.38;
  var HOST_CENTER_RADIUS = 135;
  var HOST_MIN_RECT_W    = 0.35;
  var MAX_RECTS          = 4;
  var MAX_FEED_DOTS      = 2;
  var FEED_DOT_SIZE      = 0.22;
  var STICKY_MS          = 2000;
  var CONFIRM_MS         = 600;
  var SNAPSHOT_INTERVAL  = 60000;   // note: 60_000 → 60000, numeric separators are ES2021
  var SNAPSHOT_W         = 320;
  var SNAPSHOT_H         = 180;

  // ── Frozen frame store ───────────────────────────────────────────────────────
  // displayID → data URL of last captured frame
  var _frozenFrames = {};

  // ── Snapshot canvas (reused, created once) ───────────────────────────────────
  let _snapshotCanvas = null;
  let _snapshotCtx    = null;

  function _getSnapshotCanvas() {
    if (!_snapshotCanvas) {
      _snapshotCanvas        = document.createElement('canvas');
      _snapshotCanvas.width  = SNAPSHOT_W;
      _snapshotCanvas.height = SNAPSHOT_H;
      _snapshotCtx           = _snapshotCanvas.getContext('2d');
    }
    return { canvas: _snapshotCanvas, ctx: _snapshotCtx };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Frame capture — lazy, event-driven + 60s insurance
  // ─────────────────────────────────────────────────────────────────────────────

  function _captureFrame(displayID, videoEl) {
    // Capture the current frame from a video element into _frozenFrames.
    // Low-resolution capture — shown as a dot background, not a billboard.
    if (!videoEl || videoEl.readyState < 2) return; // no frame available yet
    if (videoEl.videoWidth === 0) return;            // blank frame
    try {
      var { canvas, ctx } = _getSnapshotCanvas();
      ctx.drawImage(videoEl, 0, 0, SNAPSHOT_W, SNAPSHOT_H);
      _frozenFrames[displayID] = canvas.toDataURL('image/jpeg', 0.7);
      logger.debug('[dotconf] frame captured for', displayID);
    } catch (e) {
      // Cross-origin or security error — silently skip
    }
  }

  function _snapshotAllActiveFeeds() {
    // 60s insurance — snapshot every video element currently playing.
    // Runs only when the tab is visible to avoid wasted work.
    if (document.hidden) return;
    document.querySelectorAll('video.dotconf-tile-video').forEach(video => {
      var displayID = video.closest('[data-displayid]')?.dataset.displayid;
      if (displayID) _captureFrame(displayID, video);
    });
  }

  function _attachTrackEvents(displayID, videoEl) {
    // Wire capture triggers to a video element's track lifecycle.
    // Called when a track is attached in Phase 2.
    var track = videoEl.srcObject?.getVideoTracks()?.[0];
    if (!track) return;

    track.onmute = () => {
      // Track stopped sending — capture the last frame before it goes dark
      _captureFrame(displayID, videoEl);
      _applyFrozenStyle(displayID);
    };

    track.onunmute = () => {
      _removeFrozenStyle(displayID);
    };
  }

  function _initSnapshotScheduler() {
    // Visibility-based snapshot + 60s insurance.
    // Called once from install().
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) _snapshotAllActiveFeeds();
    });
    setInterval(_snapshotAllActiveFeeds, SNAPSHOT_INTERVAL);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Frozen frame styling
  // ─────────────────────────────────────────────────────────────────────────────

  function _applyFrozenStyle(displayID) {
    // Desaturate + blur the dot/tile to signal "stepped away"
    var el = _getDotElement(displayID);
    if (!el) return;

    var frozen = _frozenFrames[displayID];
    if (frozen) {
      el.style.backgroundImage    = `url(${frozen})`;
      el.style.backgroundSize     = 'cover';
      el.style.backgroundPosition = 'center';
    }

    el.style.filter     = 'grayscale(60%) brightness(0.85)';
    el.style.transition = 'filter 0.6s ease';
  }

  function _removeFrozenStyle(displayID) {
    // Restore live feed appearance
    var el = _getDotElement(displayID);
    if (!el) return;
    el.style.backgroundImage = '';
    el.style.filter          = '';
  }

  // ── Dot element cache — rebuilt after each render(), never queried per-tick ──
  var _dotElCache = new Map(); // displayID → dot element

  function _rebuildDotCache() {
    _dotElCache.clear();
    var canvas = document.getElementById('canvas-area');
    if (!canvas) return;
    canvas.querySelectorAll('.dot').forEach(dot => {
      if (dot.itemData?.displayID) _dotElCache.set(dot.itemData.displayID, dot);
    });
  }

  function _getDotElement(displayID) {
    // O(1) Map lookup — no DOM query
    return _dotElCache.get(displayID) || null;
  }

  


  // ─────────────────────────────────────────────────────────────────────────────
  // Contact list — stored as JSON array on host.contacts
  //
  // Shape of each contact:
  // {
  //   id:    string,   // client-generated UUID — stable key for dedup
  //   name:  string,
  //   email: string,   // optional
  //   phone: string    // optional
  // }
  //
  // Rules:
  // - At least one of email or phone required
  // - Deduped by email (if present) then phone — same person invited twice
  //   updates name, doesn't create a second entry
  // - Never deleted automatically — host manages their own list
  // ─────────────────────────────────────────────────────────────────────────────



  function _getAudioLevel(displayID) {
      var isLocal = displayID === _cachedMyId; // see note below
      if (isLocal) {
        var myAudioTrack = _localStream ? _localStream.getAudioTracks()[0] : null;
        if (!myAudioTrack) return 0;
        var track = _tracks[myAudioTrack.id];
        return track?.audioLevel || 0;
      }
      var rosterEntry = _roster[displayID];
      if (!rosterEntry) return 0;
      var track = _tracks[rosterEntry.audioTrackId];
      return track?.audioLevel || 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // generateDotPositions override — conf depth 2
  // ─────────────────────────────────────────────────────────────────────────────

  function _dotconfGeneratePositions(items, entityType, margin, orchestrator, originalFn) {
    if (orchestrator.currentApp?.id !== 'conf' ||
        orchestrator.currentPath?.length !== 2 ||
        entityType !== 'participant') {
      return originalFn(items, entityType, margin);
    }

    var canvas = document.getElementById('canvas-area');
    if (!canvas || !items || !items.length) return originalFn(items, entityType, margin);

    var W  = canvas.offsetWidth  || 800;
    var H  = canvas.offsetHeight || 600;
    var cx = W / 2, cy = H / 2;
    var m  = Math.max(margin || 0, 40);

    var hostDisplayID = _getHostDisplayID(orchestrator);
    // Keep the centre clear: the host's tile during a call, the "+" button before one.
    var hostP = items.find(it => it.displayID === hostDisplayID);
    var hostPreview = !orchestrator._dotconfCallLive && hostP &&
      (hostP.presenceState === 'live' || hostP.presenceState === 'audio_only') &&
      _dotconfIsViewer(orchestrator) && hostDisplayID !== _getMyDotConfParticipantDisplayID(orchestrator);
    var shorter = Math.min(W, H);
    // Clear centre for: the host's tile in a call, the host's preview tile, or just the "+" button.
    var keepOut = orchestrator._dotconfCallLive ? HOST_CENTER_RADIUS : (hostPreview ? shorter * 0.26 : 80);
    var rx = Math.max(keepOut + 20, cx - m);
    var ry = Math.max(keepOut + 20, cy - m);


    var hash = function(s) {
      var h = 0x811c9dc5;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
      return h;
    };
    var keyOf = (it, i) => String(it.displayID || it.ID || it.name || ('item_' + i));

    // Inner band: everyone who isn't gone. Outer band: people who have left.
    var inner = [], outer = [];
    items.forEach((it, i) => {
      if (it.displayID === hostDisplayID) return;
      (it.presenceState === 'left' ? outer : inner).push(i);
    });
    var byHash = (a, b) => hash(keyOf(items[a], a)) - hash(keyOf(items[b], b));
    inner.sort(byHash);
    outer.sort(byHash);

    var positions = new Array(items.length);
    var GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ~137.5°: successive points never line up

    // Sunflower spiral within the annulus band [t0, t1] (0 = edge of keep-out, 1 = canvas edge).
    function place(list, t0, t1, rotation) {
      var n = list.length;
      list.forEach((idx, k) => {
        var t = Math.sqrt(t0 * t0 + (t1 * t1 - t0 * t0) * (k + 0.5) / n); // area-uniform
        var a = rotation + k * GOLDEN;
        positions[idx] = {
          x: cx + Math.cos(a) * (keepOut + t * (rx - keepOut)),
          y: cy + Math.sin(a) * (keepOut + t * (ry - keepOut)),
          _isHost: false
        };
      });
    }

    if (inner.length && outer.length) {
      place(inner, 0,    0.6, 0);
      place(outer, 0.75, 1,   Math.PI / 7); // offset so the two bands don't share spokes
    } else {
      place(inner.length ? inner : outer, 0, 1, 0);
    }

    // Host (and anything unplaced) → centre, keeping the array aligned with items.
    items.forEach((it, i) => {
      if (!positions[i]) positions[i] = { x: cx, y: cy, _isHost: it.displayID === hostDisplayID };
    });
    return positions;
  }
  

  // ─────────────────────────────────────────────────────────────────────────────
  // Video tile helpers
  // ─────────────────────────────────────────────────────────────────────────────

  function _attachVideoToTile(tileEl, displayID, videoTrackId, orchestrator) {
      var isLocal = orchestrator && displayID === _getMyDotConfParticipantDisplayID(orchestrator);

      var mediaStreamTrack;
      if (isLocal) {
        mediaStreamTrack = _localStream ? _localStream.getVideoTracks()[0] : null;
      } else {
        var trackEntry = _tracks[videoTrackId];
        mediaStreamTrack = trackEntry?.mediaStreamTrack;
      }
      if (!mediaStreamTrack) return;

      let video = tileEl.querySelector('video.dotconf-tile-video');
      if (!video) {
        video             = document.createElement('video');
        video.className   = 'dotconf-tile-video';
        video.autoplay    = true;
        video.playsInline = true;
        video.muted       = isLocal ? true : false;
        video.style.cssText = `
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover; border-radius: inherit; z-index: 1;
          ${isLocal ? 'transform: scaleX(-1);' : ''}
        `;
        tileEl.setAttribute('data-displayid', displayID);
        tileEl.appendChild(video);
      }
      
      _dotconfEnsureTileLabel(tileEl, displayID, orchestrator);

      // Only touch srcObject if the underlying TRACK changed — not on every
      // resize tick. Comparing the track itself (not a freshly-wrapped
      // MediaStream, which is never === across calls) avoids restarting
      // playback dozens of times per second once audio-driven resizing
      // started actually firing.
      var currentTrack = video.srcObject?.getVideoTracks?.()[0];
      if (currentTrack !== mediaStreamTrack) {
        var stream = new MediaStream([mediaStreamTrack]);
        video.srcObject = stream;
        if (!isLocal) _attachTrackEvents(displayID, video);
      }
  }

  function _removeTileVideo(tileEl) {
    var video = tileEl.querySelector('video.dotconf-tile-video');
    if (video) { video.srcObject = null; video.remove(); }
    
    tileEl.querySelector('.dotconf-tile-name')?.remove();
    tileEl.querySelector('.dotconf-tile-actions')?.remove();
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Hover: info card on dots, name label + host actions on video tiles,
  // and mic/camera state shared with everyone.
  // ─────────────────────────────────────────────────────────────────────────────

  var _mediaState      = {};   // participantDisplayID → { micMuted, cameraOff }
  var _hoverCardEl     = null;
  var _hoverCardPid    = null;
  var _hoverHideTimer  = null;
  var DOTCONF_IN_CALL  = ['joining', 'live', 'audio_only', 'listening'];

  function _dotconfReportMedia(orchestrator) {
    if (_cachedMyId) {
      _mediaState[_cachedMyId] = { micMuted: !!_micMuted, cameraOff: !!_cameraOff };
      _dotconfRefreshTileLabel(_cachedMyId);
    }
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf || !_mySessionId) return;
    _cfApi('POST /' + conf.displayID + '/participant/media?tenantId=' + _getTenantId(orchestrator),
      { sessionId: _mySessionId, micMuted: !!_micMuted, cameraOff: !!_cameraOff })
      .catch(e => console.warn('[dotconf] media state update failed:', e));
      
    _dotconfUploadSnapshot(orchestrator);     // fresh frame on camera-on, clears it on camera-off
  }

  // ── Status text ───────────────────────────────────────────────────────────────

  function _dotconfAgo(ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60); if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }

  function _dotconfDuration(ts) {
    var m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  }

  function _dotconfStatusText(p) {
    switch (p.presenceState) {
      case 'added':   return 'Not invited yet';
      case 'invited': return 'Invited' + (p.invitedAt ? ' ' + _dotconfAgo(p.invitedAt) : '');
      case 'viewed':  return 'Opened the link' + (p.viewedAt ? ' ' + _dotconfAgo(p.viewedAt) : '');
      case 'joining': return 'Joining…';
      case 'live': case 'audio_only': case 'listening':
        return 'In the call' + (p.joinedAt ? ' · ' + _dotconfDuration(p.joinedAt) : '');
      case 'left':
        return 'Left' + (p.leftAt ? ' at ' + new Date(p.leftAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
      default: return '';
    }
  }

  // ── Entry point (called by the orchestrator's hover listener) ────────────────

  function _dotconfOnDotHover(orchestrator, dot, item) {
    if (!dot || !item || !item.displayID) return;
    if (!dot.matches(':hover')) return; // pointer already left during the hover delay
    var isTile = dot.dataset.morphed === 'true' || dot.dataset.tier === 'feedDot';
    if (isTile) _dotconfShowTileActions(orchestrator, dot, item.displayID);
    else        _dotconfShowCard(orchestrator, dot, item.displayID);
  }

  // ── Card on presence dots ─────────────────────────────────────────────────────

  function _dotconfShowCard(orchestrator, dot, pid) {
    var conf = _getCurrentDotConf(orchestrator);
    var p = (conf?.participants || []).find(x => x.displayID === pid);
    if (!p) return;
    _dotconfHideCard();

    var isMe   = pid === _getMyDotConfParticipantDisplayID(orchestrator);
    var inCall = DOTCONF_IN_CALL.includes(p.presenceState);
    var media  = _mediaState[pid] || {};

    var card = document.createElement('div');
    card.id = 'dotconf-hover-card';
    card.setAttribute('role', 'tooltip');
    card.style.cssText = 'position:fixed;z-index:1200;min-width:180px;max-width:260px;background:#fff;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.18);padding:10px 12px;font-size:13px;color:#2d3436;';

    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:6px;';
    var nameEl = document.createElement('div');
    nameEl.textContent = (p.name || 'Unnamed') + (isMe ? ' (You)' : '');
    nameEl.style.cssText = 'font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    head.appendChild(nameEl);
    if (p.isHost) {
      var chip = document.createElement('span');
      chip.textContent = 'Host';
      chip.style.cssText = 'font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;background:#eef2ff;color:#4c6ef5;';
      head.appendChild(chip);
    }
    card.appendChild(head);

    var status = document.createElement('div');
    status.textContent = _dotconfStatusText(p);
    status.style.cssText = 'margin-top:3px;font-size:12px;color:#636e72;';
    card.appendChild(status);

    if (inCall && (media.micMuted || media.cameraOff)) {
      var m = document.createElement('div');
      m.textContent = [media.micMuted ? '🔇 Muted' : '', media.cameraOff ? '📷 Camera off' : ''].filter(Boolean).join(' · ');
      m.style.cssText = 'margin-top:4px;font-size:12px;color:#2d3436;';
      card.appendChild(m);
    }

    if (orchestrator.isDataOwner() && !p.isHost && !isMe) {
      var actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:6px;margin-top:10px;';
      if (inCall && orchestrator._dotconfCallLive) {
        actions.appendChild(_dotconfCardButton('Pin', false, () => {
          _dotconfHideCard();
          _dotconfPinParticipant(orchestrator, pid);
        }));
      }
      actions.appendChild(_dotconfCardButton('Remove', true, () => {
        _dotconfHideCard();
        _dotconfConfirmRemove(orchestrator, p);
      }));
      card.appendChild(actions);
    }

    document.body.appendChild(card);
    _dotconfPositionCard(card, dot);
    _hoverCardEl = card;
    _hoverCardPid = pid;

    card.addEventListener('mouseenter', () => clearTimeout(_hoverHideTimer));
    card.addEventListener('mouseleave', _dotconfScheduleHide);
    if (!dot.dataset.dotconfHoverOut) {
      dot.dataset.dotconfHoverOut = '1';
      dot.addEventListener('mouseleave', _dotconfScheduleHide);
    }
    setTimeout(() => document.addEventListener('pointerdown', _dotconfOutsideTap), 0);
  }

  function _dotconfCardButton(label, danger, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'flex:1;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;' +
      (danger ? 'border:1px solid #ffc9c9;background:#fff5f5;color:#e03131;'
              : 'border:1px solid #dfe6e9;background:#fff;color:#2d3436;');
    b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    return b;
  }

  function _dotconfPositionCard(card, dot) {
    var r = dot.getBoundingClientRect();
    var cw = card.offsetWidth, ch = card.offsetHeight, pad = 8;
    var left = r.right + 10;
    if (left + cw > window.innerWidth - pad) left = r.left - cw - 10;
    left = Math.max(pad, Math.min(window.innerWidth - cw - pad, left));
    var top = r.top + r.height / 2 - ch / 2;
    top = Math.max(pad, Math.min(window.innerHeight - ch - pad, top));
    card.style.left = left + 'px';
    card.style.top  = top + 'px';
  }

  function _dotconfScheduleHide() {
    clearTimeout(_hoverHideTimer);
    _hoverHideTimer = setTimeout(_dotconfHideCard, 200); // time to move the pointer into the card
  }

  function _dotconfOutsideTap(e) {
    if (_hoverCardEl && !_hoverCardEl.contains(e.target)) _dotconfHideCard();
  }

  function _dotconfHideCard() {
    clearTimeout(_hoverHideTimer);
    document.removeEventListener('pointerdown', _dotconfOutsideTap);
    if (_hoverCardEl) { _hoverCardEl.remove(); _hoverCardEl = null; _hoverCardPid = null; }
  }

  function _dotconfRefreshCard(orchestrator, pid) {
    if (!_hoverCardEl || _hoverCardPid !== pid) return;
    var dot = _getDotElement(pid);
    if (dot && dot.matches(':hover')) _dotconfShowCard(orchestrator, dot, pid);
  }

  // ── Video tiles: name label + host actions ────────────────────────────────────

  function _dotconfEnsureTileLabel(tileEl, pid, orchestrator) {
    var label = tileEl.querySelector('.dotconf-tile-name');
    if (!label) {
      label = document.createElement('div');
      label.className = 'dotconf-tile-name';
      tileEl.appendChild(label);
    }
    var isFeedDot = tileEl.dataset.tier === 'feedDot';
    label.style.cssText = 'position:absolute;bottom:6px;z-index:2;max-width:calc(100% - 12px);padding:2px 8px;border-radius:10px;background:rgba(0,0,0,0.55);color:#fff;font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;' +
      (isFeedDot ? 'left:50%;transform:translateX(-50%);' : 'left:6px;');
    label.dataset.pid  = pid;
    label.dataset.name = _dotconfNameOf(orchestrator, pid) +
      (pid === _getMyDotConfParticipantDisplayID(orchestrator) ? ' (You)' : '');
    _dotconfPaintLabel(label);
  }

  function _dotconfPaintLabel(label) {
    var m = _mediaState[label.dataset.pid] || {};
    label.textContent = (m.micMuted ? '🔇 ' : '') + label.dataset.name;
  }

  function _dotconfRefreshTileLabel(pid) {
    if (!pid) return;
    var tile = _getDotElement(pid);
    var label = tile && tile.querySelector('.dotconf-tile-name');
    if (label) _dotconfPaintLabel(label);
  }

  function _dotconfShowTileActions(orchestrator, tile, pid) {
    if (!orchestrator.isDataOwner()) return;
    if (pid === _getMyDotConfParticipantDisplayID(orchestrator)) return;
    var conf = _getCurrentDotConf(orchestrator);
    var p = (conf?.participants || []).find(x => x.displayID === pid);
    if (!p || p.isHost || tile.querySelector('.dotconf-tile-actions')) return;

    var box = document.createElement('div');
    box.className = 'dotconf-tile-actions';
    box.style.cssText = 'position:absolute;top:6px;right:6px;z-index:3;display:flex;gap:4px;';
    box.appendChild(_dotconfTileIconBtn('Pin ' + (p.name || ''),
      '<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>',
      () => _dotconfPinParticipant(orchestrator, pid)));
    box.appendChild(_dotconfTileIconBtn('Remove ' + (p.name || ''),
      '<path d="M18 6 6 18M6 6l12 12"/>',
      () => _dotconfConfirmRemove(orchestrator, p)));
    tile.appendChild(box);

    if (!tile.dataset.dotconfActionsOut) {
      tile.dataset.dotconfActionsOut = '1';
      tile.addEventListener('mouseleave', () => tile.querySelector('.dotconf-tile-actions')?.remove());
    }
  }

  function _dotconfTileIconBtn(label, paths, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
    b.style.cssText = 'width:26px;height:26px;border-radius:50%;border:none;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    return b;
  }

  // ── Remove participant ────────────────────────────────────────────────────────

  function _dotconfConfirmRemove(orchestrator, p) {
    if (document.getElementById('dotconf-remove-confirm')) return;
    var inCall = DOTCONF_IN_CALL.includes(p.presenceState);

    var overlay = document.createElement('div');
    overlay.id = 'dotconf-remove-confirm';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px;';
    var dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.style.cssText = 'background:#fff;border-radius:12px;padding:24px;width:100%;max-width:300px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.25);';

    var title = document.createElement('div');
    title.textContent = 'Remove ' + (p.name || 'this participant') + '?';
    title.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:8px;color:#1a1a1a;';
    var sub = document.createElement('div');
    sub.textContent = inCall
      ? "They'll be disconnected from the call and removed from this conference."
      : "They'll be removed from this conference and won't be able to join with this link.";
    sub.style.cssText = 'font-size:13px;color:#636e72;margin-bottom:20px;line-height:1.4;';

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;';
    var close = () => overlay.remove();
    var cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'flex:1;padding:10px 0;border-radius:8px;border:1px solid #ddd;background:#fff;color:#333;cursor:pointer;font-size:14px;';
    cancel.onclick = close;
    var go = document.createElement('button');
    go.textContent = 'Remove';
    go.style.cssText = 'flex:1;padding:10px 0;border-radius:8px;border:none;background:#e03131;color:#fff;cursor:pointer;font-size:14px;font-weight:600;';
    go.onclick = async () => {
      go.disabled = true;
      try {
        var conf = _getCurrentDotConf(orchestrator);
        await _cfApi('POST /' + conf.displayID + '/participant/remove?tenantId=' + _getTenantId(orchestrator),
          { participantDisplayID: p.displayID });
        close();
        _dotconfHandleRemoved(orchestrator, p.displayID); // SSE echo will also arrive; handler is idempotent
      } catch (e) {
        console.error('[dotconf] remove participant failed:', e);
        _showError('Could not remove participant — please try again.');
        go.disabled = false;
      }
    };
    row.append(cancel, go);
    dialog.append(title, sub, row);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }

  function _dotconfHandleRemoved(orchestrator, pid) {
    var conf = _getCurrentDotConf(orchestrator);
    var isMe = pid === _getMyDotConfParticipantDisplayID(orchestrator);

    if (conf && Array.isArray(conf.participants)) {
      var i = conf.participants.findIndex(p => p.displayID === pid);
      if (i !== -1) conf.participants.splice(i, 1);
    }
    delete _roster[pid];
    delete _mediaState[pid];
    if (_hoverCardPid === pid) _dotconfHideCard();
    var dot = _getDotElement(pid);
    if (dot) { dot.remove(); _dotElCache.delete(pid); }

    if (isMe) {
      if (orchestrator._dotconfCallLive) _leaveDotConf(orchestrator);
      try {
        var contexts = JSON.parse(localStorage.getItem('savedContexts') || '{}');
        delete contexts['dotconf_participant_' + (conf && conf.displayID)];
        localStorage.setItem('savedContexts', JSON.stringify(contexts));
      } catch (_) {}
      if (typeof orchestrator.showNotification === 'function') {
        orchestrator.showNotification('The host removed you from this conference.');
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Live preview for people viewing the page before joining: each person in the
  // call uploads a tiny frame every 30s; viewers see it blurred under TV static.
  // ─────────────────────────────────────────────────────────────────────────────

  var SNAP_UPLOAD_MS     = 30000;
  var SNAP_W = 96, SNAP_H = 54;            // privacy by resolution — can't be sharpened back
  var _snapUploadTimer   = null;
  var _snapInputHandler = null; // pointerdown listener that captures a snapshot during user input
  var _lastSnapAt = 0;          // time of the last successful capture, for the 25 s cap
  var _pendingSnap = null;      // frame captured in the Join click, uploaded once the call is live
  var _snapCanvas        = null;
  var _snapVideoEl       = null;
  var _previewSnaps      = {};             // participantDisplayID → object URL
  var _previewFetchedAt  = {};

  // ── Upload side (people in the call) ──────────────────────────────────────────

  function _dotconfStartSnapshotUploads(orchestrator) {
    _dotconfStopSnapshotUploads();
    if (_pendingSnap) {
      _dotconfUploadSnapshot(orchestrator, _pendingSnap);
      _pendingSnap = null;
    } else {
      setTimeout(() => _dotconfUploadSnapshot(orchestrator), 1500);
    }
    // Timer works in most browsers; strict canvas protection blocks it, so also capture on clicks.
    _snapUploadTimer = setInterval(() => _dotconfUploadSnapshot(orchestrator), SNAP_UPLOAD_MS);
    _snapInputHandler = () => {
      if (Date.now() - _lastSnapAt > 25000) _dotconfUploadSnapshot(orchestrator);
    };
    document.addEventListener('pointerdown', _snapInputHandler, true);
  }

  function _dotconfStopSnapshotUploads() {
    clearInterval(_snapUploadTimer);
    _snapUploadTimer = null;
    if (_snapVideoEl) { _snapVideoEl.srcObject = null; _snapVideoEl.remove(); _snapVideoEl = null; }
    if (_snapInputHandler) { document.removeEventListener('pointerdown', _snapInputHandler, true); _snapInputHandler = null; }
  }

  function _dotconfSnapVideo() {
    if (!_snapVideoEl) {
      _snapVideoEl = document.createElement('video');
      _snapVideoEl.muted = true;
      _snapVideoEl.playsInline = true;
      _snapVideoEl.autoplay = true;
      _snapVideoEl.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(_snapVideoEl); // attached, so every browser keeps decoding frames
    }
    if (_snapVideoEl.srcObject !== _localStream) {
      _snapVideoEl.srcObject = _localStream;
      _snapVideoEl.play().catch(() => {});
    }
    return _snapVideoEl;
  }

  var _pendingSnap = null; // captured during the Join click, uploaded once the call is up

  // Returns a JPEG data URL, or null if the frame isn't ready or the canvas read was blocked.
  function _dotconfCaptureFrame(videoEl) {
    if (!videoEl || videoEl.readyState < 2) return null;
    if (!_snapCanvas) {
      _snapCanvas = document.createElement('canvas');
      _snapCanvas.width = SNAP_W;
      _snapCanvas.height = SNAP_H;
    }
    try {
      _snapCanvas.getContext('2d').drawImage(videoEl, 0, 0, SNAP_W, SNAP_H);
      var data = _snapCanvas.toDataURL('image/jpeg', 0.6);
      return data && data.length >= 1500 ? data : null; // a blocked/blank canvas encodes to a tiny uniform JPEG
    } catch (e) {
      return null;
    }
  }

  function _dotconfUploadSnapshot(orchestrator, preCaptured) {
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf || !_mySessionId || !orchestrator._dotconfCallLive) return;
    var url   = 'POST /' + conf.displayID + '/participant/snapshot?tenantId=' + _getTenantId(orchestrator);
    var track = _localStream && _localStream.getVideoTracks()[0];

    if (_cameraOff || !track || track.readyState !== 'live') {
      _cfApi(url, { sessionId: _mySessionId, clear: true }).catch(() => {});
      return;
    }
    var data = preCaptured || _dotconfCaptureFrame(_dotconfSnapVideo());
    if (!data) return;
    _lastSnapAt = Date.now();
    _cfApi(url, { sessionId: _mySessionId, image: data })
      .catch(e => console.warn('[dotconf] snapshot upload failed:', e));
  }

  // ── Viewer side (on the page, not in the call) ───────────────────────────────

  function _dotconfIsViewer(orchestrator) {
    if (orchestrator._dotconfCallLive) return false;
    return orchestrator.isDataOwner() ||
      (typeof orchestrator.dotconfIsIdentified === 'function' && orchestrator.dotconfIsIdentified(orchestrator));
  }

  async function _dotconfFetchSnapshot(orchestrator, pid) {
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf) return;
    _previewFetchedAt[pid] = Date.now();
    var myId = _getMyDotConfParticipantDisplayID(orchestrator);
    var qs = 'tenantId=' + encodeURIComponent(_getTenantId(orchestrator)) +
             (myId ? '&viewer=' + encodeURIComponent(myId) : '');
    try {
      var resp = await fetch('/newauth/api/conf/' + conf.displayID + '/participant/' + pid + '/snapshot?' + qs,
                             { credentials: 'same-origin', cache: 'no-store' });
      if (resp.status === 404) { _dotconfDropSnapshot(pid); _dotconfRenderPreviews(orchestrator); return; }
      if (!resp.ok) return;
      var blob = await resp.blob();
      if (_previewSnaps[pid]) URL.revokeObjectURL(_previewSnaps[pid]);
      _previewSnaps[pid] = URL.createObjectURL(blob);
      _dotconfRenderPreviews(orchestrator);
    } catch (e) {
      console.warn('[dotconf] snapshot fetch failed for', pid, e);
    }
  }

  function _dotconfDropSnapshot(pid) {
    if (_previewSnaps[pid]) URL.revokeObjectURL(_previewSnaps[pid]);
    delete _previewSnaps[pid];
  }

  function _dotconfRenderPreviews(orchestrator) {
    if (orchestrator._dotconfCallLive || !_dotconfIsViewer(orchestrator)) { _dotconfClearAllPreviews(); return; }
    _dotconfEnsureTvStyle();
    var conf   = _getCurrentDotConf(orchestrator);
    var canvas = document.getElementById('canvas-area');
    if (!conf || !canvas) return;

    var viewer  = _dotconfIsViewer(orchestrator);
    var myId    = _getMyDotConfParticipantDisplayID(orchestrator);
    var hostId  = _getHostDisplayID(orchestrator);
    var shorter = Math.min(canvas.offsetWidth || 800, canvas.offsetHeight || 600);
    
    function _dotconfPlaceAt(dot, w, h, cx, cy) {
      dot.style.width  = w + 'px';
      dot.style.height = h + 'px';
      dot.style.left   = (cx - w / 2) + 'px';
      dot.style.top    = (cy - h / 2) + 'px';
    }

    (conf.participants || []).forEach(p => {
      var dot = _getDotElement(p.displayID);
      if (!dot) return;
      var live = p.presenceState === 'live' || p.presenceState === 'audio_only';
      if (!viewer || !live || p.displayID === myId) { _dotconfClearPreview(dot); return; }

      // First look (page load, or just left the call): fetch, throttled.
      if (!_previewSnaps[p.displayID] && Date.now() - (_previewFetchedAt[p.displayID] || 0) > 25000) {
        _dotconfFetchSnapshot(orchestrator, p.displayID);
      }

      var isHost = p.displayID === hostId;
      var w = Math.round(shorter * (isHost ? 0.42 : 0.13));
      var h = isHost ? Math.round(w * 9 / 16) : w;
      if (isHost) _dotconfPlaceAt(dot, w, h, canvas.offsetWidth / 2, canvas.offsetHeight / 2);
      else        _dotconfResizeKeepCenter(dot, w, h);

      dot.classList.add('dotconf-preview');
      dot.style.setProperty('border-radius', isHost ? '14px' : '50%', 'important');
      dot.style.setProperty('background', '#1e272e', 'important');
      dot.style.setProperty('border', 'none', 'important');
      dot.style.setProperty('opacity', '0.92', 'important');
      dot.style.setProperty('color', '#fff', 'important');
      dot.style.removeProperty('filter');
      dot.querySelectorAll('.dot-label span').forEach(s => s.style.setProperty('color', '#fff', 'important'));

      var tv = dot.querySelector(':scope > .dotconf-tv');
      if (!tv) {
        tv = document.createElement('div');
        tv.className = 'dotconf-tv';
        tv.innerHTML = '<div class="dotconf-tv-img"></div><div class="dotconf-tv-noise"></div><div class="dotconf-tv-lines"></div>';
        dot.insertBefore(tv, dot.firstChild);
      }
      var src = _previewSnaps[p.displayID];
      tv.querySelector('.dotconf-tv-img').style.backgroundImage = src ? 'url(' + src + ')' : 'none';
      tv.classList.toggle('dotconf-tv-nosignal', !src || p.presenceState === 'audio_only');
    });
  }

  function _dotconfResizeKeepCenter(dot, w, h) {
    var cw = parseFloat(dot.style.width)  || dot.offsetWidth;
    var ch = parseFloat(dot.style.height) || dot.offsetHeight;
    if (Math.abs(cw - w) < 1 && Math.abs(ch - h) < 1) return;
    var left = parseFloat(dot.style.left) || 0;
    var top  = parseFloat(dot.style.top)  || 0;
    dot.style.width  = w + 'px';
    dot.style.height = h + 'px';
    dot.style.left   = (left + cw / 2 - w / 2) + 'px';
    dot.style.top    = (top  + ch / 2 - h / 2) + 'px';
  }

  function _dotconfClearPreview(dot) {
    if (!dot.classList.contains('dotconf-preview')) return;
    dot.classList.remove('dotconf-preview');
    dot.querySelector(':scope > .dotconf-tv')?.remove();
    ['width', 'height', 'left', 'top', 'border-radius', 'background',
     'border', 'opacity', 'color', 'filter'].forEach(p => dot.style.removeProperty(p));
    dot.querySelectorAll('.dot-label span').forEach(s => s.style.removeProperty('color'));
  }

  function _dotconfClearAllPreviews() {
    document.querySelectorAll('.dotconf-preview').forEach(_dotconfClearPreview);
  }


  // ── The "weak broadcast" look — pure CSS; static drawn with an SVG noise filter ─

  function _dotconfEnsureTvStyle() {
    if (document.getElementById('dotconf-tv-style')) return;
    var noise = "data:image/svg+xml;utf8," + encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>" +
      "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/>" +
      "<feColorMatrix type='saturate' values='0'/></filter>" +
      "<rect width='100%' height='100%' filter='url(#n)'/></svg>");

    var st = document.createElement('style');
    st.id = 'dotconf-tv-style';
    st.textContent = `
      .dotconf-tv { position:absolute; inset:0; border-radius:inherit; overflow:hidden; z-index:0; pointer-events:none; background:#1e272e; }
      .dotconf-preview .dot-label { position:relative; z-index:1; text-shadow:0 1px 3px rgba(0,0,0,0.8); }
      .dotconf-tv-img { position:absolute; inset:-14px; background-size:cover; background-position:center;
        filter:blur(7px) grayscale(35%) brightness(0.85); animation:dotconf-tv-jitter 6s steps(1) infinite; }
      .dotconf-tv-noise { position:absolute; inset:-50%; background-image:url("${noise}"); opacity:0.32;
        mix-blend-mode:screen; animation:dotconf-tv-snow 0.45s steps(1) infinite; }
      .dotconf-tv-nosignal .dotconf-tv-noise { opacity:0.6; }
      .dotconf-tv-lines { position:absolute; inset:0; opacity: 0.35;
        background:repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px);
        animation:dotconf-tv-roll 7s linear infinite; }
      .dotconf-preview { animation:dotconf-live-pulse 2.4s ease-in-out infinite; }
      @keyframes dotconf-tv-snow {
        0% { transform:translate(0,0); }        20% { transform:translate(-10%,6%); }
        40% { transform:translate(6%,-10%); }   60% { transform:translate(-6%,-4%); }
        80% { transform:translate(10%,8%); } }
      @keyframes dotconf-tv-jitter {
        0%, 95%, 100% { transform:translateX(0); }  96% { transform:translateX(-4px); }  97% { transform:translateX(3px); } }
      @keyframes dotconf-tv-roll {
        0%, 90%, 100% { transform:translateY(0); }  93% { transform:translateY(-3px); }  96% { transform:translateY(2px); } }
      @keyframes dotconf-live-pulse {
        0%, 100% { box-shadow:0 0 0 2px rgba(0,184,148,0.55); }  50% { box-shadow:0 0 0 7px rgba(0,184,148,0.12); } }
      @media (prefers-reduced-motion: reduce) {
        .dotconf-tv-img, .dotconf-tv-noise, .dotconf-tv-lines, .dotconf-preview { animation:none !important; } }
    `;
    document.head.appendChild(st);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Continuous audio-level sizing + morph
  //
  // Called on a 200ms interval while in-call.
  // Updates each participant's dot size based on smoothed audioLevel,
  // morphs to rect when above MORPH_THRESHOLD, back to dot below MORPH_HYSTERESIS.
  // Runs _repelPositions after size changes to keep dots from overlapping.
  // ─────────────────────────────────────────────────────────────────────────────


  function _startContinuousLayout(orchestrator) {
    if (_layoutInterval) return;
    _layoutInterval = setInterval(() => _tickLayout(orchestrator), 200);
  }

  function _stopContinuousLayout() {
    if (_layoutInterval) { clearInterval(_layoutInterval); _layoutInterval = null; }
  }

  let _maxSizeDelta = 0; // largest size change in last tick — drives repulsion gate

  // Slot holder state — displayID → timestamp when they last exceeded NOISE_FLOOR
  var _slotLastActive = {};
  
  var _hostDisplayLevel  = 0;    // eased level actually used for sizing
  var _hostLastPeakTime  = 0;    // last time we saw a rising level

  // Confirmation state — tracks how long a participant has been above NOISE_FLOOR
  // before we commit to a tier promotion.
  //
  // _speakingStarted: when they first crossed NOISE_FLOOR in this utterance
  // _speakingConfirmed: when they crossed CONFIRM_MS — morph is now allowed
  //
  // Upward transitions (presence→feedDot, feedDot→rect) require CONFIRM_MS.
  // Downward transitions (rect→feedDot, feedDot→presence) use STICKY_MS as before.
  var _speakingStarted   = {}; // displayID → timestamp of utterance start
  var _speakingConfirmed = {}; // displayID → timestamp of confirmation





  // ── Rank score — used to sort participants for slot allocation ──────────────
  // Confirmed speakers rank highest, then sticky holders, then by raw level.
  function _rankScore(displayID, level, now) {
    if (_speakingConfirmed[displayID]) {
      return level + 1.0; // confirmed — top of ranking
    }
    var lastActive = _slotLastActive[displayID] || 0;
    var dot        = _getDotElement(displayID);
    var wasActive  = (now - lastActive) < STICKY_MS && dot?.dataset.tier !== 'presence';
    if (wasActive) {
      return level + 0.5; // sticky — middle tier
    }
    return level;          // unconfirmed — ranked by raw level only
  }

  // ── Pulse animation during confirmation window ────────────────────────────
  // Shows a growing ring shadow on the dot as confirmation builds.
  // progress: 0 (just started) → 1 (about to confirm)
  function _pulseConfirming(dot, displayID, baseSize, progress, level) {
    // Ring grows from 0 to 16px spread as progress increases
    var ringSpread = Math.round(progress * 16);
    var ringAlpha  = (0.2 + progress * 0.4).toFixed(2);
    var ringColor  = `rgba(0, 184, 148, ${ringAlpha})`; // #00b894 at varying opacity

    // Dot size: tiny nudge upward as confirmation builds — not a full morph
    var size = baseSize * (1 + progress * 0.25);

    dot.style.boxShadow = `0 0 0 ${ringSpread}px ${ringColor}`;
    dot.style.width     = `${size}px`;
    dot.style.height    = `${size}px`;
    dot.style.transition = 'box-shadow 0.2s ease, width 0.2s ease, height 0.2s ease';
    dot.dataset.prevW    = size;
    dot.dataset.prevH    = size;
  }

  function _clearPulse(dot) {
    dot.style.boxShadow = '';
  }
  
  // Presence-dot styling (joining border, state colours, faded opacity) is set with
  // !important by _morphToPresenceDot. Clear it when a dot becomes a video tile so
  // the tile starts clean; _morphToPresenceDot re-applies it on the way back.
  function _clearPresenceStyling(dot) {
    ['border', 'background', 'color', 'opacity'].forEach(p => dot.style.removeProperty(p));
    dot.querySelectorAll('.dot-label span').forEach(span => {
      span.style.removeProperty('color');
      span.style.removeProperty('font-size');
    });
  }

  function _morphToRect(dot, displayID, w, h,  orchestrator) {
    _clearPulse(dot); // clear confirmation ring — morph is happening
    _clearPresenceStyling(dot);
    dot.dataset.morphed = 'true';
    dot.classList.remove('dot-fade-in');
    dot.style.animation = 'none';
    dot.style.setProperty('--dot-target-opacity', '1');
    dot.style.setProperty('opacity', '1', 'important');
    Object.assign(dot.style, {
      width:        `${w}px`,
      height:       `${h}px`,
      borderRadius: '12px',
      transition:   'width 0.3s ease, height 0.3s ease, border-radius 0.3s ease, left 0.3s ease, top 0.3s ease'
    });
    // Recentre — keep the center point fixed as the rect grows
    var currentLeft = parseFloat(dot.style.left) || 0;
    var currentTop  = parseFloat(dot.style.top)  || 0;
    var prevW       = parseFloat(dot.dataset.prevW) || w;
    var prevH       = parseFloat(dot.dataset.prevH) || h;
    dot.style.left    = `${currentLeft - (w - prevW) / 2}px`;
    dot.style.top     = `${currentTop  - (h - prevH) / 2}px`;
    dot.dataset.prevW = w;
    dot.dataset.prevH = h;

    // Phase 2: attach video if available
    var rosterEntry = _roster[displayID];
    if (rosterEntry?.videoTrackId) {
      _attachVideoToTile(dot, displayID, rosterEntry.videoTrackId, orchestrator);
    }
  }

  function _morphToDot(dot, displayID, size) {
    if (dot.dataset.morphed === 'true') {
      _removeTileVideo(dot);
      dot.dataset.morphed = 'false';
      dot.style.removeProperty('opacity');
      dot.style.removeProperty('animation');
      dot.style.removeProperty('--dot-target-opacity');
    }
    if (dot.dataset.tier === 'feedDot') {
      _removeTileVideo(dot);
      dot.dataset.tier = 'dot';
    }
    var currentLeft = parseFloat(dot.style.left) || 0;
    var currentTop  = parseFloat(dot.style.top)  || 0;
    var prevW       = parseFloat(dot.dataset.prevW) || size;
    var prevH       = parseFloat(dot.dataset.prevH) || size;
    dot.style.left    = `${currentLeft - (size - prevW) / 2}px`;
    dot.style.top     = `${currentTop  - (size - prevH) / 2}px`;
    Object.assign(dot.style, {
      width:        `${size}px`,
      height:       `${size}px`,
      borderRadius: '50%',
      transition:   'width 0.3s ease, height 0.3s ease, border-radius 0.3s ease, left 0.3s ease, top 0.3s ease'
    });
    dot.dataset.prevW = size;
    dot.dataset.prevH = size;
  }

  function _morphToFeedDot(dot, displayID, size, orchestrator) {
    // Large circle with live video playing inside.
    _clearPulse(dot); // clear confirmation ring
    _clearPresenceStyling(dot);
    if (dot.dataset.morphed === 'true') {
      dot.dataset.morphed = 'false';
      dot.style.removeProperty('opacity');
      dot.style.removeProperty('animation');
      dot.style.removeProperty('--dot-target-opacity');
    }
    dot.dataset.tier = 'feedDot';

    var currentLeft = parseFloat(dot.style.left) || 0;
    var currentTop  = parseFloat(dot.style.top)  || 0;
    var prevW       = parseFloat(dot.dataset.prevW) || size;
    var prevH       = parseFloat(dot.dataset.prevH) || size;
    dot.style.left    = `${currentLeft - (size - prevW) / 2}px`;
    dot.style.top     = `${currentTop  - (size - prevH) / 2}px`;

    Object.assign(dot.style, {
      width:        `${size}px`,
      height:       `${size}px`,
      borderRadius: '50%',           // stays circular
      overflow:     'hidden',
      transition:   'width 0.3s ease, height 0.3s ease, left 0.3s ease, top 0.3s ease'
    });
    dot.dataset.prevW = size;
    dot.dataset.prevH = size;

    // Attach video — same helper as rect, video fills the circle via object-fit: cover
    var rosterEntry = _roster[displayID];
    if (rosterEntry?.videoTrackId) {
      _attachVideoToTile(dot, displayID, rosterEntry.videoTrackId, orchestrator);
    }
  }

  function _morphToPresenceDot(dot, displayID, size, presenceState, instant, orchestrator, name) {
    _clearPulse(dot);
    if (dot.dataset.morphed === 'true') _removeTileVideo(dot);
    if (dot.dataset.tier === 'feedDot') _removeTileVideo(dot);
    dot.dataset.morphed = 'false';
    dot.style.removeProperty('opacity');
    dot.style.removeProperty('animation');
    dot.style.removeProperty('--dot-target-opacity');
    dot.dataset.tier    = 'presence';
   
    var currentLeft = parseFloat(dot.style.left) || 0;
    var currentTop  = parseFloat(dot.style.top)  || 0;
    var prevW       = parseFloat(dot.dataset.prevW) || size;
    var prevH       = parseFloat(dot.dataset.prevH) || size;
    dot.style.left    = `${currentLeft - (size - prevW) / 2}px`;
    dot.style.top     = `${currentTop  - (size - prevH) / 2}px`;
   
    var styleDef   = DOTCONF_PRESENCE_STYLES[presenceState] || DOTCONF_PRESENCE_STYLES.invited;
    var hashColor  = _dotconfNameColor(name);

    dot.classList.remove('dotconf-added');
    dot.style.backgroundImage = 'none';
    dot.style.filter = 'none';

    if (presenceState === PRESENCE_STATE.ADDED) {
      dot.classList.add('dotconf-added');
      dot.style.setProperty('background-color', 'transparent', 'important');
      dot.style.setProperty('background-image', 'none', 'important');
      dot.style.setProperty('border', '1px solid rgba(169,160,166,0.35)', 'important'); // lighter, less pronounced
      dot.style.setProperty('color', hashColor || styleDef.color, 'important');
      dot.style.setProperty('opacity', styleDef.opacity, 'important');

    } else if (presenceState === PRESENCE_STATE.INVITED) {
      dot.style.setProperty('background', hashColor || styleDef.background, 'important');
      dot.style.setProperty('border', 'none', 'important');
      dot.style.setProperty('color', '#fff', 'important');
      dot.style.setProperty('opacity', styleDef.opacity, 'important');

    } else {
      dot.style.setProperty('background', styleDef.background, 'important');
      dot.style.setProperty('border', styleDef.border, 'important');
      dot.style.setProperty('color', styleDef.color, 'important');
      dot.style.setProperty('opacity', styleDef.opacity, 'important');

      if (styleDef.useFrozenFrame) {
        var frozen = _frozenFrames[displayID];
        if (frozen) {
          dot.style.setProperty('background-image', `url(${frozen})`, 'important');
          dot.style.backgroundSize     = 'cover';
          dot.style.backgroundPosition = 'center';
          dot.style.filter = 'grayscale(40%) brightness(0.9)';
        }
      }
    }
    
    // .dot-label span hardcodes white text and shrinks each letter to
    // 0.35em/0.4em of the dot's own font-size — both silently override
    // whatever color/size we just set on the parent .dot, since a child's
    // own matching rule always wins over an inherited value regardless of
    // !important on the ancestor. Force both directly on the letter spans.
    var labelColor = dot.style.getPropertyValue('color');
    dot.querySelectorAll('.dot-label span').forEach(function(span) {
      span.style.setProperty('color', labelColor, 'important');
      span.style.setProperty('font-size', '1em', 'important');
    });
   
    var finalStyles = {
      width:        `${size}px`,
      height:       `${size}px`,
      borderRadius: '50%',
      fontSize:     `${Math.max(10, size * 0.32)}px`
    };
    // NEW — skip the transition for one-shot static passes (pre-call lobby
    // view) to avoid a visible double-animation against whatever the
    // platform's own initial paint already did. _tickLayout's live loop
    // still wants smooth transitions for audio-reactive resizing, so it
    // continues calling without this flag (defaults to animated).
    finalStyles.transition = instant
      ? 'none'
      : 'width 0.4s ease, height 0.4s ease, left 0.4s ease, top 0.4s ease';
   
    Object.assign(dot.style, finalStyles);
    dot.dataset.prevW = size;
    dot.dataset.prevH = size;
  }



  function _dotconfApplyStaticPresenceStyles(orchestrator) {
    console.log('[diag] entered, _dotconfCallLive:', orchestrator._dotconfCallLive);
    if (orchestrator._dotconfCallLive) { console.log('[diag] bailed — call is live'); return; }
   
    var conf = _getCurrentDotConf(orchestrator);
    console.log('[diag] conf:', conf, 'participants:', conf?.participants?.length);
    if (!conf?.participants) { console.log('[diag] bailed — no conf/participants'); return; }
   
    var canvas = document.getElementById('canvas-area');
    console.log('[diag] canvas element:', canvas);
    if (!canvas) { console.log('[diag] bailed — no canvas-area element found'); return; }
   
    var shorter    = Math.min(canvas.offsetWidth || 800, canvas.offsetHeight || 600);
    var minDotSize = shorter * 0.06;
    
    // Host never shows as a small presence dot pre-call — it's only ever the
    // center tile once live. The generic renderer still creates a normal dot
    // for host (needed so repulsion math keeps other dots clear of that
    // position), so remove it here rather than fighting positions/array
    // alignment upstream.
    var hostDisplayID = _getHostDisplayID(orchestrator);
    var hostP = conf.participants.find(p => p.displayID === hostDisplayID);
    var hostPreviewed = _dotconfIsViewer(orchestrator) && hostP &&
      (hostP.presenceState === 'live' || hostP.presenceState === 'audio_only') &&
      hostDisplayID !== _getMyDotConfParticipantDisplayID(orchestrator);
    if (hostDisplayID && !hostPreviewed) {
      var hostDot = _getDotElement(hostDisplayID);
      if (hostDot) {
        hostDot.remove();
        if (typeof _dotElCache !== 'undefined') _dotElCache.delete(hostDisplayID);
      }
    }
   
    conf.participants.forEach(p => {
      var isLive = p.presenceState === 'live' || p.presenceState === 'audio_only';
      if (isLive) return;
   
      var dot = _getDotElement(p.displayID);
      if (p.displayID === '1an9ww2piuo46') { // P7 — swap in the real value if it changed
        console.log('[diag] P7 — dot element:', dot, 'presenceState:', p.presenceState);
      }
      if (!dot) return;
      _morphToPresenceDot(dot, p.displayID, minDotSize, p.presenceState, true, orchestrator, p.name);
    });
   
    _dotconfRenderPreviews(orchestrator);
    console.log('[diag] finished loop');
  }


  let _lastRepelTime = 0;
  function _repelIfNeeded(orchestrator, canvas, W, H) {
      var now = Date.now();
      if (now - _lastRepelTime < 200) return;
      _lastRepelTime = now;

      var hostDisplayID = _getHostDisplayID(orchestrator);
      var hostDot       = hostDisplayID ? _getDotElement(hostDisplayID) : null;

      // Exclude the host's own dot by reference — it's the fixed centerObstacle,
      // not a movable participant. Including it let the center-obstacle loop
      // push it away from its own position (dist≈0 → arbitrary direction from
      // floating-point noise), and let dot-dot collision move it too.
      var dots = [...canvas.querySelectorAll('.dot:not(.dot-bg)')]
        .filter(d => d !== hostDot);

      if (dots.length < 2) return;

      var positions = dots.map(d => ({
        x: parseFloat(d.style.left) + parseFloat(d.style.width)  / 2,
        y: parseFloat(d.style.top)  + parseFloat(d.style.height) / 2
      }));

      var sizes = dots.map(d => {
        var w = parseFloat(d.style.width)  || 20;
        var h = parseFloat(d.style.height) || 20;
        return d.dataset.morphed === 'true'
          ? Math.sqrt(w * w + h * h) / 2
          : w / 2;
      });

      var centerObstacle = hostDot && hostDot.itemData?.presenceState === 'live'
        ? { x: W / 2, y: (canvas.offsetHeight || H) / 2, r: HOST_CENTER_RADIUS }
        : null;

      orchestrator._repelPositions(positions, sizes, W, canvas.offsetHeight || H, 16, centerObstacle);

      dots.forEach((dot, i) => {
        var w = parseFloat(dot.style.width)  || 20;
        var h = parseFloat(dot.style.height) || 20;
        dot.style.left = `${positions[i].x - w / 2}px`;
        dot.style.top  = `${positions[i].y - h / 2}px`;
      });
  }

  function _getHostDisplayID(orchestrator) {
    // The host is the participant whose displayID matches the hostUUID in the path
    // They created the conference — their participant entity was added by themselves
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf?.participants) return null;
    // Host participant has presenceState that was set first, or we can match
    // against the tenantId (host displayID) stored in currentPath[0]
    var tenantDisplayID = orchestrator.currentPath?.[0]?.displayID;
    return conf.participants.find(p =>
      p.displayID === tenantDisplayID ||
      p.isHost === true
    )?.displayID || null;
  }
  
  function _createHostCenterTile(hostDisplayID, hostLabel, hostColor) {
    var canvas = document.getElementById('canvas-area');
    if (canvas) {
      canvas.querySelectorAll('[data-displayid="' + hostDisplayID + '"]').forEach(el => el.remove());
    }

    var dot = document.createElement('div');
    dot.className = 'dot dot-fade-in';
    dot.dataset.displayid = hostDisplayID;

    // Critical: _rebuildDotCache() scans for `.itemData.displayID` (a JS
    // property the platform's own renderer sets on dots it creates) to
    // repopulate _dotElCache after every render(). Without this, our
    // manually-created tile is invisible to that scan — it gets orphaned
    // from the cache on the next rebuild, _tickLayout thinks it doesn't
    // exist, and creates a second one. Setting this makes our tile survive
    // the same rebuild cycle as every platform-created dot.
    dot.itemData = { displayID: hostDisplayID };

    dot.style.cssText = `
      position: absolute;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: ${hostColor || '#888'};
      color: #fff; font-weight: bold;
      overflow: hidden;
      left: 0px; top: 0px;
      width: 20px; height: 20px;
      z-index: 11;
    `;
    dot.textContent = hostLabel || '';

    if (canvas) canvas.appendChild(dot);

    _dotElCache.set(hostDisplayID, dot);
    return dot;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Install
  // ─────────────────────────────────────────────────────────────────────────────

  function install(orchestrator) {

    // ── Override generateDotPositions for conf depth 2 ───────────────────────
    var _originalGeneratePositions = orchestrator.generateDotPositions.bind(orchestrator);
    orchestrator.generateDotPositions = function(items, entityType, margin) {
      return _dotconfGeneratePositions(items, entityType, margin, this, _originalGeneratePositions);
    };
    
    var _originalStartPolling = orchestrator.startVersionPolling.bind(orchestrator);
    orchestrator.startVersionPolling = function() {
        if (this.currentApp &&
            this.currentApp.id === 'conf' &&
            this.currentPath.length === 2) {
            console.log('[dotconf] startVersionPolling suppressed — SSE active');
            return;
        }
        _originalStartPolling();
    };
    
    var _originalResolveDotColor = orchestrator._resolveDotColor.bind(orchestrator);
    orchestrator._resolveDotColor = function(item, entityType) {
        if (this.currentApp && 
            this.currentApp.id === 'conf' && 
            entityType === 'participant') {
            // Skip Priority 0 (metadata.displayConfig.color) for conf participants
            // so typeBehaviorMap drives the color from presenceState
            if (item && !item.presenceState) {
                item.presenceState = 'invited';
            }
            var entityConfig = this.currentApp.entityConfigs &&
                               this.currentApp.entityConfigs[entityType];
            var typeField = entityConfig && entityConfig.typeField;
            var mapName   = entityConfig && entityConfig.typeBehaviorMap;
            var behaviorMap = mapName && this.currentApp[mapName];
            var typeValue   = typeField && item[typeField];
            if (typeValue && behaviorMap && behaviorMap[typeValue] && behaviorMap[typeValue].color) {
                return behaviorMap[typeValue].color;
            }
        }
        return _originalResolveDotColor(item, entityType);
    };

    // ── Start lazy frame snapshot scheduler ──────────────────────────────────
    _initSnapshotScheduler();

    Object.assign(orchestrator, {
      // Exposed so the orchestrator's init can call preComputeScore
      preComputeScore,

      dotconfRebuildCache: (o) => _rebuildDotCache(),
      // DotConf lifecycle — called from context bar buttons (Phase 2+)
      dotconfJoin:        (o)  => _startDotConfPreview(o || orchestrator),
      dotconfLeave:       (o)  => _leaveDotConf(o || orchestrator),
      dotconfSyncAddButton: (o) => _dotconfSyncAddButton(o || orchestrator),
      dotconfEndCall:     (o)  => _dotconfConfirmEndCall(o || orchestrator),

      // Recording — called from host context bar (Phase 4)
      dotconfStartRecord: (o)  => _startRecording(o || orchestrator),
      dotconfStopRecord:  ()   => _stopRecording(),

      // SSE — opened when a user lands at dotconf depth
      dotconfOpenSSE:     (o, tenantId, confDisplayID, participantDisplayID) => _openSSE(o || orchestrator, tenantId, confDisplayID, participantDisplayID),
      dotconfCloseSSE:    ()  => _closeSSE(),

      // Presence
      dotconfMarkViewed:  (o)  => _markDotConfViewed(o || orchestrator),
      
      _dotconfHookParticipantEmail: (o) => _hookParticipantEmail(o || orchestrator),

      // Internal helpers exposed for testing
      _getTenantId,
      _dotconfMetaOnly,
      _getCurrentDotConf,
      _getDotConfUserId,
      _getMyDotConfParticipantDisplayID,
      _saveDotConfContext,

      // Contact list
      dotconfGetContacts:                    (o) => _getDotConfContacts(o || orchestrator),
      dotconfUpsertContact:                  (o, contact) => _upsertDotConfContact(o || orchestrator, contact),
      dotconfRemoveContact:                  (o, id) => _removeDotConfContact(o || orchestrator, id),
      dotconfContactsAsParticipantDefaults:  (o) => _dotconfContactsAsParticipantDefaults(_getDotConfContacts(o || orchestrator)),

      // Participant identification
      dotconfIsIdentified:                   (o) => _isDotConfIdentified(o || orchestrator),
      dotconfRenderIdentifyUI:               (o) => _renderDotConfIdentifyUI(o || orchestrator),
      dotconfMatchParticipants:              (o, q) => _matchDotConfParticipants(o || orchestrator, q),
      
      // CLoudflare-PIN
      dotconfStartLayout:    (o) => dotconfStartLayout(o || orchestrator),
      dotconfStopLayout:     ()  => dotconfStopLayout(),
      dotconfPinParticipant: (o, participantDisplayID) => _dotconfPinParticipant(o || orchestrator, participantDisplayID),
      dotconfHandleInviteClick: (o) => _dotconfHandleInviteClick(o || orchestrator),
      dotconfShouldShowInviteButton: (o) => _dotconfShouldShowInviteButton(o || orchestrator),
      dotconfApplyStaticPresenceStyles: (o) => _dotconfApplyStaticPresenceStyles(o || orchestrator),

      // Self-view
      dotconfRenderSelfView:                 (stream, name) => _renderDotConfSelfView(stream, name),
      dotconfUpdateSelfViewStream:           (stream) => _updateDotConfSelfViewStream(stream),
      dotconfRemoveSelfView:                 () => _removeDotConfSelfView(),
      _dotconfReady: true,
      dotconfOnDotHover: (dot, item) => _dotconfOnDotHover(orchestrator, dot, item)
    });

    
    console.log("[dotconf] ext.js installed");
  }
  
  window.addEventListener('online', () => {
    if (_peerConnection && _peerConnection.connectionState !== 'closed' &&
        _peerConnection.connectionState !== 'new') {
      console.log('[dotconf] network back online — restarting ICE');
      _peerConnection.restartIce();
    }
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────────────────────────────────────

  if (window.app) {
      install(window.app);
      _dotconfInstallHostParticipantHook(window.app);
  } else {
      window.addEventListener('orchestratorReady', function(e) {
          install(e.detail || window.app);
          _dotconfInstallHostParticipantHook(e.detail || window.app);
      });
  }
  
  // TEMP diagnostic — remove after debugging
  window.__dotconfDiag = function() {
    var pc = _peerConnection;
    return {
      myId:       _cachedMyId,
      mySession:  _mySessionId,
      midMap:     Object.assign({}, _midToTrackName),
      roster:     Object.fromEntries(Object.entries(_roster).map(([id, r]) =>
                    [id, { audio: r.audioTrackId, video: r.videoTrackId, session: r.cfSessionId,
                           videoSubscribed: !!r._videoSubscribed, videoMid: r._videoMid }])),
      trackKeys:  Object.keys(_tracks),
      transceivers: pc ? pc.getTransceivers().map(t => ({
                    mid: t.mid, dir: t.currentDirection,
                    kind: t.receiver.track && t.receiver.track.kind,
                    recvTrackId: t.receiver.track && t.receiver.track.id })) : null
    };
  };

})();


