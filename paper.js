// Общий бумажный стиль bak7580: рваные края листов, поворот, скотч и текстура мятой бумаги.
// Работает со всеми .sheet > .sheet-paper на странице. Атрибуты листа:
//   data-tape="top | tl | tr" (можно несколько через пробел), data-tear="глубина края в px" (по умолчанию 9).
(() => {
  // Seeded PRNG: листы «оторваны» одинаково при каждой загрузке
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Рваный контур: случайное блуждание вдоль каждой стороны, не глубже depth px от края
  function tornPath(w, h, depth, seed) {
    const rand = mulberry32(seed);
    const pts = [];
    const walk = (len, emit) => {
      let off = rand() * depth;
      for (let d = 0; d < len; d += 3 + rand() * 7) {
        off = Math.min(depth, Math.max(0, off + (rand() - 0.5) * depth * 0.8));
        emit(d, off + (rand() - 0.5));
      }
    };
    walk(w, (d, o) => pts.push([d, o]));
    walk(h, (d, o) => pts.push([w - o, d]));
    walk(w, (d, o) => pts.push([w - d, h - o]));
    walk(h, (d, o) => pts.push([o, h - d]));
    return 'polygon(' + pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',') + ')';
  }

  // Текстура мятой бумаги: SVG-фильтр рисуется один раз в canvas и переиспользуется всеми листами
  function makePaperTexture() {
    const S = 900;
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#f6f6f4';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${S}' height='${S}'>
      <filter id='c' x='0' y='0' width='100%' height='100%'>
        <feTurbulence type='turbulence' baseFrequency='0.005 0.007' numOctaves='5' seed='7580' stitchTiles='stitch'/>
        <feDiffuseLighting surfaceScale='2.2' diffuseConstant='1.15' lighting-color='#fff'>
          <feDistantLight azimuth='225' elevation='55'/>
        </feDiffuseLighting>
      </filter>
      <rect width='100%' height='100%' filter='url(#c)'/>
    </svg>`;
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d');
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, S, S);
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.32;
        ctx.drawImage(img, 0, 0);

        // Мелкое зерно поверх заломов
        const data = ctx.getImageData(0, 0, S, S);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const n = (Math.random() - 0.5) * 10;
          px[i] += n; px[i + 1] += n; px[i + 2] += n;
        }
        ctx.putImageData(data, 0, 0);

        c.toBlob(blob => {
          if (blob) document.documentElement.style.setProperty('--paper-tex', `url(${URL.createObjectURL(blob)})`);
        });
      } catch (e) {
        // Canvas недоступен — листы остаются гладкими
      }
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function initPaper() {
    const meta = new WeakMap();
    const tear = paper => {
      const { seed, depth } = meta.get(paper);
      paper.style.clipPath = tornPath(paper.offsetWidth, paper.offsetHeight, depth, seed);
    };
    const ro = 'ResizeObserver' in window ? new ResizeObserver(entries => entries.forEach(e => tear(e.target))) : null;

    document.querySelectorAll('.sheet').forEach((sheet, i) => {
      const paper = sheet.querySelector('.sheet-paper');
      const seed = 7580 + i * 131;
      const rand = mulberry32(seed);

      if (!sheet.hasAttribute('data-flat')) {
        sheet.style.setProperty('--rot', ((0.5 + rand()) * (i % 2 ? 1 : -1)).toFixed(2) + 'deg');
      }
      paper.style.setProperty('--tex-x', Math.round(rand() * 900) + 'px');
      paper.style.setProperty('--tex-y', Math.round(rand() * 900) + 'px');

      (sheet.dataset.tape || '').split(' ').filter(Boolean).forEach(pos => {
        const tape = document.createElement('span');
        tape.className = 'tape tape--' + pos;
        tape.style.setProperty('--tape-rot', ((rand() - 0.5) * 10).toFixed(1) + 'deg');
        sheet.prepend(tape);
      });

      meta.set(paper, { seed, depth: +sheet.dataset.tear || 9 });
      tear(paper);
      if (ro) ro.observe(paper);
    });

    makePaperTexture();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPaper);
  } else {
    initPaper();
  }
})();
