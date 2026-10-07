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
    left:       { background: '#dfe6e9',     border: 'none',              color: '#b2bec3',  opacity: 0.5, useFrozenFrame: false }
  };


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

    _sseSource.addEventListener("participant.viewed", e => {
      var { participantDisplayID } = JSON.parse(e.data);
      _updateParticipantPresence(orchestrator, participantDisplayID, PRESENCE_STATE.VIEWED);
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

     _sseSource.addEventListener("roster", e => {
       var payload = JSON.parse(e.data);

       (payload.participants || []).forEach(p => {
         _roster[p.displayID] = Object.assign({}, _roster[p.displayID], {
           audioTrackId: p.cfAudioTrackId,
           videoTrackId: p.cfVideoTrackId,
           cfSessionId:  p.cfSessionId,
           isHost:       !!p.isHost
         });
       });

       if (payload.pinned && typeof payload.pinned === 'object') {
         Object.keys(payload.pinned).forEach(pid => {
           _pinnedUntil.set(pid, payload.pinned[pid]);
         });
       }
     });

    
    _sseSource.addEventListener("participant.pinned", e => {
      var { participantDisplayID, pinned, expiresAt } = JSON.parse(e.data);
      if (pinned) {
        _pinnedUntil.set(participantDisplayID, expiresAt);
      } else {
        _pinnedUntil.delete(participantDisplayID);
      }
    });


    _sseSource.addEventListener("recording.consent.request", e => {
      _showConsentBanner(orchestrator);
    });

    _sseSource.onerror = () => {
      // EventSource reconnects automatically; log for diagnostics only
      console.warn("[dotconf] SSE error — browser will retry");
    };
  }

  function _closeSSE() {
    if (_sseSource) { _sseSource.close(); _sseSource = null; }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Presence helpers
  // ─────────────────────────────────────────────────────────────────────────────

  function _updateParticipantPresence(orchestrator, participantDisplayID, state) {
    // Find the participant entity in the current data and update its presenceState.
    // The orchestrator's refreshCurrentView re-renders dots with the new typeBehaviorMap color.
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf || !conf.participants) return;
    var p = conf.participants.find(p => p.displayID === participantDisplayID);
    if (!p) return;
    p.presenceState = state;
    // Trigger a canvas re-render without a full fetch
    orchestrator.render();
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
    var conf = _getCurrentDotConf(orchestrator);
    if (!conf) return;

    var tenantId = _getTenantId(orchestrator);

    _cfApi(
      'POST /' + conf.displayID + '/participant/markAllInvited?tenantId=' + tenantId,
      {}
    ).then(() => {
      if (typeof orchestrator.showNotification === 'function') {
        orchestrator.showNotification('✅ Invite sent to all pending participants!');
      }
    }).catch(e => {
      console.error('[dotconf] markAllInvited failed:', e);
      if (typeof orchestrator._showError === 'function') {
        orchestrator._showError('Could not send invites — please try again.');
      }
    });
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

      try {
        _localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        var myName = (conf.participants.find(p => p.displayID === myId) || {}).name || 'You';

        _renderDotConfPreview(orchestrator, _localStream, myName, () => {
          _finishDotConfConnect(orchestrator, conf, tenantId, myId, n);
        });

        // Kick off the expensive prep work in parallel with the user looking
        // at the preview — peer connection, ICE gathering, offer creation.
        // None of this touches the network's Cloudflare endpoints yet, so it's
        // safe to do before the user has actually confirmed they want to join.
        _prepareDotConfConnection(orchestrator, tenantId, conf.displayID);

          // Keep the prepared offer fresh if the user lingers on preview —
          // old ICE candidates/offer could go stale on a long dwell.
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

        } catch (e) {
          console.error('[dotconf] _finishDotConfConnect failed:', e);
          _showError('Could not join the call. Please check your connection and try again.');
          _stopAllMedia();
          _mySessionId = null;
          _myLocalTracks = null;
          _preparedOfferSdp = null;
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
          {
            sessionId:   _mySessionId,
            tracks:      _myLocalTracks || [],
            // Presence of speakingSec is what tells the server this is a
            // real leave (vs. a tier-driven single-video unsubscribe of
            // someone else's track, which never sends this field) — see
            // the controller's tracks/close handler.
            speakingSec: Math.round(_mySpeakingSec)
          }
        );
      }
    } catch (e) {
      console.error('[dotconf] _leaveDotConf close call failed:', e);
      // fall through — tear down locally regardless, don't strand the user
    }
    
    var hostDisplayID = _getHostDisplayID(orchestrator);
    var hostDot = hostDisplayID ? _getDotElement(hostDisplayID) : null;
    if (hostDot) {
      hostDot.remove();
      _dotElCache.delete(hostDisplayID);
    }
    _removeCallControls();
    
    orchestrator.dotconfStopLayout(orchestrator);
    _stopCheapAudioLevelPolling();
    _stopAudioLevelUpdates();
    _stopAllMedia();
    _closeSSE();
   
    orchestrator._dotconfCallLive = false;
    _mySessionId          = null;
    _myLocalTracks        = null;
    _mySpeakingSec        = 0;
    _videoSubscribedTier  = new Set();
    _initialNegotiationDone = false; 
    
  }
   
   
  // ── A4. _attachPeerConnectionHandlers — new. ──
  // ontrack no longer unconditionally attaches the fine-grained AnalyserNode
  // to every audio track — that only happens once a participant enters a
  // video tier (see _subscribeVideoForParticipant). Everyone else's level
  // comes from the cheap getStats() poll.
   
  function _attachPeerConnectionHandlers(orchestrator, tenantId, confDisplayID) {
   
    _peerConnection.ontrack = (event) => {
      var track = event.track;
      var mid   = event.transceiver ? event.transceiver.mid : null;
   
      var ownerId = null;
      for (var pid in _roster) {
        var r = _roster[pid];
        if (r && (r.audioTrackId === track.id || r.videoTrackId === track.id)) {
          ownerId = pid;
          break;
        }
      }
   
      _tracks[track.id] = Object.assign({}, _tracks[track.id], {
        kind: track.kind,
        participantDisplayID: ownerId,
        mediaStreamTrack: track,
        mid: mid
      });
   
      // Record which mid a participant's video landed on — needed to close
      // exactly that track when the tier system demotes them.
      if (track.kind === 'video' && ownerId && _roster[ownerId]) {
        _roster[ownerId]._videoMid = mid;
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
    var others = Object.keys(_roster).filter(pid => {
      var r = _roster[pid];
      return r && r.audioTrackId && pid !== myId;
    });
   
    for (var i = 0; i < others.length; i++) {
      await _subscribeAudioForParticipant(orchestrator, tenantId, confDisplayID, sessionId, others[i]);
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
   
    try {
      var track = { trackName: r.audioTrackId, sessionId: r.cfSessionId };
   
      var pullResp = await _cfApi(
        'POST /' + confDisplayID + '/tracks/pull?tenantId=' + tenantId,
        { sessionId: sessionId, tracks: [track] }
      );
   
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
  }
   
   
  // ── A6. Video subscription — new. Tier-gated, called only from _tickLayout. ──
  // Pairs with attaching/detaching the fine-grained AnalyserNode: only
  // visible (rect/feed-dot) participants get the finer real-time level data
  // used for the visual size-pulse.
   
  async function _subscribeVideoForParticipant(orchestrator, tenantId, confDisplayID, participantDisplayID, tier) {
    var r = _roster[participantDisplayID];
    if (!r || !r.videoTrackId || !r.cfSessionId) return;
    if (r._videoSubscribed || r._videoSubscribing) return;
    r._videoSubscribing = true;
   
    var preferredRid = (tier === 'rect') ? null : 'q'; // rect wants best available, feed-dot wants low-res
   
    try {
      var track = { trackName: r.videoTrackId, sessionId: r.cfSessionId };
      if (preferredRid) track.simulcast = { preferredRid: preferredRid };
   
      var pullResp = await _cfApi(
        'POST /' + confDisplayID + '/tracks/pull?tenantId=' + tenantId,
        { sessionId: _mySessionId, tracks: [track] }
      );
   
      await _peerConnection.setRemoteDescription({ type: 'offer', sdp: pullResp.offerSdp });
      var answer = await _peerConnection.createAnswer();
      await _peerConnection.setLocalDescription(answer);
      await _cfApi(
        'PUT /' + confDisplayID + '/tracks/renegotiate?tenantId=' + tenantId,
        { sessionId: _mySessionId, answerSdp: answer.sdp }
      );
   
      _roster[participantDisplayID]._videoSubscribed = true;
   
      // Upgrade to the fine-grained analyser now that they're visible —
      // their audio was already pulled broadly at join, so _tracks[audioTrackId]
      // should already exist from ontrack.
      var audioEntry = _tracks[r.audioTrackId];
      if (audioEntry && audioEntry.mediaStreamTrack && !audioEntry.analyser) {
        _attachAudioAnalyser(r.audioTrackId, audioEntry.mediaStreamTrack);
      }
   
    } catch (e) {
      console.error('[dotconf] _subscribeVideoForParticipant failed for', participantDisplayID, e);
    } finally {
      if (_roster[participantDisplayID]) _roster[participantDisplayID]._videoSubscribing = false;
    }
  }
   
  async function _unsubscribeVideoForParticipant(orchestrator, tenantId, confDisplayID, participantDisplayID) {
    var r = _roster[participantDisplayID];
    if (!r || !r._videoSubscribed) return;
   
    var mid = r._videoMid; // set by ontrack when the pulled track actually arrived
    if (!mid) {
      console.warn('[dotconf] cannot unsubscribe video for', participantDisplayID, '— mid unknown yet');
      return;
    }
   
    try {
      // No speakingSec field — tells the server this is a tier-driven
      // unsubscribe of someone ELSE's track, not our own leave.
      await _cfApi(
        'PUT /' + confDisplayID + '/tracks/close?tenantId=' + tenantId,
        { sessionId: _mySessionId, tracks: [{ trackName: r.videoTrackId, mid: mid }] }
      );
      _roster[participantDisplayID]._videoSubscribed = false;
      _roster[participantDisplayID]._videoMid = null;
   
      // Drop back to cheap polling for this participant's audio level.
      if (r.audioTrackId && _tracks[r.audioTrackId]) {
        delete _tracks[r.audioTrackId].analyser;
      }
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
          _morphToPresenceDot(dot, p.displayID, size, p.presenceState);
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

    bar.appendChild(micBtn);
    bar.appendChild(cameraBtn);
    bar.appendChild(leaveBtn);

    document.body.appendChild(bar);
    _controlsBarEl = bar;
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
      _controlsBarEl.remove();
      _controlsBarEl = null;
    }
    clearTimeout(_controlsHideTimer);
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
      mic:       '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>',
      'mic-off': '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>',
      camera:       '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>',
      'camera-off': '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5l-4 4V7a1 1 0 0 0-1-1H9.83l-2-2H16a1 1 0 0 1 1 1v3.5l4-4v11l-1.17-1.17L21 6.5zM3.27 2L2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12c.2 0 .39-.06.54-.16L19.73 21 21 19.73 3.27 2zM6 8.27L13.73 16H6V8.27z"/></svg>',
      leave:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a1.003 1.003 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>'
    };
    return icons[isOff ? kind + '-off' : kind] || icons[kind] || '';
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

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(leaveBtn);
    dialog.appendChild(title);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);

    // Dismiss on backdrop click, same as Cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
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
  
  var _previewAnalyser  = null;
  var _previewLevelRaf  = null;

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

    var levelRing = document.createElement('div');
    levelRing.style.cssText = `
      position: absolute; inset: 0;
      border: 3px solid rgba(255,255,255,0.15);
      pointer-events: none;
      transition: border-color 0.1s linear;
      box-sizing: border-box;
    `;

    var hint = document.createElement('div');
    hint.textContent = 'Say something';
    hint.style.cssText = `
        position: absolute; top: 6px; left: 0; right: 0;
        text-align: center;
        color: #fff; font-size: 13px; font-weight: 600;
        text-shadow: 0 1px 4px rgba(0,0,0,0.8);
    `;

    videoWrap.appendChild(video);
    videoWrap.appendChild(levelRing);
    videoWrap.appendChild(hint);

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

    _startPreviewAudioMeter(stream, levelRing);
  }

  function _startPreviewAudioMeter(stream, levelRing) {
    var audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    if (!_audioCtx) _audioCtx = new AudioContext();
    var source   = _audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
    var analyser = _audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    _previewAnalyser = analyser;

    var buf = new Uint8Array(64);
    function tick() {
      analyser.getByteTimeDomainData(buf);
      var sumSq = 0;
      for (var i = 0; i < buf.length; i++) {
        var v = (buf[i] - 128) / 128;
        sumSq += v * v;
      }
      var rms = Math.sqrt(sumSq / buf.length);
      var level = Math.min(1, rms * 5); // slightly hotter gain than before

      // More obvious: thicker border + brighter color + a visible glow,
      // not just a subtle opacity shift.
      var thickness = 3 + level * 9;         // 3px idle → up to 12px when loud
      var glow      = level * 24;            // up to 24px glow radius
      levelRing.style.borderWidth = thickness + 'px';
      levelRing.style.borderColor = `rgba(64, 219, 110, ${0.3 + level * 0.7})`;
      levelRing.style.boxShadow   = `0 0 ${glow}px rgba(64, 219, 110, ${level * 0.8})`;

      _previewLevelRaf = requestAnimationFrame(tick);
    }
    tick();
  }

  function _stopPreviewAudioMeter() {
    if (_previewLevelRaf) { cancelAnimationFrame(_previewLevelRaf); _previewLevelRaf = null; }
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
    // tenantId is currentPath[0].displayID — the host's displayID in the URL
    // This is the raw (un-hashed) value the server needs to varruct paths
    return orchestrator.currentPath?.[0]?.displayID || null;
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
          await _sendParticipantInviteEmail(orchestrator);
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

      var confUrl    = orchestrator.getAppUrl(orchestrator.currentPath);
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
      p.presenceState === PRESENCE_STATE.VIEWED
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
  var HOST_CENTER_RADIUS = 80;
  var HOST_MIN_RECT_W    = 0.15;
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
    // Host never gets a presence dot from the base renderer, live call or
    // not — their own representation is handled entirely by _tickLayout's
    // isHost branch once live (center tile). Strip them from items
    // unconditionally, not just during the live-call override path below.
    if (orchestrator.currentApp?.id === 'conf' &&
        orchestrator.currentPath?.length === 2 &&
        entityType === 'participant') {
      var hostDisplayID = _getHostDisplayID(orchestrator);
      items = items.filter(function(p) { return p.displayID !== hostDisplayID; });
    }

    if (!orchestrator._dotconfCallLive) {
        return originalFn(items, entityType, margin);
      }

    if (orchestrator.currentApp?.id !== 'conf' ||
        orchestrator.currentPath?.length !== 2 ||
        entityType !== 'participant') {
      return originalFn(items, entityType, margin);
    }

    var canvas = document.getElementById('canvas-area');
    if (!canvas) return originalFn(items, entityType, margin);

    var W = canvas.offsetWidth;
    var H = canvas.offsetHeight;

    var hostDisplayID = _getHostDisplayID(orchestrator);
    var hostIndex     = items.findIndex(p => p.displayID === hostDisplayID);

    // FNV32 — same as the original generateDotPositions for stable positions
    var fnv32 = (str, seed = 0x811c9dc5) => {
      let h = seed;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
      }
      return h;
    };

    var positions = items.map((item, i) => {
      // Host → canvas center
      if (i === hostIndex) {
        return { x: W / 2, y: H / 2, _isHost: true };
      }

      // Everyone else → stable hash position, same as original
      var seed     = item.ID || item.displayID || item.name || `item_${i}`;
      var indexMix = (i * 2654435761) >>> 0;
      var hx       = fnv32(seed, (0x811c9dc5 ^ indexMix) >>> 0);
      var hy       = fnv32(seed, (0x33333333 ^ indexMix) >>> 0);

      // Keep away from center — host is there
      // Use the annular region: margin..edge but avoid center 150px
      let x = margin + (hx / 0xFFFFFFFF) * (W - margin * 2);
      let y = margin + (hy / 0xFFFFFFFF) * (H - margin * 2);

      // Nudge away from center if too close
      var dx   = x - W / 2;
      var dy   = y - H / 2;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        var scale = 150 / (dist || 1);
        x = W / 2 + dx * scale;
        y = H / 2 + dy * scale;
      }

      return { x, y, _isHost: false };
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

  function _morphToRect(dot, displayID, w, h,  orchestrator) {
    _clearPulse(dot); // clear confirmation ring — morph is happening
    dot.dataset.morphed = 'true';
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
    if (dot.dataset.morphed === 'true') {
      dot.dataset.morphed = 'false';
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

  function _morphToPresenceDot(dot, displayID, size, presenceState, instant, orchestrator) {
    _clearPulse(dot);
    if (dot.dataset.morphed === 'true') _removeTileVideo(dot);
    if (dot.dataset.tier === 'feedDot') _removeTileVideo(dot);
    dot.dataset.morphed = 'false';
    dot.dataset.tier    = 'presence';
   
    var currentLeft = parseFloat(dot.style.left) || 0;
    var currentTop  = parseFloat(dot.style.top)  || 0;
    var prevW       = parseFloat(dot.dataset.prevW) || size;
    var prevH       = parseFloat(dot.dataset.prevH) || size;
    dot.style.left    = `${currentLeft - (size - prevW) / 2}px`;
    dot.style.top     = `${currentTop  - (size - prevH) / 2}px`;
   
    var styleDef = DOTCONF_PRESENCE_STYLES[presenceState] || DOTCONF_PRESENCE_STYLES.invited;
   
    dot.classList.remove('dotconf-added');
    dot.style.backgroundImage = 'none';
    dot.style.filter = 'none';
   
    if (presenceState === PRESENCE_STATE.ADDED) {
      dot.classList.add('dotconf-added'); // kept for anything else the class might carry, border now set directly below
      dot.style.setProperty('background-color', 'transparent', 'important');
      dot.style.setProperty('background-image', 'none', 'important');
      dot.style.setProperty('border', styleDef.border, 'important');
      dot.style.color   = styleDef.color; // was missing — this is why text was invisible before (white text on transparent bg)
      dot.style.opacity = styleDef.opacity;
    } else {
      dot.style.background = styleDef.background;
      dot.style.border     = styleDef.border;
      dot.style.color      = styleDef.color;
      dot.style.opacity    = styleDef.opacity;
   
      if (styleDef.useFrozenFrame) {
        var frozen = _frozenFrames[displayID];
        if (frozen) {
          dot.style.backgroundImage    = `url(${frozen})`;
          dot.style.backgroundSize     = 'cover';
          dot.style.backgroundPosition = 'center';
          dot.style.filter = 'grayscale(40%) brightness(0.9)';
        }
      }
    }
   
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
   
    conf.participants.forEach(p => {
      var isLive = p.presenceState === 'live' || p.presenceState === 'audio_only';
      if (isLive) return;
   
      var dot = _getDotElement(p.displayID);
      if (p.displayID === '1an9ww2piuo46') { // P7 — swap in the real value if it changed
        console.log('[diag] P7 — dot element:', dot, 'presenceState:', p.presenceState);
      }
      if (!dot) return;
      _morphToPresenceDot(dot, p.displayID, minDotSize, p.presenceState, true);
    });
   
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
      _dotconfReady: true
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

})();


