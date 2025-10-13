// Import the shared Firebase services and specific functions
import { auth, db } from './firebase-init.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updatePassword, deleteUser, fetchSignInMethodsForEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

console.log("Firebase is connected via shared module!");

window.auth = auth; 

document.addEventListener('DOMContentLoaded', () => {

    // --- DYNAMIC CONTENT LOADING (NEW) ---
    async function loadLatestHaul() {
        try {
            // 1. Fetch Latest Newsletter from Firestore
            const q = query(collection(db, "newsletters"), where("isLatest", "==", true), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                console.log("No 'latest haul' found in Firestore.");
                const contentWrapper = document.getElementById('page-content-wrapper');
                if(contentWrapper) {
                   contentWrapper.innerHTML = '<h1 style="text-align: center; padding: 4rem 1rem; font-family: var(--font-serif);">No newsletter has been published yet. Check back soon!</h1>';
                }
                // Stop further rendering if no content
                document.getElementById('loader')?.classList.add('hidden');
                return;
            }

            const newsletterDoc = querySnapshot.docs[0];
            const data = newsletterDoc.data();
            renderMagazineView(data);

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
            const contentWrapper = document.getElementById('page-content-wrapper');
            if(contentWrapper) {
                contentWrapper.innerHTML = '<h1 style="text-align: center; padding: 4rem 1rem;">Could not load content. Please try again later.</h1>';
            }
        }
    }

    function renderMagazineView(data) {
        // Populate Header/Welcome section
        const welcomeEyebrow = document.querySelector('.welcome-main-content .eyebrow');
        if (welcomeEyebrow) welcomeEyebrow.textContent = `Issue #${data.issueNumber}`;
        
        const welcomeTitle = document.querySelector('.welcome-main-content .article-title');
        if (welcomeTitle) welcomeTitle.textContent = data.mainTitle;

        const welcomeSummary = document.querySelector('.welcome-main-content .article-body-wrapper p');
        if (welcomeSummary) welcomeSummary.textContent = data.mainSummary;

        const harrysNote = document.querySelector('.welcome-sidebar .article-body-wrapper p');
        if (harrysNote) harrysNote.textContent = data.harrysNote;
        
        const datePlaceholder = document.getElementById('header-date-placeholder');
        if(datePlaceholder && data.publishDate) {
            const date = new Date(data.publishDate.replace(/-/g, '\/')); // More robust date parsing
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            datePlaceholder.textContent = date.toLocaleDateString('en-US', options).toUpperCase();
        }

        // Populate Dynamic Sections from the database
        renderSection('essentials', data.essentials, 'Five essentials');
        renderSection('imports', data.imports, 'The Imports');
        renderSection('deliveries', data.deliveries, 'Next Deliveries');
        renderSection('cannoli', data.cannoli, 'The Cannoli');
        renderSection('coffee', data.coffee, 'Coffee Review');
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

        items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'essential-item';
            
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
                } else if (type === 'imports') {
                     const mapContainer = document.querySelector('#imports .map-container');
                     if(mapContainer) mapContainer.innerHTML = `<img src="${item.image}" alt="World map of imports" class="map-image">`;
                }
                else {
                    innerHTML += `<img src="${item.image}" alt="${item.title}" style="width:100%; height:auto; margin-top:1rem; border:1px solid var(--color-border);">`;
                }
            }
            
            itemEl.innerHTML = innerHTML;
            container.appendChild(itemEl);
        });
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
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday

    if (isWeekday) {
        const closedOverlay = document.getElementById('weekday-closed-overlay');
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

    function createSocialPost(authorName, avatarSrc, content, isThread = false, imageSrc = null) {
        const post = document.createElement('div');
        post.className = `social-post ${isThread ? 'post-thread' : ''}`;
        const avatarContent = avatarSrc.startsWith('https') ? `<div class="post-avatar"><img src="${avatarSrc}" alt="${authorName}"></div>` : `<div class="post-avatar ${avatarSrc}"></div>`;
        const avatarPlaceholder = `<div class="post-avatar-placeholder"></div>`;
        const imageHTML = imageSrc ? `<div class="post-image"><img src="${imageSrc}" alt=""></div>` : '';
        const headerHTML = !isThread ? `<div class="post-header"><span class="post-author-name">${authorName}</span></div>` : '';
        post.innerHTML = `${isThread ? avatarPlaceholder : avatarContent}<div class="post-content">${headerHTML}<div class="post-body">${content}</div>${imageHTML}</div>`;
        return post;
    }

    function generateSocialFeed() {
        if (isSocialFeedGenerated || !pageContentWrapper || !socialFeedView) return;
        socialFeedView.innerHTML = '';
        const haulAvatar = 'https://firebasestorage.googleapis.com/v0/b/newsletter-496de.firebasestorage.app/o/images%2Fbag.png?alt=media&token=222e6f04-fefb-4091-8678-cbab7840ce7c';
        const harryAvatar = 'https://firebasestorage.googleapis.com/v0/b/newsletter-496de.firebasestorage.app/o/images%2Fharrygraphic2.png?alt=media&token=ebb5eaca-c15e-43eb-a546-4a692fc48134';
        const processSectionItems = (selector, titlePrefix, avatarClass, sectionImageSrc = null) => {
            pageContentWrapper.querySelectorAll(selector).forEach((item, index) => {
                const title = item.querySelector('.item-title')?.innerText.replace(/^\d+\.\s*/, '') || '';
                const description = item.querySelector('.item-description')?.innerText || '';
                const paragraphs = description.split(/\n\s*\n/).filter(p => p.trim());
                if (paragraphs.length === 0) return;
                const firstPara = paragraphs.shift().trim();
                const postAuthorName = titlePrefix.replace('#', index + 1);
                const firstPostContent = `<p><strong>${title}</strong></p><p>${firstPara}</p>`;
                const imageForPost = (index === 0) ? sectionImageSrc : null;
                socialFeedView.appendChild(createSocialPost(postAuthorName, avatarClass, firstPostContent, false, imageForPost));
                paragraphs.forEach(para => socialFeedView.appendChild(createSocialPost(postAuthorName, avatarClass, `<p>${para.trim()}</p>`, true)));
            });
        };
        const welcomeTitle = pageContentWrapper.querySelector('.welcome-main-content .article-title')?.innerText || '';
        const welcomeBody = pageContentWrapper.querySelector('.welcome-main-content .article-body-wrapper p')?.innerText || '';
        const harrysNoteBody = pageContentWrapper.querySelector('.welcome-sidebar .article-body-wrapper p')?.innerText || '';
        const welcomeContent = `<p><strong>${welcomeTitle}</strong></p><p>${welcomeBody}</p>`;
        socialFeedView.appendChild(createSocialPost('The News Haul', haulAvatar, welcomeContent));
        if (harrysNoteBody) socialFeedView.appendChild(createSocialPost('Harry North', harryAvatar, `<p>${harrysNoteBody}</p>`));
        const importMapSrc = pageContentWrapper.querySelector('#imports .map-image')?.src || null;
        const cannoliImgSrc = pageContentWrapper.querySelector('#cannoli .cannoli-image')?.src || null;
        processSectionItems('#essentials .essential-item', 'Essential #', 'post-avatar--essential');
        processSectionItems('#imports .essential-item', 'Import', 'post-avatar--import', importMapSrc);
        processSectionItems('#deliveries .essential-item', 'Next Delivery', 'post-avatar--delivery');
        processSectionItems('#cannoli .essential-item', 'The Cannoli', 'post-avatar--cannoli', cannoliImgSrc);
        processSectionItems('#coffee .essential-item', 'Coffee Review', 'post-avatar--coffee');
        isSocialFeedGenerated = true;
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

    onAuthStateChanged(auth, async (user) => {
        const userAuthLinks = document.querySelector('.desktop-only.user-auth-links');
        const mobileAccountTrigger = document.getElementById('mobile-account-trigger');
        if (user) {
            document.body.classList.add('logged-in');
            removeStickyBannerLock();
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                let layoutPreference = 'magazine';
                if (userDoc.exists()) {
                    layoutPreference = userDoc.data().layoutPreference || 'magazine';
                }
                applyLayoutPreference(layoutPreference);
            } catch(e) {
                console.error("Error fetching user preferences:", e);
                applyLayoutPreference('magazine');
            }
            if (userAuthLinks) userAuthLinks.innerHTML = ``;
            if (mobileAccountTrigger) mobileAccountTrigger.addEventListener('click', (e) => { e.preventDefault(); openAccountPanel(); });
        } else {
            document.body.classList.remove('logged-in');
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
    
    async function openAccountPanel() {
        if (!auth.currentUser || !accountPanelOverlay) return;
        accountPanelOverlay.classList.add('is-open');
        document.body.classList.add('no-scroll');
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
    
    function openHowItWorksPanel() { if (howItWorksPanelOverlay) { howItWorksPanelOverlay.classList.add('is-open'); document.body.classList.add('no-scroll'); } }
    function closeHowItWorksPanel() { if (howItWorksPanelOverlay) { howItWorksPanelOverlay.classList.remove('is-open'); document.body.classList.remove('no-scroll'); } }

    if (howItWorksTriggers.length > 0) {
        howItWorksTriggers.forEach(trigger => trigger.addEventListener('click', (e) => { e.preventDefault(); openHowItWorksPanel(); }));
    }
    if (howItWorksPanelOverlay) howItWorksPanelOverlay.addEventListener('click', (e) => { if (e.target === howItWorksPanelOverlay) closeHowItWorksPanel(); });
    if (howItWorksPanelCloseBtn) howItWorksPanelCloseBtn.addEventListener('click', closeHowItWorksPanel);

    const menuToggle = document.querySelector('.menu-toggle');
    const mobileNav = document.querySelector('.mobile-nav');
    const closeMenuBtn = document.querySelector('.close-menu-btn');
    function toggleMenu() { if (mobileNav) document.body.classList.toggle('no-scroll', mobileNav.classList.toggle('is-open')); }
    if (menuToggle && closeMenuBtn) { menuToggle.addEventListener('click', toggleMenu); closeMenuBtn.addEventListener('click', toggleMenu); }

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
});
