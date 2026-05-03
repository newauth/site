(function() {

	function alphabetLocation(char) {
		const code = char.toUpperCase().charCodeAt(0);
		if (code >= 65 && code <= 90) {
			return Math.ceil((code - 64) / 9);
		}
		return null;
	}

	function injectPriceMovesStyles() {
		if (document.getElementById('price-moves-style')) return;

		const style = document.createElement('style');
		style.id = 'price-moves-style';
		style.textContent = `
  .price-moves-container {
    display: flex;
    height: 100px;
    width: 75%;
    margin: 0 auto;
    background-color: #fff;
    border: 1px solid #ccc;
    overflow-x: auto;
    overflow-y: visible;
    position: relative;
    scroll-behavior: smooth;
	z-index:1;
    /* Discrete/minimal scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: #ccc transparent;
  }
  .price-moves-container::-webkit-scrollbar {
    height: 6px;
  }
  .price-moves-container::-webkit-scrollbar-track {
    background: transparent;
  }
  .price-moves-container::-webkit-scrollbar-thumb {
    background-color: #ccc;
    border-radius: 3px;
  }
  .price-moves-container::-webkit-scrollbar-thumb:hover {
    background-color: #999;
  }
    .center-line {
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: 1px;
      background-color: #ccc;
      z-index: 0;
    }
    .date-column {
      position: relative;
      width: 60px;
      height: 100px;
      flex-shrink: 0;
      z-index: 1;
    }
    .date-label {
      position: absolute;
      top: 2px;
      left: 35%;
      transform: translateX(-50%);
      font-size: 10px;
      color: #555;
      background: #fff;
      padding: 2px 4px;
      border-radius: 4px;
      z-index: 1;
    }
    .evt-dot {
      position: absolute;
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.2s ease;
      z-index: 1;
    }
    .price-tooltip {
      position: fixed;
      background: #333;
      color: #fff;
      padding: 4px 8px;
      font-size: 12px;
      white-space: nowrap;
      border-radius: 4px;
      pointer-events: none;
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .price-tooltip.visible {
      opacity: 1;
    }
	.friday-column {
	  position: relative;
	}

	.friday-column::after {
	  content: '';
	  position: absolute;
	  top: 20%;              /* skip top 20% */
	  bottom: 20%;           /* skip bottom 20% */
	  right: 0;
	  width: 2px;
	  background-color: #aaa; /* or any color you like */
	}
  `;
		document.head.appendChild(style);
	}
	
	// Global registry to preserve dot state before signal render
	var dotStateRegistry = {};

	function saveDotState(dotElement, id) {
		if (dotStateRegistry[id]) {
			console.warn('saveDotState SKIP: entry exists for', id, 
			                     'dotState:', dotElement.dataset.dotState);
			return;
	    }
	    // 🔒 Guard 1: Ensure it's a real element
	    if (!dotElement || typeof dotElement !== 'object') {
	        console.warn('saveDotState: invalid dotElement for id', id, dotElement);
	        return;
	    }

	    // 🔒 Guard 2: Ensure it has a style property (HTML/SVG element)
	    if (!dotElement.style) {
	        // Try to unwrap if it's a jQuery object
	        if (dotElement.jquery && dotElement[0]) {
	            dotElement = dotElement[0];
	        }
	        // If still no style, bail
	        if (!dotElement.style) {
	            console.warn('saveDotState: no .style property on element', id, dotElement);
	            return;
	        }
	    }

	    // ✅ Safe to proceed — capture state defensively
	    dotStateRegistry[id] = {
	        innerHTML: dotElement.innerHTML || '',
	        className: dotElement.className || '',
	        style: {
	            cssText: dotElement.style.cssText || '',
	            width: dotElement.style.width || '',
	            height: dotElement.style.height || '',
	            transform: dotElement.style.transform || '',
	            backgroundColor: dotElement.style.backgroundColor || '',
	            zIndex: dotElement.style.zIndex || '',
	            position: dotElement.style.position || '',
	            overflow: dotElement.style.overflow || ''
	        },
	        dataset: {}
	    };

	    // Copy dataset safely
	    if (dotElement.dataset) {
	        for (var key in dotElement.dataset) {
	            if (dotElement.dataset.hasOwnProperty(key)) {
	                dotStateRegistry[id].dataset[key] = dotElement.dataset[key];
	            }
	        }
	    }
	}

	function restoreDotState(dotElement, id) {
	    var state = dotStateRegistry[id];
	    if (!state || !dotElement || !dotElement.style) {
	        console.warn('restoreDotState: invalid state or element for id', id);
	        return;
	    }

	    // ✅ Preserve signal cache BEFORE anything
	    var signalCached = dotElement.dataset.signalCached;
	    var signalHTML   = dotElement.dataset.signalHTML;

	    // Restore content & classes
	    if (state.innerHTML !== undefined) dotElement.innerHTML = state.innerHTML;
	    if (state.className !== undefined) dotElement.className = state.className;

	    // Restore styles
	    var styles = state.style || {};
	    if (styles.cssText) {
	        dotElement.style.cssText = styles.cssText;
	    } else {
	        if (styles.width)           dotElement.style.width           = styles.width;
	        if (styles.height)          dotElement.style.height          = styles.height;
	        if (styles.transform)       dotElement.style.transform       = styles.transform;
	        if (styles.backgroundColor) dotElement.style.backgroundColor = styles.backgroundColor;
	        if (styles.zIndex)          dotElement.style.zIndex          = styles.zIndex;
	        if (styles.position)        dotElement.style.position        = styles.position;
	        if (styles.overflow)        dotElement.style.overflow        = styles.overflow;
	    }

	    // Restore dataset from saved state
	    if (dotElement.dataset && state.dataset) {
	        for (var key in state.dataset) {
	            if (state.dataset.hasOwnProperty(key)) {
	                dotElement.dataset[key] = state.dataset[key];
	            }
	        }
	    }

	    // ✅ Re-apply signal cache AFTER dataset restore — must come last
	    if (signalCached) dotElement.dataset.signalCached = signalCached;
	    if (signalHTML)   dotElement.dataset.signalHTML   = signalHTML;

	    // Restore savedpastel for shrinkdot
	    var savedBgClr = dotElement.dataset.savedBgClr;
	    if (savedBgClr) {
	        dotElement.style.backgroundColor = savedBgClr;
	        dotElement.style.background      = savedBgClr;
	        dotElement.savedpastel           = savedBgClr;
	    }
	    dotElement.style.opacity    = '1';
	    dotElement.style.visibility = 'visible';
	    dotElement.dataset.dotState = 'normal';
	    dotElement.dataset.expanded = 'false';

	    delete dotStateRegistry[id];
	}
	
	function generateSignalHTML(data) {
		//console.log('Signal data: ' + JSON.stringify(data));
	    var rec = JSON.parse(data.summary.data).recommendation || {
	        signal: "BUY",
	        score: 82,
	        confidence: 0.78,
	        drivers: ["Strong beat consistency", "Options underpricing reactions", "Revenue growth accelerating"]
	    };

	    var s = JSON.parse(data.summary.data) || {};
	    var color = rec.signal === "BUY" ? "#14b86a" : rec.signal === "SELL" ? "#d84a4a" : "#d6a328";
	    var gaugeAngle = (rec.score / 100) * 180;
	    var ticker = data.summary.ticker || s.ticker || "TICKER";

	    function pct(v) {
	        if (v == null) return "--";
	        return Math.round(v * 100) + "%";
	    }

	    function num(v) {
	        if (v == null) return "--";
	        return Number(v).toFixed(1);
	    }

	    function metricCard(label, val) {
	        return "<div class='metric'>" +
	            "<div class='metric-label'>" + label + "</div>" +
	            "<div class='metric-val'>" + val + "</div>" +
	            "</div>";
	    }

	    function metricAxis(label, val) {
	        return "<div class='axis'>" +
	            "<div>" + label + "</div>" +
	            "<div class='bar'>" +
	            "<div class='fill' style='width:" + val + "%;'></div>" +
	            "</div>" +
	            "</div>";
	    }

	    // ── Build Drivers HTML ──
	    var driversHTML = "";
	    if (rec.drivers && rec.drivers.length) {
	        for (var i = 0; i < rec.drivers.length; i++) {
	            driversHTML += "<div class='driver'><span class='checkmark'>&#10003;</span> " + rec.drivers[i] + "</div>";
	        }
	    }

	    // ── Build Radar Axes ─
	    var fundamentalVal = Math.min(100, (s.beatConsistency || 0) * 100);
	    var underreactionVal = Math.min(100, (s.underpricedScore || 1) * 60);
	    var convictionVal = Math.min(100, ((s.avgActualMove || 0) / (s.avgImpliedMove || 1)) * 60);
	    var catalystVal = 70;

	    var radarHTML = metricAxis("Fundamental", fundamentalVal) +
	        metricAxis("Underreaction", underreactionVal) +
	        metricAxis("Conviction", convictionVal) +
	        metricAxis("Catalyst", catalystVal);

	    // ── Build Metrics Cards ──
	    var metricsHTML = metricCard("Beat Consistency", pct(s.beatConsistency)) +
	        metricCard("Avg Surprise", num(s.avgSurprise) + "%") +
	        metricCard("Underpriced", num(s.underpricedScore)) +
	        metricCard("Rev Growth", num(s.avgRevenueYoy) + "%");

	    // ── Build Horizontal Timeline with Log Scale ──
	    var timelineHTML = "";
	    if (data.events && data.events.length) {
	        // 1. Reverse to get chronological order (Oldest -> Newest)
	        // 2. Slice to max 10 items
	        var eventsToShow = data.events.slice().reverse().slice(0, 10);
	        
	        var mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	        
	        // Log scale function: maps move percentage to vertical offset
	        // FLIPPED: Positive (green) above, Negative (red) below
	        function logScale(move) {
	            var absMove = Math.abs(move);
	            var sign = move >= 0 ? 1 : -1;
	            // FLIPPED: Negative sign so positive moves go UP (negative translateY)
	            return -sign * Math.log1p(absMove) * 20; // 20 is a scaling factor
	        }

	        timelineHTML = "<div class='timeline-wrapper'><div class='timeline-axis'></div><div class='timeline-track'>";
	        
	        for (var j = 0; j < eventsToShow.length; j++) {
	            var ev = eventsToShow[j];
	            var d = {};
	            try {
	                d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data || {};
	            } catch (e) { }
	            
	            var reactions = d.reactions || [];
	            var move = 0;
	            // Use the first day reaction as the primary indicator
	            if (reactions.length > 0) {
	                move = reactions[0].priceChange || 0;
	            }
	            
	            // Format Date (e.g., "Jan '24")
	            var parts = ev.yearMonth.split("-");
	            var dateLabel = mNames[parseInt(parts[1]) - 1] + " '" + parts[0].substring(2);
	            
	            // Calculate vertical position using log scale
	            var verticalOffset = logScale(move);
	            var dotColor = move >= 0 ? "#14b86a" : "#d84a4a";
	            var moveSign = move >= 0 ? "+" : "";
	            
	            // FIXED DOT SIZE (12px)
	            var dotSize = 12;
	            
	            // Determine tooltip position:
	            // Green (positive) dots are ABOVE line -> Tooltip BELOW dot (towards line)
	            // Red (negative) dots are BELOW line -> Tooltip BELOW dot (further down)
	            var tooltipClass = move >= 0 ? "tooltip-below" : "tooltip-above";
	            
	            timelineHTML += "<div class='timeline-item'>" +
	                            "<div class='timeline-date'>" + dateLabel + "</div>" +
	                            "<div class='timeline-dot-container'>" +
	                            "<div class='timeline-dot' style='width:" + dotSize + "px;height:" + dotSize + "px;background:" + dotColor + ";transform:translateY(" + verticalOffset + "px);' data-move='" + moveSign + num(move) + "%'></div>" +
	                            "<div class='timeline-tooltip " + tooltipClass + "'>" + moveSign + num(move) + "%</div>" +
	                            "</div>" +
	                            "</div>";
	        }
	        timelineHTML += "</div></div>";
	    }

	    // ── CSS Styles ──
	    var cssStyles = [
	        "<style>",
	        ".signal-wrap { overscroll-behavior: contain; -webkit-overflow-scrolling: touch;width: 100%;  min-height: 100%; height: auto;box-sizing: border-box;display: flex; flex-direction: column;font-family:Inter,Arial,sans-serif;background:#ffffff;border:2px solid #d1d5db;border-radius:16px;padding:24px;max-width:980px;box-shadow:0 20px 40px rgba(0,0,0,0.2),0 0 0 1px rgba(0,0,0,0.05);position:relative;z-index:999999!important;isolation:isolate;overflow:visible;}",
	        ".top-row{display:grid;grid-template-columns:1.2fr 1fr;gap:24px;align-items:center;}",
	        ".hero{padding:20px;border-radius:12px;background:linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%);border:1px solid #cbd5e1;}",
	        ".ticker{font-size:13px;letter-spacing:.08em;color:#64748b;font-weight:600;margin-bottom:8px;text-transform:uppercase;}",
	        ".signal{font-size:48px;font-weight:900;color:" + color + ";line-height:1;text-shadow:0 2px 4px rgba(0,0,0,0.1);}",
	        ".score{margin-top:12px;font-size:20px;font-weight:700;color:#1e293b;}",
	        ".conf{margin-top:6px;color:#475569;font-size:14px;font-weight:500;}",
	        ".drivers{margin-top:20px;}",
	        ".driver{padding:6px 0;font-size:14px;color:#334155;font-weight:500;display:flex;align-items:flex-start;gap:8px;}",
	        ".checkmark{color:#14b86a;font-weight:900;font-size:16px;line-height:1;flex-shrink:0;}",
	        ".gauge{position:relative;width:260px;height:130px;margin:auto;overflow:hidden;}",
	        ".gauge-base{width:260px;height:260px;border-radius:50%;background:conic-gradient(#d84a4a 0deg 60deg,#d6a328 60deg 120deg,#14b86a 120deg 180deg,transparent 180deg);transform:rotate(-90deg);opacity:0.3;}",
	        ".needle{position:absolute;bottom:0;left:50%;width:4px;height:100px;background:#1e293b;transform-origin:bottom center;transform:translateX(-50%) rotate(" + (gaugeAngle - 90) + "deg);border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.2);}",
	        ".needle:after{content:'';position:absolute;bottom:-6px;left:-6px;width:16px;height:16px;background:#1e293b;border-radius:50%;}",
	        ".metrics{margin-top:28px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;position:relative;z-index:1;}",
	        ".metric{border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc;min-height:80px;display:flex;flex-direction:column;justify-content:center;}",
	        ".metric-label{font-size:11px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;}",
	        ".metric-val{font-size:24px;font-weight:800;color:#0f172a;}",
	        ".section-title{margin-top:28px;font-weight:800;font-size:16px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;position:relative;z-index:1;}",
	        ".radar{margin-top:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;position:relative;z-index:1;}",
	        ".axis{text-align:center;}",
	        ".axis>div:first-child{font-size:12px;font-weight:600;color:#475569;margin-bottom:6px;}",
	        ".bar{height:6px;background:#e2e8f0;border-radius:999px;margin-top:6px;overflow:hidden;border:1px solid #cbd5e1;}",
	        ".fill{height:100%;background:linear-gradient(90deg,#3b82f6,#1d4ed8);border-radius:999px;}",
	        
	        // UPDATED: Timeline Styles with smart tooltip positioning
	        ".timeline-wrapper{margin-top:16px;overflow-x:auto;padding-bottom:10px;position:relative;scrollbar-width:thin;}",
	        ".timeline-wrapper::-webkit-scrollbar{height:4px;}",
	        ".timeline-wrapper::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px;}",
	        ".timeline-axis{height:2px;background:#94a3b8;position:absolute;top:50%;left:0;right:0;z-index:0;transform:translateY(-1px);}",
	        ".timeline-track{display:flex;justify-content:space-between;position:relative;z-index:1;min-width:600px;padding:0 5px;height:120px;align-items:center;}",
	        ".timeline-item{display:flex;flex-direction:column;align-items:center;min-width:50px;flex:1;cursor:default;}",
	        ".timeline-date{font-size:10px;color:#64748b;margin-bottom:4px;white-space:nowrap;font-weight:600;}",
	        ".timeline-dot-container{position:relative;height:100px;display:flex;align-items:center;justify-content:center;}",
	        ".timeline-dot{border-radius:50%;transition:all 0.2s ease;box-shadow:0 2px 6px rgba(0,0,0,0.15);position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);}",
	        ".timeline-dot:hover{transform:translate(-50%,-50%) scale(1.4);box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:10;}",
	        ".timeline-tooltip{position:absolute;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity 0.2s;z-index:20;}",
	        
	        /* UPDATED: Red dot tooltips moved DOWN */
	        ".timeline-tooltip.tooltip-above{top:22px;}",
	        /* Green dot tooltips (stay same) */
	        ".timeline-tooltip.tooltip-below{top:20px;}",
	        
	        ".timeline-dot:hover + .timeline-tooltip{opacity:1;}",
	        ".timeline-dot-container:hover .timeline-tooltip{opacity:1;}",
	        
	        "</style>"
	    ].join("");

	    // ── Build Final HTML ─
	    return [
	        cssStyles,
	        "<div class='signal-wrap'>",
	        "<div class='top-row'>",

	        "<div class='hero'>",
	        "<div class='ticker'>" + ticker + "</div>",
	        "<div class='signal'>" + rec.signal + "</div>",
	        "<div class='score'>Signal Score " + rec.score + "/100</div>",
	        "<div class='conf'>Confidence " + Math.round(rec.confidence * 100) + "%</div>",
	        "<div class='drivers'>" + driversHTML + "</div>",
	        "</div>",

	        "<div>",
	        "<div class='gauge'>",
	        "<div class='gauge-base'></div>",
	        "<div class='needle'></div>",
	        "</div>",
	        "<div class='radar'>" + radarHTML + "</div>",
	        "</div>",

	        "</div>",

	        "<div class='metrics'>" + metricsHTML + "</div>",

	        "<div class='section-title'>Recent Earnings Behavior (Last 10)</div>",
	        timelineHTML,

	        "</div>"
	    ].join("");
	}
	

	// ─────────────────────────────────────────────
	// STATE
	// ─────────────────────────────────────────────
	var dotStateRegistry = {};
	var pinnedDotId      = null;
	var hoverTimers      = {};

	function showBasicPopup(dotElement) {
	    // ✅ Extract data BEFORE replacing innerHTML
	    var ticker = '', price = '', time = '', exchange = '';
	    
	    // Try from dot-popup li items first
	    var popup = dotElement.querySelector('.dot-popup');
	    if (popup) {
	        var items = popup.querySelectorAll('li');
	        for (var i = 0; i < items.length; i++) {
	            var text = items[i].textContent;
	            if (text.indexOf('Ticker:')   > -1) ticker   = text.split(':')[1].trim().toUpperCase();
	            if (text.indexOf('Price:')    > -1) price    = text.split(':')[1].trim();
	            if (text.indexOf('Time:')     > -1) time     = text.split(':')[1].trim();
	            if (text.indexOf('Exchange:') > -1) exchange = text.split(':')[1].trim();
	        }
	    }

	    // Fallback — ticker from span
	    if (!ticker) {
	        var tickerSpan = dotElement.querySelector('span[style*="pointer-events: none"]');
	        if (tickerSpan) ticker = tickerSpan.textContent.trim();
	    }

	    var bg = dotElement.dataset.savedBgClr || dotElement.style.backgroundColor || '#3b82f6';
	    dotElement.savedpastel         = bg;
	    dotElement.style.background    = 'transparent';
	    dotElement.style.position      = 'fixed';
	    dotElement.style.overflow      = 'hidden';
	    dotElement.style.opacity       = '1';
	    dotElement.style.visibility    = 'visible';

	    dotElement.innerHTML = [
	        '<div style="',
	            'background:' + bg + ';',
	            'color:white;',
	            'width:100%;',
	            'height:100%;',
	            'padding:20px;',
	            'box-sizing:border-box;',
	            'position:absolute;',
	            'top:0;left:0;right:0;bottom:0;',
	            'z-index:10;',
	            'display:flex;',
	            'flex-direction:column;',
	            'gap:12px;',
	            'overflow:auto;',
	            'font-family:Inter,Arial,sans-serif;',
	        '">',
	            '<div style="font-size:11px;letter-spacing:.1em;opacity:0.8;">EARNINGS</div>',
	            '<div style="font-size:28px;font-weight:800;letter-spacing:.05em;">' + ticker + '</div>',
	            '<div style="font-size:13px;opacity:0.85;">Reports ' + time + '</div>',
	            '<div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:12px;display:flex;flex-direction:column;gap:8px;">',
	                '<div style="display:flex;justify-content:space-between;font-size:13px;">',
	                    '<span style="opacity:0.75;">Price</span>',
	                    '<span style="font-weight:700;">$' + price + '</span>',
	                '</div>',
	                '<div style="display:flex;justify-content:space-between;font-size:13px;">',
	                    '<span style="opacity:0.75;">Exchange</span>',
	                    '<span style="font-weight:700;">' + exchange + '</span>',
	                '</div>',
	            '</div>',
	        '</div>'
	    ].join('');
	}

	function smartExpand(dotElement, callback) {
		logDotCSS(dotElement, 'BEFORE smartExpand');
	    // ✅ Capture rect FIRST before any style changes
	    var rect          = dotElement.getBoundingClientRect();
	    var viewportWidth  = window.innerWidth;
	    var viewportHeight = window.innerHeight;
	    var isLeft        = rect.left < viewportWidth  / 2;
	    var isTop         = rect.top  < viewportHeight / 2;
	    var hMargin       = 20;
	    var vMargin       = 20;
	    var availW, availH, left, top, bottom, right;

	    if (isLeft) {
	        left   = Math.max(hMargin, rect.left) + 'px';
	        right  = 'auto';
	        availW = viewportWidth - rect.left - hMargin;
	    } else {
	        right  = Math.max(hMargin, viewportWidth - rect.right) + 'px';
	        left   = 'auto';
	        availW = rect.right - hMargin;
	    }

	    if (isTop) {
	        top    = Math.max(vMargin, rect.top) + 'px';
	        bottom = 'auto';
	        availH = viewportHeight - rect.top - vMargin;
	    } else {
	        bottom = Math.max(vMargin, viewportHeight - rect.bottom) + 'px';
	        top    = 'auto';
	        availH = rect.bottom - vMargin;
	    }

	    var finalW = Math.min(availW, 640);
	    var finalH = Math.min(availH, viewportHeight * 0.80);

	    // ✅ Store original position for collapse animation
	    dotElement.dataset.expandedFromLeft   = rect.left;
	    dotElement.dataset.expandedFromTop    = rect.top;
	    dotElement.dataset.expandedFromWidth  = rect.width;
	    dotElement.dataset.expandedFromHeight = rect.height;
	    dotElement.dataset.expandedIsLeft     = isLeft ? 'true' : 'false';
	    dotElement.dataset.expandedIsTop      = isTop  ? 'true' : 'false';

	    dotElement.style.position     = 'fixed';
	    dotElement.style.zIndex       = '999999';
	    dotElement.style.transform    = 'none';
	    dotElement.style.borderRadius = '16px';
	    dotElement.style.boxShadow    = '0 20px 40px rgba(0,0,0,0.2)';
	    dotElement.style.overflow     = 'auto';
	    dotElement.style.left         = left;
	    dotElement.style.right        = right;
	    dotElement.style.top          = top;
	    dotElement.style.bottom       = bottom;
	    dotElement.style.width        = finalW + 'px';
	    dotElement.style.height       = finalH + 'px';
	    dotElement.style.maxWidth     = finalW + 'px';
	    dotElement.style.maxHeight    = finalH + 'px';
	    dotElement.style.minWidth     = '260px';
	    dotElement.style.visibility   = 'visible';
	    dotElement.style.opacity      = '1';
	    dotElement.style.transition   = 'none';

	    if (typeof callback === 'function') callback();
		
		requestAnimationFrame(function() {
		        requestAnimationFrame(function() {
		            // ... apply styles ...
		            logDotCSS(dotElement, 'AFTER smartExpand styles applied');
		            if (typeof callback === 'function') callback();
		        });
		    });
	}

	function animatedRestore(dotElement, id, callback) {
		logDotCSS(dotElement, 'BEFORE animatedRestore');
	    // ✅ Use stored original position for correct collapse origin
	    var isLeft = dotElement.dataset.expandedIsLeft === 'true';
	    var isTop  = dotElement.dataset.expandedIsTop  === 'true';

	    var originX = isLeft ? '0%' : '100%';
	    var originY = isTop  ? '0%' : '100%';

	    dotElement.style.transformOrigin = originX + ' ' + originY;
	    dotElement.style.transition      = 'transform 0.25s cubic-bezier(0.4, 0, 1, 1), opacity 0.25s ease';
	    dotElement.style.transform       = 'scale(0.05)';
	    dotElement.style.opacity         = '0';
	    dotElement.style.borderRadius    = '50%';
	    dotElement.style.pointerEvents   = 'none';

	    setTimeout(function() {
			logDotCSS(dotElement, 'AFTER setTimeout - before restoreDotState');
	        dotElement.style.transition      = '';
	        dotElement.style.transform       = '';
	        dotElement.style.transformOrigin = '';
	        dotElement.style.pointerEvents   = '';
	        PriceMoves.restoreDotState(dotElement, id);
			logDotCSS(dotElement, 'AFTER restoreDotState');
	        if (typeof callback === 'function') callback();
	    }, 250);
		
		
	}

	// ─────────────────────────────────────────────
	// SHOW SIGNAL inside expanded dot
	// ─────────────────────────────────────────────
	function showSignal(dotElement, obj) {
	    dotElement.style.background    = '#ffffff';
	    dotElement.style.display       = '';
	    dotElement.style.flexDirection = '';
	    dotElement.style.padding       = '0';

	    if (dotElement.dataset.signalCached === 'true') {
	        dotElement.innerHTML = dotElement.dataset.signalHTML;
	        addCloseButton(dotElement);
	    } else {
	        // ✅ Show loader while fetching
	        dotElement.innerHTML = [
	            '<div style="',
	                'display:flex;flex-direction:column;align-items:center;',
	                'justify-content:center;height:100%;min-height:200px;',
	                'font-family:Inter,Arial,sans-serif;color:#64748b;',
	            '">',
	            '  <div class="signal-loader" style="',
	                'width:40px;height:40px;border-radius:50%;',
	                'border:3px solid #e2e8f0;border-top-color:#3b82f6;',
	                'animation:signalSpin 0.8s linear infinite;margin-bottom:16px;',
	            '"></div>',
	            '  <div style="font-size:13px;font-weight:600;">Analyzing ' + (obj.data.Ticker || '').toUpperCase() + '</div>',
	            '  <div style="font-size:11px;margin-top:4px;opacity:0.6;">Loading signal data...</div>',
	            '  <style>',
	            '    @keyframes signalSpin {',
	            '      to { transform: rotate(360deg); }',
	            '    }',
	            '  </style>',
	            '</div>'
	        ].join('');

	        addCloseButton(dotElement);
	        fetchAndRenderSignal(dotElement, obj);
	    }
	}

	// ─────────────────────────────────────────────
	// CLOSE BUTTON
	// ─────────────────────────────────────────────
	function addCloseButton(dotElement) {
	    // Remove existing close btn if any
	    var existing = dotElement.querySelector('.signal-close-btn');
	    if (existing) existing.remove();

	    var closeBtn = document.createElement('button');
	    closeBtn.className = 'signal-close-btn';
	    closeBtn.innerHTML = '&times;';
	    closeBtn.style.cssText = [
	        'position:absolute', 'top:12px', 'right:16px',
	        'background:#ffffff', 'border:2px solid #e2e8f0',
	        'border-radius:50%', 'width:32px', 'height:32px',
	        'font-size:20px', 'cursor:pointer', 'color:#64748b',
	        'font-weight:700', 'z-index:1000000',
	        'box-shadow:0 2px 8px rgba(0,0,0,0.1)', 'line-height:1'
	    ].join(';');

	    closeBtn.onmouseover = function() {
	        this.style.background  = '#ef4444';
	        this.style.color       = '#fff';
	        this.style.borderColor = '#ef4444';
	    };
	    closeBtn.onmouseout = function() {
	        this.style.background  = '#ffffff';
	        this.style.color       = '#64748b';
	        this.style.borderColor = '#e2e8f0';
	    };
		closeBtn.onclick = function(e) {
		    if (e) { e.stopPropagation(); e.preventDefault(); }
		    PriceMoves.setPinnedId(null);
		    dotElement.dataset.dotState = 'normal';
		    animatedRestore(dotElement, dotElement.id);
		};
	    dotElement.appendChild(closeBtn);
	}

	// ─────────────────────────────────────────────
	// renderEarningsSignalInDot — just inject + cache
	// ─────────────────────────────────────────────
	function renderEarningsSignalInDot(dotElement, data) {
	    injectPanelStyles();

	    dotElement.innerHTML = generateSignalHTML(data);

	    var signalWrap = dotElement.querySelector('.signal-wrap');
	    if (signalWrap) {
	        signalWrap.style.maxHeight = 'none';
	        signalWrap.style.overflow  = 'visible';
	        signalWrap.style.width     = '100%';
	        signalWrap.addEventListener('wheel',     function(e) { e.stopPropagation(); }, { passive: false });
	        signalWrap.addEventListener('touchmove', function(e) { e.stopPropagation(); }, { passive: false });
	    }

	    // Cache
	    dotElement.dataset.signalCached = 'true';
	    dotElement.dataset.signalHTML   = dotElement.innerHTML;

	    addCloseButton(dotElement);

	    // Scroll lock on dot
	    if (!dotElement.dataset.scrollListenerAdded) {
	        dotElement.addEventListener('wheel',     function(e) { e.stopPropagation(); }, { passive: false });
	        dotElement.addEventListener('touchmove', function(e) { e.stopPropagation(); }, { passive: false });
	        dotElement.dataset.scrollListenerAdded = 'true';
	    }

	    return dotElement.id;
	}



	// ─────────────────────────────────────────────
	// CLOSE PINNED DOT
	// ─────────────────────────────────────────────
	function closePinnedDot() {
	    if (pinnedDotId === null) return;
	    var id = pinnedDotId;
	    pinnedDotId = null;
	    var dotElement = document.getElementById('dot-' + id);
	    if (!dotElement) return;

	    dotElement.dataset.dotState = 'normal';
	    var domId = dotElement.id;

	    var state = dotStateRegistry[domId];
	    if (state) {
	        // ✅ Restore manually and clean up
	        if (state.innerHTML !== undefined) dotElement.innerHTML = state.innerHTML;
	        if (state.className !== undefined) dotElement.className = state.className;
	        if (state.style && state.style.cssText) {
	            dotElement.style.cssText = state.style.cssText;
	        }
	        // Restore signal cache
	        if (dotElement.dataset) {
	            for (var key in state.dataset) {
	                if (state.dataset.hasOwnProperty(key)) {
	                    dotElement.dataset[key] = state.dataset[key];
	                }
	            }
	        }
	        var savedBgClr = dotElement.dataset.savedBgClr;
	        if (savedBgClr) {
	            dotElement.style.backgroundColor = savedBgClr;
	            dotElement.savedpastel = savedBgClr;
	        }
	        dotElement.style.opacity    = '1';
	        dotElement.style.visibility = 'visible';
	        dotElement.dataset.dotState = 'normal';
	        delete dotStateRegistry[domId];
	    }

	    shrinkdot(dotElement);
	}

	// Fetch & render signal (called only on click)
	function fetchAndRenderSignal(dotElement, obj) {
	    // Prevent duplicate fetches if already rendering
	    if (dotElement._isFetching) return;
	    dotElement._isFetching = true;

	    fetch('/newauth/api/earnings/' + encodeURIComponent(obj.data.Ticker), {
	        method: 'GET',
	        headers: { 'Content-Type': 'application/json' }
	    })
	    .then(function(response) {
	        if (!response.ok) throw new Error('API error: ' + response.status);
	        return response.json();
	    })
	    .then(function(signalData) {
	        // Only render if dot is still in DOM
	        if (document.body.contains(dotElement)) {
	            renderEarningsSignalInDot(dotElement, signalData);
	        }
	    })
	    .catch(function(error) {
	        console.error('Failed to fetch signal data for obj', obj.id, error);
	    })
	    .finally(function() {
	        dotElement._isFetching = false;
	    });
	}
	
	// Pull this out of renderEarningsSignalInDot so both hover and click can use it
	function applySmartPositioning(dotElement) {
	    var rect = dotElement.getBoundingClientRect();
	    var viewportWidth   = window.innerWidth;
	    var viewportHeight  = window.innerHeight;
	    var isLeft = rect.left < viewportWidth  / 2;
	    var isTop  = rect.top  < viewportHeight / 2;

	    var horizontalMargin = 20;
	    var verticalMargin   = 20;
	    var availW, availH;

	    dotElement.style.position   = 'fixed';
	    dotElement.style.zIndex     = '999999';
	    dotElement.style.transform  = 'none';
	    dotElement.style.transition = 'none';

	    if (isLeft) {
	        dotElement.style.left  = Math.max(horizontalMargin, rect.left) + 'px';
	        dotElement.style.right = 'auto';
	        availW = viewportWidth - rect.left - horizontalMargin;
	    } else {
	        dotElement.style.right = Math.max(horizontalMargin, viewportWidth - rect.right) + 'px';
	        dotElement.style.left  = 'auto';
	        availW = rect.right - horizontalMargin;
	    }

	    if (isTop) {
	        dotElement.style.top    = Math.max(verticalMargin, rect.top) + 'px';
	        dotElement.style.bottom = 'auto';
	        availH = viewportHeight - rect.top - verticalMargin;
	    } else {
	        dotElement.style.bottom = Math.max(verticalMargin, viewportHeight - rect.bottom) + 'px';
	        dotElement.style.top    = 'auto';
	        availH = rect.bottom - verticalMargin;
	    }

	    dotElement.style.maxWidth  = Math.min(availW, 640)                   + 'px';
	    dotElement.style.maxHeight = Math.min(availH, viewportHeight * 0.80) + 'px';
	    dotElement.style.width      = 'auto';
	    dotElement.style.height     = 'auto';
	    dotElement.style.minWidth   = '340px';
	    dotElement.style.overflow   = 'auto';
	    
	    dotElement.style.border     = '2px solid #d1d5db';
	    dotElement.style.borderRadius = '16px';
	    dotElement.style.boxShadow  = '0 20px 40px rgba(0,0,0,0.2)';
	}
	
	// Define ONCE at module/file level, outside all other functions
	function injectPanelStyles() {
	    var styleId = 'earnings-panel-styles';
	    if (document.getElementById(styleId)) return;
	    
	    var style = document.createElement('style');
	    style.id = styleId;
	    style.textContent = `
	        @keyframes panelExpand {
	            from { opacity: 0; transform: scale(0.95); }
	            to   { opacity: 1; transform: scale(1); }
	        }
	        .earnings-panel {
	            animation: panelExpand 0.2s ease-out;
	        }
	    `;
		style.textContent += [
		    '@keyframes cardToDot {',
		    '  from { opacity: 1; transform: scale(1); border-radius: 16px; }',
		    '  to   { opacity: 0; transform: scale(0.1); border-radius: 50%; }',
		    '}',
		    '@keyframes dotToCard {',
		    '  from { opacity: 0; transform: scale(0.1); border-radius: 50%; }',
		    '  to   { opacity: 1; transform: scale(1); border-radius: 16px; }',
		    '}',
		    '.dot-collapsing {',
		    '  animation: cardToDot 0.25s cubic-bezier(0.4, 0, 1, 1) forwards !important;',
		    '  pointer-events: none !important;',
		    '}',
		    '.dot-expanding {',
		    '  animation: dotToCard 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;',
		    '}'
		].join('');
	    document.head.appendChild(style);
	}
	
	

	// Create tooltip element
	let tooltipEl = null;
	function getTooltipElement() {
		if (!tooltipEl) {
			tooltipEl = document.createElement('div');
			tooltipEl.className = 'price-tooltip';
			document.body.appendChild(tooltipEl);
		}
		return tooltipEl;
	}

	function showTooltip(event, text) {
		const tooltip = getTooltipElement();
		tooltip.textContent = text;
		tooltip.classList.add('visible');

		const dot = event.currentTarget;
		const rect = dot.getBoundingClientRect();

		// Position tooltip above the dot, centered
		const tooltipRect = tooltip.getBoundingClientRect();
		let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
		let top = rect.top - tooltipRect.height - 8;

		// Prevent tooltip from going off-screen left
		if (left < 5) {
			left = 5;
		}

		// Prevent tooltip from going off-screen right
		if (left + tooltipRect.width > window.innerWidth - 5) {
			left = window.innerWidth - tooltipRect.width - 5;
		}

		// If tooltip would go above viewport, show it below instead
		if (top < 5) {
			top = rect.bottom + 8;
		}

		tooltip.style.left = `${left}px`;
		tooltip.style.top = `${top}px`;

		const dotColor = window.getComputedStyle(dot).backgroundColor;
		tooltip.style.backgroundColor = dotColor;
	}

	function hideTooltip() {
		const tooltip = getTooltipElement();
		tooltip.classList.remove('visible');
	}

	function renderPriceMoves(data, containerId) {

		injectPriceMovesStyles();

		const container = document.getElementById(containerId);
		if (!container) return;



		container.innerHTML = '';
		container.className = 'price-moves-container';
		container.style.zIndex = 1;
		container.style.position = 'relative';

		const height = container.offsetHeight || 100;

		const centerLine = document.createElement('div');
		centerLine.className = 'center-line';
		container.appendChild(centerLine);

		const grouped = groupByDate(data);

		Object.entries(grouped).forEach(([date, items]) => {
			const column = document.createElement('div');
			column.className = 'date-column';

			const label = document.createElement('div');
			label.className = 'date-label';
			const [year, month, day] = date.split('-');
			const dateObj = new Date(year, month - 1, day); // month is 0-indexed

			const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 5 = Friday

			//console.log('dayOfWeek ' + dayOfWeek);
			if (dayOfWeek === 5) {
				column.classList.add('friday-column');
			}

			label.textContent = dateObj.toLocaleDateString('en-US', {
				month: 'short',
				day: '2-digit'
			});
			column.appendChild(label);

			const upMoves = items.filter(i => i.change > 0);
			const downMoves = items.filter(i => i.change < 0);
			const leftPositions = ['10%', '30%', '50%', '70%', '80%'];

			upMoves.forEach((item, i) => {
				const dot = createDot(item, height);
				dot.style.left = leftPositions[i % 5];
				column.appendChild(dot);
			});

			downMoves.forEach((item, i) => {
				const dot = createDot(item, height);
				dot.style.left = leftPositions[i % 5];
				column.appendChild(dot);
			});

			container.appendChild(column);
		});

		// Scroll to show the most recent dates (rightmost)
		setTimeout(() => {
			container.scrollLeft = container.scrollWidth - container.clientWidth;
		}, 0);

		// ADD hover logic to container
		let hoverTimer = null;
		let resetTimer = null;

		container.style.transition = 'box-shadow 0.2s ease, z-index 0.2s ease';

		container.addEventListener('mouseenter', () => {
			clearTimeout(resetTimer);
			hoverTimer = setTimeout(() => {
				container.style.zIndex = '999';
				container.style.boxShadow = '0 8px 16px rgba(0,0,0,0.35)'
			}, 300); // 1 second delay
		});

		container.addEventListener('mouseleave', () => {
			clearTimeout(hoverTimer);
			resetTimer = setTimeout(() => {
				container.style.zIndex = '1';
				container.style.boxShadow = 'none';
			}, 600); // fade out delay
		});


		setTimeout(() => {
			toggleDelayedMouseover(true);
		}, 2500);
	}

	function groupByDate(data) {
		return data.reduce((acc, item) => {
			acc[item.dateString] = acc[item.dateString] || [];
			acc[item.dateString].push(item);
			return acc;
		}, {});
	}

	const pastelPalette = [
		"#c62828", "#e65100", "#f9a825", "#388e3c", "#1976d2",
		"#512da8", "#c2185b", "#00838f", "#7b1fa2"
	];

	function getColorForNumber(num) {
		const validKeys = [11, 12, 13, 21, 22, 23, 31, 32, 33];
		const index = validKeys.indexOf(num);
		return index !== -1 ? pastelPalette[index] : null;
	}

	function createDot(item, height) {
		const dot = document.createElement('div');
		dot.className = 'evt-dot ' + (item.change >= 0 ? 'up' : 'down');

		// Add exclamation for extreme moves in tooltip
		const isExtreme = Math.abs(item.change) >= 100;
		const tooltipText = `${item.ticker}: ${item.price.toFixed(0)} (${item.change.toFixed(0)}%${isExtreme ? '!' : ''})`;

		// Add event listeners for tooltip
		let longHoverTimer = null;
		let similardotsmaskapplied = false;
		dot.addEventListener('mouseenter', (e) => {
			showTooltip(e, tooltipText); // immediate tooltip

			longHoverTimer = setTimeout(() => {
				masksimilardots(item.ticker, true);
				similardotsmaskapplied = true;
			}, 1000); // 2 seconds
		});

		dot.addEventListener('mouseleave', () => {
			hideTooltip();
			if (similardotsmaskapplied) {
				masksimilardots(item.ticker, false);
				similardotsmaskapplied = false;
			}
			clearTimeout(longHoverTimer); // cancel if hover ends early
		});

		let size = 2;
		if (item.price >= 50 && item.price < 300) size = 5;
		else if (item.price >= 300 && item.price < 500) size = 8;
		else if (item.price >= 500) size = 11;

		dot.style.width = `${size}px`;
		dot.style.height = `${size}px`;

		// Account for dot size and add padding
		const halfSize = size / 2;
		const maxOffset = height / 2 - halfSize - 2;

		// Cap display at 100% - anything beyond shows at max position
		const displayChange = Math.max(-100, Math.min(100, item.change));
		const offset = Math.min(Math.abs(displayChange) * (maxOffset / 50), maxOffset);

		const y = item.change > 0
			? height / 2 - offset
			: height / 2 + offset;

		dot.style.top = `${y}px`;
		dot.style.transform = `translateX(-50%)`;
		dot.setAttribute('data-ticker', item.ticker);

		const firstChar = alphabetLocation(item.ticker.charAt(0));
		const secondChar = alphabetLocation(item.ticker.charAt(1));
		dot.style.backgroundColor = getColorForNumber(parseInt(firstChar) * 10 + parseInt(secondChar));

		return dot;
	}

	function addAccordionToggleRight(wrapperId) {
		const wrapper = document.getElementById(wrapperId);
		if (!wrapper) return;


		if (!document.getElementById('accordion-toggle-style')) {
			const style = document.createElement('style');
			style.id = 'accordion-toggle-style';
			style.textContent = `
      .accordion-wrapper {
        position: relative;
        transition: transform 0.4s ease, opacity 0.4s ease;
      }
      .accordion-collapsed {
        transform: translateX(-100%);
        opacity: 0;
        pointer-events: none;
      }
      .accordion-expand-btn {
        position: fixed;
        left: 0;
        transform: translateY(-50%);
        background: #eee;
        border: 1px solid #ccc;
        border-left: none;
        border-radius: 0 4px 4px 0;
        padding: 3px 5px;
        cursor: pointer;
        font-size: 16px;
        z-index: 1000;
        display: none;
      }
      .accordion-collapse-btn {
        position: absolute;
        top: 50%;
        right: 12.5%;
        transform: translateY(-50%);
        background: #eee;
        border: 1px solid #ccc;
        border-right: none;
        border-radius: 4px 0 0 4px;
        padding: 3px 5px;
        cursor: pointer;
        font-size: 16px;
        z-index: 10;
      }
	  .accordion-color-toggle {
		position: absolute;
        top:10%;
        right: 13%;
        transform: translateY(-50%);
	    z-index: 999;
	    display: flex;
	    align-items: center;
	    gap: 8px;
	    font-size: 14px;
	    font-family: sans-serif;
	    cursor: pointer;
	    user-select: none;
	  }

	  .toggle-switch {
	    position: relative;
	    width: 20px;
	    height: 10px;
	    background: #ccc;
	    border-radius: 5px;
	    transition: background 0.3s ease;
	  }

	  .toggle-switch::before {
	    content: '';
	    position: absolute;
	    top: 1px;
	    left: 1px;
	    width: 8px;
	    height: 8px;
	    background: #fff;
	    border-radius: 50%;
	    transition: transform 0.3s ease;
	  }

	  .toggle-switch.active {
	    background: #4caf50;
	  }

	  .toggle-switch.active::before {
	    transform: translateX(10px);
	  }


    `;
			document.head.appendChild(style);
		}

		wrapper.classList.add('accordion-wrapper');

		const collapseBtn = document.createElement('button');
		collapseBtn.className = 'accordion-collapse-btn';
		collapseBtn.textContent = '<';

		const expandBtn = document.createElement('button');
		expandBtn.className = 'accordion-expand-btn';
		expandBtn.textContent = '>';
		expandBtn.style.display = 'none';

		collapseBtn.onclick = () => {
			// Calculate the wrapper's center position before collapsing
			const rect = wrapper.getBoundingClientRect();
			const centerY = rect.top + (rect.height / 2);

			wrapper.classList.add('accordion-collapsed');
			collapseBtn.style.display = 'none';
			expandBtn.style.display = 'block';
			expandBtn.style.top = `${centerY}px`;
		};

		expandBtn.onclick = () => {
			wrapper.classList.remove('accordion-collapsed');
			expandBtn.style.display = 'none';
			collapseBtn.style.display = 'block';
		};

		const colorToggleWrapper = document.createElement('div');
		colorToggleWrapper.className = 'accordion-color-toggle';

		const colorLabel = document.createElement('span');
		colorLabel.textContent = 'Use Event Color';
		colorLabel.style.color = '#888';
		colorLabel.style.fontSize = '11px';

		const toggleSwitch = document.createElement('div');
		toggleSwitch.className = 'toggle-switch';

		colorToggleWrapper.appendChild(colorLabel);
		colorToggleWrapper.appendChild(toggleSwitch);
		wrapper.appendChild(colorToggleWrapper);



		toggleSwitch.onclick = (event) => {
			event.stopPropagation();

			if (colorMode == '') colorMode = 'uniform';

			colorMode = colorMode === 'event' ? 'uniform' : 'event';
			toggleSwitch.classList.toggle('active', colorMode === 'event');

			if (colorMode === 'event') {
				applyEventColors();
			} else {
				applyUniformColor();
			}
		};

		wrapper.appendChild(collapseBtn);
		document.body.appendChild(expandBtn);
		adjustCanvasForTopPanel();
	}
	
	function adjustCanvasForTopPanel() {
	    var topPanel = document.getElementById('price-moves-wrapper');
	    var canvas   = document.getElementById('topic-page-id');
	    if (!topPanel || !canvas) return;

	    var panelHeight = topPanel.offsetHeight;
	    canvas.style.transition = 'margin-top 0.3s ease';
	    canvas.style.marginTop  = (panelHeight + 10) + 'px'; // 10px breathing room
	}
	
	function masksimilardots(ticker, apply) {
		document.querySelectorAll('.dot').forEach(dot => {

			const tickerfirstChar = alphabetLocation(ticker.charAt(0) || '');
			const tickersecondChar = alphabetLocation(ticker.charAt(1) || '');

			const firstChar = alphabetLocation(dot.textContent.charAt(0) || '');
			const secondChar = alphabetLocation(dot.textContent.charAt(1) || '');

			if (tickerfirstChar == firstChar && tickersecondChar == secondChar) {
				if (apply)
					dot.style.display = 'block';
				else
					dot.style.display = 'none';
			} else {
				if (apply)
					dot.style.display = 'none';
				else
					dot.style.display = 'block';
			}
		});


	}


	let handlerRegistry = new Map();

	function toggleDelayedMouseover(enable = true) {
		const elements = document.querySelectorAll(`.dot`);
		//console.log('dot elemts found ' + elements.length);
		elements.forEach(el => {

			//console.log('attaching to ' + el.textContent);
			let timer;

			const delayedHandler = () => {

				timer = setTimeout(() => masksimilarevents(el.textContent, true), 1000);
			};

			const cleardotTimer = () => {
				clearTimeout(timer);
				masksimilarevents(el.textContent, false);
			};

			if (enable) {
				if (!handlerRegistry.has(el)) {
					el.addEventListener('mouseover', delayedHandler);
					el.addEventListener('mouseout', cleardotTimer);
					handlerRegistry.set(el, { delayedHandler, cleardotTimer });
				}
			} else {
				const registered = handlerRegistry.get(el);
				if (registered) {
					el.removeEventListener('mouseover', registered.delayedHandler);
					el.removeEventListener('mouseout', registered.cleardotTimer);
					handlerRegistry.delete(el);
				}
			}
		});
	}


	function masksimilarevents(ticker, apply) {
		// Inject CSS if not already present
		if (!document.getElementById('highlight-dot-style')) {
			const style = document.createElement('style');
			style.id = 'highlight-dot-style';
			style.textContent = `
      @keyframes pulseDot {
        0% { transform: scale(1); box-shadow: none; }
        50% { transform: scale(1.5); box-shadow: 0 0 10px rgba(255, 165, 0, 0.6); }
        100% { transform: scale(1); box-shadow: none; }
      }

      .highlight-dot {
        animation: pulseDot 2s ease;
      }

      .price-moves-container {
        transition: opacity 0.5s ease;
      }
    `;
			document.head.appendChild(style);
		}

		const container = document.querySelector('.price-moves-container');
		const dots = document.querySelectorAll('.evt-dot');

		const tickerfirstChar = alphabetLocation(ticker.charAt(0) || '');
		const tickersecondChar = alphabetLocation(ticker.charAt(1) || '');

		// Apply fade-in effect
		if (apply) {
			container.style.zIndex = '999';
		} else {
			setTimeout(() => {
				container.style.zIndex = '1';
			}, 500); // Delay lowering z-index until fade-out completes
		}

		dots.forEach(dot => {
			const firstChar = alphabetLocation(dot.getAttribute('data-ticker').charAt(0) || '');
			const secondChar = alphabetLocation(dot.getAttribute('data-ticker').charAt(1) || '');

			const isSimilar = tickerfirstChar === firstChar && tickersecondChar === secondChar;

			if (isSimilar) {
				if (apply) {
					dot.style.display = 'block';
					dot.classList.add('highlight-dot');
					setTimeout(() => {
						dot.classList.remove('highlight-dot');
					}, 1500);
				} else {
					dot.style.display = 'none';
				}
			} else {
				dot.style.display = apply ? 'none' : 'block';
			}
		});
	}



	let colorMode = ''; // default

	function applyEventColors() {
		document.querySelectorAll('.dot').forEach(dot => {
			const firstChar = alphabetLocation(dot.textContent.charAt(0) || '');
			const secondChar = alphabetLocation(dot.textContent.charAt(1) || '');
			const color = getColorForNumber(parseInt(firstChar) * 10 + parseInt(secondChar));
			if (color) dot.style.backgroundColor = color;
		});
	}

	function applyUniformColor() {
		document.querySelectorAll('.dot').forEach(dot => {
			dot.style.backgroundColor = dot.dataset.savedBgClr;
		});
	}

	window.PriceMoves = {
		render: renderPriceMoves,
		toggle: addAccordionToggleRight,
		signal: fetchAndRenderSignal,
		restoreDotState: restoreDotState,
		closePinnedDot: closePinnedDot,
		applySmartPositioning: applySmartPositioning,
		saveDotState: saveDotState,
		smartExpand: smartExpand,
		showBasicPopup: showBasicPopup,
		showSignal:showSignal,
		addCloseButton:addCloseButton,
		animatedRestore: animatedRestore
	};
	
	PriceMoves.getPinnedId = function() { return pinnedDotId; };
	PriceMoves.setPinnedId = function(id) { 
	    
	    pinnedDotId = id; 
	};
	
	// In marketEventsRenderer.js, add to PriceMoves exports:
	PriceMoves.clearStateRegistry = function(id) {
	    delete dotStateRegistry[id];
	};

	PriceMoves.hasStateRegistry = function(id) {
	    return !!dotStateRegistry[id];
	};
})();