// Function to calculate time ago for posts
export function timeAgo(timestamp) {
    const now = new Date();
    const postDate = timestamp.toDate();
    const seconds = Math.floor((now - postDate) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) {
        return Math.floor(interval) + " years ago";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
        return Math.floor(interval) + " months ago";
    }
    interval = seconds / 86400;
    if (interval > 1) {
        return Math.floor(interval) + " days ago";
    }
    interval = seconds / 3600;
    if (interval > 1) {
        return Math.floor(interval) + " hours ago";
    }
    interval = seconds / 60;
    if (interval > 1) {
        return Math.floor(interval) + " minutes ago";
    }
    return Math.floor(seconds) + " seconds ago";
}

// Function to render posts
export const renderPosts = (posts, containerId) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID "${containerId}" not found.`);
        return;
    }
    container.innerHTML = ''; // Clear existing posts

    if (posts.length === 0) {
        container.innerHTML = '<p class="no-posts-message">No posts yet. Be the first to add an update!</p>';
        return;
    }

    posts.forEach(post => {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        postCard.dataset.postId = post.id; // Store Firestore document ID

        let mediaHtml = '';
        if (post.mediaUrl) {
            if (post.mediaType && post.mediaType.startsWith('image')) {
                mediaHtml = `<img src="${post.mediaUrl}" alt="Post Image" class="post-media">`;
            } else if (post.mediaType && post.mediaType.startsWith('video')) {
                mediaHtml = `<video controls src="${post.mediaUrl}" class="post-media"></video>`;
            }
        }

        // Default avatar or use a placeholder if none is available
        const avatarUrl = post.authorAvatar || 'https://via.placeholder.com/50?text=👤'; 

        postCard.innerHTML = `
            <div class="author-avatar">
                <img src="${avatarUrl}" alt="Author Avatar" class="author-avatar-img">
            </div>
            <div class="post-content-area">
                <div class="post-meta">
                    <strong>${post.authorName || 'Anonymous'}</strong> 
                    ${post.reportingFrom ? `Reporting from ${post.reportingFrom}` : ''}
                    <span class="time-ago">${timeAgo(post.timestamp)}</span>
                </div>
                <p class="post-text">${post.content}</p>
                ${mediaHtml}
            </div>
        `;
        container.appendChild(postCard);
    });

    // Notify parent iframe (if any) to adjust height
    if (window.parent) {
        const height = document.body.scrollHeight;
        window.parent.postMessage({ type: 'iframeHeight', height: height }, window.location.origin);
    }
};

// Pagination variables
let currentPage = 0;
const postsPerPage = 5; // You can adjust this number

let currentBlogId = null; // Store the blog ID from the URL

// Function to load and display posts
export const loadPosts = async () => { // Export this function
    const urlParams = new URLSearchParams(window.location.search);
    currentBlogId = urlParams.get('blogId');

    const postsContainer = document.getElementById('postsContainer');
    const paginationControls = document.getElementById('paginationControls');

    if (!currentBlogId) {
        if (postsContainer) {
            postsContainer.innerHTML = '<p class="error-message">Error: Blog ID not found in URL. Please provide a valid blog ID.</p>';
        }
        if (paginationControls) {
            paginationControls.innerHTML = '';
        }
        return;
    }

    // Ensure Firebase is initialized and db is available
    if (!window.db || !window.collection || !window.query || !window.where || !window.orderBy || !window.getDocs) {
        console.error("Firebase services not initialized in embed-script.js");
        if (postsContainer) {
            postsContainer.innerHTML = '<p class="error-message">Error: Firebase services not loaded. Check console for details.</p>';
        }
        return;
    }

    try {
        const postsCollectionRef = window.collection(window.db, `blogs/${currentBlogId}/posts`);
        const q = window.query(postsCollectionRef, window.orderBy('timestamp', 'desc'));
        const querySnapshot = await window.getDocs(q);

        const allPosts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Apply pagination
        const startIndex = currentPage * postsPerPage;
        const endIndex = startIndex + postsPerPage;
        const postsToShow = allPosts.slice(startIndex, endIndex);

        renderPosts(postsToShow, 'postsContainer');
        updatePaginationControls(allPosts.length);

    } catch (error) {
        console.error("Error loading posts for embed:", error);
        if (postsContainer) {
            postsContainer.innerHTML = '<p class="error-message">Error loading posts. Please try again later.</p>';
        }
    }
};

// Function to update pagination controls
export const updatePaginationControls = (totalPosts) => { // Export if used elsewhere
    const paginationControls = document.getElementById('paginationControls');
    if (!paginationControls) return;

    paginationControls.innerHTML = ''; // Clear previous controls

    const totalPages = Math.ceil(totalPosts / postsPerPage);

    if (totalPages > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.disabled = currentPage === 0;
        prevButton.addEventListener('click', () => {
            currentPage--;
            loadPosts();
        });
        paginationControls.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
        paginationControls.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.disabled = currentPage >= totalPages - 1;
        nextButton.addEventListener('click', () => {
            currentPage++;
            loadPosts();
        });
        paginationControls.appendChild(nextButton);
    }
};

// REMOVE the DOMContentLoaded listener from this file.
// document.addEventListener('DOMContentLoaded', loadPosts);
