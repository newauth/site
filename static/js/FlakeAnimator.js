var FlakeAnimator = (function() {

    var BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var SPOKES = 44;

    // ── Lookup map — built once, avoids indexOf per frame ─────────
    var BASE64_MAP = {};
    for (var i = 0; i < BASE64_CHARS.length; i++) {
        BASE64_MAP[BASE64_CHARS[i]] = i;
    }

    // ── Pre-computed spoke angles — cos/sin never change ──────────
    var SPOKE_ANGLES = (function() {
        var step = (Math.PI * 2) / SPOKES;
        var cos = new Float32Array(SPOKES);
        var sin = new Float32Array(SPOKES);
        for (var i = 0; i < SPOKES; i++) {
            var a = i * step - Math.PI / 2;
            cos[i] = Math.cos(a);
            sin[i] = Math.sin(a);
        }
        return { cos: cos, sin: sin };
    })();

    // ── Palettes ──────────────────────────────────────────────────
    var PALETTES = {
        'indigo-violet': {
            barBg:   '#4f46e5',
            barText: '#fff',
            barDot:  '#a5b4fc',
            spokeFn: function(t) { return 'hsl('+(230+t*30)+',72%,'+(50+t*22)+'%)'; },
            tipFn:   function(t) { return 'hsl('+(210+t*40)+',85%,'+(68+t*14)+'%)'; },
            center:  '#4338ca'
        },
        'purple-brand': {
            barBg:   '#5a4ba0',
            barText: '#fff',
            barDot:  '#f0c040',
            spokeFn: function(t) { return 'hsl('+(270+t*20)+',60%,'+(48+t*24)+'%)'; },
            tipFn:   function(t) { return 'hsl('+(280+t*30)+',75%,'+(70+t*12)+'%)'; },
            center:  '#7c3aed'
        },
        'slate-gray': {
            barBg:   '#334155',
            barText: '#e2e8f0',
            barDot:  '#94a3b8',
            spokeFn: function(t) { return 'hsl(215,'+(18+t*22)+'%,'+(42+t*30)+'%)'; },
            tipFn:   function(t) { return 'hsl(210,'+(20+t*15)+'%,'+(65+t*20)+'%)'; },
            center:  '#475569'
        },
        'teal-cyan': {
            barBg:   '#0f766e',
            barText: '#ccfbf1',
            barDot:  '#5eead4',
            spokeFn: function(t) { return 'hsl('+(172+t*20)+',65%,'+(38+t*26)+'%)'; },
            tipFn:   function(t) { return 'hsl('+(180+t*15)+',70%,'+(60+t*18)+'%)'; },
            center:  '#0d9488'
        },
        'rose-pink': {
            barBg:   '#9f1239',
            barText: '#ffe4e6',
            barDot:  '#fda4af',
            spokeFn: function(t) { return 'hsl('+(340+t*20)+',68%,'+(44+t*22)+'%)'; },
            tipFn:   function(t) { return 'hsl('+(350+t*15)+',80%,'+(68+t*14)+'%)'; },
            center:  '#be123c'
        },
        'amber-gold': {
            barBg:   '#92400e',
            barText: '#fef3c7',
            barDot:  '#fcd34d',
            spokeFn: function(t) { return 'hsl('+(32+t*14)+',80%,'+(42+t*28)+'%)'; },
            tipFn:   function(t) { return 'hsl('+(38+t*10)+',90%,'+(62+t*16)+'%)'; },
            center:  '#b45309'
        },
        'dark-minimal': {
            barBg:   '#18181b',
            barText: '#e4e4e7',
            barDot:  '#71717a',
            spokeFn: function(t) { return 'hsl(240,'+(8+t*10)+'%,'+(30+t*40)+'%)'; },
            tipFn:   function(t) { return 'hsl(240,'+(10+t*8)+'%,'+(55+t*25)+'%)'; },
            center:  '#3f3f46'
        },
        'white-frosted': {
            barBg:   '#f1f5f9',
            barText: '#1e293b',
            barDot:  '#6366f1',
            spokeFn: function(t) { return 'hsl(220,'+(20+t*15)+'%,'+(55+t*30)+'%)'; },
            tipFn:   function(t) { return 'hsl(225,'+(30+t*20)+'%,'+(72+t*15)+'%)'; },
            center:  '#94a3b8'
        }
    };

    // ── Helpers ───────────────────────────────────────────────────
    function randomFlake() {
        var out = new Float32Array(SPOKES);
        for (var i = 0; i < SPOKES; i++) {
            out[i] = Math.random();
        }
        return out;
    }

    function flakeToValues(input) {
        var out = new Float32Array(SPOKES);
        if (!input) return randomFlake();
        var str = Array.isArray(input) ? input.join('') : String(input);
        for (var i = 0; i < SPOKES; i++) {
            var ch = str[i % str.length];
            out[i] = ((BASE64_MAP[ch] || 0)) / 63;
        }
        return out;
    }

    function easeInOut(t) {
        return t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    }

    function resolvePalette(p) {
        if (!p) return PALETTES['purple-brand'];
        if (typeof p === 'string') return PALETTES[p] || PALETTES['purple-brand'];
        return p;
    }

    // ── Draw ──────────────────────────────────────────────────────
	function drawFlakeSpokes(ctx, size, values, palette) {
	    var cx = size/2, cy = size/2;
	    var isSmall = size <= 24;
	    var r      = size * (isSmall ? 0.46 : 0.46); // ← was 0.44/0.43, now 0.46 both
	    var innerR = size * (isSmall ? 0.05 : 0.06);  // ← slightly smaller inner = longer spokes
	    var minLineW = isSmall ? 1.1 : 0.7;           // ← was 0.9/0.5, thicker minimum

        for (var i = 0; i < SPOKES; i++) {
            var t  = values[i];
            var sr = innerR + t * (r - innerR);
            var x1 = cx + SPOKE_ANGLES.cos[i] * innerR;
            var y1 = cy + SPOKE_ANGLES.sin[i] * innerR;
            var x2 = cx + SPOKE_ANGLES.cos[i] * sr;
            var y2 = cy + SPOKE_ANGLES.sin[i] * sr;

			ctx.lineWidth = Math.max(minLineW, size*0.026*t + size*(isSmall ? 0.014 : 0.010));

            ctx.strokeStyle = palette.spokeFn(t);
            ctx.lineCap     = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            var dotR = Math.max(isSmall ? 0.9 : 0.7, size*(isSmall ? 0.032 : 0.026)*t);
            ctx.beginPath();
            ctx.arc(x2, y2, dotR, 0, Math.PI*2);
            ctx.fillStyle = palette.tipFn(t);
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, size*(isSmall ? 0.07 : 0.055), 0, Math.PI*2);
        ctx.fillStyle = palette.center;
        ctx.fill();
    }

    // ── Logo Animator ─────────────────────────────────────────────
    function Animator(canvas, options) {
        options       = options || {};
        this.canvas   = canvas;
        this.ctx      = canvas.getContext('2d');
        this.size     = canvas.width;
        this.palette  = resolvePalette(options.palette);
        this.duration = options.duration || 2800;
        this.hold     = options.hold     || 1800;
        this.current  = randomFlake();
        this.next     = randomFlake();
        this._buf     = new Float32Array(SPOKES);
        this.phase     = 'hold';
        this.phaseStart = performance.now();
        this._running  = true;
        this._raf      = null;

        // Draw first frame immediately so canvas isn't blank
        drawFlakeSpokes(this.ctx, this.size, this.current, this.palette);

        var self = this;
        this._raf = setTimeout(function() {
            requestAnimationFrame(function(ts) { self._tick(ts); });
        }, this.hold);
    }

    Animator.prototype._tick = function(ts) {
        if (!this._running) return;
        var self = this;

        if (this.phase === 'hold') {
            this.phase = 'transition';
            this.phaseStart = ts;
        }

        var elapsed = ts - this.phaseStart;
        var t = Math.min(elapsed / this.duration, 1);
        var et = easeInOut(t);

        // Lerp into pre-allocated buffer — no allocation per frame
        var a = this.current, b = this.next, buf = this._buf;
        for (var i = 0; i < SPOKES; i++) {
            buf[i] = a[i] + (b[i] - a[i]) * et;
        }

        this.ctx.clearRect(0, 0, this.size, this.size);
        drawFlakeSpokes(this.ctx, this.size, buf, this.palette);

        if (t >= 1) {
            // Swap buffers — reuse current as next's target
            var tmp    = this.current;
            this.current = this.next;
            this.next    = tmp;
            // Fill next with new random values in place
            for (var i = 0; i < SPOKES; i++) {
                this.next[i] = Math.random();
            }
            this.phase = 'hold';
            this.phaseStart = ts;
            // Sleep for hold duration — no rAF spinning
            this._raf = setTimeout(function() {
                requestAnimationFrame(function(ts) { self._tick(ts); });
            }, self.hold);
            return;
        }

        this._raf = requestAnimationFrame(function(ts) { self._tick(ts); });
    };

    Animator.prototype.stop = function() {
        this._running = false;
        clearTimeout(this._raf);
        cancelAnimationFrame(this._raf);
    };

    Animator.prototype.start = function() {
        if (this._running) return;
        this._running = true;
        this.phase = 'hold';
        this.phaseStart = performance.now();
        var self = this;
        this._raf = setTimeout(function() {
            requestAnimationFrame(function(ts) { self._tick(ts); });
        }, 0);
    };

    Animator.prototype.setFlake = function(base64str) {
        var vals = flakeToValues(base64str);
        for (var i = 0; i < SPOKES; i++) this.next[i] = vals[i];
        this.phase = 'transition';
        this.phaseStart = performance.now();
        clearTimeout(this._raf);
        cancelAnimationFrame(this._raf);
        var self = this;
        this._raf = requestAnimationFrame(function(ts) { self._tick(ts); });
    };

    Animator.prototype.setPalette = function(name) {
        this.palette = resolvePalette(name);
    };

    // Static one-shot draw — no animation
    Animator.drawStatic = function(canvas, flakeStr, paletteName) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawFlakeSpokes(ctx, canvas.width,
            flakeStr ? flakeToValues(flakeStr) : randomFlake(),
            resolvePalette(paletteName));
    };

    Animator.PALETTES = PALETTES;

    // ── Favicon Animator ──────────────────────────────────────────
    function FaviconAnimator(options) {
        options        = options || {};
        this.size      = 32;
        this.canvas    = document.createElement('canvas');
        this.canvas.width  = this.size;
        this.canvas.height = this.size;
        this.ctx       = this.canvas.getContext('2d');
        this.palette   = resolvePalette(options.palette);
        this.duration  = options.duration || 2800;
        this.hold      = options.hold     || 1800;
        this.current   = randomFlake();
        this.next      = randomFlake();
        this._buf      = new Float32Array(SPOKES);
        this.phase      = 'hold';
        this.phaseStart = performance.now();
        this._running   = true;
        this._raf       = null;

        this._link = document.querySelector("link[rel~='icon']");
        if (!this._link) {
            this._link      = document.createElement('link');
            this._link.rel  = 'icon';
            this._link.type = 'image/png';
            document.head.appendChild(this._link);
        }

        // Draw and push first frame immediately
        this._draw(this.current);
        this._link.href = this.canvas.toDataURL('image/png');

        //var self = this;
        //this._raf = setTimeout(function() { self._tick(); }, this.hold);
    }

	FaviconAnimator.prototype._draw = function(values) {
	    var ctx  = this.ctx;
	    var size = this.size;
	    ctx.clearRect(0, 0, size, size);

	    // Background
	    var radius = 10;
	    ctx.beginPath();
	    ctx.moveTo(radius, 0);
	    ctx.lineTo(size - radius, 0);
	    ctx.quadraticCurveTo(size, 0, size, radius);
	    ctx.lineTo(size, size - radius);
	    ctx.quadraticCurveTo(size, size, size - radius, size);
	    ctx.lineTo(radius, size);
	    ctx.quadraticCurveTo(0, size, 0, size - radius);
	    ctx.lineTo(0, radius);
	    ctx.quadraticCurveTo(0, 0, radius, 0);
	    ctx.closePath();
	    ctx.fillStyle = '#f8fafc';
	    ctx.fill();

	    // Spokes drawn first
	    drawFlakeSpokes(ctx, size, values, this.palette);

	    // Border drawn on top — won't get covered
	    ctx.beginPath();
	    ctx.moveTo(radius, 0);
	    ctx.lineTo(size - radius, 0);
	    ctx.quadraticCurveTo(size, 0, size, radius);
	    ctx.lineTo(size, size - radius);
	    ctx.quadraticCurveTo(size, size, size - radius, size);
	    ctx.lineTo(radius, size);
	    ctx.quadraticCurveTo(0, size, 0, size - radius);
	    ctx.lineTo(0, radius);
	    ctx.quadraticCurveTo(0, 0, radius, 0);
	    ctx.closePath();
	    ctx.strokeStyle = '##64748b';
	    ctx.lineWidth = 2;
	    ctx.stroke();
	};
    FaviconAnimator.prototype._tick = function() {
        if (!this._running) return;
        var self = this;
        var now  = performance.now();

        if (this.phase === 'hold') {
            this.phase = 'transition';
            this.phaseStart = now;
        }

        var elapsed = now - this.phaseStart;
        var t  = Math.min(elapsed / this.duration, 1);
        var et = easeInOut(t);
        var a  = this.current, b = this.next, buf = this._buf;

        for (var i = 0; i < SPOKES; i++) {
            buf[i] = a[i] + (b[i] - a[i]) * et;
        }

        this._draw(buf);
        //this._link.href = this.canvas.toDataURL('image/png');

        if (t >= 1) {
            var tmp      = this.current;
            this.current = this.next;
            this.next    = tmp;
            for (var i = 0; i < SPOKES; i++) this.next[i] = Math.random();
            this.phase = 'hold';
            this._raf  = setTimeout(function() { self._tick(); }, self.hold);
            return;
        }

        // 100ms interval = ~10fps — low CPU, smooth enough for favicon
        this._raf = setTimeout(function() { self._tick(); }, 100);
    };

    FaviconAnimator.prototype.stop = function() {
        this._running = false;
        clearTimeout(this._raf);
    };

    FaviconAnimator.prototype.start = function() {
        if (this._running) return;
        this._running = true;
        var self = this;
        this._raf = setTimeout(function() { self._tick(); }, 0);
    };

    FaviconAnimator.prototype.setFlake = function(base64str) {
        var vals = flakeToValues(base64str);
        for (var i = 0; i < SPOKES; i++) this.next[i] = vals[i];
        this.phase = 'transition';
        this.phaseStart = performance.now();
        clearTimeout(this._raf);
        var self = this;
        this._raf = setTimeout(function() { self._tick(); }, 0);
    };

    FaviconAnimator.prototype.setPalette = function(name) {
        this.palette = resolvePalette(name);
    };

    Animator.Favicon = FaviconAnimator;

    // ── Page visibility — pause when tab hidden ───────────────────
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (window.logoFlake)    window.logoFlake.stop();
            if (window.faviconFlake) window.faviconFlake.stop();
        } else {
            if (window.logoFlake)    window.logoFlake.start();
            if (window.faviconFlake) window.faviconFlake.start();
        }
    });

    return Animator;

})();