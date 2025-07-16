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
    const paginationContainer = document.getElementById('paginationControls');

    const urlParams = new URLSearchParams(window.location.search);
    const currentBlogId = urlParams.get('blogId');
    const currentBlogName = urlParams.get('blogName');

    let currentUserProfile = null;
    let allPostsData = []; // Store all fetched post data
    let paginatedPosts = []; // Stores arrays of post data, each array representing a page
    let currentPageIndex = 0; // 0-indexed current page

    // Define the maximum height for a page of posts in pixels
    // You might need to adjust this value based on your content and screen size
    const maxPageHeight = 700; // Example: 700 pixels

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

                await loadPosts(); // Initial load posts and paginate
            } catch (error) {
                console.error("Error fetching user profile or loading posts:", error);
                authorNameInput.value = user.email || "Error Loading User";

                if (loadingContainer) loadingContainer.style.display = 'none';
                if (mainContent) mainContent.style.display = 'block';
                await loadPosts(); // Still try to load posts even if profile fails
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
                mediaHtml = `<img src="${postData.mediaUrl}" alt="Posted Image" onload="window.measurePostHeight()">`; // Added onload for dynamic height
            } else if (postData.mediaType && postData.mediaType.startsWith('video/')) {
                mediaHtml = `<video controls src="${postData.mediaUrl}" onloadstart="window.measurePostHeight()"></video>`; // Added onloadstart
            } else {
                 mediaHtml = `<img src="${postData.mediaUrl}" alt="Posted Media" onload="window.measurePostHeight()">`;
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
                // When content expands/collapses, we might need to re-evaluate page heights
                // For simplicity here, we re-paginate on next load.
                // For immediate reflow, you would call displayCurrentPagePosts() or a dedicated reflow function.
            });
        }

        return newPost;
    };

    // This function will re-paginate allPostsData based on height
    const paginatePostsByHeight = async () => {
        paginatedPosts = [];
        let currentPagePosts = [];
        let currentPageHeight = 0;

        // Temporarily render all posts off-screen to measure their heights
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.height = 'auto'; // Allow content to determine height
        tempContainer.style.width = postsContainer.offsetWidth + 'px'; // Match container width for accurate measurement
        document.body.appendChild(tempContainer);

        for (const postData of allPostsData) {
            const postElement = createPostElement(postData);
            tempContainer.appendChild(postElement);

            // Wait for images/videos to load if present, to get accurate height
            await new Promise(resolve => {
                const mediaElements = postElement.querySelectorAll('img, video');
                if (mediaElements.length === 0) {
                    resolve();
                    return;
                }
                let loadedCount = 0;
                mediaElements.forEach(media => {
                    // Check if already loaded/cached
                    if (media.complete || media.readyState >= 2) { // complete for img, readyState for video
                        loadedCount++;
                    } else {
                        const mediaLoadHandler = () => {
                            loadedCount++;
                            if (loadedCount === mediaElements.length) {
                                resolve();
                                media.removeEventListener('load', mediaLoadHandler);
                                media.removeEventListener('loadeddata', mediaLoadHandler);
                                media.removeEventListener('error', mediaLoadHandler);
                            }
                        };
                        media.addEventListener('load', mediaLoadHandler);
                        media.addEventListener('loadeddata', mediaLoadHandler); // For video
                        media.addEventListener('error', mediaLoadHandler); // Handle errors too
                    }
                });
                if (loadedCount === mediaElements.length) resolve(); // All media already loaded
            });

            const postHeight = postElement.offsetHeight; // Get the rendered height

            if (currentPageHeight + postHeight > maxPageHeight && currentPagePosts.length > 0) {
                // If adding this post exceeds max height, start a new page
                paginatedPosts.push(currentPagePosts);
                currentPagePosts = [postData];
                currentPageHeight = postHeight;
            } else {
                // Otherwise, add to current page
                currentPagePosts.push(postData);
                currentPageHeight += postHeight;
            }
        }

        // Add any remaining posts as the last page
        if (currentPagePosts.length > 0) {
            paginatedPosts.push(currentPagePosts);
        }

        document.body.removeChild(tempContainer); // Clean up the temporary container
    };

    const displayCurrentPagePosts = () => {
        if (!postsContainer) return;

        postsContainer.innerHTML = ''; // Clear current posts

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
            noPostsMessage.textContent = 'No posts yet. Be the first to add an update!';
            postsContainer.appendChild(noPostsMessage);
        }

        renderPaginationControls();
    };

    const renderPaginationControls = () => {
        if (!paginationContainer) return;

        paginationContainer.innerHTML = ''; // Clear existing controls
        const totalPages = paginatedPosts.length;

        if (totalPages <= 1) {
            return; // No pagination needed for 1 or less pages
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
            pageButton.textContent = i + 1; // Display 1-indexed page numbers
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
            postsContainer.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">Please create or select a blog to view posts.</p>`;
            if (postForm) postForm.style.display = 'none';
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

            // After fetching all posts, paginate them based on height
            await paginatePostsByHeight();
            // Then display the current page
            displayCurrentPagePosts();

        } catch (error) {
            console.error("Error fetching posts: ", error);
            postsContainer.innerHTML = `<p style="text-align: center; color: red;">Error loading posts.</p>`;
            paginationContainer.innerHTML = '';
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
            // For now, we'll store media locally. In a real app, you'd upload to cloud storage
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
                // Add the new post to Firestore
                await window.addDoc(window.collection(window.db, "posts"), postData);

                // Clear the form
                postContent.value = '';
                postMedia.value = '';

                // Reload all posts and reset to the first page to see the new post
                currentPageIndex = 0; // Go to first page after new post
                await loadPosts(); // Reload and re-paginate
            } catch (e) {
                console.error("Error adding post: ", e);
                alert("Error posting update. Please try again. Check console for details.");
            }
        });
    }

    // This function can be called by onload/loadeddata of media to trigger re-pagination if media loads late
    // However, the `paginatePostsByHeight` already waits for media in the temp container
    // so this is more of a fallback/redundancy or for very complex dynamic content.
    window.measurePostHeight = () => {
        // Debounce or only re-paginate if truly necessary
        // For simplicity, we assume paginatePostsByHeight handles initial measurement correctly.
    };

    setInterval(() => {
        if (window.auth.currentUser && currentBlogId) {
            loadPosts();
        }
    }, 60000); // Every 60 seconds
});
