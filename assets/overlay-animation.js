if (!window.Maximize.loadedScript.includes("overlay-animation.js")) {
  window.Maximize.loadedScript.push("overlay-animation.js");

  class OverlayAnimation extends HTMLElement {
    static FIREWORK_DENSITY = 6;
    static PARTICLES_PER_ROCKET = 45;
    static FIRE_COLORS = ["#ff3b3b", "#ffd93d", "#4aeaff", "#9d4bff", "#ffffff"];

    static SNOW_STYLES = {
      light: {
        count: 60,
        sizeMin: 0.5,
        sizeMax: 1,
        speedMin: 0.2,
        speedMax: 1,
        windMin: -0.05,
        windMax: 0.05,
        twinkle: false
      },
      twinkle: {
        count: 150,
        sizeMin: 1,
        sizeMax: 3,
        speedMin: 0.5,
        speedMax: 1.3,
        windMin: -0.2,
        windMax: 0.2,
        twinkle: true
      }
    };

    static SNOW_STYLE = "light";
    static BASE_AREA = 1440 * 900;

    constructor() {
      super();
      this.attachShadow({mode: "open"});

      this.canvas = document.createElement("canvas");
      this.canvas.id = "overlay-animation-canvas";
      const style = this.canvas.style;
      style.position = "fixed";
      style.inset = "0";
      style.width = "100vw";
      style.height = "100vh";
      style.pointerEvents = "none";
      style.zIndex = "999999";

      this.shadowRoot.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      this.DPR = window.devicePixelRatio || 1;

      this.width = 0;
      this.height = 0;
      this.rockets = [];
      this.particles = [];
      this.flakes = [];

      this._resizeHandler = () => this._resize();

      this.mode = this.dataset.animation;
      this.timeout = +(this.dataset.timeout || 0) * 1000;
      this.snowSpeed = 1;
      this.fireworkSpeed = 1;
      this.animatingStarted = false;

      this.snowBitmap = null;
    }

    static rand(a, b) {
      return Math.random() * (b - a) + a;
    }

    static fireColor() {
      const COLORS = OverlayAnimation.FIRE_COLORS;
      return COLORS[Math.floor(OverlayAnimation.rand(0, COLORS.length))];
    }

    connectedCallback() {
      this.mode = this.dataset.animation || this.mode || "none";
      this.timeout = +(this.dataset.timeout || 0) * 1000;
      const {snowSpeed, fireworksSpeed} = this.dataset;

      this.snowSpeed = snowSpeed !== undefined ? parseFloat(snowSpeed) || 1 : 1;
      this.fireworkSpeed = fireworksSpeed !== undefined ? parseFloat(fireworksSpeed) || 1 : 1;

      this.snowSpeed = Math.min(Math.max(this.snowSpeed, 0.2), 3);
      this.fireworkSpeed = Math.min(Math.max(this.fireworkSpeed, 0.5), 2);

      if (this.mode === "none") return;

      this._resize();
      window.addEventListener("resize", this._resizeHandler, {passive: true});

      if (this.mode === "snow") {
        this._createSnowBitmap();
      }

      this.drawInitialFrame();

      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => this.startAnimationAfterRender(), {timeout: 1000});
      } else {
        setTimeout(() => this.startAnimationAfterRender(), 0);
      }
    }

    startAnimationAfterRender() {
      if (this.animatingStarted) return;
      this.animatingStarted = true;
      this.animate();

      if (this.timeout > 0) {
        setTimeout(() => this.remove(), this.timeout);
      }
    }

    disconnectedCallback() {
      window.removeEventListener("resize", this._resizeHandler);
    }

    _resize() {
      const {innerWidth, innerHeight} = window;
      this.width = innerWidth;
      this.height = innerHeight;

      this.canvas.width = this.width * this.DPR;
      this.canvas.height = this.height * this.DPR;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

      if (this.mode === "snow") this.flakes.length = 0;
    }

    spawnRocket() {
      const rockets = this.rockets;
      const width = this.width, height = this.height;
      for (let i = 0; i < OverlayAnimation.FIREWORK_DENSITY; i++) {
        rockets.push({
          x: OverlayAnimation.rand(0, width),
          y: height + 10,
          vx: OverlayAnimation.rand(-1, 1),
          vy: OverlayAnimation.rand(-14, -8),
          ay: 0.14,
          far: OverlayAnimation.rand(height * 0.2, height * 0.55),
          color: OverlayAnimation.fireColor()
        });
      }
    }

    explode(x, y, color) {
      const particles = this.particles;
      for (let i = 0; i < OverlayAnimation.PARTICLES_PER_ROCKET; i++) {
        particles.push({
          x,
          y,
          vx: OverlayAnimation.rand(-4, 4),
          vy: OverlayAnimation.rand(-4, 4),
          ay: 0.06,
          alpha: 1,
          color,
          size: OverlayAnimation.rand(1.4, 3.4),
          life: OverlayAnimation.rand(35, 65)
        });
      }
    }

    get snowOpts() {
      return OverlayAnimation.SNOW_STYLES[OverlayAnimation.SNOW_STYLE];
    }

    _randSnowSize() {
      const r = Math.random();
      if (r < 0.6) {
        return 8 + Math.random() * 10;
      } else {
        return 18 + Math.random() * 14;
      }
    }

    _createSnowBitmap() {
      const size = 64;
      const off = document.createElement("canvas");
      off.width = size;
      off.height = size;
      const c = off.getContext("2d");

      const r = size / 2;
      c.translate(r, r);

      c.clearRect(-r, -r, size, size);

      c.shadowBlur = 10;
      c.shadowColor = "rgba(255, 255, 255, 0.9)";
      c.strokeStyle = "#ffffff";
      c.lineWidth = 2;
      c.lineCap = "round";
      c.lineJoin = "round";

      const armLength = r - 6;
      const branchLen = armLength * 0.35;
      const branchAngle = Math.PI / 6;
      const arms = 6;

      for (let i = 0; i < arms; i++) {
        c.save();
        c.rotate((i * 2 * Math.PI) / arms);

        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(armLength, 0);
        c.stroke();

        const p1 = armLength * 0.4;
        const p2 = armLength * 0.75;

        [p1, p2].forEach((p) => {
          c.beginPath();
          c.moveTo(p, 0);
          c.lineTo(
            p + branchLen * Math.cos(branchAngle),
            branchLen * Math.sin(branchAngle)
          );
          c.stroke();

          c.beginPath();
          c.moveTo(p, 0);
          c.lineTo(
            p + branchLen * Math.cos(branchAngle),
            -branchLen * Math.sin(branchAngle)
          );
          c.stroke();
        });

        c.beginPath();
        c.arc(armLength, 0, 2.2, 0, Math.PI * 2);
        c.stroke();

        c.restore();
      }

      this.snowBitmap = off;
    }

    initSnowflakes() {
      const area = this.width * this.height;
      const scale = Math.min(Math.max(area / OverlayAnimation.BASE_AREA, 0.3), 1.0);
      const opts = this.snowOpts;
      const count = Math.round(opts.count * scale);

      const flakes = this.flakes;
      flakes.length = 0;

      for (let i = 0; i < count; i++) {
        const size = this._randSnowSize();
        flakes.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          size,
          vy: OverlayAnimation.rand(opts.speedMin, opts.speedMax),
          vx: OverlayAnimation.rand(opts.windMin, opts.windMax),
          rot: OverlayAnimation.rand(0, Math.PI * 2),
          vrot: OverlayAnimation.rand(-0.02, 0.02)
        });
      }
    }

    drawInitialFrame() {
      const ctx = this.ctx;
      const width = this.width, height = this.height;

      if (this.mode === "fireworks") {
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = OverlayAnimation.FIRE_COLORS[0];
        ctx.fillStyle = OverlayAnimation.FIRE_COLORS[0];
        ctx.beginPath();
        ctx.arc(width * 0.5, height - 30, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (this.mode === "snow") {
        ctx.clearRect(0, 0, width, height);
        const count = 14;
        for (let i = 0; i < count; i++) {
          const x = ((i * 87) % width) + 20;
          const y = ((i * 209) % height) + 20;
          const size = 10 + (i % 5) * 4;

          ctx.save();
          ctx.globalAlpha = 0.8;
          ctx.translate(x, y);
          ctx.rotate((i % 6) * 0.4 + 0.1);

          if (this.snowBitmap) {
            ctx.drawImage(
              this.snowBitmap,
              -size / 2,
              -size / 2,
              size,
              size
            );
          }
          ctx.restore();
        }
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }

    animate = () => {
      if (!this.animatingStarted) return;

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      if (this.mode === "fireworks") {
        if (Math.random() < 0.02) this.spawnRocket();

        for (let i = this.rockets.length - 1; i >= 0; i--) {
          const r = this.rockets[i];
          r.x += r.vx * this.fireworkSpeed;
          r.y += r.vy * this.fireworkSpeed;
          r.vy += r.ay * this.fireworkSpeed;

          ctx.save();
          ctx.shadowBlur = 20;
          ctx.shadowColor = r.color;
          ctx.fillStyle = r.color;
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          if (r.y <= r.far || r.vy >= -2) {
            this.explode(r.x, r.y, r.color);
            this.rockets.splice(i, 1);
          }
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.x += p.vx * this.fireworkSpeed;
          p.y += p.vy * this.fireworkSpeed;
          p.vy += p.ay * this.fireworkSpeed;
          p.life--;
          p.alpha = p.life / 60;
          if (p.life <= 0 || p.alpha <= 0) {
            this.particles.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.shadowBlur = 25;
          ctx.shadowColor = p.color;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (this.mode === "snow") {
        if (!this.flakes.length) this.initSnowflakes();
        const flakes = this.flakes;
        const width = this.width, height = this.height, snowSpeed = this.snowSpeed;
        const bmp = this.snowBitmap;

        for (let i = 0, len = flakes.length; i < len; i++) {
          const f = flakes[i];
          f.x += f.vx * snowSpeed;
          f.y += f.vy * snowSpeed;
          f.rot += f.vrot * snowSpeed;

          if (f.y > height + 50) f.y = -50;
          if (f.x > width + 50) f.x = -50;
          if (f.x < -50) f.x = width + 50;

          if (!bmp) continue;

          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rot);
          ctx.drawImage(
            bmp,
            -f.size / 2,
            -f.size / 2,
            f.size,
            f.size
          );
          ctx.restore();
        }
      }

      requestAnimationFrame(this.animate);
    };
  }

  if (!customElements.get("overlay-animation")) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        customElements.define("overlay-animation", OverlayAnimation);
      });
    } else {
      setTimeout(() => {
        customElements.define("overlay-animation", OverlayAnimation);
      }, 0);
    }
  }
}
