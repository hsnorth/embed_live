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

        // Build the controls bar (counter + arrow) once per section.
        const controls = document.createElement('div');
        controls.className = 'carousel-controls';
        controls.innerHTML = `
            <button class="carousel-prev" type="button" aria-label="Previous">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <span class="carousel-counter"><span class="carousel-current">1</span> / <span class="carousel-total">${items.length}</span></span>
            <button class="carousel-next" type="button" aria-label="Next">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        `;
        // Place the controls after the track.
        track.insertAdjacentElement('afterend', controls);
        // Single-item sections don't need navigation.
        if (items.length <= 1) controls.style.display = 'none';

        const prev = controls.querySelector('.carousel-prev');
        const next = controls.querySelector('.carousel-next');
        const currentEl = controls.querySelector('.carousel-current');

        const getIndex = () => {
            // Nearest snapped item to the current scroll position.
            const itemW = track.scrollWidth / items.length;
            return Math.round(track.scrollLeft / itemW);
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
            currentEl.textContent = i + 1;
            prev.disabled = i <= 0;
            next.disabled = i >= items.length - 1;
        };
        let raf = null;
        track.addEventListener('scroll', () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(updateUI);
        });

        // Keyboard support when the section is focused.
        sectionEl.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(getIndex() + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(getIndex() - 1); }
        });

        updateUI();
    }

    function refreshControls(sectionEl, track, items) {
        const totalEl = sectionEl.querySelector('.carousel-total');
        if (totalEl) totalEl.textContent = items.length;
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
