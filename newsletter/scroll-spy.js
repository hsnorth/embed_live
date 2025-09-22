// This code only runs on the homepage to control the nav underline on scroll
document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.main-nav');
    if (!nav) return;
    const navUl = nav.querySelector('ul');
    if (!navUl) return;

    const mainSections = document.querySelectorAll('main[id], section.content-section[id]');
    const originalNavHTML = navUl.innerHTML;
    
    // Store original titles from the initial nav links
    const originalTitles = {};
    navUl.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (href && href.startsWith('#')) {
            originalTitles[href.substring(1)] = a.textContent.trim();
        }
    });

    // 1. Prepare sections data and add unique IDs to sub-items for linking
    const sectionsData = {};
    const allSubSections = [];

    mainSections.forEach(section => {
        const sectionId = section.id;
        const mainTitle = originalTitles[sectionId] || section.querySelector('.section-title')?.textContent.trim() || section.id;
        
        // Find sub-items, which are nested inside .essential-item divs
        const subItems = section.querySelectorAll('.essential-item');
        
        sectionsData[sectionId] = {
            title: mainTitle,
            subSections: []
        };
        
        subItems.forEach((item, index) => {
            const subTitleEl = item.querySelector('.item-title');
            if (subTitleEl) {
                const subId = `${sectionId}-item-${index}`;
                item.id = subId; // Add a unique ID to the element itself
                
                const subData = {
                    id: subId,
                    title: subTitleEl.textContent.trim()
                };
                sectionsData[sectionId].subSections.push(subData);
                allSubSections.push(item);
            }
        });
    });

    // 2. Function to update the navigation bar to the dynamic, section-specific view
    const updateNavToSection = (activeSectionId) => {
        const data = sectionsData[activeSectionId];
        
        // If the section is 'welcome' or has no sub-sections, revert to the original nav style
        if (!data || activeSectionId === 'welcome' || data.subSections.length === 0) {
            restoreOriginalNav(activeSectionId); // Pass the ID to highlight the correct link
            return;
        }

        nav.classList.remove('original-nav');
        let newNavHTML = '';
        
        // Build the new nav with section title and sub-section links
        newNavHTML += `<li class="nav-section-title"><a>${data.title}</a></li>`;
        newNavHTML += `<li class="nav-separator"><a>|</a></li>`;
        data.subSections.forEach(sub => {
            newNavHTML += `<li><a href="#${sub.id}">${sub.title}</a></li>`;
        });
        
        navUl.innerHTML = newNavHTML;
    };
    
    // 3. Function to restore the original nav and highlight the active section
    const restoreOriginalNav = (activeSectionId) => {
        if (!nav.classList.contains('original-nav')) {
            nav.classList.add('original-nav');
            navUl.innerHTML = originalNavHTML;
        }
        if (activeSectionId) {
             navUl.querySelectorAll('a').forEach(a => a.classList.remove('active-link'));
             const activeLink = navUl.querySelector(`a[href="#${activeSectionId}"]`);
             if (activeLink) activeLink.classList.add('active-link');
        }
    };

    // 4. Observer to watch for main sections entering the viewport
    const mainSectionObserver = new IntersectionObserver((entries) => {
        const visibleSections = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visibleSections.length > 0) {
            // The first one in the sorted list is the topmost visible one
            const activeSectionId = visibleSections[0].target.id;
            updateNavToSection(activeSectionId);
        }
    }, {
        root: null,
        rootMargin: '-100px 0px -50% 0px', // Watches a band in the upper part of the viewport
        threshold: 0
    });

    // 5. Observer to watch for sub-sections to highlight the active link
    const subSectionObserver = new IntersectionObserver((entries) => {
        const visibleSubSections = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visibleSubSections.length > 0) {
            const activeSubSectionId = visibleSubSections[0].target.id;
            const link = navUl.querySelector(`a[href="#${activeSubSectionId}"]`);
            if (link) {
                navUl.querySelectorAll('a').forEach(a => a.classList.remove('active-link'));
                link.classList.add('active-link');
            }
        }
    }, {
        root: null,
        rootMargin: '-40% 0px -59% 0px', // Highlights the sub-section when it's near the middle of the screen
        threshold: 0.01
    });
    
    // Start observing all main sections and sub-sections
    mainSections.forEach(section => mainSectionObserver.observe(section));
    allSubSections.forEach(subSection => subSectionObserver.observe(subSection));
    
    // Set the initial state of the navigation bar
    restoreOriginalNav('welcome');
});
