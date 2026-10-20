// house-tip 1.0.0. Tooltips for anything carrying data-tip, styled by house-data.css (#tip).
// Native title tooltips are slow and unstyled, and never appear on a page that redraws often;
// this places one floating element next to whatever is under the pointer, above it when there
// is room and below it otherwise, and hides it on scroll. No dependencies.
//
//   <div id="tip" role="tooltip"></div>          (once, at the end of <body>)
//   <th data-tip="What this column checks">…</th>
//   import { tooltips } from './house/house-tip.js'; tooltips()
export function tooltips(tip = document.getElementById('tip')) {
  if (!tip) return
  document.addEventListener('mouseover', (e) => {
    const n = e.target.closest?.('[data-tip]')
    if (!n) { tip.style.display = 'none'; return }
    tip.textContent = n.dataset.tip
    tip.style.display = 'block'
    const r = n.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`
    tip.style.top = `${r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8}px`
  })
  addEventListener('scroll', () => { tip.style.display = 'none' }, { passive: true })
}
