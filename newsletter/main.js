// Import the shared Firebase services and specific functions
import { auth, db } from './firebase-init.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updatePassword, deleteUser, fetchSignInMethodsForEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

console.log("Firebase is connected via shared module!");

window.auth = auth; 

document.addEventListener('DOMContentLoaded', () => {

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
    
    // --- DOM ELEMENTS (MOVED TO TOP) ---
    const header = document.querySelector('.main-header');
    const headerBranding = document.querySelector('.header-branding');
    const signInModal = document.getElementById('signInModal');
    const joinModal = document.getElementById('joinModal');
    const modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    const joinFormStep1 = document.getElementById('joinFormStep1');
    const joinFormStep2 = document.getElementById('joinFormStep2');
    const signInForm = document.getElementById('signInForm');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const goToJoinBtnFromSignIn = document.getElementById('goToJoinBtnFromSignIn');
    const goToSignInBtnFromJoin = document.getElementById('goToSignInBtnFromJoin');
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
    const mobileAccountTrigger = document.getElementById('mobile-account-trigger');
    const loader = document.getElementById('loader');
    const loaderMessage = document.getElementById('loader-message');
    const controlCentreTrigger = document.getElementById('control-centre-trigger');
    const controlCentreOverlay = document.getElementById('control-centre-overlay');
    const controlCentreCloseBtn = document.getElementById('control-centre-close-btn');
    const deepnoteToggle = document.getElementById('deepnote-toggle');
    const commentsToggle = document.getElementById('comments-toggle');
    const digipadToggle = document.getElementById('digipad-toggle');
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
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 2; // Monday to Friday

    if (isWeekday) {
        const closedOverlay = document.getElementById('weekday-closed-overlay');
        const messagePlaceholder = document.getElementById('weekday-message-placeholder');
        const signupForm = document.getElementById('weekday-signup-form');
        
        document.body.style.overflow = 'hidden';

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
                        const emailValue = emailInput.value;
                        
                        try {
                            const methods = await fetchSignInMethodsForEmail(auth, emailValue);
                            if (methods.length > 0) {
                                showWeekdayError('This email is already registered. You can sign in on Saturday!');
                            } else {
                                weekdayEmailValue = emailValue;
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
                    weekdayEmailValue = document.getElementById('weekday-email').value;
                    const name = nameInput ? nameInput.value : '';
                    const password = passwordInput ? passwordInput.value : '';

                    if (weekdayEmailValue && name && password) {
                        try {
                            const userCredential = await createUserWithEmailAndPassword(auth, weekdayEmailValue, password);
                            await setDoc(doc(db, "users", userCredential.user.uid), {
                                email: weekdayEmailValue,
                                name: name,
                                createdAt: serverTimestamp(),
                                newsletter: true,
                                commentsEnabled: true
                            });
                            
                            const contentWrapper = document.querySelector('.weekday-closed-content');
                            if (contentWrapper) {
                                contentWrapper.innerHTML = '<h1>Thank you for joining!<br>We’ll see you Saturday.</h1>';
                            }
                        } catch (error) {
                            let message = 'An unexpected error occurred. Please try again.';
                            switch (error.code) {
                                case 'auth/email-already-in-use':
                                    message = 'This email address is already registered. You can sign in on Saturday!';
                                    break;
                                case 'auth/weak-password':
                                    message = 'Your password needs to be at least 6 characters long.';
                                    break;
                                case 'auth/invalid-email':
                                    message = 'The email address you entered is not valid.';
                                    break;
                            }
                            showWeekdayError(message);
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
                if (modal) {
                    closeModal(modal);
                }
            });
        });
    }
    
    if (mobileJoinLink) {
        mobileJoinLink.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(joinModal);
        });
    }

    if (mobileSignInLink) {
        mobileSignInLink.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(signInModal);
        });
    }
    
    const harrysNoteWrapper = document.getElementById('harrys-note-wrapper');
    const showMoreBtn = document.getElementById('show-more-btn');

    if (harrysNoteWrapper && showMoreBtn) {
        harrysNoteWrapper.classList.add('truncated');
        showMoreBtn.addEventListener('click', () => {
            const isTruncated = harrysNoteWrapper.classList.toggle('truncated');
            showMoreBtn.textContent = isTruncated ? 'Show more' : 'Show less';
        });
    }

    function setLiveDate() {
        const dateElement = document.getElementById('header-date-placeholder');
        if (dateElement) {
            const today = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateElement.textContent = today.toLocaleDateString('en-US', options).toUpperCase();
        }
    }
    setLiveDate();
    
    const headerTopBar = document.querySelector('.header-top-bar');
    
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
        searchOverlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('no-scroll');
        setTimeout(() => searchInput.focus(), 300);
    }

    function closeSearch() {
        if (!searchOverlay) return;
        searchOverlay.classList.remove('is-open');
        searchOverlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('no-scroll');
    }

    if (searchIcon) searchIcon.addEventListener('click', (e) => { e.preventDefault(); openSearch(); });
    if (closeSearchBtn) closeSearchBtn.addEventListener('click', closeSearch);
    if (searchOverlay) searchOverlay.addEventListener('click', (e) => { if (e.target === searchOverlay) closeSearch(); });

    function showToast(message, type = 'info', duration = 4000) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.classList.add('toast', `toast-${type}`);
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
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('is-open');
        document.body.classList.add('no-scroll');
        
        if (modal.id === 'joinModal') {
            const content = modal.querySelector('.modal-content');
            
            if (joinFormStep1 && !joinFormStep1.classList.contains('hidden')) {
                let signInLink = content.querySelector('.modal-sign-in-prompt');
                if (!signInLink) {
                    signInLink = document.createElement('button');
                    signInLink.className = 'modal-sign-in-prompt modal-link-btn';
                    signInLink.textContent = 'Already have an account? Sign In';
                    signInLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        closeModal(joinModal);
                        openModal(signInModal);
                    });
                    joinFormStep1.querySelector('.modal-btn').insertAdjacentElement('afterend', signInLink);
                }
                signInLink.style.display = 'block';
            }

            const textToType = "For stories to tell at supper";
            typeWriter(modalTagline, textToType, 80, () => {
                if(joinFormStep1) joinFormStep1.classList.add('form-visible');
            });
        }
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('is-open');
        document.body.classList.remove('no-scroll');
        
        if (joinFormStep1 && joinFormStep2) {
            joinFormStep1.classList.remove('hidden');
            joinFormStep2.classList.add('hidden');
            joinFormStep1.reset();
            joinFormStep2.reset();
            joinFormStep1.classList.remove('form-visible');
            
            const signInLink = joinModal.querySelector('.modal-sign-in-prompt');
            if(signInLink) signInLink.style.display = 'none';
            const backBtn = joinModal.querySelector('.join-back-btn');
            if(backBtn) backBtn.remove();
        }
        if (typeInterval) clearInterval(typeInterval);
        if (modalTagline) {
            modalTagline.innerHTML = '';
            modalTagline.classList.remove('typing-active');
        }
    }

    const signUp = async (email, password, name, wantsNewsletter) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", userCredential.user.uid), { 
                email, 
                name, 
                createdAt: serverTimestamp(), 
                newsletter: wantsNewsletter,
                commentsEnabled: true
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

    const handleForgotPassword = async (email) => {
        if (!email) { showToast("Please enter an email to reset password.", 'error'); return; }
        try {
            await sendPasswordResetEmail(auth, email);
            showToast("Password reset email sent! Check your inbox.", 'info');
        } catch (error) { showToast(error.message, 'error'); }
    };

    const updateLayoutPreference = async (layout) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { layoutPreference: layout });
            showToast(`Layout set to ${layout === 'social' ? 'Social Feed' : 'Magazine'}.`, 'info');
        } catch (error) {
            showToast(`Error saving preference: ${error.message}`, 'error');
        }
    };

    const updateCommentsPreference = async (isEnabled) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { commentsEnabled: isEnabled });
            showToast(`Comments have been ${isEnabled ? 'turned ON' : 'turned OFF'}.`, 'info');
        } catch (error) {
            showToast(`Error saving preference: ${error.message}`, 'error');
        }
    };
    const updateDeepnotePreference = async (isEnabled) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { deepnotesEnabled: isEnabled });
            showToast(`Deepnotes have been ${isEnabled ? 'turned ON' : 'turned OFF'}.`, 'info');
        } catch (error) {
            showToast(`Error saving preference: ${error.message}`, 'error');
        }
    };

    if (signInForm) {
        signInForm.addEventListener('submit', (e) => { e.preventDefault(); signIn(signInForm.elements['signInEmail'].value, signInForm.elements['signInPassword'].value); });
    }
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', (e) => { e.preventDefault(); handleForgotPassword(signInForm.elements['signInEmail'].value); });
    }
    if (joinFormStep1) {
        joinFormStep1.addEventListener('submit', (e) => {
            e.preventDefault();
            joinEmailValue = joinFormStep1.elements['joinEmail'].value;
            if (joinEmailValue) {
                joinFormStep1.classList.remove('form-visible');
                joinFormStep1.classList.add('hidden');
                
                const signInLink = joinModal.querySelector('.modal-sign-in-prompt');
                if(signInLink) signInLink.style.display = 'none';
                
                if(joinFormStep2) {
                    let backBtn = joinModal.querySelector('.join-back-btn');
                    if(!backBtn) {
                        backBtn = document.createElement('button');
                        backBtn.className = 'join-back-btn modal-link-btn back-arrow';
                        backBtn.innerHTML = '&#8592; Back'; 
                        backBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            joinFormStep2.classList.add('hidden');
                            joinFormStep1.classList.remove('hidden');
                            joinFormStep1.classList.add('form-visible');
                            backBtn.remove();
                            
                            const signInLink = joinModal.querySelector('.modal-sign-in-prompt');
                            if(signInLink) signInLink.style.display = 'block';
                        });
                        joinModal.querySelector('.modal-content').insertAdjacentElement('afterbegin', backBtn);
                    }
                    joinFormStep2.classList.remove('hidden');
                }
            }
        });
    }
    if (joinFormStep2) {
        joinFormStep2.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = joinFormStep2.elements['joinName'].value;
            const password = joinFormStep2.elements['joinPassword'].value;
            const wantsNewsletter = joinFormStep2.elements['joinNewsletter'].checked;
            if (joinEmailValue && name && password) {
                signUp(joinEmailValue, password, name, wantsNewsletter);
            } else {
                showToast('Missing name or password.', 'error');
            }
        });
    }

    /**
     * Creates a social post element.
     * @param {string} authorName - The name of the author.
     * @param {string} avatarSrc - URL for an image avatar or a class name for a placeholder.
     * @param {string} content - The HTML content of the post body.
     * @param {boolean} isThread - Whether this post is part of a thread.
     * @param {string|null} imageSrc - Optional URL for an image in the post.
     * @returns {HTMLElement} The created post element.
     */
    function createSocialPost(authorName, avatarSrc, content, isThread = false, imageSrc = null, isPinned = false) {
        const post = document.createElement('div');
        // Add the 'pinned-post' class if the post is pinned
        post.className = `social-post ${isThread ? 'post-thread' : ''} ${isPinned ? 'pinned-post' : ''}`;
    
        const avatarContent = avatarSrc.startsWith('https')
            ? `<div class="post-avatar"><img src="${avatarSrc}" alt="${authorName}"></div>`
            : `<div class="post-avatar ${avatarSrc}"></div>`;
    
        const avatarPlaceholder = `<div class="post-avatar-placeholder"></div>`;
        const imageHTML = imageSrc ? `<div class="post-image"><img src="${imageSrc}" alt=""></div>` : '';
    
        const headerHTML = !isThread ? `
            <div class="post-header">
                <span class="post-author-name">${authorName}</span>
            </div>` : '';
    
        // Create the HTML for the "PINNED" header
        const pinnedHeaderHTML = isPinned ? `
                <div class="pinned-header">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M13.32 3.68l-1.34 1.34 2.11 2.11 1.34-1.34-2.11-2.11zM11.63 7.5l-3.5 3.5c-.98.98-.98 2.56 0 3.54s2.56.98 3.54 0l3.5-3.5-3.54-3.54zM16 3c-1.1 0-2.1.4-2.83 1.17l-1.41 1.41-2.12 2.12-1.41 1.41-2.47 2.47-2.12 2.12 1.41 1.41 2.12-2.12 2.47-2.47 1.41-1.41 2.12-2.12 1.41-1.41C13.9 4.1 14.9 3.7 16 3.7c1.48 0 2.7 1.22 2.7 2.7s-1.22 2.7-2.7 2.7-2.7-1.22-2.7-2.7c0-.4.1-.78.27-1.12L12.16 9l-4.6 4.6c-1.37 1.37-1.37 3.58 0 4.95s3.58 1.37 4.95 0l4.6-4.6-1.41-1.41-2.12-2.12-1.41-1.41c.34-.17.72-.27 1.12-.27 2.04 0 3.7 1.66 3.7 3.7s-1.66 3.7-3.7 3.7-3.7-1.66-3.7-3.7c0-.4.1-.78.27-1.12L9.84 15l-4.6 4.6-1.41-1.41 4.6-4.6c.34-.17.72-.27 1.12-.27.4 0 .78.1 1.12.27l1.41-1.41-4.24-4.24c-1.37-1.37-3.58-1.37-4.95 0s-1.37 3.58 0 4.95l4.24 4.24 1.41-1.41-2.12-2.12-1.41-1.41c-.17.34-.27.72-.27 1.12 0 2.04 1.66 3.7 3.7 3.7s3.7-1.66 3.7-3.7-1.66-3.7-3.7-3.7c-.4 0-.78.1-1.12.27l-1.41-1.41 4.24-4.24 1.41 1.41-2.12 2.12-1.41 1.41c.17-.34.27-.72.27-1.12 0-2.04-1.66-3.7-3.7-3.7s-3.7 1.66-3.7 3.7.1 1.12.27 1.12l-1.41 1.41 2.12 2.12 1.41 1.41 4.24-4.24C12.1 4.1 13.1 3.7 14 3.7c1.48 0 2.7 1.22 2.7 2.7S15.48 9 14 9s-2.7-1.22-2.7-2.7c0-.4.1-.78.27-1.12L10.16 5l4.6-4.6C12.92 3.23 11.51 3 10 3c-1.93 0-3.68.78-4.95 2.05S3 8.07 3 10s.78 3.68 2.05 4.95 3.02 2.05 4.95 2.05 3.68-.78 4.95-2.05l4.6-4.6-1.41-1.41L18.16 9c.17.34.27.72.27 1.12 0 1.48-1.22 2.7-2.7 2.7s-2.7-1.22-2.7-2.7.1-1.12.27-1.12L14.57 9l-2.11-2.11-1.34-1.34C10.34 4.77 9.21 4.3 8 4.3c-1.48 0-2.7 1.22-2.7 2.7s1.22 2.7 2.7 2.7 2.7-1.22 2.7-2.7c0-.4-.1-.78-.27-1.12L11.84 5l3.5-3.5C14.56 3.23 15.25 3 16 3z"></path></g></svg>
                    <span>PINNED</span>
                </div>` : '';
    
        // Assemble the final post HTML
        post.innerHTML = `
            ${isThread ? avatarPlaceholder : avatarContent}
            <div class="post-content">
                ${pinnedHeaderHTML}
                ${headerHTML}
                <div class="post-body">${content}</div>
                ${imageHTML}
            </div>
        `;
        return post;
    }
    /**
     * Parses the magazine content and generates a social feed view.
     */
    function generateSocialFeed() {
        if (isSocialFeedGenerated || !pageContentWrapper || !socialFeedView) return;
        socialFeedView.innerHTML = '';

        const haulAvatar = 'https://firebasestorage.googleapis.com/v0/b/newsletter-496de.firebasestorage.app/o/images%2Fbag.png?alt=media&token=222e6f04-fefb-4091-8678-cbab7840ce7c';
        const harryAvatar = 'https://firebasestorage.googleapis.com/v0/b/newsletter-496de.firebasestorage.app/o/images%2Fharrygraphic2.png?alt=media&token=ebb5eaca-c15e-43eb-a546-4a692fc48134';

        const processSectionItems = (selector, titlePrefix, avatarClass, sectionImageSrc = null) => {
            const items = pageContentWrapper.querySelectorAll(selector);
            items.forEach((item, index) => {
                const title = item.querySelector('.item-title')?.innerText.replace(/^\d+\.\s*/, '') || '';
                const description = item.querySelector('.item-description')?.innerText || '';
                const paragraphs = description.split(/\n\s*\n/).filter(p => p.trim());

                if (paragraphs.length === 0) return;

                const firstPara = paragraphs.shift().trim();
                const postAuthorName = titlePrefix.replace('#', index + 1);
                const firstPostContent = `<p><strong>${title}</strong></p><p>${firstPara}</p>`;

                const imageForPost = (index === 0) ? sectionImageSrc : null;
                socialFeedView.appendChild(createSocialPost('The News Haul', haulAvatar, welcomeContent, false, null, true));
                paragraphs.forEach(para => {
                    socialFeedView.appendChild(createSocialPost(postAuthorName, avatarClass, `<p>${para.trim()}</p>`, true));
                });
            });
        };

        const welcomeTitle = pageContentWrapper.querySelector('.welcome-main-content .article-title')?.innerText || '';
        const welcomeBody = pageContentWrapper.querySelector('.welcome-main-content .article-body-wrapper p')?.innerText || '';
        const harrysNoteBody = pageContentWrapper.querySelector('.welcome-sidebar .article-body-wrapper p')?.innerText || '';

        const welcomeContent = `<p><strong>${welcomeTitle}</strong></p><p>${welcomeBody}</p>`;
        socialFeedView.appendChild(createSocialPost('The News Haul', haulAvatar, welcomeContent));

        if (harrysNoteBody) {
            socialFeedView.appendChild(createSocialPost('Harry North', harryAvatar, `<p>${harrysNoteBody}</p>`));
        }

        const importMapSrc = pageContentWrapper.querySelector('#imports .map-image')?.src || null;
        const cannoliImgSrc = pageContentWrapper.querySelector('#cannoli .cannoli-image')?.src || null;

        processSectionItems('#essentials .essential-item', 'Essential #', 'post-avatar--essential');
        processSectionItems('#imports .essential-item', 'Import', 'post-avatar--import', importMapSrc);
        processSectionItems('#deliveries .essential-item', 'Next Delivery', 'post-avatar--delivery');
        processSectionItems('#cannoli .essential-item', 'The Cannoli', 'post-avatar--cannoli', cannoliImgSrc);
        processSectionItems('#coffee .essential-item', 'Coffee Review', 'post-avatar--coffee');

        isSocialFeedGenerated = true;
    }
    
    // --- NEW, MORE ROBUST LAYOUT SWITCHING LOGIC ---
    
    function applyLayoutPreference(layout) {
        const commentsToggleContainer = commentsToggle ? commentsToggle.closest('.newsletter-toggle') : null;
        const deepnoteToggleContainer = deepnoteToggle ? deepnoteToggle.closest('.newsletter-toggle') : null;

        // Update the active button state
        if (layoutToggleContainer) {
            layoutToggleContainer.querySelector('.active')?.classList.remove('active');
            layoutToggleContainer.querySelector(`[data-layout="${layout}"]`)?.classList.add('active');
        }

        if (layout === 'social') {
            document.body.classList.add('social-layout');
            generateSocialFeed();

            // Disable feature toggles for social view
            if (commentsToggle) commentsToggle.disabled = true;
            if (deepnoteToggle) deepnoteToggle.disabled = true;
            if (commentsToggleContainer) commentsToggleContainer.classList.add('feature-disabled');
            if (deepnoteToggleContainer) deepnoteToggleContainer.classList.add('feature-disabled');

        } else { // layout is 'magazine'
            document.body.classList.remove('social-layout');

            // Enable feature toggles for magazine view
            if (commentsToggle) commentsToggle.disabled = false;
            if (deepnoteToggle) deepnoteToggle.disabled = false;
            if (commentsToggleContainer) commentsToggleContainer.classList.remove('feature-disabled');
            if (deepnoteToggleContainer) deepnoteToggleContainer.classList.remove('feature-disabled');
        }
    }

    // Set up the single, reliable event listener for the layout toggle
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


    onAuthStateChanged(auth, async (user) => {
        const userAuthLinks = document.querySelector('.desktop-only.user-auth-links');
        const mobileAccountTrigger = document.getElementById('mobile-account-trigger'); 

        mobileAccountTrigger?.removeEventListener('click', (e) => { e.preventDefault(); openAccountPanel(); });
        
        if (user) {
            document.body.classList.add('logged-in');
            removeStickyBannerLock();
    
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
    
                let commentsEnabled = true;
                let deepnotesEnabled = true;
                let layoutPreference = 'magazine';
    
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    commentsEnabled = userData.commentsEnabled !== false;
                    deepnotesEnabled = userData.deepnotesEnabled !== false;
                    layoutPreference = userData.layoutPreference || 'magazine';
                }
    
                if (commentsToggle) commentsToggle.checked = commentsEnabled;
                if (deepnoteToggle) deepnoteToggle.checked = deepnotesEnabled;
                
                // Apply the saved layout preference on page load
                applyLayoutPreference(layoutPreference);
    
                document.body.classList.toggle('commenting-disabled', !commentsEnabled);
                document.body.classList.toggle('deepnote-disabled', !deepnotesEnabled);

            } catch(e) {
                console.error("Error fetching user preferences:", e);
                document.body.classList.remove('commenting-disabled');
                if (commentsToggle) commentsToggle.checked = true;
                applyLayoutPreference('magazine');
            }

            if (userAuthLinks) {
                userAuthLinks.innerHTML = ``;
            }
            
            if (mobileAccountTrigger) {
                mobileAccountTrigger.addEventListener('click', (e) => { 
                    e.preventDefault(); 
                    openAccountPanel();
                });
            }

        } else {
            document.body.classList.remove('logged-in');
            applyLayoutPreference('magazine');
            
            document.body.classList.add('commenting-disabled'); 
            document.body.classList.add('deepnote-disabled');

            if (userAuthLinks) {
                userAuthLinks.innerHTML = `<a href="#" class="nav-link" id="signInLink">SIGN IN</a><a href="#" class="btn btn-primary" id="joinLink">JOIN COMMUNITY</a>`;
                document.getElementById('signInLink')?.addEventListener('click', (e) => { e.preventDefault(); openModal(signInModal); });
                document.getElementById('joinLink')?.addEventListener('click', (e) => { e.preventDefault(); openModal(joinModal); });
            }
        }
    });

    function openControlCentrePanel() {
        if (!controlCentreOverlay) return;
        controlCentreOverlay.classList.add('is-open');
        document.body.classList.add('no-scroll');
    }

    function closeControlCentrePanel() {
        if (!controlCentreOverlay) return;
        controlCentreOverlay.classList.remove('is-open');
        document.body.classList.remove('no-scroll');
    }

    if (controlCentreTrigger) controlCentreTrigger.addEventListener('click', (e) => { e.preventDefault(); openControlCentrePanel(); });
    if (controlCentreOverlay) controlCentreOverlay.addEventListener('click', (e) => { if (e.target === controlCentreOverlay) closeControlCentrePanel(); });
    if (controlCentreCloseBtn) controlCentreCloseBtn.addEventListener('click', closeControlCentrePanel);

    if (commentsToggle) {
        commentsToggle.addEventListener('change', () => {
            const isEnabled = commentsToggle.checked;
            updateCommentsPreference(isEnabled);
            document.body.classList.toggle('commenting-disabled', !isEnabled);
        });
    }

    if (deepnoteToggle) {
        deepnoteToggle.addEventListener('change', () => {
            const isEnabled = deepnoteToggle.checked;
            updateDeepnotePreference(isEnabled);
            document.body.classList.toggle('deepnote-disabled', !isEnabled);
        });
    }

    const accountPanelOverlay = document.getElementById('account-panel-overlay');
    const accountPanelCloseBtn = document.getElementById('account-panel-close-btn');
    const newsletterCheckbox = document.getElementById('newsletter-checkbox');
    const accountDetailsForm = document.getElementById('account-details-form');
    const accountPasswordForm = document.getElementById('account-password-form');
    const accountNameInput = document.getElementById('account-name');
    const accountEmailInput = document.getElementById('account-email');
    const logoutBtn = document.getElementById('logout-btn');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const personalDetailsToggle = document.getElementById('personal-details-toggle');
    const personalDetailsContent = document.getElementById('personal-details-content');

    async function openAccountPanel() {
        const user = auth.currentUser;
        if (!user || !accountPanelOverlay) return;

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            accountNameInput.value = userData.name || '';
            accountEmailInput.value = userData.email || '';
            newsletterCheckbox.checked = userData.newsletter !== false;
        }

        accountPanelOverlay.classList.add('is-open');
        document.body.classList.add('no-scroll');
    }

    function closeAccountPanel() {
        if (!accountPanelOverlay) return;
        accountPanelOverlay.classList.remove('is-open');
        document.body.classList.remove('no-scroll');
    }

    if (accountPanelOverlay) accountPanelOverlay.addEventListener('click', (e) => { if (e.target === accountPanelOverlay) closeAccountPanel(); });
    if (accountPanelCloseBtn) accountPanelCloseBtn.addEventListener('click', closeAccountPanel);
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        await handleSignOut();
        closeAccountPanel();
    });
    if (mobileAccountTrigger) mobileAccountTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openAccountPanel();
    });

    if (newsletterCheckbox) {
        newsletterCheckbox.addEventListener('change', async () => {
            const user = auth.currentUser;
            if (!user) return;
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { newsletter: newsletterCheckbox.checked });
            showToast('Newsletter preference saved!', 'info');
        });
    }

    if (accountDetailsForm) {
        accountDetailsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const newName = accountNameInput.value;
            if (!user || !newName.trim()) return;

            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { name: newName });
            showToast('Your name has been updated.', 'success');
        });
    }
    
    if (accountPasswordForm) {
        accountPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const newPassword = document.getElementById('account-password').value;
            if (!user || !newPassword) return;

            try {
                await updatePassword(user, newPassword);
                showToast('Password updated successfully!', 'success');
                accountPasswordForm.reset();
            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
            }
        });
    }

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if (!confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.')) {
                return;
            }

            const user = auth.currentUser;
            if (!user) return;

            try {
                await deleteDoc(doc(db, 'users', user.uid));
                await deleteUser(user);
                showToast('Your account has been permanently deleted.', 'info');
                closeAccountPanel();
            } catch (error) {
                showToast(`Error deleting account: ${error.message}`, 'error');
                console.error("Account deletion error:", error);
            }
        });
    }

    if (personalDetailsToggle) {
        personalDetailsToggle.addEventListener('click', () => {
            personalDetailsToggle.classList.toggle('is-open');
            personalDetailsContent.classList.toggle('is-open');
        });
    }
    
    function openHowItWorksPanel() {
        if (!howItWorksPanelOverlay) return;
        howItWorksPanelOverlay.classList.add('is-open');
        document.body.classList.add('no-scroll');
    }

    function closeHowItWorksPanel() {
        if (!howItWorksPanelOverlay) return;
        howItWorksPanelOverlay.classList.remove('is-open');
        document.body.classList.remove('no-scroll');
    }

    if (howItWorksTriggers.length > 0) {
        howItWorksTriggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const mobileNav = document.querySelector('.mobile-nav');
                if (mobileNav && mobileNav.classList.contains('is-open')) {
                    mobileNav.classList.remove('is-open');
                }
                openHowItWorksPanel();
            });
        });
    }
    if (howItWorksPanelOverlay) {
        howItWorksPanelOverlay.addEventListener('click', (e) => {
            if (e.target === howItWorksPanelOverlay) {
                closeHowItWorksPanel();
            }
        });
    }
    if (howItWorksPanelCloseBtn) {
        howItWorksPanelCloseBtn.addEventListener('click', closeHowItWorksPanel);
    }

    const menuToggle = document.querySelector('.menu-toggle');
    const mobileNav = document.querySelector('.mobile-nav');
    const closeMenuBtn = document.querySelector('.close-menu-btn');

    function toggleMenu() {
        if (!mobileNav) return;
        const isOpen = mobileNav.classList.toggle('is-open');
        mobileNav.setAttribute('aria-hidden', !isOpen);
        document.body.classList.toggle('no-scroll', isOpen);
    }
    if (menuToggle && closeMenuBtn) {
        menuToggle.addEventListener('click', toggleMenu);
        closeMenuBtn.addEventListener('click', toggleMenu);
    }

    function handleScrollLock() {
        if (isScrollLocked && window.scrollY > scrollLockPosition) {
            window.scrollTo(0, scrollLockPosition);
        }
    }

    if (stickyBanner) {
        const triggerSection = document.getElementById('imports');
        
        const bannerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !document.body.classList.contains('logged-in') && !stickyBanner.classList.contains('is-visible')) {
                    stickyBanner.classList.add('is-visible');
                    scrollLockPosition = entry.boundingClientRect.top + window.scrollY - window.innerHeight + stickyBanner.offsetHeight;
                    isScrollLocked = true;
                    window.addEventListener('scroll', handleScrollLock);
                }
            });
             if (document.body.classList.contains('logged-in') && triggerSection) {
                 bannerObserver.unobserve(triggerSection);
            }
        }, { threshold: 0.01 });

        if (triggerSection) {
            bannerObserver.observe(triggerSection);
        }

        if (stickyNextBtn) {
            stickyNextBtn.addEventListener('click', () => {
                if (stickyEmailInput && stickyEmailInput.value && stickyEmailInput.checkValidity()) {
                    if (stickyStep1) stickyStep1.classList.add('hidden');
                    if (stickyStep2) stickyStep2.classList.remove('hidden');
                } else {
                    showToast('Please enter a valid email.', 'error');
                }
            });
        }

        if (stickyForm) {
            stickyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = stickyEmailInput.value;
                const name = document.getElementById('sticky-name').value;
                const password = document.getElementById('sticky-password').value;
                if (email && name && password) {
                    signUp(email, password, name, true);
                } else {
                    showToast('Please fill out all fields.', 'error');
                }
            });
        }
    }
});
