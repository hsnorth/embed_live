document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('postsContainer');
    const paginationContainer = document.getElementById('paginationControls');

    const urlParams = new URLSearchParams(window.location.search);
    const currentBlogId = urlParams.get('blogId'); // Get blogId from URL for embedding

    let allPostsData = [];
    let paginatedPosts = [];
    let currentPageIndex = 0;

    const maxPageHeight = 700; // Adjust this value as needed for embed height

    // No authentication check needed for embed page
    // Just load posts directly
    loadPosts();

    const formatTimeAgo = (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;

        if (interval > 1) { return Math.floor(interval) + " years ago"; }
        interval = seconds / 2592000;
        if (interval > 1) { return Math.floor(interval) + " months ago"; }
        interval = seconds / 86400;
        if (interval > 1) { return Math.floor(interval) + " days ago"; }
        interval = seconds / 3600;
        if (interval > 1) { return Math.floor(interval) + " hours ago"; }
        interval = seconds / 60;
        if (interval > 1) { return Math.floor(interval) + " minutes ago"; }
        return "Just now";
    };

    const truncateText = (text, maxLength) => {
        if (!text || text.length <= maxLength) {
            return {
                truncated: false,
                display: text
            };
        }
        let trimmedText = text.substring(0, maxLength);
        trimmedText = trimmedText.substring(0, Math.min(trimmedText.length, trimmedText.lastIndexOf(" ")));
        return {
            truncated: true,
            display: trimmedText + '...'
        };
    };

    const createPostElement = (postData) => {
        const newPost = document.createElement('div');
        newPost.classList.add('blog-post');

        let mediaHtml = '';
        if (postData.mediaUrl) {
            if (postData.mediaType && postData.mediaType.startsWith('image/')) {
                mediaHtml = `<img src="${postData.mediaUrl}" alt="Posted Image" onload="window.parent.postMessage({ type: 'iframeHeight', height: document.body.scrollHeight }, '*');">`; // Notify parent of height change
            } else if (postData.mediaType && postData.mediaType.startsWith('video/')) {
                mediaHtml = `<video controls src="${postData.mediaUrl}" onloadeddata="window.parent.postMessage({ type: 'iframeHeight', height: document.body.scrollHeight }, '*');"></video>`; // Notify parent
            } else {
                 mediaHtml = `<img src="${postData.mediaUrl}" alt="Posted Media" onload="window.parent.postMessage({ type: 'iframeHeight', height: document.body.scrollHeight }, '*');">`;
            }
        }

        const postTime = postData.timestamp ? postData.timestamp.toDate() : new Date();
        const timeSince = formatTimeAgo(postTime);

        const authorPicSrc = postData.authorPic || 'https://via.placeholder.com/36/CCCCCC/FFFFFF?text=AV';
        const authorPicHtml = `<img src="${authorPicSrc}" alt="${postData.authorName || 'Anonymous'}'s avatar" class="author-avatar-img">`;

        const maxLength = 200;
        const { truncated, display } = truncateText(postData.content, maxLength);

        let contentHtml = postData.content ? `<p class="post-text-body">${display}</p>` : '';
        let readMoreButtonHtml = '';

        if (truncated) {
            contentHtml += `<p class="read-more-content hidden">${postData.content}</p>`;
            readMoreButtonHtml = `<button class="read-more-button">Read more</button>`;
        }

        newPost.innerHTML = `
            <div class="post-header">
                <div class="author-avatar">${authorPicHtml}</div>
                <div class="author-details">
                    <div class="name-and-time">
                        <span class="author-name">${postData.authorName || 'Anonymous'}</span>
                        <span class="time-since-post">${timeSince}</span>
                    </div>
                    <span class="reporting-from">Reporting from ${postData.reportingFrom || 'Unknown Location'}</span>
                </div>
            </div>
            <div class="post-body">
                ${contentHtml}
                ${readMoreButtonHtml}
                ${mediaHtml}
            </div>
        `;

        if (truncated) {
            const readMoreButton = newPost.querySelector('.read-more-button');
            const fullContent = newPost.querySelector('.read-more-content');
            const initialContent = newPost.querySelector('.post-text-body');

            readMoreButton.addEventListener('click', () => {
                if (fullContent.classList.contains('hidden')) {
                    fullContent.classList.remove('hidden');
                    initialContent.classList.add('hidden');
                    readMoreButton.textContent = 'Show less';
                } else {
                    fullContent.classList.add('hidden');
                    initialContent.classList.remove('hidden');
                    readMoreButton.textContent = 'Read more';
                }
                // Notify parent iframe of height change after expanding/collapsing
                window.parent.postMessage({ type: 'iframeHeight', height: document.body.scrollHeight }, '*');
            });
        }

        return newPost;
    };

    const paginatePostsByHeight = async () => {
        paginatedPosts = [];
        let currentPagePosts = [];
        let currentPageHeight = 0;

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.height = 'auto';
        tempContainer.style.width = postsContainer.offsetWidth + 'px';
        document.body.appendChild(tempContainer);

        for (const postData of allPostsData) {
            const postElement = createPostElement(postData);
            tempContainer.appendChild(postElement);

            await new Promise(resolve => {
                const mediaElements = postElement.querySelectorAll('img, video');
                if (mediaElements.length === 0) {
                    resolve();
                    return;
                }
                let loadedCount = 0;
                mediaElements.forEach(media => {
                    if (media.complete || media.readyState >= 2) {
                        loadedCount++;
                    } else {
                        media.addEventListener('load', () => { loadedCount++; if (loadedCount === mediaElements.length) resolve(); });
                        media.addEventListener('loadeddata', () => { loadedCount++; if (loadedCount === mediaElements.length) resolve(); });
                        media.addEventListener('error', () => { loadedCount++; if (loadedCount === mediaElements.length) resolve(); });
                    }
                });
                if (loadedCount === mediaElements.length) resolve();
            });

            const postHeight = postElement.offsetHeight;

            if (currentPageHeight + postHeight > maxPageHeight && currentPagePosts.length > 0) {
                paginatedPosts.push(currentPagePosts);
                currentPagePosts = [postData];
                currentPageHeight = postHeight;
            } else {
                currentPagePosts.push(postData);
                currentPageHeight += postHeight;
            }
        }

        if (currentPagePosts.length > 0) {
            paginatedPosts.push(currentPagePosts);
        }

        document.body.removeChild(tempContainer);
    };

    const displayCurrentPagePosts = () => {
        if (!postsContainer) return;

        postsContainer.innerHTML = '';

        const postsOnPage = paginatedPosts[currentPageIndex];

        if (postsOnPage && postsOnPage.length > 0) {
            postsOnPage.forEach((postData, index) => {
                const postElement = createPostElement(postData);
                postsContainer.appendChild(postElement);
            });
        } else {
            const noPostsMessage = document.createElement('p');
            noPostsMessage.style.textAlign = 'center';
            noPostsMessage.style.color = '#888';
            noPostsMessage.textContent = 'No posts yet for this blog.';
            postsContainer.appendChild(noPostsMessage);
        }
        renderPaginationControls();
        // Notify parent iframe of initial height after rendering
        window.parent.postMessage({ type: 'iframeHeight', height: document.body.scrollHeight }, '*');
    };

    const renderPaginationControls = () => {
        if (!paginationContainer) return;

        paginationContainer.innerHTML = '';
        const totalPages = paginatedPosts.length;

        if (totalPages <= 1) {
            return;
        }

        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.classList.add('pagination-button');
        prevButton.disabled = currentPageIndex === 0;
        prevButton.addEventListener('click', () => {
            if (currentPageIndex > 0) {
                currentPageIndex--;
                displayCurrentPagePosts();
            }
        });
        paginationContainer.appendChild(prevButton);

        for (let i = 0; i < totalPages; i++) {
            const pageButton = document.createElement('span');
            pageButton.textContent = i + 1;
            pageButton.classList.add('page-number');
            if (i === currentPageIndex) {
                pageButton.classList.add('active');
            }
            pageButton.addEventListener('click', () => {
                currentPageIndex = i;
                displayCurrentPagePosts();
            });
            paginationContainer.appendChild(pageButton);
        }

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.classList.add('pagination-button');
        nextButton.disabled = currentPageIndex === totalPages - 1;
        nextButton.addEventListener('click', () => {
            if (currentPageIndex < totalPages - 1) {
                currentPageIndex++;
                displayCurrentPagePosts();
            }
        });
        paginationContainer.appendChild(nextButton);
    };

    const loadPosts = async () => {
        if (!postsContainer) return;

        if (!currentBlogId) {
            postsContainer.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">No blog ID provided for embedding.</p>`;
            paginationContainer.innerHTML = '';
            return;
        }

        try {
            const q = window.query(window.collection(window.db, "posts"), window.where("blogId", "==", currentBlogId), window.orderBy("timestamp", "desc"));
            const querySnapshot = await window.getDocs(q);

            allPostsData = [];
            if (!querySnapshot.empty) {
                querySnapshot.forEach(doc => {
                    allPostsData.push(doc.data());
                });
            }

            await paginatePostsByHeight();
            displayCurrentPagePosts();

        } catch (error) {
            console.error("Error fetching posts for embed: ", error);
            postsContainer.innerHTML = `<p style="text-align: center; color: red;">Error loading posts for embed.</p>`;
            paginationContainer.innerHTML = '';
        }
    };

    // No setInterval for embeds, as they are usually static or refreshed by parent.
});
