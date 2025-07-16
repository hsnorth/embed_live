document.addEventListener('DOMContentLoaded', () => {
    // Ensure Firebase is initialized and its modules are exposed to window
    // This script (script.js) assumes the Firebase initialization script
    // in the HTML has completed and set window.db, window.collection etc.

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

    let currentUserProfile = null; // Store fetched user profile

    // Authentication Guard & User Profile Fetching
    window.onAuthStateChanged(window.auth, async (user) => {
        if (!user) {
            // No user is signed in, redirect to login
            window.location.href = 'index.html';
        } else {
            // User is signed in, fetch their profile
            try {
                const userDocRef = window.doc(window.db, "users", user.uid);
                const userDocSnap = await window.getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    currentUserProfile = userDocSnap.data();
                    // Pre-fill author name from profile, make it readonly
                    authorNameInput.value = currentUserProfile.name || user.email; // Fallback to email
                } else {
                    console.warn("User profile not found in Firestore for UID:", user.uid);
                    authorNameInput.value = user.email || "Unknown User"; // Use email if profile missing
                }
                loadPosts(); // Load posts only after user is authenticated and profile potentially loaded
            } catch (error) {
                console.error("Error fetching user profile:", error);
                authorNameInput.value = user.email || "Error Loading User"; // Fallback on error
                loadPosts(); // Still try to load posts even if profile fetch fails
            }
        }
    });

    if (currentBlogName && blogPageTitle && blogHeaderTitle) {
        blogPageTitle.textContent = currentBlogName;
        blogHeaderTitle.textContent = currentBlogName;
    } else {
        // Default behavior if not coming from dashboard (e.g., direct access without blogId)
        if (blogPageTitle) blogPageTitle.textContent = "Create New Live Blog";
        if (blogHeaderTitle) blogHeaderTitle.textContent = "My Live Blog";
    }

    const formatTimeAgo = (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000; // years

        if (interval > 1) { return Math.floor(interval) + " years ago"; }
        interval = seconds / 2592000; // months
        if (interval > 1) { return Math.floor(interval) + " days ago"; }
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

        // Use postData.authorPic if available, fallback to a default avatar or no image
        const authorPicSrc = postData.authorPic || 'https://via.placeholder.com/50/CCCCCC/FFFFFF?text=AV'; // Default grey avatar
        const authorPicHtml = `<img src="${authorPicSrc}" alt="${postData.authorName || 'Anonymous'}'s avatar" class="author-avatar-img">`;


        newPost.innerHTML = `
            <div class="post-header">
                <div class="author-info">
                    <div class="author-avatar">${authorPicHtml}</div>
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
            // Hide the form if no blog is selected
            if (postForm) postForm.style.display = 'none';
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

    // Only add submit listener if postForm exists (it might be hidden if no blogId)
    if (postForm) {
        postForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const content = postContent.value.trim();
            const authorName = authorNameInput.value.trim(); // Will be pre-filled
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
                authorName: currentUserProfile ? currentUserProfile.name : (window.auth.currentUser ? window.auth.currentUser.email : "Anonymous"), // Use fetched profile name or auth email
                authorEmail: currentUserProfile ? currentUserProfile.email : (window.auth.currentUser ? window.auth.currentUser.email : "N/A"), // Store email
                authorPic: currentUserProfile ? currentUserProfile.pic : 'https://via.placeholder.com/50/CCCCCC/FFFFFF?text=AV', // Use fetched profile pic
                reportingFrom: reportingFrom || "Unknown Location",
                timestamp: window.serverTimestamp(),
                mediaUrl: mediaUrl,
                mediaType: mediaType,
                uid: window.auth.currentUser ? window.auth.currentUser.uid : null // Store the user's UID
            };

            try {
                await window.addDoc(window.collection(window.db, "posts"), postData);
                postContent.value = ''; // Clear form fields
                postMedia.value = ''; // Clear file input
                loadPosts(); // Reload all posts to display the new one at the top
            } catch (e) {
                console.error("Error adding post: ", e);
                alert("Error posting update. Please try again. Check console for details.");
            }
        });
    }

    // `loadPosts()` is now called inside `onAuthStateChanged` to ensure user is logged in first.
    // The setInterval is also now conditionally set after auth check to ensure `loadPosts` has context.
    setInterval(() => {
        if (window.auth.currentUser && currentBlogId) {
            loadPosts(); // Only refresh if user is logged in and a blog is selected
        }
    }, 60000); // Every minute
});
