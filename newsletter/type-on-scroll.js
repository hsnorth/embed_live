document.addEventListener('DOMContentLoaded', () => {
    // Configuration for which sections get an animated subtitle
    const sectionsToAnimate = [
        { id: 'essentials', subtitle: 'Stories that mattered this week in Montreal' },
        { id: 'imports', subtitle: 'And what about the stories around the world that mattered here' },
        { id: 'deliveries', subtitle: "What are we monitoring next week?" },
        { id: 'cannoli', subtitle: 'The sweet treat' }
    ];

    // Prepare the HTML structure for each targeted section
    sectionsToAnimate.forEach(sectionData => {
        const sectionEl = document.getElementById(sectionData.id);
        if (!sectionEl) return;
        const originalTitleEl = sectionEl.querySelector('.section-title');
        if (!originalTitleEl) return;

        const originalTitleText = originalTitleEl.textContent;
        const container = document.createElement('div');
        container.className = 'section-title-container';
        
        // Set a min-height to prevent layout shifts during the animation
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
            // Check if the section is intersecting and hasn't been animated yet
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                entry.target.dataset.animated = 'true';
                const subtitleEl = entry.target.querySelector('.typewriter-subtitle');
                const originalTitleEl = entry.target.querySelector('.original-title');
                const subtitleText = subtitleEl.dataset.subtitleText;

                // Start the typing animation
                typeWriter(subtitleEl, subtitleText, () => {
                    // After typing is finished, wait 2 seconds
                    setTimeout(() => {
                        subtitleEl.classList.add('fade-out');
                        originalTitleEl.classList.add('fade-in');
                    }, 2000);
                });

                observer.unobserve(entry.target); // Animate only once
            }
        });
    }, {
        rootMargin: '0px 0px -20% 0px' // Trigger when 20% of the section is visible
    });

    // Tell the observer to watch the configured sections
    sectionsToAnimate.forEach(sectionData => {
        const sectionEl = document.getElementById(sectionData.id);
        if (sectionEl) {
            observer.observe(sectionEl);
        }
    });
});
