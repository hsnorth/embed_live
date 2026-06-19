// Import the shared Firebase services and specific functions
import { auth, db } from './firebase-init.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updatePassword, deleteUser, fetchSignInMethodsForEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, limit, onSnapshot, increment, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
 
console.log("Firebase is connected via shared module!");
 
window.auth = auth; 
 
// --- MOBILE NAV (isolated) ---
// Registered in its own listener and via event delegation so the hamburger
// always works, regardless of anything that happens in the main init block.
document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('.menu-toggle');
    const closeBtn = e.target.closest('.close-menu-btn');
    const navLink = e.target.closest('.mobile-nav a');
    if (!openBtn && !closeBtn && !navLink) return;
    const mobileNav = document.querySelector('.mobile-nav');
    if (!mobileNav) return;
    if (openBtn) {
        e.preventDefault();
        const willOpen = !mobileNav.classList.contains('is-open');
        mobileNav.classList.toggle('is-open', willOpen);
        document.body.classList.toggle('no-scroll', willOpen);
        mobileNav.setAttribute('aria-hidden', String(!willOpen));
    } else {
        // close button OR a link inside the nav
        if (closeBtn) e.preventDefault();
        mobileNav.classList.remove('is-open');
        document.body.classList.remove('no-scroll');
        mobileNav.setAttribute('aria-hidden', 'true');
    }
});
 
document.addEventListener('DOMContentLoaded', () => {
 
    // --- DYNAMIC CONTENT LOADING (NEW) ---
    // Render a specific newsletter document into the magazine view.
    function renderIssue(docId, data) {
        window.currentNewsletterId = docId;
        renderMagazineView(data);
        document.body.classList.remove('content-loading');
        document.dispatchEvent(new CustomEvent('newsletter-loaded'));
    }

    // Load a specific past issue by its document ID (used by the archive panel).
    async function loadIssueById(docId) {
        try {
            document.body.classList.add('content-loading');
            const snap = await getDoc(doc(db, 'newsletters', docId));
            if (snap.exists()) {
                renderIssue(snap.id, snap.data());
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                document.body.classList.remove('content-loading');
            }
        } catch (e) {
            console.error('Could not load issue:', e);
            document.body.classList.remove('content-loading');
        }
    }
    window.loadIssueById = loadIssueById;

    // Populate the "Past Issues" archive panel with all published newsletters.
    async function loadPastIssues() {
        const listEl = document.getElementById('past-issues-list');
        if (!listEl) return;
        listEl.innerHTML = '<p style="font-family: var(--font-sans); color:#888;">Loading…</p>';
        try {
            const snap = await getDocs(collection(db, 'newsletters'));
            // Treat legacy docs without a status field as published.
            const issues = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(n => n.status !== 'draft');
            // Latest first, then newest publish date.
            issues.sort((a, b) => {
                if ((!!b.isLatest) - (!!a.isLatest)) return (!!b.isLatest) - (!!a.isLatest);
                return String(b.publishDate || '').localeCompare(String(a.publishDate || ''));
            });

            if (issues.length === 0) {
                listEl.innerHTML = '<p style="font-family: var(--font-sans); color:#888;">No issues published yet.</p>';
                return;
            }

            listEl.innerHTML = '';
            issues.forEach(issue => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'past-issue-item' + (issue.isLatest ? ' is-latest' : '');
                const dateStr = issue.publishDate
                    ? new Date(String(issue.publishDate).replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '';
                item.innerHTML = `
                    <span class="past-issue-meta">Issue #${issue.issueNumber ?? '?'}${issue.isLatest ? ' · Latest' : ''}</span>
                    <span class="past-issue-title">${issue.mainTitle || '(untitled)'}</span>
                    <span class="past-issue-date">${dateStr}</span>`;
                item.addEventListener('click', () => {
                    loadIssueById(issue.id);
                    document.getElementById('past-issues-panel-overlay')?.classList.remove('is-open');
                    document.body.classList.remove('no-scroll');
                });
                listEl.appendChild(item);
            });
        } catch (e) {
            console.error('Could not load past issues:', e);
            listEl.innerHTML = '<p style="font-family: var(--font-sans); color:#888;">Could not load issues.</p>';
        }
    }
    window.loadPastIssues = loadPastIssues;

    async function loadLatestHaul() {
        try {
            // 1. Fetch Latest Newsletter from Firestore
            const q = query(collection(db, "newsletters"), where("isLatest", "==", true), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                console.log("No 'latest haul' found in Firestore.");
                document.body.classList.remove('content-loading');
                const contentWrapper = document.getElementById('page-content-wrapper');
                if(contentWrapper) {
                   contentWrapper.innerHTML = '<h1 style="text-align: center; padding: 4rem 1rem; font-family: var(--font-serif);">No newsletter has been published yet. Check back soon!</h1>';
                }
                // Stop further rendering if no content
                document.getElementById('loader')?.classList.add('hidden');
                return;
            }
 
            const newsletterDoc = querySnapshot.docs[0];
            renderIssue(newsletterDoc.id, newsletterDoc.data());
 
            // Populate the archive panel in the background.
            loadPastIssues();
 
            // 2. Fetch "How It Works" Content from Firestore
            const howItWorksDoc = await getDoc(doc(db, 'siteContent', 'howItWorks'));
            if (howItWorksDoc.exists()) {
                const howItWorksPanelContent = document.querySelector('#how-it-works-panel .account-panel-content');
                if (howItWorksPanelContent) {
                    // This assumes the content saved in Firestore is safe HTML.
                    // For a production app, consider using a sanitizer or a Markdown-to-HTML library.
                    howItWorksPanelContent.innerHTML = howItWorksDoc.data().content;
                }
            }
 
        } catch (error)            {
            console.error("Error loading latest haul:", error);
            document.body.classList.remove('content-loading');
            const contentWrapper = document.getElementById('page-content-wrapper');
            if(contentWrapper) {
                contentWrapper.innerHTML = '<h1 style="text-align: center; padding: 4rem 1rem;">Could not load content. Please try again later.</h1>';
            }
        }
    }
 
    function renderMagazineView(data) {
        // Populate Header/Welcome section.
        // The issue eyebrow + title are no longer shown on the magazine page,
        // but we keep the title for the social feed and Past Issues panel.
        window.currentIssueTitle = data.mainTitle || '';
 
        const harrysNote = document.querySelector('.harrys-note-top .harrys-note-body p');
        if (harrysNote) harrysNote.textContent = data.harrysNote;

        // Vertical video in the welcome sidebar (where Harry's Note used to be)
        const videoWrapper = document.getElementById('welcome-video-wrapper');
        const videoEl = document.getElementById('welcome-video');
        if (videoWrapper && videoEl) {
            if (data.welcomeVideo) {
                videoEl.src = data.welcomeVideo;
                videoWrapper.style.display = 'block';
                window.currentWelcomeVideo = data.welcomeVideo;
            } else {
                videoEl.removeAttribute('src');
                videoWrapper.style.display = 'none';
                window.currentWelcomeVideo = null;
            }
        }
        
        const datePlaceholder = document.getElementById('header-date-placeholder');
        if (datePlaceholder) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            // Keep the masthead date in sync with the real current date.
            const today = new Date();
            datePlaceholder.textContent = today.toLocaleDateString('en-US', options).toUpperCase();
        }
 
        // Populate Dynamic Sections from the database
        renderSection('essentials', data.essentials, 'Five essentials');
        renderSection('imports', data.imports, 'The Imports');
        renderImportMap(data.importMap);
        renderSection('deliveries', data.deliveries, 'Next Deliveries');
        renderSection('cannoli', data.cannoli, 'The Cannoli');
        renderSection('coffee', data.coffee, 'Coffee Review');
    }

    // Render the imports map: just the admin-uploaded image (no pins).
    function renderImportMap(importMap) {
        const wrapper = document.querySelector('#imports .map-pin-wrapper');
        const mapContainer = document.querySelector('#imports .map-container');
        if (!wrapper || !mapContainer) return;

        const imageSrc = importMap && importMap.image;
        if (!imageSrc) {
            // No map for this issue — hide the map area entirely.
            mapContainer.style.display = 'none';
            wrapper.innerHTML = '';
            return;
        }

        mapContainer.style.display = 'block';
        wrapper.innerHTML = `<img src="${imageSrc}" alt="Imports map" class="map-image">`;
    }
 
    function renderSection(type, items, defaultTitle) {
        const section = document.getElementById(type);
        if (!section) return;
        
        const container = section.querySelector('.essentials-container, .cannoli-text-content'); // Support both layouts
        if (!container) return;
 
        container.innerHTML = ''; // Clear any hardcoded content
 
        if (!items || items.length === 0) {
             section.style.display = 'none'; // Hide the entire section if no items exist
             return;
        }
        
        section.style.display = 'block'; // Ensure section is visible
        const titleEl = section.querySelector('.section-title');
        if (titleEl) titleEl.textContent = defaultTitle;
 
        items.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'essential-item';
            const postId = `${type}-${index}`;
            itemEl.dataset.postId = postId;
            
            // Create inner HTML, converting newlines in content to <br> tags
            let innerHTML = `
                <h3 class="item-title">${item.title}</h3>
                <p class="item-description">${item.content.replace(/\n/g, '<br>')}</p>
            `;
            
            // Add image if it exists for this item
            if (item.image) {
                // Special handling for cannoli layout
                if (type === 'cannoli') {
                    const imageContainer = document.querySelector('.cannoli-image-container');
                    if (imageContainer) {
                        imageContainer.innerHTML = `<img src="${item.image}" alt="${item.title}" class="cannoli-image">`;
                    }
                }
                else {
                    innerHTML += `<img src="${item.image}" alt="${item.title}" style="width:100%; height:auto; margin-top:1rem; border:1px solid var(--color-border);">`;
                }
            }

            // Like + comment bar for magazine items
            innerHTML += `
                <div class="item-actions" data-post-id="${postId}">
                    <button class="post-like-btn" data-post-id="${postId}" aria-label="Like">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        <span class="post-like-count">0</span>
                    </button>
                    <button class="post-comment-btn" data-post-id="${postId}" aria-expanded="false" aria-label="Comments">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        <span class="post-comment-count">0</span>
                    </button>
                </div>
                <div class="post-comments" data-post-id="${postId}" hidden></div>`;
            
            itemEl.innerHTML = innerHTML;
            container.appendChild(itemEl);
        });
        // Let the likes engine hydrate any new buttons.
        document.dispatchEvent(new CustomEvent('magazine-section-rendered'));
    }
 
    // --- INITIAL PAGE LOAD ---
    loadLatestHaul();
    // --- END OF DYNAMIC CONTENT LOADING ---
 
 
    // --- ALL ORIGINAL UI AND AUTH LOGIC ---
 
    const typeWriter = (element, text, speed, callback) => {
        let i = 0;
        if (!element) return;
        element.innerHTML = '';
        const interval = setInterval(() => {
            if (i < text.length) {
                const char = text.charAt(i);
                if (char === '<') {
                    const closingTagIndex = text.indexOf('>', i);
                    if (closingTagIndex !== -1) {
                        const tag = text.substring(i, closingTagIndex + 1);
                        element.innerHTML += tag;
                        i = closingTagIndex;
                    }
                } else {
                    element.innerHTML += char;
                }
                i++;
            } else {
                clearInterval(interval);
                element.classList.add('typing-done');
                if (callback) callback();
            }
        }, speed);
    };
    
    // --- DOM ELEMENTS ---
    const signInModal = document.getElementById('signInModal');
    const joinModal = document.getElementById('joinModal');
    const modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    const joinFormStep1 = document.getElementById('joinFormStep1');
    const joinFormStep2 = document.getElementById('joinFormStep2');
    const signInForm = document.getElementById('signInForm');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const modalTagline = document.getElementById('modalTagline');
    const toastContainer = document.getElementById('toast-container');
    const mobileJoinLink = document.getElementById('mobileJoinLink');
    const mobileSignInLink = document.getElementById('mobileSignInLink');
    const searchIcon = document.getElementById('search-icon');
    const searchOverlay = document.getElementById('search-overlay');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');
    const stickyBanner = document.getElementById('sticky-signup-banner');
    const stickyForm = document.getElementById('sticky-signup-form');
    const stickyNextBtn = document.getElementById('sticky-next-btn');
    const stickyStep1 = stickyForm ? stickyForm.querySelector('[data-step="1"]') : null;
    const stickyStep2 = stickyForm ? stickyForm.querySelector('[data-step="2"]') : null;
    const stickyEmailInput = document.getElementById('sticky-email');
    const howItWorksTriggers = document.querySelectorAll('.js-how-it-works-trigger');
    const howItWorksPanelOverlay = document.getElementById('how-it-works-panel-overlay');
    const howItWorksPanelCloseBtn = document.getElementById('how-it-works-panel-close-btn');
    const loader = document.getElementById('loader');
    const loaderMessage = document.getElementById('loader-message');
    const controlCentreTrigger = document.getElementById('control-centre-trigger');
    const controlCentreOverlay = document.getElementById('control-centre-overlay');
    const controlCentreCloseBtn = document.getElementById('control-centre-close-btn');
    const commentsToggle = document.getElementById('comments-toggle');
    const deepnoteToggle = document.getElementById('deepnote-toggle');
    const layoutToggleContainer = document.querySelector('.layout-toggle-container');
    const pageContentWrapper = document.getElementById('page-content-wrapper');
    const socialFeedView = document.getElementById('social-feed-view');
 
    let typeInterval;
    let joinEmailValue = '';
    let weekdayEmailValue = '';
    let scrollLockPosition = 0;
    let isScrollLocked = false;
    let isSocialFeedGenerated = false;
    
    // --- WEEKDAY CLOSED LOGIC ---
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 3; // Monday to Friday
    const weekdayClosedOverlay = document.getElementById('weekday-closed-overlay');
 
    // Only run the "closed" flow on pages that actually have the overlay (i.e. the homepage).
    // Previously this branch returned early on EVERY page on weekdays, which killed all
    // auth/UI logic on audio.html, about-us.html, etc.
    if (isWeekday && weekdayClosedOverlay) {
        const closedOverlay = weekdayClosedOverlay;
        const messagePlaceholder = document.getElementById('weekday-message-placeholder');
        const signupForm = document.getElementById('weekday-signup-form');
        
        if (closedOverlay) document.body.style.overflow = 'hidden';
 
        setTimeout(() => {
            if (loader) loader.classList.add('hidden');
            if (closedOverlay) closedOverlay.style.display = 'flex';
            
            const textToType = "Sorry, we're closed on weekdays.<br>Come back Saturday morning.";
            typeWriter(messagePlaceholder, textToType, 60, () => {
                if (signupForm) signupForm.classList.add('is-visible');
            });
        }, 2000);
 
        if (signupForm) {
            let formStep = 1;
            const credentialsContainer = document.getElementById('weekday-credentials-container');
            const submitBtn = document.getElementById('weekday-submit-btn');
            const formLabel = document.getElementById('weekday-form-label');
            const errorMessageDiv = document.getElementById('weekday-error-message');
            const nameInput = document.getElementById('weekday-name');
            const passwordInput = document.getElementById('weekday-password');
 
            const showWeekdayError = (message) => {
                if (errorMessageDiv) {
                    errorMessageDiv.textContent = message;
                    errorMessageDiv.classList.add('is-visible');
                }
            };
 
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (errorMessageDiv) errorMessageDiv.classList.remove('is-visible');
 
                if (formStep === 1) {
                    const emailInput = document.getElementById('weekday-email');
                    if (emailInput && emailInput.value && emailInput.checkValidity()) {
                        try {
                            const methods = await fetchSignInMethodsForEmail(auth, emailInput.value);
                            if (methods.length > 0) {
                                showWeekdayError('This email is already registered. You can sign in on Saturday!');
                            } else {
                                weekdayEmailValue = emailInput.value;
                                credentialsContainer.classList.remove('hidden');
                                credentialsContainer.classList.add('is-open');
                                if (nameInput) nameInput.disabled = false;
                                if (passwordInput) passwordInput.disabled = false;
                                formLabel.textContent = 'Complete your account';
                                submitBtn.textContent = 'Create Account';
                                formStep = 2;
                            }
                        } catch (error) {
                            showWeekdayError('Could not verify email. Please try again.');
                        }
                    } else {
                        showWeekdayError('Please enter a valid email address.');
                    }
                } 
                else if (formStep === 2) {
                    const name = nameInput ? nameInput.value : '';
                    const password = passwordInput ? passwordInput.value : '';
 
                    if (weekdayEmailValue && name && password) {
                        try {
                            const userCredential = await createUserWithEmailAndPassword(auth, weekdayEmailValue, password);
                            await setDoc(doc(db, "users", userCredential.user.uid), {
                                email: weekdayEmailValue, name: name, createdAt: serverTimestamp(), newsletter: true, commentsEnabled: true
                            });
                            const contentWrapper = document.querySelector('.weekday-closed-content');
                            if (contentWrapper) {
                                contentWrapper.innerHTML = '<h1>Thank you for joining!<br>We’ll see you Saturday.</h1>';
                            }
                        } catch (error) {
                            showWeekdayError(error.message);
                        }
                    } else {
                        showWeekdayError('Please make sure all fields are filled out.');
                    }
                }
            });
        }
        return; 
    }
 
    // --- WEEKEND/NORMAL PAGE LOAD ---
    if (loader && loaderMessage) {
        setTimeout(() => {
            loader.classList.add('is-typing');
            typeWriter(loaderMessage, "The haul is open.", 80, () => {
                setTimeout(() => {
                    loader.classList.add('hidden');
                }, 1000);
            });
        }, 2000);
    }
 
    if (modalCloseBtns.length > 0) {
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal-overlay');
                if (modal) closeModal(modal);
            });
        });
    }
    
    if (mobileJoinLink) mobileJoinLink.addEventListener('click', (e) => { e.preventDefault(); openModal(joinModal); });
    if (mobileSignInLink) mobileSignInLink.addEventListener('click', (e) => { e.preventDefault(); openModal(signInModal); });
    
    const headerTopBar = document.querySelector('.header-top-bar');
    const headerBranding = document.querySelector('.header-branding');
    if (headerTopBar && headerBranding) {
        window.addEventListener('scroll', () => {
            const scrollThreshold = headerBranding.offsetTop + headerBranding.offsetHeight;
            if (window.scrollY > scrollThreshold) {
                headerTopBar.classList.add('scrolled');
            } else {
                headerTopBar.classList.remove('scrolled');
            }
        });
    }
 
    function openSearch() {
        if (!searchOverlay) return;
        searchOverlay.classList.add('is-open');
        document.body.classList.add('no-scroll');
        setTimeout(() => searchInput.focus(), 300);
    }
 
    function closeSearch() {
        if (!searchOverlay) return;
        searchOverlay.classList.remove('is-open');
        document.body.classList.remove('no-scroll');
    }
 
    if (searchIcon) searchIcon.addEventListener('click', (e) => { e.preventDefault(); openSearch(); });
    if (closeSearchBtn) closeSearchBtn.addEventListener('click', closeSearch);
    if (searchOverlay) searchOverlay.addEventListener('click', (e) => { if (e.target === searchOverlay) closeSearch(); });
 
    function showToast(message, type = 'info', duration = 4000) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-exit');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    }
 
    function removeStickyBannerLock() {
        if (stickyBanner && stickyBanner.classList.contains('is-visible')) {
            stickyBanner.classList.remove('is-visible');
        }
        if (isScrollLocked) {
            isScrollLocked = false;
            window.removeEventListener('scroll', handleScrollLock);
            document.body.classList.remove('no-scroll'); 
        }
    }
 
    function openModal(modal) {
        if (!modal) return;
        modal.classList.add('is-open');
        document.body.classList.add('no-scroll');
        if (modal.id === 'joinModal') {
            const textToType = "For stories to tell at supper";
            typeWriter(modalTagline, textToType, 80, () => {
                if(joinFormStep1) joinFormStep1.classList.add('form-visible');
            });
        }
    }
 
    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('is-open');
        document.body.classList.remove('no-scroll');
        if (joinFormStep1 && joinFormStep2) {
            joinFormStep1.classList.remove('hidden', 'form-visible');
            joinFormStep2.classList.add('hidden');
            joinFormStep1.reset();
            joinFormStep2.reset();
        }
        if (typeInterval) clearInterval(typeInterval);
        if (modalTagline) modalTagline.innerHTML = '';
    }
 
    const signUp = async (email, password, name, wantsNewsletter) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", userCredential.user.uid), { 
                email, name, createdAt: serverTimestamp(), newsletter: wantsNewsletter, commentsEnabled: true
            });
            showToast('Welcome to the community!', 'success');
            closeModal(joinModal);
            removeStickyBannerLock();
        } catch (error) { showToast(error.message, 'error'); }
    };
 
    const signIn = async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showToast('Successfully signed in!', 'success');
            closeModal(signInModal);
            removeStickyBannerLock();
        } catch (error) { showToast(error.message, 'error'); }
    };
 
    const handleSignOut = async () => {
        try {
            await signOut(auth);
            showToast('You have been signed out.', 'info');
        } catch (error) { showToast(error.message, 'error'); }
    };
    
    const updateLayoutPreference = async (layout) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), { layoutPreference: layout });
        } catch (error) {
            showToast(`Error saving preference: ${error.message}`, 'error');
        }
    };
 
    if (signInForm) signInForm.addEventListener('submit', (e) => { e.preventDefault(); signIn(signInForm.elements['signInEmail'].value, signInForm.elements['signInPassword'].value); });
    if (joinFormStep1) joinFormStep1.addEventListener('submit', (e) => { e.preventDefault(); joinEmailValue = joinFormStep1.elements['joinEmail'].value; if (joinEmailValue) { joinFormStep1.classList.add('hidden'); joinFormStep2.classList.remove('hidden'); } });
    if (joinFormStep2) joinFormStep2.addEventListener('submit', (e) => { e.preventDefault(); signUp(joinEmailValue, joinFormStep2.elements['joinPassword'].value, joinFormStep2.elements['joinName'].value, joinFormStep2.elements['joinNewsletter'].checked); });
 
    // --- FORGOT PASSWORD (was imported but never wired up) ---
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', async () => {
            const email = signInForm ? signInForm.elements['signInEmail'].value.trim() : '';
            if (!email) {
                showToast('Enter your email address above first, then click "Forgot Password?".', 'error');
                return;
            }
            try {
                await sendPasswordResetEmail(auth, email);
                showToast('Password reset email sent. Check your inbox.', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }
 
    // --- SWITCH BETWEEN SIGN IN / JOIN MODALS (buttons existed in HTML but did nothing) ---
    const goToJoinBtnFromSignIn = document.getElementById('goToJoinBtnFromSignIn');
    const goToSignInBtnFromJoin = document.getElementById('goToSignInBtnFromJoin');
    if (goToJoinBtnFromSignIn) goToJoinBtnFromSignIn.addEventListener('click', () => { closeModal(signInModal); openModal(joinModal); });
    if (goToSignInBtnFromJoin) goToSignInBtnFromJoin.addEventListener('click', () => { closeModal(joinModal); openModal(signInModal); });
 
    function createSocialPost(authorName, avatarSrc, content, isThread = false, imageSrc = null, postId = null, opts = {}) {
        const { verified = false, videoSrc = null, avatarNumber = null } = opts;
        const post = document.createElement('div');
        post.className = `social-post ${isThread ? 'post-thread' : ''}`;
        if (postId) post.dataset.postId = postId;
        let avatarContent;
        if (avatarSrc.startsWith('https')) {
            avatarContent = `<div class="post-avatar"><img src="${avatarSrc}" alt="${authorName}"></div>`;
        } else if (avatarNumber != null) {
            // Numbered colored avatar (essentials 1-5, imports 1-3, etc.)
            avatarContent = `<div class="post-avatar post-avatar--num ${avatarSrc}"><span class="post-avatar-num">${avatarNumber}</span></div>`;
        } else {
            avatarContent = `<div class="post-avatar ${avatarSrc}"></div>`;
        }
        const avatarPlaceholder = `<div class="post-avatar-placeholder"></div>`;
        const imageHTML = imageSrc ? `<div class="post-image"><img src="${imageSrc}" alt=""></div>` : '';
        const videoHTML = videoSrc ? `<div class="post-video"><video src="${videoSrc}" class="post-video-el" controls playsinline preload="metadata"></video></div>` : '';
        const verifiedSvg = verified
            ? `<svg class="post-verified" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2l2.4 1.8 3 .1 1 2.8 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.2 15.5l.9-2.9-.9-2.9 2.4-1.8 1-2.8 3-.1L12 2z" fill="#1d9bf0"/><path d="M10.6 14.6l-2.3-2.3 1.1-1.1 1.2 1.2 3.3-3.3 1.1 1.1-4.4 4.4z" fill="#fff"/></svg>`
            : '';
        const headerHTML = !isThread
            ? `<div class="post-header">
                   <span class="post-author-name">${authorName}</span>
                   ${verifiedSvg}
               </div>`
            : '';
        // Only top-level posts get a like bar and comment thread; continuation threads do not.
        const actionsHTML = (!isThread && postId)
            ? `<div class="post-actions" data-post-id="${postId}">
                   <button class="post-like-btn" data-post-id="${postId}" aria-label="Like">
                       <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                       <span class="post-like-count">0</span>
                   </button>
                   <button class="post-comment-btn" data-post-id="${postId}" aria-expanded="false" aria-label="Comments">
                       <svg viewBox="0 0 24 24" width="18" height="18"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                       <span class="post-comment-count">0</span>
                   </button>
               </div>
               <div class="post-comments" data-post-id="${postId}" hidden></div>`
            : '';
        post.innerHTML = `${isThread ? avatarPlaceholder : avatarContent}<div class="post-content">${headerHTML}<div class="post-body">${content}</div>${imageHTML}${videoHTML}${actionsHTML}</div>`;
        return post;
    }

    function generateSocialFeed() {
        if (isSocialFeedGenerated || !pageContentWrapper || !socialFeedView) return;
        socialFeedView.innerHTML = '';
        // A sticky feed header for a polished, app-like top.
        const feedHeader = document.createElement('div');
        feedHeader.className = 'social-feed-header';
        feedHeader.innerHTML = `<span class="social-feed-title">My feed</span>`;
        socialFeedView.appendChild(feedHeader);
        const haulAvatar = 'https://firebasestorage.googleapis.com/v0/b/newsletter-496de.firebasestorage.app/o/images%2Fbag.png?alt=media&token=222e6f04-fefb-4091-8678-cbab7840ce7c';
        const harryAvatar = 'https://firebasestorage.googleapis.com/v0/b/newsletter-496de.firebasestorage.app/o/images%2Fharrygraphic2.png?alt=media&token=ebb5eaca-c15e-43eb-a546-4a692fc48134';
        const processSectionItems = (selector, titlePrefix, avatarClass, sectionImageSrc = null, idPrefix = '') => {
            pageContentWrapper.querySelectorAll(selector).forEach((item, index) => {
                const title = item.querySelector('.item-title')?.innerText.replace(/^\d+\.\s*/, '') || '';
                const description = item.querySelector('.item-description')?.innerText || '';
                const paragraphs = description.split(/\n\s*\n/).filter(p => p.trim());
                if (paragraphs.length === 0) return;
                const firstPara = paragraphs.shift().trim();
                const postAuthorName = titlePrefix.replace('#', index + 1);
                const firstPostContent = `<p><strong>${title}</strong></p><p>${firstPara}</p>`;
                const imageForPost = (index === 0) ? sectionImageSrc : null;
                const postId = `${idPrefix}-${index}`;
                socialFeedView.appendChild(createSocialPost(postAuthorName, avatarClass, firstPostContent, false, imageForPost, postId, { avatarNumber: index + 1 }));
                paragraphs.forEach(para => socialFeedView.appendChild(createSocialPost(postAuthorName, avatarClass, `<p>${para.trim()}</p>`, true)));
            });
        };
        const harrysNoteBody = pageContentWrapper.querySelector('.harrys-note-top .harrys-note-body p')?.innerText || '';
        // The welcome "what mattered most" post is removed — the feed starts with
        // Harry's note. Only this post is verified, and the welcome video plays
        // at the end of it.
        const welcomeVideoEl = document.getElementById('welcome-video');
        const welcomeVideoSrc = (welcomeVideoEl && welcomeVideoEl.getAttribute('src')) ? welcomeVideoEl.getAttribute('src') : (window.currentWelcomeVideo || null);
        if (harrysNoteBody) {
            socialFeedView.appendChild(createSocialPost('Harry North', harryAvatar, `<p>${harrysNoteBody}</p>`, false, null, 'harrysnote-0', { verified: true, videoSrc: welcomeVideoSrc }));
        }
        const cannoliImgSrc = pageContentWrapper.querySelector('#cannoli .cannoli-image')?.src || null;
        // The import map is intentionally NOT rendered in the social feed.
        processSectionItems('#essentials .essential-item', 'Essential #', 'post-avatar--essential', null, 'essential');
        processSectionItems('#imports .essential-item', 'Import', 'post-avatar--import', null, 'import');
        processSectionItems('#deliveries .essential-item', 'Next Delivery', 'post-avatar--delivery', null, 'delivery');
        processSectionItems('#cannoli .essential-item', 'The Cannoli', 'post-avatar--cannoli', cannoliImgSrc, 'cannoli');
        processSectionItems('#coffee .essential-item', 'Coffee Review', 'post-avatar--coffee', null, 'coffee');
        isSocialFeedGenerated = true;
        // Let commenting.js / likes hydrate the freshly-built posts.
        document.dispatchEvent(new CustomEvent('social-feed-generated'));
    }

    function applyLayoutPreference(layout) {
        if (layoutToggleContainer) {
            layoutToggleContainer.querySelector('.active')?.classList.remove('active');
            layoutToggleContainer.querySelector(`[data-layout="${layout}"]`)?.classList.add('active');
        }
        if (layout === 'social') {
            document.body.classList.add('social-layout');
            generateSocialFeed();
        } else {
            document.body.classList.remove('social-layout');
        }
    }
 
    if (layoutToggleContainer) {
        layoutToggleContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.layout-toggle-btn');
            if (button) {
                const newLayout = button.dataset.layout;
                applyLayoutPreference(newLayout);
                updateLayoutPreference(newLayout);
            }
        });
    }
 
    // --- FEATURE TOGGLES (Control Centre) ---
    // These toggles previously did nothing. They now drive the body classes that
    // style.css and commenting.js rely on, persist the preference, and notify
    // commenting.js (via a custom event) so highlights are re-rendered.
    const applyFeatureClasses = () => {
        const commentsEnabled = commentsToggle ? commentsToggle.checked : true;
        const deepnotesEnabled = deepnoteToggle ? deepnoteToggle.checked : false;
        document.body.classList.toggle('commenting-disabled', !commentsEnabled);
        document.body.classList.toggle('deepnote-disabled', !deepnotesEnabled);
        document.dispatchEvent(new CustomEvent('features-changed'));
    };
 
    const saveFeaturePreferences = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                commentsEnabled: commentsToggle ? commentsToggle.checked : true,
                deepnotesEnabled: deepnoteToggle ? deepnoteToggle.checked : false
            });
        } catch (error) {
            console.error('Error saving feature preferences:', error);
        }
    };
 
    if (commentsToggle) commentsToggle.addEventListener('change', () => { applyFeatureClasses(); saveFeaturePreferences(); });
    if (deepnoteToggle) deepnoteToggle.addEventListener('change', () => { applyFeatureClasses(); saveFeaturePreferences(); });
    applyFeatureClasses(); // Set the initial state (deepnotes are off by default)
 
    onAuthStateChanged(auth, async (user) => {
        const userAuthLinks = document.querySelector('.desktop-only.user-auth-links');
        if (user) {
            document.body.classList.add('logged-in');
            removeStickyBannerLock();
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                let layoutPreference = 'magazine';
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    layoutPreference = userData.layoutPreference || 'magazine';
                    // Restore saved feature preferences
                    if (commentsToggle) commentsToggle.checked = userData.commentsEnabled !== false;
                    if (deepnoteToggle) deepnoteToggle.checked = userData.deepnotesEnabled === true;
                    // Expose admin status so deepnote creation can be gated.
                    window.isAdmin = userData.isAdmin === true;
                    document.body.classList.toggle('is-admin', window.isAdmin);
                }
                applyLayoutPreference(layoutPreference);
                applyFeatureClasses();
                document.dispatchEvent(new CustomEvent('admin-status-resolved'));
            } catch(e) {
                console.error("Error fetching user preferences:", e);
                applyLayoutPreference('magazine');
            }
            if (userAuthLinks) userAuthLinks.innerHTML = ``;
        } else {
            document.body.classList.remove('logged-in');
            window.isAdmin = false;
            document.body.classList.remove('is-admin');
            document.dispatchEvent(new CustomEvent('admin-status-resolved'));
            applyLayoutPreference('magazine');
            if (userAuthLinks) {
                userAuthLinks.innerHTML = `<a href="#" class="nav-link" id="signInLink">SIGN IN</a><a href="#" class="btn btn-primary" id="joinLink">JOIN COMMUNITY</a>`;
                document.getElementById('signInLink')?.addEventListener('click', (e) => { e.preventDefault(); openModal(signInModal); });
                document.getElementById('joinLink')?.addEventListener('click', (e) => { e.preventDefault(); openModal(joinModal); });
            }
        }
    });
 
    function openControlCentrePanel() { if (controlCentreOverlay) { controlCentreOverlay.classList.add('is-open'); document.body.classList.add('no-scroll'); } }
    function closeControlCentrePanel() { if (controlCentreOverlay) { controlCentreOverlay.classList.remove('is-open'); document.body.classList.remove('no-scroll'); } }
    if (controlCentreTrigger) controlCentreTrigger.addEventListener('click', (e) => { e.preventDefault(); openControlCentrePanel(); });
    if (controlCentreOverlay) controlCentreOverlay.addEventListener('click', (e) => { if (e.target === controlCentreOverlay) closeControlCentrePanel(); });
    if (controlCentreCloseBtn) controlCentreCloseBtn.addEventListener('click', closeControlCentrePanel);
 
    const accountPanelOverlay = document.getElementById('account-panel-overlay');
    const accountPanelCloseBtn = document.getElementById('account-panel-close-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const accountGreeting = document.getElementById('account-greeting');
    const accountNameInput = document.getElementById('account-name');
    const accountEmailInput = document.getElementById('account-email');
    const newsletterCheckbox = document.getElementById('newsletter-checkbox');
    const accountDetailsForm = document.getElementById('account-details-form');
    const accountPasswordForm = document.getElementById('account-password-form');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const personalDetailsToggle = document.getElementById('personal-details-toggle');
    const personalDetailsContent = document.getElementById('personal-details-content');
    const mobileAccountTrigger = document.getElementById('mobile-account-trigger');
 
    async function openAccountPanel() {
        const user = auth.currentUser;
        if (!user || !accountPanelOverlay) return;
        accountPanelOverlay.classList.add('is-open');
        document.body.classList.add('no-scroll');
        // Populate the panel with the user's saved details
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const data = userDoc.exists() ? userDoc.data() : {};
            if (accountGreeting) accountGreeting.textContent = data.name ? `Bonjour, ${data.name.split(' ')[0]}!` : 'Bonjour!';
            if (accountNameInput) accountNameInput.value = data.name || '';
            if (accountEmailInput) accountEmailInput.value = user.email || '';
            if (newsletterCheckbox) newsletterCheckbox.checked = data.newsletter === true;
        } catch (error) {
            console.error('Error loading account details:', error);
        }
    }
    function closeAccountPanel() {
        if (accountPanelOverlay) {
            accountPanelOverlay.classList.remove('is-open');
            document.body.classList.remove('no-scroll');
        }
    }
    if (accountPanelOverlay) accountPanelOverlay.addEventListener('click', (e) => { if (e.target === accountPanelOverlay) closeAccountPanel(); });
    if (accountPanelCloseBtn) accountPanelCloseBtn.addEventListener('click', closeAccountPanel);
    if (logoutBtn) logoutBtn.addEventListener('click', async () => { await handleSignOut(); closeAccountPanel(); });
 
    // Single, persistent listener (was previously re-attached on every auth change,
    // and did nothing at all for logged-out users)
    if (mobileAccountTrigger) {
        mobileAccountTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            if (auth.currentUser) openAccountPanel();
            else openModal(signInModal);
        });
    }
 
    // Collapsible "Personal Details" section
    if (personalDetailsToggle && personalDetailsContent) {
        personalDetailsToggle.addEventListener('click', () => {
            personalDetailsToggle.classList.toggle('is-open');
            personalDetailsContent.classList.toggle('is-open');
        });
    }
 
    // Newsletter subscription toggle
    if (newsletterCheckbox) {
        newsletterCheckbox.addEventListener('change', async () => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                await updateDoc(doc(db, 'users', user.uid), { newsletter: newsletterCheckbox.checked });
                showToast(newsletterCheckbox.checked ? 'Subscribed to the weekly newsletter.' : 'Unsubscribed from the weekly newsletter.', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }
 
    // Save name changes
    if (accountDetailsForm) {
        accountDetailsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return;
            const newName = accountNameInput ? accountNameInput.value.trim() : '';
            if (!newName) { showToast('Name cannot be empty.', 'error'); return; }
            try {
                await updateDoc(doc(db, 'users', user.uid), { name: newName });
                if (accountGreeting) accountGreeting.textContent = `Bonjour, ${newName.split(' ')[0]}!`;
                showToast('Your details have been updated.', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }
 
    // Change password
    if (accountPasswordForm) {
        accountPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return;
            const passwordInputEl = document.getElementById('account-password');
            const newPassword = passwordInputEl ? passwordInputEl.value : '';
            if (!newPassword || newPassword.length < 6) {
                showToast('Password must be at least 6 characters.', 'error');
                return;
            }
            try {
                await updatePassword(user, newPassword);
                accountPasswordForm.reset();
                showToast('Password updated successfully.', 'success');
            } catch (error) {
                if (error.code === 'auth/requires-recent-login') {
                    showToast('For security, please sign out and back in before changing your password.', 'error');
                } else {
                    showToast(error.message, 'error');
                }
            }
        });
    }
 
    // Delete account
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) return;
            if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return;
            try {
                await deleteDoc(doc(db, 'users', user.uid));
                await deleteUser(user);
                closeAccountPanel();
                showToast('Your account has been deleted.', 'info');
            } catch (error) {
                if (error.code === 'auth/requires-recent-login') {
                    showToast('For security, please sign out and back in before deleting your account.', 'error');
                } else {
                    showToast(error.message, 'error');
                }
            }
        });
    }
    
    function closeMobileNavIfOpen() {
        const mn = document.querySelector('.mobile-nav');
        if (mn && mn.classList.contains('is-open')) {
            mn.classList.remove('is-open');
            document.body.classList.remove('no-scroll');
        }
    }

    function openHowItWorksPanel() { closeMobileNavIfOpen(); if (howItWorksPanelOverlay) { howItWorksPanelOverlay.classList.add('is-open'); document.body.classList.add('no-scroll'); } }
    function closeHowItWorksPanel() { if (howItWorksPanelOverlay) { howItWorksPanelOverlay.classList.remove('is-open'); document.body.classList.remove('no-scroll'); } }
 
    if (howItWorksTriggers.length > 0) {
        howItWorksTriggers.forEach(trigger => trigger.addEventListener('click', (e) => { e.preventDefault(); openHowItWorksPanel(); }));
    }
    if (howItWorksPanelOverlay) howItWorksPanelOverlay.addEventListener('click', (e) => { if (e.target === howItWorksPanelOverlay) closeHowItWorksPanel(); });
    if (howItWorksPanelCloseBtn) howItWorksPanelCloseBtn.addEventListener('click', closeHowItWorksPanel);

    // "Watch" ticker → scroll to the video in the CURRENT layout and play it.
    const watchTicker = document.getElementById('watch-ticker');
    if (watchTicker) {
        watchTicker.addEventListener('click', (e) => {
            e.preventDefault();
            const isSocial = document.body.classList.contains('social-layout');
            if (isSocial) {
                // Social feed: find Harry North's post video.
                const socialVideo = document.querySelector('#social-feed-view .post-video-el');
                if (socialVideo) {
                    socialVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    try { socialVideo.play(); } catch (_) {}
                } else {
                    document.getElementById('social-feed-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
            }
            // Magazine: scroll to the welcome video.
            const anchor = document.getElementById('welcome-video-anchor');
            const video = document.getElementById('welcome-video');
            const wrapper = document.getElementById('welcome-video-wrapper');
            if (wrapper && wrapper.style.display !== 'none' && anchor) {
                anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (video) { try { video.play(); } catch (_) {} }
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
    const pastIssuesOverlay = document.getElementById('past-issues-panel-overlay');
    const pastIssuesCloseBtn = document.getElementById('past-issues-panel-close-btn');
    const pastIssuesTriggers = document.querySelectorAll('.js-past-issues-trigger');
    function openPastIssuesPanel() {
        closeMobileNavIfOpen();
        if (pastIssuesOverlay) {
            pastIssuesOverlay.classList.add('is-open');
            document.body.classList.add('no-scroll');
            loadPastIssues();
        }
    }
    function closePastIssuesPanel() {
        if (pastIssuesOverlay) { pastIssuesOverlay.classList.remove('is-open'); document.body.classList.remove('no-scroll'); }
    }
    pastIssuesTriggers.forEach(trigger => trigger.addEventListener('click', (e) => { e.preventDefault(); openPastIssuesPanel(); }));
    if (pastIssuesOverlay) pastIssuesOverlay.addEventListener('click', (e) => { if (e.target === pastIssuesOverlay) closePastIssuesPanel(); });
    if (pastIssuesCloseBtn) pastIssuesCloseBtn.addEventListener('click', closePastIssuesPanel);
 
    function handleScrollLock() { if (isScrollLocked && window.scrollY > scrollLockPosition) { window.scrollTo(0, scrollLockPosition); } }
    if (stickyBanner) {
        const triggerSection = document.getElementById('imports');
        const bannerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !document.body.classList.contains('logged-in')) {
                    stickyBanner.classList.add('is-visible');
                    isScrollLocked = true;
                    window.addEventListener('scroll', handleScrollLock);
                }
            });
        }, { threshold: 0.01 });
        if (triggerSection) bannerObserver.observe(triggerSection);
        if (stickyNextBtn) stickyNextBtn.addEventListener('click', () => { if (stickyEmailInput && stickyEmailInput.checkValidity()) { if (stickyStep1) stickyStep1.classList.add('hidden'); if (stickyStep2) stickyStep2.classList.remove('hidden'); } });
        if (stickyForm) stickyForm.addEventListener('submit', (e) => { e.preventDefault(); signUp(stickyEmailInput.value, document.getElementById('sticky-password').value, document.getElementById('sticky-name').value, true); });
    }

    // =========================================================================
    // LIKES
    // Each post (magazine item or social post) has a stable postId. Likes are
    // stored at: likes/{newsletterId}__{postId} with { count, users: [uid...] }.
    // A logged-in user can like once; pressing again unlikes and decrements.
    // Counts update live for everyone via onSnapshot.
    // =========================================================================
    const likeUnsubscribers = new Map();

    function likeDocRef(postId) {
        const nId = window.currentNewsletterId || 'default';
        // Slashes aren't allowed in doc IDs; postIds are safe but guard anyway.
        const safeId = `${nId}__${postId}`.replace(/\//g, '_');
        return doc(db, 'likes', safeId);
    }

    function paintLikeButton(postId, count, likedByMe) {
        document.querySelectorAll(`.post-like-btn[data-post-id="${postId}"]`).forEach(btn => {
            const countEl = btn.querySelector('.post-like-count');
            if (countEl) countEl.textContent = count;
            btn.classList.toggle('liked', !!likedByMe);
        });
    }

    function subscribeLikes(postId) {
        if (likeUnsubscribers.has(postId)) return; // already watching
        const unsub = onSnapshot(likeDocRef(postId), (snap) => {
            const data = snap.exists() ? snap.data() : { count: 0, users: [] };
            const uid = auth.currentUser ? auth.currentUser.uid : null;
            const likedByMe = uid ? (data.users || []).includes(uid) : false;
            paintLikeButton(postId, data.count || 0, likedByMe);
        }, (err) => console.error('Likes listener error:', err));
        likeUnsubscribers.set(postId, unsub);
    }

    function hydrateLikeButtons() {
        document.querySelectorAll('.post-like-btn[data-post-id]').forEach(btn => {
            subscribeLikes(btn.dataset.postId);
        });
    }

    async function toggleLike(postId) {
        const user = auth.currentUser;
        if (!user) {
            showToast('Please sign in to like posts.', 'info');
            openModal(signInModal);
            return;
        }
        const ref = likeDocRef(postId);
        try {
            const snap = await getDoc(ref);
            const data = snap.exists() ? snap.data() : { count: 0, users: [] };
            const alreadyLiked = (data.users || []).includes(user.uid);
            if (!snap.exists()) {
                await setDoc(ref, {
                    count: 1,
                    users: [user.uid],
                    newsletterId: window.currentNewsletterId || 'default',
                    postId
                });
            } else if (alreadyLiked) {
                await updateDoc(ref, { count: increment(-1), users: arrayRemove(user.uid) });
            } else {
                await updateDoc(ref, { count: increment(1), users: arrayUnion(user.uid) });
            }
        } catch (err) {
            console.error('Error toggling like:', err);
            showToast('Could not update like. Please try again.', 'error');
        }
    }

    // One delegated click handler covers magazine items and social posts.
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.post-like-btn');
        if (!btn) return;
        e.preventDefault();
        toggleLike(btn.dataset.postId);
    });

    // Hydrate whenever new likeable content appears.
    document.addEventListener('newsletter-loaded', hydrateLikeButtons);
    document.addEventListener('magazine-section-rendered', hydrateLikeButtons);
    document.addEventListener('social-feed-generated', hydrateLikeButtons);
    // Re-evaluate "liked by me" styling when auth state changes.
    onAuthStateChanged(auth, () => {
        // Re-trigger the listeners' paint by re-reading current snapshots.
        likeUnsubscribers.forEach((unsub, postId) => {
            unsub();
            likeUnsubscribers.delete(postId);
            subscribeLikes(postId);
        });
    });
});
