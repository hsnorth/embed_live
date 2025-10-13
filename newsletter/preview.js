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
        document.getElementById('harrys-note-placeholder').textContent = data.harrysNote;
        
        const date = new Date(data.publishDate.replace(/-/g, '\/'));
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('header-date-placeholder').textContent = date.toLocaleDateString('en-US', options).toUpperCase();

        // Populate Dynamic Sections
        renderSection('essentials', data.essentials);
        renderSection('imports', data.imports);
        renderSection('deliveries', data.deliveries);
        renderSection('cannoli', data.cannoli);
        renderSection('coffee', data.coffee);
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

        socialFeedView.appendChild(createSocialPost('The News Haul', `<p><strong>${data.mainTitle}</strong></p><p>${data.mainSummary}</p>`));
        if (data.harrysNote) {
            socialFeedView.appendChild(createSocialPost('Harry North', `<p>${data.harrysNote}</p>`));
        }

        data.essentials.forEach((item, index) => socialFeedView.appendChild(createSocialPost(`Essential #${index + 1}`, `<p><strong>${item.title}</strong></p><p>${item.content}</p>`)));
        // ... repeat for other sections
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
