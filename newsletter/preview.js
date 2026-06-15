document.addEventListener('DOMContentLoaded', () => {
    const previewDataString = sessionStorage.getItem('newsletterPreviewData');
    if (!previewDataString) {
        document.body.innerHTML = '<h1>No preview data found. Please generate a preview from the admin panel.</h1>';
        return;
    }
    const data = JSON.parse(previewDataString);

    // --- RENDER FUNCTIONS ---
    function renderMagazineView() {
        document.body.classList.remove('social-layout');
        
        // Populate Header/Welcome
        document.getElementById('eyebrow-placeholder').textContent = `Issue #${data.issueNumber}`;
        document.getElementById('main-title-placeholder').textContent = data.mainTitle;
        document.getElementById('main-summary-placeholder').textContent = data.mainSummary;
        const harrysNoteEl = document.getElementById('harrys-note-placeholder');
        if (harrysNoteEl) harrysNoteEl.textContent = data.harrysNote;

        // Vertical welcome video (where Harry's Note used to live)
        const videoWrapper = document.getElementById('welcome-video-wrapper');
        const videoEl = document.getElementById('welcome-video');
        if (videoWrapper && videoEl) {
            if (data.welcomeVideo) {
                videoEl.src = data.welcomeVideo;
                videoWrapper.style.display = 'block';
            } else {
                videoWrapper.style.display = 'none';
            }
        }
        
        if (data.publishDate) {
            const date = new Date(data.publishDate.replace(/-/g, '\/'));
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            document.getElementById('header-date-placeholder').textContent = date.toLocaleDateString('en-US', options).toUpperCase();
        }

        // Populate Dynamic Sections
        renderSection('essentials', data.essentials);
        renderSection('imports', data.imports);
        renderSection('deliveries', data.deliveries);
        renderSection('cannoli', data.cannoli);
        renderSection('coffee', data.coffee);

        // Import map with the pins dropped in the admin editor
        if (data.importMap && data.importMap.image) {
            const importsSection = document.getElementById('imports');
            if (importsSection && importsSection.style.display !== 'none') {
                const mapWrapper = document.createElement('div');
                mapWrapper.className = 'map-container';
                mapWrapper.innerHTML = `
                    <div class="map-pin-wrapper">
                        <img src="${data.importMap.image}" alt="World map of imports" class="map-image">
                        ${(data.importMap.pins || []).map(pin => `
                            <div class="map-pin" style="left:${Number(pin.x)}%; top:${Number(pin.y)}%;">
                                <svg viewBox="0 0 24 24" fill="#e74c3c" stroke="#ffffff" stroke-width="1.2"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"></path><circle cx="12" cy="9" r="2.5" fill="#ffffff"></circle></svg>
                                <span class="pin-label"></span>
                            </div>`).join('')}
                    </div>`;
                const pinEls = mapWrapper.querySelectorAll('.map-pin .pin-label');
                (data.importMap.pins || []).forEach((pin, i) => { if (pinEls[i]) pinEls[i].textContent = pin.label || ''; });
                importsSection.insertBefore(mapWrapper, importsSection.querySelector('.essentials-container'));
            }
        }
    }

    function renderSection(type, items) {
        const container = document.querySelector(`#${type} .essentials-container`);
        if (!container) return;
        container.innerHTML = '';
        if (!items || items.length === 0) {
             document.getElementById(type).style.display = 'none';
             return;
        }
        document.getElementById(type).style.display = 'block';

        items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'essential-item';
            // Note: In a real app, sanitize this HTML to prevent XSS attacks
            itemEl.innerHTML = `
                <h3 class="item-title">${item.title}</h3>
                <p class="item-description">${item.content.replace(/\n/g, '<br>')}</p>
                ${item.image ? `<img src="${item.image}" style="width:100%; margin-top:1rem;">` : ''}
            `;
            container.appendChild(itemEl);
        });
    }

    function renderSocialFeedView() {
        document.body.classList.add('social-layout');
        const socialFeedView = document.getElementById('social-feed-view');
        socialFeedView.innerHTML = '';
        
        // This is a simplified version of the social feed generator from your main.js
        const createSocialPost = (author, content, isThread = false) => {
            const post = document.createElement('div');
            post.className = `social-post ${isThread ? 'post-thread' : ''}`;
            post.innerHTML = `
                <div class="post-avatar-placeholder"></div>
                <div class="post-content">
                    <div class="post-header"><span class="post-author-name">${author}</span></div>
                    <div class="post-body">${content}</div>
                </div>
            `;
            return post;
        };

        socialFeedView.appendChild(createSocialPost("Harry's Haul", `<p><strong>${data.mainTitle}</strong></p><p>${data.mainSummary}</p>`));
        if (data.harrysNote) {
            socialFeedView.appendChild(createSocialPost('Harry North', `<p>${data.harrysNote}</p>`));
        }

        // Render every content section (previously only essentials were rendered)
        const renderItems = (items, labelFn) => {
            (items || []).forEach((item, index) => {
                const body = `<p><strong>${item.title}</strong></p><p>${(item.content || '').replace(/\n/g, '<br>')}</p>`;
                socialFeedView.appendChild(createSocialPost(labelFn(index), body));
            });
        };

        renderItems(data.essentials, (i) => `Essential #${i + 1}`);
        renderItems(data.imports, () => 'Import');
        renderItems(data.deliveries, () => 'Next Delivery');
        renderItems(data.cannoli, () => 'The Cannoli');
        renderItems(data.coffee, () => 'Coffee Review');
    }
    
    // --- INITIALIZE VIEW ---
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');

    if (view === 'social') {
        renderSocialFeedView();
    } else {
        renderMagazineView();
    }
});
