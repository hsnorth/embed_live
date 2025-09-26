document.addEventListener('DOMContentLoaded', () => {
    // Configuration for which sections get an animated subtitle
    const sectionsToAnimate = [
        { id: 'essentials', subtitle: 'Stories that mattered this week in Montreal' },
        { id: 'imports', subtitle: 'And what about the stories around the world that mattered here' },
        { id: 'deliveries', subtitle: "What are we monitoring next week?" },
        { id: 'cannoli', subtitle: 'The sweet treat' }
    ];

    // Prepare the HTML structure and hide content for each targeted section
    sectionsToAnimate.forEach(sectionData => {
        const sectionEl = document.getElementById(sectionData.id);
        if (!sectionEl) return;
        const originalTitleEl = sectionEl.querySelector('.section-title');
        if (!originalTitleEl) return;

        // Hide all content elements within the section initially
        const contentElements = Array.from(sectionEl.children).filter(child => !child.classList.contains('section-title'));
        contentElements.forEach(el => el.classList.add('animated-content'));

        const originalTitleText = originalTitleEl.textContent;
        const container = document.createElement('div');
        container.className = 'section-title-container';
        
        container.style.minHeight = `${originalTitleEl.offsetHeight}px`;

        container.innerHTML = `
          <h2 class="typewriter-subtitle" data-subtitle-text="${sectionData.subtitle}"></h2>
          <h2 class="section-title original-title">${originalTitleText}</h2>
        `;
        originalTitleEl.replaceWith(container);
    });

    // Function to simulate the typewriter effect
    const typeWriter = (element, text, callback) => {
        let i = 0;
        element.innerHTML = '';
        const speed = 50; // Typing speed in milliseconds

        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            } else {
                element.classList.add('typing-done'); // Mark as done for cursor animation
                if (callback) callback();
            }
        }
        type();
    };

    // Use Intersection Observer to trigger the animation on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                entry.target.dataset.animated = 'true';
                const subtitleEl = entry.target.querySelector('.typewriter-subtitle');
                const originalTitleEl = entry.target.querySelector('.original-title');
                const subtitleText = subtitleEl.dataset.subtitleText;
                
                // Find the content elements to reveal
                const contentToReveal = entry.target.querySelectorAll('.animated-content');

                typeWriter(subtitleEl, subtitleText, () => {
                    setTimeout(() => {
                        subtitleEl.classList.add('fade-out');
                        originalTitleEl.classList.add('fade-in');
                        
                        // Reveal the main content
                        contentToReveal.forEach(el => el.classList.add('is-visible'));
                    }, 2000);
                });

                observer.unobserve(entry.target);
            }
        });
    }, {
        rootMargin: '0px 0px -20% 0px'
    });

    // Tell the observer to watch the configured sections
    sectionsToAnimate.forEach(sectionData => {
        const sectionEl = document.getElementById(sectionData.id);
        if (sectionEl) {
            observer.observe(sectionEl);
        }
    });
});
