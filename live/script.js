document.addEventListener('DOMContentLoaded', () => {
    const postForm = document.getElementById('postForm');
    const authorNameInput = document.getElementById('authorNameInput');
    const reportingFromInput = document.getElementById('reportingFromInput');
    const postContent = document.getElementById('postContent');
    const postMedia = document.getElementById('postMedia');
    const postsContainer = document.getElementById('postsContainer');
    const blogPageTitle = document.getElementById('blogPageTitle');
    const blogHeaderTitle = document.getElementById('blogHeaderTitle');
    const mainContent = document.getElementById('mainContent');
    const loadingContainer = document.getElementById('loadingContainer');

    const urlParams = new URLSearchParams(window.location.search);
    const currentBlogId = urlParams.get('blogId');
    const currentBlogName = urlParams.get('blogName');

    let currentUserProfile = null;

    window.onAuthStateChanged(window.auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            try {
                const userDocRef = window.doc(window.db, "users", user.uid);
                const userDocSnap = await window.getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    currentUserProfile = userDocSnap.data();
                    authorNameInput.value = currentUserProfile.name || user.email;
                } else {
                    console.warn("User profile not found in Firestore for UID:", user.uid);
                    authorNameInput.value = user.email || "Unknown User";
                }

                if (loadingContainer) loadingContainer.style.display = 'none';
                if (mainContent) mainContent.style.display = 'block';

                loadPosts();

            } catch (error) {
                console.error("Error fetching user profile:", error);
                authorNameInput.value = user.email || "Error Loading User";

                if (loadingContainer) loadingContainer.style.display = 'none';
                if (mainContent) mainContent.style.display = 'block';
                loadPosts();
            }
        }
    });

    if (currentBlogName && blogPageTitle && blogHeaderTitle) {
        blogPageTitle.textContent = currentBlogName;
        blogHeaderTitle.textContent = currentBlogName;
    } else {
        if (blogPageTitle) blogPageTitle.textContent = "Create New Live Blog";
        if (blogHeaderTitle) blogHeaderTitle.textContent = "My Live Blog";
    }

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
                mediaHtml = `<img src="${postData.mediaUrl}" alt="Posted Image">`;
            } else if (postData.mediaType && postData.mediaType.startsWith('video/')) {
                mediaHtml = `<video controls src="${postData.mediaUrl}"></video>`;
            } else {
                 mediaHtml = `<img src="${postData.mediaUrl}" alt="Posted Media">`;
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
            <div class="post-divider"></div>
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
            });
        }

        return newPost;
    };

    const loadPosts = async () => {
        if (!postsContainer) return;

        postsContainer.innerHTML = '';

        if (!currentBlogId) {
            const messageDiv = document.createElement('div');
            messageDiv.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">Please create or select a blog to view posts.</p>`;
            postsContainer.appendChild(messageDiv);
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

    if (postForm) {
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
                mediaUrl = URL.createObjectURL(mediaFile);
                mediaType = mediaFile.type;
            }

            const postData = {
                blogId: currentBlogId,
                content: content,
                authorName: currentUserProfile ? currentUserProfile.name : (window.auth.currentUser ? window.auth.currentUser.email : "Anonymous"),
                authorEmail: currentUserProfile ? currentUserProfile.email : (window.auth.currentUser ? window.auth.currentUser.email : "N/A"),
                authorPic: currentUserProfile ? currentUserProfile.pic : 'https://via.placeholder.com/36/CCCCCC/FFFFFF?text=AV',
                reportingFrom: reportingFrom || "Unknown Location",
                timestamp: window.serverTimestamp(),
                mediaUrl: mediaUrl,
                mediaType: mediaType,
                uid: window.auth.currentUser ? window.auth.currentUser.uid : null
            };

            try {
                await window.addDoc(window.collection(window.db, "posts"), postData);
                postContent.value = '';
                postMedia.value = '';
                loadPosts();
            } catch (e) {
                console.error("Error adding post: ", e);
                alert("Error posting update. Please try again. Check console for details.");
            }
        });
    }

    setInterval(() => {
        if (window.auth.currentUser && currentBlogId) {
            loadPosts();
        }
    }, 60000);
});
