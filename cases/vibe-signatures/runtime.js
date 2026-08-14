(() => {
  const escape = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const splitPoints = body => body.split(/[；。]/).map(item => item.trim()).filter(Boolean).slice(0, 5);
  const parseSlides = content => content.trim().split(/\n\s*\n/).map((block, offset) => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const match = (lines.shift() || '').match(/^第(\d+)页｜(.+)$/);
    const body = lines.join(' ');
    return { number: Number(match?.[1] || offset + 1), title: match?.[2] || `第 ${offset + 1} 页`, body, points: splitPoints(body) };
  });
  const queryColors = defaults => {
    const supplied = (new URLSearchParams(location.search).get('colors') || '').split(',').filter(color => /^#[0-9a-f]{6}$/i.test(color));
    return supplied.length >= 4 ? supplied.slice(0, 4) : defaults;
  };
  const setColors = colors => {
    const root = document.documentElement;
    ['bg','accent','soft','ink'].forEach((name, index) => root.style.setProperty(`--${name}`, colors[index]));
  };
  class Deck {
    constructor() {
      this.slides = [...document.querySelectorAll('.slide')]; this.current = 0; this.stage = document.getElementById('deck-stage'); this.lock = false;
      this.scale(); addEventListener('resize', () => this.scale());
      addEventListener('keydown', event => { if (['ArrowRight','ArrowDown',' ','PageDown'].includes(event.key)) { event.preventDefault(); this.go(1); } if (['ArrowLeft','ArrowUp','PageUp'].includes(event.key)) { event.preventDefault(); this.go(-1); } if (event.key === 'Home') this.show(0); if (event.key === 'End') this.show(this.slides.length - 1); });
      let touchX = 0; addEventListener('touchstart', event => touchX = event.touches[0].clientX, {passive:true}); addEventListener('touchend', event => { const delta = event.changedTouches[0].clientX - touchX; if (Math.abs(delta) > 42) this.go(delta < 0 ? 1 : -1); }, {passive:true});
      addEventListener('wheel', event => { if (this.lock || Math.abs(event.deltaY) < 20) return; this.lock = true; this.go(event.deltaY > 0 ? 1 : -1); setTimeout(() => this.lock = false, 480); }, {passive:true});
      this.show(Math.max(0, Number((location.hash.match(/slide-(\d+)/) || [])[1] || 1) - 1));
    }
    scale() { const factor = Math.min(innerWidth / 1920, innerHeight / 1080); this.stage.style.transform = `translate(${(innerWidth - 1920 * factor) / 2}px,${(innerHeight - 1080 * factor) / 2}px) scale(${factor})`; }
    go(delta) { this.show(this.current + delta); }
    show(index) { this.current = Math.max(0, Math.min(index, this.slides.length - 1)); this.slides.forEach((slide, position) => slide.classList.toggle('active', position === this.current)); document.getElementById('counter').textContent = `${String(this.current + 1).padStart(2,'0')} / ${String(this.slides.length).padStart(2,'0')}`; document.getElementById('progress').style.width = `${(this.current + 1) / this.slides.length * 100}%`; location.hash = `slide-${this.current + 1}`; }
  }
  window.SignatureDeck = {
    escape,
    async boot({ colors, render }) {
      setColors(queryColors(colors));
      const data = await fetch('../../data/vibe-coding-20.json').then(response => response.json());
      const slides = parseSlides(data.content);
      document.getElementById('deck-stage').innerHTML = slides.map((slide, index) => render(slide, index, slides)).join('');
      const deck = new Deck();
      document.getElementById('prev').onclick = () => deck.go(-1); document.getElementById('next').onclick = () => deck.go(1); document.getElementById('full').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    }
  };
})();
