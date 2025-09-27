// Import the shared database instance and specific Firestore functions
import { db } from './firebase-init.js';
import { collection, addDoc, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const commentsCollection = collection(db, 'comments');

document.addEventListener('DOMContentLoaded', () => {
    const commentUiContainer = document.getElementById('comment-ui-container');
    if (!commentUiContainer) {
        console.error('Comment UI container not found!');
        return;
    }

    // --- 1. HIGHLIGHTING & TRIGGERING THE "ADD COMMENT" BUTTON ---

    document.addEventListener('mouseup', (e) => {
        // Don't trigger on text input fields or buttons
        if (e.target.closest('input, textarea, button')) return;

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        const existingTrigger = document.getElementById('comment-trigger');
        if (existingTrigger) existingTrigger.remove();

        if (selectedText.length > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer.parentElement;
            
            if (!container.closest('.main-article, .essentials-container, .cannoli-section-content')) {
                return;
            }

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
    });
    
    document.addEventListener('mousedown', (e) => {
        const trigger = document.getElementById('comment-trigger');
        if (trigger && !trigger.contains(e.target)) {
            trigger.remove();
        }
    });


    // --- 2. SHOWING THE COMMENT INPUT FORM ---

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
        modal.onclick = (e) => { if(e.target === modal) modal.remove(); };

        modal.querySelector('#comment-post-btn').onclick = async () => {
            const commentText = document.getElementById('comment-textarea').value;
            const isPublic = document.getElementById('comment-public-checkbox').checked;

            if (commentText.trim()) {
                await postComment(commentText, isPublic, selection, range);
                modal.remove();
            }
        };
    }

    // --- 3. POSTING THE COMMENT TO FIRESTORE ---

    async function postComment(commentText, isPublic, selection, range) {
        const parentElement = range.startContainer.parentElement.closest('p, li, h3');
        if (!parentElement) {
            console.error("Could not find a suitable parent element for the comment.");
            return;
        }
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
                pageUrl: window.location.pathname,
                createdAt: new Date()
            });
            
            applyHighlightToRange(parentElement, startOffset, endOffset, docRef.id);

        } catch (error) {
            console.error("Error adding comment: ", error);
        }
    }


    // --- 4. LOADING & APPLYING HIGHLIGHTS ON PAGE LOAD ---

    async function loadAndApplyAllHighlights() {
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
    
    loadAndApplyAllHighlights();


    // --- 5. VIEWING COMMENTS ---

    document.addEventListener('click', async (e) => {
        const highlight = e.target.closest('.comment-highlight');
        const existingView = document.getElementById('comment-view');

        // Close logic: if clicking away, or clicking the same highlight again.
        if (existingView && (!highlight || existingView.dataset.commentId === highlight.dataset.commentId)) {
            existingView.remove();
            return;
        }
        if (existingView) existingView.remove();

        if (highlight) {
            const commentId = highlight.dataset.commentId;
            const commentDoc = await getDoc(doc(db, 'comments', commentId));
            if (!commentDoc.exists()) return;

            const commentData = commentDoc.data();
            const rect = highlight.getBoundingClientRect();
            
            const view = document.createElement('div');
            view.id = 'comment-view';
            view.dataset.commentId = commentId;
            view.innerHTML = `<p>${commentData.commentText}</p><button class="comment-view-close-btn">&times;</button>`;
            
            commentUiContainer.appendChild(view);
            view.querySelector('.comment-view-close-btn').onclick = () => view.remove();

            // Responsive positioning logic
            if (window.innerWidth > 900) {
                view.className = 'comment-display-sidebar';
                
                // Find the main content column to position relative to
                const mainContent = highlight.closest('.main-article, .essentials-container, .cannoli-section-content');
                if (mainContent) {
                    const contentRect = mainContent.getBoundingClientRect();
                    view.style.top = `${window.scrollY + rect.top}px`;
                    view.style.left = `${contentRect.right + 20}px`; // Position 20px right of the content column
                }

            } else {
                view.className = 'comment-display-popup';
                view.style.top = `${window.scrollY + rect.bottom + 10}px`;
                view.style.left = `${window.scrollX + rect.left}px`;
            }
        }
    });


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
                selector = `#${el.id}`;
                path.unshift(selector);
                break;
            } else {
                let sib = el, nth = 1;
                while (sib = sib.previousElementSibling) {
                    if (sib.nodeName.toLowerCase() == selector)
                       nth++;
                }
                if (nth != 1)
                    selector += `:nth-of-type(${nth})`;
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(" > ");
    }
});
