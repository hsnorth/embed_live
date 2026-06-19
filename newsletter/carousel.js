// Horizontal carousels for each magazine section.
// Each section's items lay out in a horizontal scroll-snap track; an arrow +
// "n / total" counter on the right advances through them. Native swipe works on
// touch. Vertical scrolling still moves between (full-height snap) sections.
//
// Runs after content is injected (the 'newsletter-loaded' event from main.js).

(function () {
    // Sections to carousel-ify and which inner element holds the items.
    const SECTIONS = [
        { id: 'essentials', track: '.essentials-container' },
        { id: 'imports', track: '.essentials-container' },
        { id: 'deliveries', track: '.essentials-container' },
        { id: 'cannoli', track: '.cannoli-text-content' },
        { id: 'coffee', track: '.essentials-container' }
    ];

    function buildCarousel(sectionEl, trackSelector) {
        const track = sectionEl.querySelector(trackSelector);
        if (!track) return;
        const items = Array.from(track.children).filter(c => c.classList.contains('essential-item'));
        if (items.length === 0) return;

        // Avoid double-initialising on re-render.
        if (sectionEl.dataset.carousel === 'true') {
            // Re-sync item count if it changed.
            refreshControls(sectionEl, track, items);
            return;
        }
        sectionEl.dataset.carousel = 'true';
        track.classList.add('carousel-track');
        // Wrap the track so arrows can sit on each side, vertically centered.
        const wrapper = document.createElement('div');
        wrapper.className = 'carousel-wrapper';
        track.parentNode.insertBefore(wrapper, track);
        wrapper.appendChild(track);

        const controls = document.createElement('div');
        controls.className = 'carousel-controls';
        controls.innerHTML = `
            <div class="carousel-side carousel-side-prev">
                <button class="carousel-prev" type="button" aria-label="Previous">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <span class="carousel-num carousel-num-prev"></span>
            </div>
            <div class="carousel-side carousel-side-next">
                <button class="carousel-next" type="button" aria-label="Next">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
                <span class="carousel-num carousel-num-next"></span>
            </div>
        `;
        wrapper.appendChild(controls);
        // Single-item sections don't need navigation.
        if (items.length <= 1) controls.style.display = 'none';

        const prev = controls.querySelector('.carousel-prev');
        const next = controls.querySelector('.carousel-next');
        const numPrev = controls.querySelector('.carousel-num-prev');
        const numNext = controls.querySelector('.carousel-num-next');

        const getIndex = () => {
            if (!items.length) return 0;
            const itemW = track.scrollWidth / items.length;
            if (!itemW || !isFinite(itemW)) return 0;
            const idx = Math.round(track.scrollLeft / itemW);
            return isFinite(idx) ? Math.max(0, Math.min(items.length - 1, idx)) : 0;
        };
        const goTo = (i) => {
            const clamped = Math.max(0, Math.min(items.length - 1, i));
            const target = items[clamped];
            if (target) track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: 'smooth' });
        };

        prev.addEventListener('click', () => goTo(getIndex() - 1));
        next.addEventListener('click', () => goTo(getIndex() + 1));

        const updateUI = () => {
            const i = getIndex();
            // Number under each arrow = the item it will take you to (clamped).
            const prevTarget = Math.max(1, i);          // 1-based of previous item
            const nextTarget = Math.min(items.length, i + 2); // 1-based of next item
            numPrev.textContent = i > 0 ? prevTarget : '';
            numNext.textContent = i < items.length - 1 ? nextTarget : '';
            prev.disabled = i <= 0;
            next.disabled = i >= items.length - 1;
            controls.querySelector('.carousel-side-prev').style.visibility = i <= 0 ? 'hidden' : 'visible';
            controls.querySelector('.carousel-side-next').style.visibility = i >= items.length - 1 ? 'hidden' : 'visible';
        };
        let raf = null;
        track.addEventListener('scroll', () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(updateUI);
        });

        sectionEl.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(getIndex() + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(getIndex() - 1); }
        });

        // Defer first measure until layout settles (avoids NaN on 0-width).
        requestAnimationFrame(updateUI);
        setTimeout(updateUI, 300);
    }

    function refreshControls(sectionEl, track, items) {
        // Counters update live on scroll; nothing static to refresh now.
    }

    function initAll() {
        SECTIONS.forEach(s => {
            const sectionEl = document.getElementById(s.id);
            if (sectionEl) buildCarousel(sectionEl, s.track);
        });
        // Enable full-height vertical snap once carousels exist.
        document.body.classList.add('snap-sections');
    }

    document.addEventListener('newsletter-loaded', initAll);
    document.addEventListener('magazine-section-rendered', initAll);
})();
