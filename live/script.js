document.addEventListener('DOMContentLoaded', () => {
    // Ensure Firebase is initialized and its modules are exposed to window
    // This script (script.js) assumes the Firebase initialization script
    // in the HTML has completed and set window.db, window.collection etc.
    // If you ever convert script.js to type="module", you'd import directly.

    const postForm = document.getElementById('postForm');
    const authorNameInput = document.getElementById('authorNameInput'); // New
    const reportingFromInput = document.getElementById('reportingFromInput'); // New
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
        // Default behavior if not coming from index.html (e.g., direct access)
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
        if (interval > 1) { return Math.floor(interval) + " days ago"; }
        interval = seconds / 3600; // hours
        if (interval > 1) { return Math.floor(interval) + " hours ago"; }
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

        if (!currentBlogId) {
            // Show hardcoded examples if no specific blog is being viewed
            postsContainer.innerHTML = `
                <div class="blog-post">
                    <div class="post-header">
                        <div class="author-info">
                            <div class="author-avatar"></div>
                            <div class="author-details">
                                <span class="time-since-post">11 minutes ago</span>
                                <span class="author-name">Ian Austen</span>
                                <span class="reporting-from">Reporting from Ottawa</span>
                            </div>
                        </div>
                    </div>
                    <div class="post-body">
                        <p>Canada's leader now says there is little hope of avoiding U.S. tariffs in a trade deal.</p>
                        <img src="Screen Shot 2025-07-15 at 7.20.56 PM.jpg" alt="Canadian Prime Minister Mark Carney">
                        <p class="image-caption">Prime Minister Mark Carney of Canada has grown less optimistic about avoiding U.S. tariffs in a trade deal. Kenny Holston/The New York Times</p>
                        <p>Prime Minister Mark Carney of Canada, in a reversal, said on Tuesday that “there’s not a lot of evidence right now” that his country can get a trade deal with the United States that does not impose tariffs.</p>
                    </div>
                    <div class="post-divider"></div>
                </div>

                <div class="blog-post">
                    <div class="post-header">
                        <div class="author-info">
                            <div class="author-avatar"></div>
                            <div class="author-details">
                                <span class="time-since-post">3 hours ago</span>
                                <span class="author-name">Glenn Thrush</span>
                            </div>
                        </div>
                    </div>
                    <div class="post-body">
                        <p>Attorney General Pam Bondi, addressing reporters for the first time since the controversy over the Epstein files erupted last week, dodged questions about her relationship with the F.B.I.'s No. 2 official, Dan Bongino, whom she has accused of leaking negative stories to the press.</p>
                        <p>Bondi, speaking at the headquarters of the Drug Enforcement Administration, said that she intended to serve a full four-year term and that she had spent the morning meeting with Bongino's boss, Kash Patel, about law enforcement matters.</p>
                    </div>
                    <div class="post-divider"></div>
                </div>
            `;
            return; // Exit here as we're showing static content
        }

        try {
            // Ensure db and collection are available from the window object
            const q = window.query(window.collection(window.db, "posts"), window.where("blogId", "==", currentBlogId), window.orderBy("timestamp", "desc"));
            const querySnapshot = await window.getDocs(q);

            if (!querySnapshot.empty) {
                querySnapshot.forEach(doc => {
                    const postData = doc.data();
                    const postElement = createPostElement(postData);
                    postsContainer.appendChild(postElement); // Add to end, as query is ordered desc
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

    if (postForm && currentBlogId) {
        postForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const content = postContent.value.trim();
            const authorName = authorNameInput.value.trim(); // Get value from input
            const reportingFrom = reportingFromInput.value.trim(); // Get value from input
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
                authorName: authorName || "Anonymous", // Use input or default
                reportingFrom: reportingFrom || "Unknown Location", // Use input or default
                timestamp: window.serverTimestamp(), // Use Firestore server timestamp
                mediaUrl: mediaUrl,
                mediaType: mediaType
            };

            try {
                // Ensure db and addDoc are available from the window object
                await window.addDoc(window.collection(window.db, "posts"), postData);
                postContent.value = ''; // Clear form fields *before* reloading
                if (authorNameInput) authorNameInput.value = 'You'; // Reset to default or clear
                if (reportingFromInput) reportingFromInput.value = 'Montreal, Quebec, Canada'; // Reset to default or clear
                postMedia.value = ''; // Clear file input
                loadPosts(); // Reload all posts to display the new one at the top
            } catch (e) {
                console.error("Error adding post: ", e);
                alert("Error posting update. Please try again. Check console for details.");
            }
        });
    } else if (postForm) { // If on create-blog.html but no blogId (direct access without selecting a blog)
        // Hide the form and show a message
        postForm.style.display = 'none'; // Hide the form
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">Select an existing blog or create a new one from the <a href="index.html">Home page</a> to post updates.</p>`;
        // Insert the message before the postsContainer, or append to main section
        postsContainer.parentNode.insertBefore(messageDiv, postsContainer);
    }

    if (postsContainer) {
        loadPosts();
    }

    // Update "time since post" periodically by reloading all posts
    // Be cautious with frequent reloads, might hit Firestore read limits in production
    // For development, this is fine. Consider real-time listeners (onSnapshot) for production.
    setInterval(loadPosts, 60000); // Every minute
});
