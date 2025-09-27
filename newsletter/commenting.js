// Import the shared auth/db instances, specific Firestore functions, and the auth state listener
import { db, auth } from './firebase-init.js';
import { collection, addDoc, getDocs, doc, getDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// Define the collection reference at the top level of the module
const commentsCollection = collection(db, 'comments');

document.addEventListener('DOMContentLoaded', () => {
    const commentUiContainer = document.getElementById('comment-ui-container');
    if (!commentUiContainer) {
        console.error('Comment UI container not found!');
        return;
    }

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
                    if (sib.nodeName.toLowerCase() === selector) {
                       nth++;
                    }
                }
                if (nth !== 1) {
                    selector += `:nth-of-type(${nth})`;
                }
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(" > ");
    }

    function cleanupComments() {
        document.getElementById('comment-trigger')?.remove();
        document.getElementById('comment-view')?.remove();

        const highlights = document.querySelectorAll('.comment-highlight');
        highlights.forEach(span => {
            const parent = span.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(span.textContent), span);
                parent.normalize();
            }
        });
    }

    // --- UI DISPLAY & REPLY FUNCTIONS ---
    function showCommentView(commentData, highlightElement) {
        document.getElementById('comment-view')?.remove();
        const rect = highlightElement.getBoundingClientRect();
        const view = document.createElement('div');
        view.id = 'comment-view';
        view.dataset.commentId = commentData.id;

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

        // Logic for replies
        loadAndDisplayReplies(commentData.id, view);
        view.querySelector('.reply-btn').onclick = (e) => showReplyForm(e.target.dataset.commentId, view);
        view.querySelector('.comment-view-close-btn').onclick = () => view.remove();

        // Positioning logic
        if (window.innerWidth > 900) {
            view.className = 'comment-display-sidebar';
            const mainContent = highlightElement.closest('.main-article, .essentials-container, .cannoli-section-content');
            if (mainContent) {
                const contentRect = mainContent.getBoundingClientRect();
                view.style.top = `${window.scrollY + rect.top}px`;
                view.style.left = `${contentRect.right + 20}px`;
            }
        } else {
            view.className = 'comment-display-popup';
            view.style.top = `${window.scrollY + rect.bottom + 10}px`;
            view.style.left = `${window.scrollX + rect.left}px`;
        }
    }
    
    async function postReply(replyText, parentCommentId) {
        const user = auth.currentUser;
        if (!user || !replyText.trim()) return;
    
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const userName = userDoc.exists() ? userDoc.data().name : "Anonymous";
    
        try {
            await addDoc(commentsCollection, {
                commentText: replyText,
                parentCommentId: parentCommentId,
                userId: user.uid,
                userName: userName,
                pageUrl: window.location.pathname,
                createdAt: new Date()
            });
            const commentView = document.getElementById('comment-view');
            if (commentView) {
                loadAndDisplayReplies(parentCommentId, commentView);
                commentView.querySelector('.reply-form-container')?.remove();
            }
        } catch (error) {
            console.error("Error posting reply: ", error);
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

    // --- EVENT HANDLERS ---
    const handleMouseUp = (e) => {
        if (e.target.closest('input, textarea, button')) return;
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        document.getElementById('comment-trigger')?.remove();
        if (selectedText.length > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer.parentElement;
            if (!container.closest('.main-article, .essentials-container, .cannoli-section-content')) return;
            const rect = range.getBoundingClientRect();
            const trigger = document.createElement('button');
            trigger.id = 'comment-trigger';
            trigger.innerHTML = `Add Comment`;
            commentUiContainer.appendChild(trigger);
            const triggerRect = trigger.getBoundingClientRect();
            trigger.style.top = `${window.scrollY + rect.bottom + 5}px`;
            trigger.style.left = `${window.scrollX + rect.left + (rect.width / 2) - (triggerRect.width / 2)}px`;
            trigger.addEventListener('mousedown', (e) => e.stopPropagation());
            trigger.onclick = () => {
                showCommentForm(selection);
                trigger.remove();
            };
        }
    };
    
    const handleMouseDown = (e) => {
        const trigger = document.getElementById('comment-trigger');
        if (trigger && !trigger.contains(e.target)) {
            trigger.remove();
        }
    };

    const handleHighlightClick = async (e) => {
        const highlight = e.target.closest('.comment-highlight');
        if (highlight) {
            const existingView = document.getElementById('comment-view');
            if (existingView && existingView.dataset.commentId === highlight.dataset.commentId) {
                existingView.remove();
                return;
            }
            const commentId = highlight.dataset.commentId;
            const commentDoc = await getDoc(doc(db, 'comments', commentId));
            if (!commentDoc.exists()) return;
            showCommentView({ id: commentId, ...commentDoc.data() }, highlight);
        }
    };

    // --- AUTH-DRIVEN INITIALIZATION ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadAndApplyAllHighlights();
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('mousedown', handleMouseDown);
            document.addEventListener('click', handleHighlightClick);
        } else {
            cleanupComments();
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('click', handleHighlightClick);
        }
    });
});
