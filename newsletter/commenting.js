// Comments are now attached to whole posts (magazine items + social posts),
// shown under each post in the actions area. Anyone logged in can comment,
// all comments are public, and threaded replies are supported.
//
// Deepnotes remain inline text highlights (dotted underline) but ONLY admins
// can create them. Everyone can read/click an existing deepnote.

import { db, auth } from './firebase-init.js';
import { collection, addDoc, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

const commentsCollection = collection(db, 'comments');
const deepnotesCollection = collection(db, 'deepnotes');

document.addEventListener('DOMContentLoaded', () => {
    const deepnoteUiContainer = document.getElementById('deepnote-ui-container');
    let currentSelectionRange = null;

    const isAdmin = () => window.isAdmin === true;

    // ---------------------------------------------------------------------
    // UTILITIES
    // ---------------------------------------------------------------------
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

    const toMillis = (r) => (r && r.createdAt && typeof r.createdAt.toMillis === 'function')
        ? r.createdAt.toMillis()
        : new Date((r && r.createdAt) || 0).getTime();

    async function getUserName(uid) {
        try {
            const snap = await getDoc(doc(db, 'users', uid));
            return snap.exists() ? (snap.data().name || 'Anonymous') : 'Anonymous';
        } catch { return 'Anonymous'; }
    }

    // =====================================================================
    // POST COMMENTS  (magazine items + social posts)
    // =====================================================================

    // Cache of all top-level comments + replies for this page, grouped by postId.
    let commentsByPost = {};

    async function loadComments() {
        commentsByPost = {};
        try {
            const q = query(commentsCollection, where('pageUrl', '==', window.location.pathname));
            const snap = await getDocs(q);
            const all = [];
            snap.forEach(d => all.push({ id: d.id, ...d.data() }));

            // Group top-level comments by postId; stash replies under their parent.
            const repliesByParent = {};
            all.forEach(c => {
                if (c.parentCommentId) {
                    (repliesByParent[c.parentCommentId] = repliesByParent[c.parentCommentId] || []).push(c);
                }
            });
            all.forEach(c => {
                if (!c.parentCommentId && c.postId) {
                    c.replies = (repliesByParent[c.id] || []).sort((a, b) => toMillis(a) - toMillis(b));
                    (commentsByPost[c.postId] = commentsByPost[c.postId] || []).push(c);
                }
            });
            Object.values(commentsByPost).forEach(list => list.sort((a, b) => toMillis(a) - toMillis(b)));
        } catch (e) {
            console.error('Could not load comments.', e);
        }
    }

    // Track which posts have their comment thread expanded, so re-renders
    // (e.g. after posting) keep the thread open.
    const expandedPosts = new Set();

    function updateCommentCount(postId) {
        const count = (commentsByPost[postId] || []).reduce(
            (n, c) => n + 1 + (c.replies ? c.replies.length : 0), 0);
        document.querySelectorAll(`.post-comment-btn[data-post-id="${postId}"] .post-comment-count`)
            .forEach(el => { el.textContent = count; });
    }

    function renderAllCommentThreads() {
        const disabled = document.body.classList.contains('commenting-disabled');
        document.querySelectorAll('.post-comments[data-post-id]').forEach(container => {
            const postId = container.dataset.postId;
            if (disabled) {
                container.innerHTML = '';
                container.hidden = true;
                // Hide the comment button entirely when commenting is off.
                document.querySelectorAll(`.post-comment-btn[data-post-id="${postId}"]`)
                    .forEach(b => { b.style.display = 'none'; });
                return;
            }
            document.querySelectorAll(`.post-comment-btn[data-post-id="${postId}"]`)
                .forEach(b => { b.style.display = ''; });
            renderCommentThread(container);
            updateCommentCount(postId);
            // Respect whether this thread was open before the re-render.
            const open = expandedPosts.has(postId);
            container.hidden = !open;
            document.querySelectorAll(`.post-comment-btn[data-post-id="${postId}"]`)
                .forEach(b => b.setAttribute('aria-expanded', String(open)));
        });
    }

    function renderCommentThread(container) {
        const postId = container.dataset.postId;
        const comments = commentsByPost[postId] || [];
        const loggedIn = !!auth.currentUser;

        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'comment-thread';

        // Existing comments + their replies
        comments.forEach(c => wrap.appendChild(buildCommentEl(c)));

        if (comments.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'comment-empty';
            empty.textContent = 'No comments yet. Be the first.';
            wrap.appendChild(empty);
        }

        // Comment composer (logged-in only)
        if (loggedIn) {
            wrap.appendChild(buildComposer(postId));
        } else {
            const prompt = document.createElement('div');
            prompt.className = 'comment-login-prompt';
            prompt.textContent = 'Sign in to join the conversation.';
            wrap.appendChild(prompt);
        }

        container.appendChild(wrap);
    }

    // Toggle a post's comment thread open/closed.
    function toggleCommentThread(postId) {
        const isOpen = expandedPosts.has(postId);
        if (isOpen) expandedPosts.delete(postId);
        else expandedPosts.add(postId);
        const nowOpen = !isOpen;
        document.querySelectorAll(`.post-comments[data-post-id="${postId}"]`)
            .forEach(c => { c.hidden = !nowOpen; });
        document.querySelectorAll(`.post-comment-btn[data-post-id="${postId}"]`)
            .forEach(b => b.setAttribute('aria-expanded', String(nowOpen)));
        // Auto-focus the composer when opening, for an intuitive feel.
        if (nowOpen) {
            const ta = document.querySelector(`.post-comments[data-post-id="${postId}"] .comment-composer-input`);
            if (ta) ta.focus();
        }
    }

    // Delegated click for the comment toggle button.
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.post-comment-btn');
        if (!btn) return;
        e.preventDefault();
        toggleCommentThread(btn.dataset.postId);
    });

    function buildCommentEl(comment) {
        const el = document.createElement('div');
        el.className = 'thread-comment';

        const main = document.createElement('div');
        main.className = 'thread-comment-main';
        main.innerHTML = `
            <div class="thread-comment-author"></div>
            <p class="thread-comment-body"></p>
            <button class="thread-reply-btn" type="button">Reply</button>
        `;
        main.querySelector('.thread-comment-author').textContent = comment.userName || 'Anonymous';
        main.querySelector('.thread-comment-body').textContent = comment.commentText || '';
        el.appendChild(main);

        // Replies
        const repliesWrap = document.createElement('div');
        repliesWrap.className = 'thread-replies';
        (comment.replies || []).forEach(r => {
            const rEl = document.createElement('div');
            rEl.className = 'thread-reply';
            rEl.innerHTML = `<div class="thread-comment-author"></div><p class="thread-comment-body"></p>`;
            rEl.querySelector('.thread-comment-author').textContent = r.userName || 'Anonymous';
            rEl.querySelector('.thread-comment-body').textContent = r.commentText || '';
            repliesWrap.appendChild(rEl);
        });
        el.appendChild(repliesWrap);

        // Reply button behaviour
        const replyBtn = main.querySelector('.thread-reply-btn');
        replyBtn.addEventListener('click', () => {
            if (!auth.currentUser) { promptSignIn(); return; }
            if (el.querySelector('.reply-composer')) return; // already open
            const composer = buildComposer(comment.postId, comment.id);
            composer.classList.add('reply-composer');
            el.appendChild(composer);
            composer.querySelector('textarea')?.focus();
        });

        return el;
    }

    function buildComposer(postId, parentCommentId = null) {
        const composer = document.createElement('div');
        composer.className = 'comment-composer';
        composer.innerHTML = `
            <textarea class="comment-composer-input" placeholder="${parentCommentId ? 'Write a reply…' : 'Add a comment…'}"></textarea>
            <button class="comment-composer-btn" type="button">${parentCommentId ? 'Post Reply' : 'Post'}</button>
        `;
        const textarea = composer.querySelector('textarea');
        const btn = composer.querySelector('.comment-composer-btn');
        btn.addEventListener('click', async () => {
            const text = textarea.value.trim();
            if (!text) return;
            btn.disabled = true;
            await postComment(postId, text, parentCommentId);
        });
        return composer;
    }

    async function postComment(postId, commentText, parentCommentId = null) {
        const user = auth.currentUser;
        if (!user) { promptSignIn(); return; }
        const userName = await getUserName(user.uid);
        try {
            await addDoc(commentsCollection, {
                commentText,
                isPublic: true,
                postId,
                parentCommentId,
                userId: user.uid,
                userName,
                pageUrl: window.location.pathname,
                newsletterId: window.currentNewsletterId || 'default',
                createdAt: new Date()
            });
            await loadComments();
            renderAllCommentThreads();
        } catch (e) {
            console.error('Error posting comment:', e);
            alert('Your comment could not be saved. Please try again.');
        }
    }

    function promptSignIn() {
        const signInModal = document.getElementById('signInModal');
        if (signInModal) signInModal.classList.add('is-open');
    }

    // =====================================================================
    // DEEPNOTES  (admin-only creation, inline dotted highlight)
    // =====================================================================

    function cleanupDeepnotes() {
        document.getElementById('selection-trigger')?.remove();
        document.getElementById('deepnote-view')?.remove();
        // Unwrap existing deepnote highlights safely via DOM (no innerHTML splicing).
        document.querySelectorAll('.deepnote-highlight').forEach(span => {
            const parent = span.parentNode;
            if (!parent) return;
            while (span.firstChild) parent.insertBefore(span.firstChild, span);
            parent.removeChild(span);
            parent.normalize();
        });
    }

    // Wrap a DOM Range in a highlight span using surroundContents-style logic.
    // This is offset-free, so it cannot corrupt the surrounding HTML the way the
    // old innerHTML string-splicing did.
    function wrapRangeWithDeepnote(range, deepnoteId) {
        try {
            const span = document.createElement('span');
            span.className = 'deepnote-highlight';
            span.dataset.deepnoteId = deepnoteId;
            // surroundContents throws if the range partially selects a node;
            // fall back to extract+insert which handles multi-node ranges.
            try {
                range.surroundContents(span);
            } catch {
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
            }
            return true;
        } catch (e) {
            console.error('Could not wrap deepnote range:', e);
            return false;
        }
    }

    // Find a text range inside an element matching the saved highlighted text.
    function findTextRange(element, text) {
        if (!text) return null;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            const idx = node.nodeValue.indexOf(text);
            if (idx !== -1) {
                const range = document.createRange();
                range.setStart(node, idx);
                range.setEnd(node, idx + text.length);
                return range;
            }
        }
        return null; // spans multiple nodes — skip rather than risk corruption
    }

    async function loadDeepnotes() {
        cleanupDeepnotes();
        if (document.body.classList.contains('deepnote-disabled')) return;
        try {
            const q = query(deepnotesCollection, where('pageUrl', '==', window.location.pathname));
            const snap = await getDocs(q);
            snap.forEach(d => {
                const deepnote = { id: d.id, ...d.data() };
                const element = document.querySelector(deepnote.targetSelector);
                if (!element) return;
                if (element.querySelector(`[data-deepnote-id="${deepnote.id}"]`)) return;
                const range = findTextRange(element, deepnote.highlightedText);
                if (range) wrapRangeWithDeepnote(range, deepnote.id);
            });
        } catch (e) {
            console.error('Could not load deepnotes.', e);
        }
    }

    async function showDeepnoteView(highlightElement) {
        document.getElementById('deepnote-view')?.remove();
        const deepnoteId = highlightElement.dataset.deepnoteId;
        if (!deepnoteId) return;
        try {
            const snap = await getDoc(doc(db, 'deepnotes', deepnoteId));
            if (!snap.exists()) return;
            const view = document.createElement('div');
            view.id = 'deepnote-view';
            view.textContent = snap.data().content;
            deepnoteUiContainer.appendChild(view);
            const rect = highlightElement.getBoundingClientRect();
            view.style.top = `${window.scrollY + rect.bottom + 5}px`;
            view.style.left = `${window.scrollX + rect.left}px`;
        } catch (e) {
            console.error('Error fetching deepnote:', e);
        }
    }

    function showDeepnoteForm() {
        document.getElementById('selection-trigger')?.remove();
        if (!currentSelectionRange) return;
        const selectedText = currentSelectionRange.toString().trim();
        if (!selectedText) return;
        const modal = document.getElementById('deepnote-form-modal');
        if (modal) {
            modal.querySelector('#deepnote-quote').textContent = `"${selectedText}"`;
            modal.classList.add('is-open');
            modal.querySelector('#deepnote-textarea').focus();
        }
    }

    async function postDeepnote() {
        const user = auth.currentUser;
        if (!user || !isAdmin() || !currentSelectionRange) return;
        const content = document.getElementById('deepnote-textarea').value;
        if (!content.trim()) { alert('Deepnote cannot be empty.'); return; }

        const parentElement = currentSelectionRange.startContainer.parentElement.closest('p, li, h3');
        if (!parentElement) {
            console.error('No valid parent element for the deepnote.');
            return;
        }
        const selector = generateCssSelector(parentElement);
        const highlightedText = currentSelectionRange.toString();

        try {
            await addDoc(deepnotesCollection, {
                content,
                highlightedText,
                targetSelector: selector,
                userId: user.uid,
                pageUrl: window.location.pathname,
                newsletterId: window.currentNewsletterId || 'default',
                createdAt: new Date()
            });
            await loadDeepnotes();
        } catch (e) {
            console.error('Error saving deepnote:', e);
        } finally {
            const modal = document.getElementById('deepnote-form-modal');
            if (modal) { modal.classList.remove('is-open'); modal.querySelector('form')?.reset(); }
            currentSelectionRange = null;
        }
    }

    // Selection trigger — only offered to admins, only for deepnotes.
    const handleMouseUp = (e) => {
        setTimeout(() => {
            document.getElementById('selection-trigger')?.remove();
            if (!isAdmin()) return;
            if (document.body.classList.contains('deepnote-disabled')) return;

            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            if (selectedText.length === 0 || selection.rangeCount === 0) return;
            if (e.target.closest('input, textarea, button, #deepnote-view')) return;

            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer.parentElement;
            // Deepnotes only inside the magazine article body.
            if (!container || !container.closest('.main-article, .essentials-container, .cannoli-section-content')) return;

            currentSelectionRange = range.cloneRange();
            const rect = range.getBoundingClientRect();
            const trigger = document.createElement('div');
            trigger.id = 'selection-trigger';
            trigger.innerHTML = `<button class="selection-trigger-btn" id="deepnote-trigger-btn">Add Deepnote</button>`;
            document.body.appendChild(trigger);
            trigger.style.top = `${window.scrollY + rect.top - trigger.offsetHeight - 5}px`;
            trigger.style.left = `${window.scrollX + rect.left + (rect.width - trigger.offsetWidth) / 2}px`;
            document.getElementById('deepnote-trigger-btn').onclick = showDeepnoteForm;
        }, 10);
    };

    const handleDocumentClick = (e) => {
        if (!e.target.closest('#selection-trigger')) {
            document.getElementById('selection-trigger')?.remove();
        }
        const deepnoteHighlight = e.target.closest('.deepnote-highlight');
        if (deepnoteHighlight) { showDeepnoteView(deepnoteHighlight); return; }
        if (!e.target.closest('#deepnote-view')) document.getElementById('deepnote-view')?.remove();
    };

    const deepnoteForm = document.getElementById('deepnote-form');
    if (deepnoteForm) {
        deepnoteForm.addEventListener('submit', (e) => { e.preventDefault(); postDeepnote(); });
    }

    // =====================================================================
    // WIRING
    // =====================================================================
    // Deepnote selection/click listeners are always attached; they self-gate
    // on admin status and the deepnote-disabled body class.
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('click', handleDocumentClick);

    async function refreshEverything() {
        await loadComments();
        renderAllCommentThreads();
        await loadDeepnotes();
    }

    // Re-render after content appears or auth/admin status changes.
    document.addEventListener('newsletter-loaded', refreshEverything);
    document.addEventListener('magazine-section-rendered', () => { renderAllCommentThreads(); loadDeepnotes(); });
    document.addEventListener('social-feed-generated', renderAllCommentThreads);
    document.addEventListener('admin-status-resolved', refreshEverything);
    document.addEventListener('features-changed', () => { loadDeepnotes(); renderAllCommentThreads(); });
    onAuthStateChanged(auth, refreshEverything);
});
