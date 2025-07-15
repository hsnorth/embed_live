document.addEventListener('DOMContentLoaded', () => {
    const postForm = document.getElementById('postForm');
    const postContent = document.getElementById('postContent');
    const postMedia = document.getElementById('postMedia');
    const postsContainer = document.getElementById('postsContainer');

    // Check if the elements exist before adding event listeners
    if (postForm && postContent && postMedia && postsContainer) {
        postForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent default form submission

            const content = postContent.value.trim();
            const mediaFile = postMedia.files[0]; // Get the first selected file

            if (!content && !mediaFile) {
                alert('Please enter some content or select a file to post.');
                return;
            }

            // Simulate author info (in a real app, this would come from user login)
            const authorName = "You";
            const reportingFrom = "Montreal, Quebec, Canada"; // Current location from the prompt

            // Create a new post element
            const newPost = document.createElement('div');
            newPost.classList.add('blog-post');

            let mediaHtml = '';
            if (mediaFile) {
                const mediaUrl = URL.createObjectURL(mediaFile);
                if (mediaFile.type.startsWith('image/')) {
                    mediaHtml = `<img src="${mediaUrl}" alt="Posted Image">`;
                } else if (mediaFile.type.startsWith('video/')) {
                    mediaHtml = `<video controls src="${mediaUrl}"></video>`;
                }
            }

            newPost.innerHTML = `
                <div class="post-header">
                    <div class="author-info">
                        <div class="author-avatar"></div>
                        <div class="author-details">
                            <span class="time-since-post">Just now</span>
                            <span class="author-name">${authorName}</span>
                            <span class="reporting-from">${reportingFrom}</span>
                        </div>
                    </div>
                </div>
                <div class="post-body">
                    ${content ? `<p>${content}</p>` : ''}
                    ${mediaHtml}
                </div>
                <div class="post-divider"></div>
            `;

            // Add the new post to the top of the container
            postsContainer.prepend(newPost);

            // Clear the form
            postContent.value = '';
            postMedia.value = ''; // Clear file input
        });

        // Function to update "time since post" (could be more sophisticated)
        function updateTimes() {
            const timeElements = document.querySelectorAll('.time-since-post');
            timeElements.forEach(element => {
                // This is a placeholder. In a real app, you'd store the timestamp
                // and calculate the difference. For now, it just shows "Just now" or the hardcoded ones.
            });
        }

        // Call updateTimes initially and then every minute (or as needed)
        // setInterval(updateTimes, 60000); // Update every minute
        updateTimes(); // Initial call
    }
});
