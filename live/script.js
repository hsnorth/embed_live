document.addEventListener('DOMContentLoaded', () => {
    // Ensure Firebase is initialized and its modules are exposed to window
    // This script (script.js) assumes the Firebase initialization script
    // in the HTML has completed and set window.db, window.collection etc.
    // If you ever convert script.js to type="module", you'd import directly.

    const postForm = document.getElementById('postForm');
    const authorNameInput = document.getElementById('authorNameInput');
    const reportingFromInput = document.getElementById('reportingFromInput');
    const postContent = document.getElementById('postContent');
    const postMedia = document.getElementById('postMedia');
    const postsContainer = document.getElementById('postsContainer');
    const blogPageTitle = document.getElementById('blogPageTitle');
    const blogHeaderTitle = document.getElementById('blogHeaderTitle');

    const urlParams = new URLSearchParams(window.location.search);
    const currentBlogId = urlParams.get('blogId');
    const currentBlogName = urlParams.get('blogName');

    if (currentBlogName && blogPageTitle && blogHeaderTitle) {
        blogPageTitle.textContent = currentBlogName;
        blogHeaderTitle.textContent = currentBlogName;
    } else {
        // Default behavior if not coming from index.html (e.g., direct access without blogId)
        if (blogPageTitle) blogPageTitle.textContent = "Create New Live Blog";
        if (blogHeaderTitle) blogHeaderTitle.textContent = "My Live Blog";
    }

    const formatTimeAgo = (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000; // years

        if (interval > 1) { return Math.floor(interval) + " years ago"; }
        interval = seconds / 2592000; // months
        if (interval > 1) { return Math.floor(interval) + " months ago"; }
        interval = seconds / 86400; // days
        if (interval > 1) { return Math.floor(interval) + " hours ago"; }
        interval = seconds / 3600; // hours
        if (interval > 1) { return Math.floor(interval) + " minutes ago"; }
        interval = seconds / 60; // minutes
        if (interval > 1) { return Math.floor(interval) + " minutes ago"; }
        return "Just now";
    };

    const createPostElement = (postData) => {
        const newPost = document.createElement('div');
        newPost.classList.add('blog-post');

        let mediaHtml = '';
        if (postData.mediaUrl) {
            if (postData.mediaType && postData.mediaType.startsWith('image/')) {
                mediaHtml = `<img src="${postData.mediaUrl}" alt="Posted Image">`;
            } else if (postData.mediaType && postData.mediaType.startsWith('video/')) {
                mediaHtml = `<video controls src="${postData.mediaUrl}"></video>`;
            } else {
                 mediaHtml = `<img src="${postData.mediaUrl}" alt="Posted Media">`; // Fallback for general media
            }
        }

        const postTime = postData.timestamp ? postData.timestamp.toDate() : new Date();
        const timeSince = formatTimeAgo(postTime);

        newPost.innerHTML = `
            <div class="post-header">
                <div class="author-info">
                    <div class="author-avatar"></div>
                    <div class="author-details">
                        <span class="time-since-post">${timeSince}</span>
                        <span class="author-name">${postData.authorName || 'Anonymous'}</span>
                        <span class="reporting-from">${postData.reportingFrom || 'Unknown Location'}</span>
                    </div>
                </div>
            </div>
            <div class="post-body">
                ${postData.content ? `<p>${postData.content}</p>` : ''}
                ${mediaHtml}
            </div>
            <div class="post-divider"></div>
        `;
        return newPost;
    };

    const loadPosts = async () => {
        if (!postsContainer) return;

        postsContainer.innerHTML = ''; // Clear existing content

        // If no blogId, display a message but don't try to load from Firestore
        // This handles cases where create-blog.html is accessed directly without parameters.
        if (!currentBlogId) {
            const messageDiv = document.createElement('div');
            messageDiv.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">Please create or select a blog to view posts.</p>`;
            postsContainer.appendChild(messageDiv);
            return;
        }

        try {
            const q = window.query(window.collection(window.db, "posts"), window.where("blogId", "==", currentBlogId), window.orderBy("timestamp", "desc"));
            const querySnapshot = await window.getDocs(q);

            if (!querySnapshot.empty) {
                querySnapshot.forEach(doc => {
                    const postData = doc.data();
                    const postElement = createPostElement(postData);
                    postsContainer.appendChild(postElement);
                });
            } else {
                const noPostsMessage = document.createElement('p');
                noPostsMessage.style.textAlign = 'center';
                noPostsMessage.style.color = '#888';
                noPostsMessage.textContent = 'No posts yet. Be the first to add an update!';
                postsContainer.appendChild(noPostsMessage);
            }
        } catch (error) {
            console.error("Error fetching posts: ", error);
            const errorMessage = document.createElement('p');
            errorMessage.style.textAlign = 'center';
            errorMessage.style.color = 'red';
            errorMessage.textContent = 'Error loading posts.';
            postsContainer.appendChild(errorMessage);
        }
    };

    if (postForm && currentBlogId) { // Only enable form if a blogId is present
        postForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const content = postContent.value.trim();
            const authorName = authorNameInput.value.trim();
            const reportingFrom = reportingFromInput.value.trim();
            const mediaFile = postMedia.files[0];

            if (!content && !mediaFile) {
                alert('Please enter some content or select a file to post.');
                return;
            }

            let mediaUrl = '';
            let mediaType = '';
            if (mediaFile) {
                // IMPORTANT: This creates a temporary URL. For persistent media,
                // you would need Firebase Storage.
                mediaUrl = URL.createObjectURL(mediaFile);
                mediaType = mediaFile.type;
            }

            const postData = {
                blogId: currentBlogId,
                content: content,
                authorName: authorName || "Anonymous",
                reportingFrom: reportingFrom || "Unknown Location",
                timestamp: window.serverTimestamp(),
                mediaUrl: mediaUrl,
                mediaType: mediaType
            };

            try {
                await window.addDoc(window.collection(window.db, "posts"), postData);
                postContent.value = '';
                if (authorNameInput) authorNameInput.value = 'You';
                if (reportingFromInput) reportingFromInput.value = 'Montreal, Quebec, Canada';
                postMedia.value = '';
                loadPosts(); // Reload all posts to display the new one at the top
            } catch (e) {
                console.error("Error adding post: ", e);
                alert("Error posting update. Please try again. Check console for details.");
            }
        });
    } else if (postForm) { // If on create-blog.html but no blogId (direct access without selecting a blog)
        // Hide the form and show a message
        postForm.style.display = 'none';
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">Please select an existing blog or create a new one from the <a href="index.html">Home page</a> to post updates.</p>`;
        postsContainer.parentNode.insertBefore(messageDiv, postsContainer);
    }

    if (postsContainer) {
        loadPosts();
    }

    // Update "time since post" periodically by reloading all posts
    setInterval(loadPosts, 60000); // Every minute
});
