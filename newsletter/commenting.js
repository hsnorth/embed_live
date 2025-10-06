// Import the shared auth/db instances, specific Firestore functions, and the auth state listener
import { db, auth } from './firebase-init.js';
import { collection, addDoc, getDocs, doc, getDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// Define collection references for both features
const commentsCollection = collection(db, 'comments');
const deepnotesCollection = collection(db, 'deepnotes');

document.addEventListener('DOMContentLoaded', () => {
    const commentUiContainer = document.getElementById('comment-ui-container');
    const deepnoteUiContainer = document.getElementById('deepnote-ui-container');
    
    if (!commentUiContainer || !deepnoteUiContainer) {
        console.error('Comment or Deepnote UI container not found!');
        return;
    }

    let currentSelectionRange = null;

    // --- UTILITY FUNCTIONS ---
    function getRangeHtml(range) {
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());
        return container.innerHTML;
    }
     
    function applyHighlightToRange(element, start, end, commentId) {
        const originalHtml = element.innerHTML;
        const before = originalHtml.substring(0, start);
        const highlighted = originalHtml.substring(start, end);
        const after = originalHtml.substring(end);
        
        if (highlighted.includes('class="comment-highlight"')) return;

        const newHtml = `${before}<span class="comment-highlight" data-comment-id="${commentId}">${highlighted}</span>${after}`;
        element.innerHTML = newHtml;
    }

    function generateCssSelector(el) {
        if (!(el instanceof Element)) return;
        let path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector = '#' + el.id;
                path.unshift(selector);
                break;
            } else {
                let sib = el, nth = 1;
                while (sib = sib.previousElementSibling) {
                    if (sib.nodeName.toLowerCase() === selector) nth++;
                }
                if (nth !== 1) selector += `:nth-of-type(${nth})`;
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(" > ");
    }

    function cleanupFeatures() {
        document.getElementById('selection-trigger')?.remove();
        document.getElementById('comment-view')?.remove();
        document.getElementById('deepnote-view')?.remove();

        document.querySelectorAll('.comment-highlight, .deepnote-highlight').forEach(span => {
            const parent = span.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(span.textContent), span);
                parent.normalize();
            }
        });
    }
    /**
     * Makes the comment view box draggable by its header.
     * @param {HTMLElement} element The comment view element to make draggable.
     */
    function makeDraggable(element) {
        const handle = element.querySelector('.comment-view-header');
        if (!handle) return; // We only want to drag by the header
    
        let isDragging = false;
        let initialX, initialY, offsetX, offsetY;
        
        // Get the main header to prevent dragging the box on top of it
        const mainHeader = document.querySelector('.main-header');
        const navHeight = mainHeader ? mainHeader.offsetHeight : 0;
    
        handle.onmousedown = (e) => {
            isDragging = true;
            // Record initial positions
            initialX = e.clientX;
            initialY = e.clientY;
            offsetX = element.offsetLeft;
            offsetY = element.offsetTop;
            
            element.classList.add('is-dragging'); // Add style for visual feedback
    
            // Listen for mouse movements and release
            document.onmousemove = onMouseMove;
            document.onmouseup = onMouseUp;
        };
    
        function onMouseMove(e) {
            if (!isDragging) return;
            e.preventDefault();
    
            // Calculate the new position
            const deltaX = e.clientX - initialX;
            const deltaY = e.clientY - initialY;
            let newTop = offsetY + deltaY;
            let newLeft = offsetX + deltaX;
    
            // Constraint: Prevent the box from being dragged under the nav header
            if (newTop < navHeight) {
                newTop = navHeight;
            }
            
            element.style.top = `${newTop}px`;
            element.style.left = `${newLeft}px`;
        }
    
        function onMouseUp() {
            isDragging = false;
            element.classList.remove('is-dragging');
            
            // Stop listening to mouse events
            document.onmousemove = null;
            document.onmouseup = null;
        }
    }

    // --- DEEPNOTE-SPECIFIC FUNCTIONS ---
    function showDeepnoteForm() {
        document.getElementById('selection-trigger')?.remove();
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        if (!selectedText || !currentSelectionRange) return;

        const modal = document.getElementById('deepnote-form-modal');
        if (modal) {
            modal.querySelector('#deepnote-quote').textContent = `"${selectedText}"`;
            modal.classList.add('is-open');
            modal.querySelector('#deepnote-textarea').focus();
        }
    }

    async function postDeepnote() {
        const user = auth.currentUser;
        if (!user || !currentSelectionRange) return;

        const content = document.getElementById('deepnote-textarea').value;
        if (!content.trim()) {
            alert("Deepnote cannot be empty.");
            return;
        }
        
        const parentElement = currentSelectionRange.startContainer.parentElement.closest('p, li, h3');
        if (!parentElement) {
            console.error("Could not find a valid parent element for the deepnote.");
            return;
        }

        const selector = generateCssSelector(parentElement);
        const preRange = document.createRange();
        preRange.selectNodeContents(parentElement);
        preRange.setEnd(currentSelectionRange.startContainer, currentSelectionRange.startOffset);
        const startOffset = getRangeHtml(preRange).length;
        const endOffset = startOffset + getRangeHtml(currentSelectionRange).length;

        try {
            await addDoc(deepnotesCollection, {
                content: content,
                highlightedText: currentSelectionRange.toString(),
                targetSelector: selector,
                startOffset: startOffset,
                endOffset: endOffset,
                userId: user.uid,
                pageUrl: window.location.pathname,
                createdAt: new Date()
            });
            await loadAllFeatures();
        } catch (error) {
            console.error("Error saving deepnote: ", error);
        } finally {
            const modal = document.getElementById('deepnote-form-modal');
            if(modal) {
                modal.classList.remove('is-open');
                modal.querySelector('form').reset();
            }
        }
    }

    async function showDeepnoteView(highlightElement) {
        document.getElementById('deepnote-view')?.remove();
        const deepnoteId = highlightElement.dataset.deepnoteId;
        if (!deepnoteId) return;

        try {
            const docRef = doc(db, 'deepnotes', deepnoteId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const deepnoteData = docSnap.data();
                const view = document.createElement('div');
                view.id = 'deepnote-view';
                view.textContent = deepnoteData.content;
                deepnoteUiContainer.appendChild(view);
                
                const rect = highlightElement.getBoundingClientRect();
                view.style.top = `${window.scrollY + rect.bottom + 5}px`;
                view.style.left = `${window.scrollX + rect.left}px`;
            }
        } catch (error) {
            console.error("Error fetching deepnote:", error);
        }
    }

    async function loadAllFeatures() {
        cleanupFeatures();

        // 1. Load Comments
        try {
            const q = query(commentsCollection, where("pageUrl", "==", window.location.pathname), where("parentCommentId", "==", null));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                // ... (your existing comment loading logic) ...
            });
        } catch(e) { console.error("Could not load comments.", e); }

        // --- MODIFIED --- Only load deepnotes if the feature is not disabled
        if (!document.body.classList.contains('deepnote-disabled')) {
            // 2. Load Deepnotes
            try {
                const q = query(deepnotesCollection, where("pageUrl", "==", window.location.pathname));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    const deepnote = { id: doc.id, ...doc.data() };
                    const element = document.querySelector(deepnote.targetSelector);
                    if (element) {
                        let html = element.innerHTML;
                        const before = html.substring(0, deepnote.startOffset);
                        const highlighted = html.substring(deepnote.startOffset, deepnote.endOffset);
                        const after = html.substring(deepnote.endOffset);
                        if (!highlighted.includes('deepnote-highlight')) {
                            element.innerHTML = `${before}<span class="deepnote-highlight" data-deepnote-id="${deepnote.id}">${highlighted}</span>${after}`;
                        }
                    }
                });
            } catch(e) { console.error("Could not load deepnotes.", e); }
        }
    }
    /**
     * Displays the comment view with screen-size-aware positioning.
     */
    function showCommentView(commentData, highlightElement) {
        document.getElementById('comment-view')?.remove();
        const rect = highlightElement.getBoundingClientRect();
        const view = document.createElement('div');
        view.id = 'comment-view';
        view.dataset.commentId = commentData.id;
    
        // The HTML structure remains the same
        view.innerHTML = `
            <div class="comment-view-header">
                <div class="comment-author">${commentData.userName || 'Anonymous'}</div>
                <button class="comment-view-close-btn">&times;</button>
            </div>
            <p class="comment-body">${commentData.commentText}</p>
            <div class="comment-footer">
                <button class="reply-btn" data-comment-id="${commentData.id}">Reply</button>
            </div>
            <div class="replies-container"></div>
        `;
    
        commentUiContainer.appendChild(view);
        const viewRect = view.getBoundingClientRect();
    
        // Logic for replies and close button
        loadAndDisplayReplies(commentData.id, view);
        view.querySelector('.reply-btn').onclick = (e) => showReplyForm(e.target.dataset.commentId, view);
        view.querySelector('.comment-view-close-btn').onclick = () => view.remove();
    
        // --- NEW Positioning and Draggable Logic ---
        if (window.innerWidth > 900) { // Large screens
            view.className = 'comment-display-sidebar';
            const mainContent = highlightElement.closest('.main-article, .essentials-container, .cannoli-section-content');
            if (mainContent) {
                const contentRect = mainContent.getBoundingClientRect();
                view.style.top = `${window.scrollY + rect.top}px`;
                view.style.left = `${contentRect.right + 20}px`;
            }
            makeDraggable(view); // Enable dragging
        } else { // Medium and Small screens
            view.className = 'comment-display-popup';
            // Position below and centered to the highlighted text
            view.style.top = `${window.scrollY + rect.bottom + 15}px`;
            const centeredLeft = (rect.left + (rect.width / 2)) - (viewRect.width / 2);
            view.style.left = `${Math.max(15, centeredLeft)}px`; // Use Math.max to prevent it from going off the left edge
            
            if (window.innerWidth > 768) {
                makeDraggable(view); // Enable dragging only on medium screens and up
            }
        }
    }
    
// In commenting.js, replace the entire postReply function with this one

    async function postReply(replyText, parentCommentId) {
        const user = auth.currentUser;
        if (!user || !replyText.trim()) {
            alert("You must be logged in and write a reply.");
            return;
        }
    
        console.log(`Attempting to save reply as user: ${user.uid}`);
        
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const userName = userDoc.exists() ? userDoc.data().name : "Anonymous";
    
        const replyData = {
            commentText: replyText,
            parentCommentId: parentCommentId,
            userId: user.uid,
            userName: userName,
            pageUrl: window.location.pathname,
            createdAt: new Date()
        };
    
        console.log("Data being sent to Firestore:", replyData);
    
        try {
            await addDoc(commentsCollection, replyData);
            
            // If we reach this line, the save was successful.
            alert("Success! Your reply was saved to the database.");
            
            // Now we refresh the list from the database.
            const commentView = document.getElementById('comment-view');
            if (commentView) {
                loadAndDisplayReplies(parentCommentId, commentView);
                commentView.querySelector('.reply-form-container')?.remove();
            }
    
        } catch (error) {
            // If we reach this line, the save failed.
            console.error("--- FIRESTORE SAVE FAILED ---", error);
            alert("Error: The reply could not be saved. Please check the developer console for a detailed error message.");
        }
    }
    function showReplyForm(parentCommentId, viewElement) {
        viewElement.querySelector('.reply-form-container')?.remove();
    
        const formContainer = document.createElement('div');
        formContainer.className = 'reply-form-container';
        formContainer.innerHTML = `
            <textarea class="reply-textarea" placeholder="Write a reply..."></textarea>
            <button class="post-reply-btn">Post Reply</button>
        `;
        viewElement.appendChild(formContainer);
    
        const postBtn = formContainer.querySelector('.post-reply-btn');
        const textarea = formContainer.querySelector('.reply-textarea');
        textarea.focus();
    
        postBtn.onclick = () => {
            postReply(textarea.value, parentCommentId);
        };
    }
    
    async function loadAndDisplayReplies(parentCommentId, viewElement) {
        let repliesContainer = viewElement.querySelector('.replies-container');
        if (!repliesContainer) {
            repliesContainer = document.createElement('div');
            repliesContainer.className = 'replies-container';
            viewElement.appendChild(repliesContainer);
        }
        
        repliesContainer.innerHTML = '';
    
        const q = query(commentsCollection, where("parentCommentId", "==", parentCommentId), orderBy("createdAt"));
        const querySnapshot = await getDocs(q);
    
        querySnapshot.forEach((doc) => {
            const replyData = doc.data();
            const replyDiv = document.createElement('div');
            replyDiv.className = 'reply';
            replyDiv.innerHTML = `
                <div class="reply-author">${replyData.userName}</div>
                <p class="reply-body">${replyData.commentText}</p>
            `;
            repliesContainer.appendChild(replyDiv);
        });
    }

    // --- CORE COMMENTING FUNCTIONS ---
    async function loadAndApplyAllHighlights() {
        cleanupComments();
        try {
            // Query for top-level comments only (where parentCommentId is null)
            const q = query(commentsCollection, where("parentCommentId", "==", null));
            const snapshot = await getDocs(q);
            
            const comments = [];
            snapshot.forEach(doc => {
                if (doc.data().pageUrl === window.location.pathname) {
                    comments.push({ id: doc.id, ...doc.data() });
                }
            });

            const commentsBySelector = comments.reduce((acc, comment) => {
                const selector = comment.targetSelector;
                if (!acc[selector]) acc[selector] = [];
                acc[selector].push(comment);
                return acc;
            }, {});

            for (const selector in commentsBySelector) {
                const element = document.querySelector(selector);
                if (!element) continue;

                const elementComments = commentsBySelector[selector].sort((a, b) => b.startOffset - a.startOffset);
                let newHtml = element.innerHTML;

                for (const comment of elementComments) {
                    const before = newHtml.substring(0, comment.startOffset);
                    const highlighted = newHtml.substring(comment.startOffset, comment.endOffset);
                    const after = newHtml.substring(comment.endOffset);

                    if (highlighted.includes('class="comment-highlight"')) continue;

                    newHtml = `${before}<span class="comment-highlight" data-comment-id="${comment.id}">${highlighted}</span>${after}`;
                }
                element.innerHTML = newHtml;
            }
        } catch(e) {
            console.error("Could not load comments from Firestore.", e);
        }
    }

    function showCommentForm(selection) {
        const range = selection.getRangeAt(0);
        const modal = document.createElement('div');
        modal.className = 'comment-form-modal';
        modal.innerHTML = `
            <div class="comment-form-content">
                <button class="comment-close-btn">&times;</button>
                <h3>Add a Comment</h3>
                <blockquote class="comment-quote">${selection.toString()}</blockquote>
                <textarea id="comment-textarea" placeholder="Share your thoughts..."></textarea>
                <div class="comment-options">
                    <input type="checkbox" id="comment-public-checkbox" checked>
                    <label for="comment-public-checkbox">Public comment</label>
                </div>
                <button id="comment-post-btn">Post</button>
            </div>
        `;
        commentUiContainer.appendChild(modal);
        modal.querySelector('.comment-close-btn').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        
        modal.querySelector('#comment-post-btn').onclick = async () => {
            const commentText = document.getElementById('comment-textarea').value;
            const isPublic = document.getElementById('comment-public-checkbox').checked;
            if (commentText.trim()) {
                await postComment(commentText, isPublic, selection, range);
                modal.remove();
            } else {
                alert("Comment cannot be empty.");
            }
        };
    }

    async function postComment(commentText, isPublic, selection, range) {
        const user = auth.currentUser;
        if (!user) return;

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const userName = userDoc.exists() ? userDoc.data().name : "Anonymous";

        const parentElement = range.startContainer.parentElement.closest('p, li, h3');
        if (!parentElement) {
            console.error("Could not find a valid parent element for the comment.");
            return;
        }

        const selector = generateCssSelector(parentElement);
        const preRange = document.createRange();
        preRange.selectNodeContents(parentElement);
        preRange.setEnd(range.startContainer, range.startOffset);
        const startOffset = getRangeHtml(preRange).length;
        const endOffset = startOffset + getRangeHtml(range).length;

        try {
            const docRef = await addDoc(commentsCollection, {
                commentText, isPublic, highlightedText: selection.toString(),
                targetSelector: selector, startOffset, endOffset,
                parentCommentId: null, // This marks it as a top-level comment
                userId: user.uid, userName: userName,
                pageUrl: window.location.pathname, createdAt: new Date()
            });
            
            applyHighlightToRange(parentElement, startOffset, endOffset, docRef.id);
            
            const newHighlight = parentElement.querySelector(`[data-comment-id="${docRef.id}"]`);
            if (newHighlight) {
                const commentData = { id: docRef.id, userName: userName, commentText };
                showCommentView(commentData, newHighlight);
            }
        } catch (error) {
            console.error("Error saving comment to Firestore: ", error);
        }
    }

   // --- MODIFIED --- EVENT HANDLERS ---

    const handleMouseUp = (e) => {
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            document.getElementById('selection-trigger')?.remove();
            
            if (selectedText.length > 0 && !e.target.closest('input, textarea, button, #comment-view, #deepnote-view')) {
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer.parentElement;
                
                if (!container.closest('.main-article, .essentials-container, .cannoli-section-content')) return;
                
                currentSelectionRange = range;

                const rect = range.getBoundingClientRect();
                const trigger = document.createElement('div');
                trigger.id = 'selection-trigger';
                
                // --- MODIFIED --- Conditionally build the trigger's HTML
                let triggerHTML = `<button class="selection-trigger-btn" id="comment-trigger-btn">Add Comment</button>`;
                if (!document.body.classList.contains('deepnote-disabled')) {
                    triggerHTML += `
                        <div class="selection-trigger-divider"></div>
                        <button class="selection-trigger-btn" id="deepnote-trigger-btn">Add Deepnote</button>
                    `;
                }
                trigger.innerHTML = triggerHTML;
                document.body.appendChild(trigger);
                
                trigger.style.top = `${window.scrollY + rect.top - trigger.offsetHeight - 5}px`;
                trigger.style.left = `${window.scrollX + rect.left + (rect.width - trigger.offsetWidth) / 2}px`;
                
                document.getElementById('comment-trigger-btn').onclick = () => showCommentForm(selection);
                // Conditionally add listener for deepnote button if it exists
                const deepnoteBtn = document.getElementById('deepnote-trigger-btn');
                if (deepnoteBtn) {
                    deepnoteBtn.onclick = showDeepnoteForm;
                }
            }
        }, 10);
    };
    
    const handleDocumentClick = async (e) => {
        if (!e.target.closest('#selection-trigger')) {
            document.getElementById('selection-trigger')?.remove();
        }

        const commentHighlight = e.target.closest('.comment-highlight');
        if (commentHighlight) {
            const commentId = commentHighlight.dataset.commentId;
            const commentDoc = await getDoc(doc(db, 'comments', commentId));
            if (commentDoc.exists()) {
                showCommentView({ id: commentId, ...commentDoc.data() }, commentHighlight);
            }
            return;
        }

        const deepnoteHighlight = e.target.closest('.deepnote-highlight');
        if (deepnoteHighlight) {
            showDeepnoteView(deepnoteHighlight);
            return;
        }

        if (!e.target.closest('#comment-view')) document.getElementById('comment-view')?.remove();
        if (!e.target.closest('#deepnote-view')) document.getElementById('deepnote-view')?.remove();
    };

    const deepnoteForm = document.getElementById('deepnote-form');
    if (deepnoteForm) {
        deepnoteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            postDeepnote();
        });
    }

    // --- AUTH-DRIVEN INITIALIZATION ---
    onAuthStateChanged(auth, (user) => {
        cleanupFeatures(); // Always cleanup first
        
        const commentingDisabled = document.body.classList.contains('commenting-disabled');
        const deepnoteDisabled = document.body.classList.contains('deepnote-disabled');

        if (user) {
            loadAllFeatures(); // This function will internally check if deepnotes are disabled
            document.addEventListener('click', handleDocumentClick);

            // --- MODIFIED --- Only add the mouseup listener if at least one feature is enabled
            if (!commentingDisabled || !deepnoteDisabled) {
                document.addEventListener('mouseup', handleMouseUp);
            } else {
                document.removeEventListener('mouseup', handleMouseUp);
            }
        } else {
            // If logged out, remove listeners
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('click', handleDocumentClick);
        }
    });
});






