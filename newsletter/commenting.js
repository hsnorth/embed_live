// Import the shared auth/db instances, specific Firestore functions, and the auth state listener
import { db, auth } from './firebase-init.js';
import { collection, addDoc, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
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

    // --- UI DISPLAY FUNCTIONS ---
    
    // NEW FUNCTION to handle creating and positioning the comment view
    function showCommentView(commentData, highlightElement) {
        // Remove any existing view first
        document.getElementById('comment-view')?.remove();

        const rect = highlightElement.getBoundingClientRect();
        
        const view = document.createElement('div');
        view.id = 'comment-view';
        view.dataset.commentId = commentData.id;
        view.innerHTML = `
            <div class="comment-author">${commentData.userName || 'Anonymous'}</div>
            <p>${commentData.commentText}</p>
            <button class="comment-view-close-btn">&times;</button>
        `;
        
        commentUiContainer.appendChild(view);
        view.querySelector('.comment-view-close-btn').onclick = () => view.remove();

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

    // --- CORE COMMENTING FUNCTIONS ---

    async function loadAndApplyAllHighlights() {
        cleanupComments();
        try {
            const snapshot = await getDocs(commentsCollection);
            const comments = [];
            snapshot.forEach(doc => {
                if (doc.data().pageUrl === window.location.pathname) {
                    comments.push({ id: doc.id, ...doc.data() });
                }
            });

            comments.sort((a, b) => b.startOffset - a.startOffset);

            for (const comment of comments) {
                const element = document.querySelector(comment.targetSelector);
                if (element) {
                    applyHighlightToRange(element, comment.startOffset, comment.endOffset, comment.id);
                }
            }
        } catch(e) {
            console.error("Could not load comments from Firestore.", e);
        }
    }

    function showCommentForm(selection) {
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
        modal.onclick = (e) => { if(e.target === modal) modal.remove(); };

        modal.querySelector('#comment-post-btn').onclick = async () => {
            const commentText = document.getElementById('comment-textarea').value;
            const isPublic = document.getElementById('comment-public-checkbox').checked;

            if (commentText.trim()) {
                await postComment(commentText, isPublic, selection, selection.getRangeAt(0));
                modal.remove();
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
        if (!parentElement) return;

        const selector = generateCssSelector(parentElement);
        const preRange = document.createRange();
        preRange.selectNodeContents(parentElement);
        preRange.setEnd(range.startContainer, range.startOffset);
        const startOffset = preRange.toString().length;
        const endOffset = startOffset + range.toString().length;

        try {
            const docRef = await addDoc(commentsCollection, {
                commentText,
                isPublic,
                highlightedText: selection.toString(),
                targetSelector: selector,
                startOffset,
                endOffset,
                userId: user.uid,
                userName: userName,
                pageUrl: window.location.pathname,
                createdAt: new Date()
            });
            
            applyHighlightToRange(parentElement, startOffset, endOffset, docRef.id);
            
            // --- THIS IS THE FIX ---
            // After posting, find the new highlight and show the comment view
            const newHighlight = parentElement.querySelector(`[data-comment-id="${docRef.id}"]`);
            if (newHighlight) {
                const commentData = { id: docRef.id, userName, commentText };
                showCommentView(commentData, newHighlight);
            }
            // --- END FIX ---

        } catch (error) {
            console.error("Error adding comment: ", error);
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
            
            // Use the centralized showCommentView function
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
