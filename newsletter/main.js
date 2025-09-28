// Import the shared Firebase services and specific functions
import { auth, db } from './firebase-init.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

console.log("Firebase is connected via shared module!");

document.addEventListener('DOMContentLoaded', () => {

    // A generic typewriter function, available to all logic
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

    // --- WEEKDAY CLOSED LOGIC ---
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 7;

    if (isWeekday) {
        const closedOverlay = document.getElementById('weekday-closed-overlay');
        const messagePlaceholder = document.getElementById('weekday-message-placeholder');
        const signupForm = document.getElementById('weekday-signup-form');
        const loader = document.getElementById('loader');
        
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
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const emailInput = document.getElementById('weekday-email');
                if (emailInput && emailInput.value) {
                    if (typeof showToast === 'function') {
                        showToast(`${emailInput.value} has been added to the list!`, 'success');
                    } else {
                        alert("Thank you for subscribing!");
                    }
                    signupForm.reset();
                }
            });
        }
        return; // Stop the rest of the script from running on weekdays
    }

    // --- WEEKEND/NORMAL PAGE LOAD ---
    const loader = document.getElementById('loader');
    const loaderMessage = document.getElementById('loader-message');
    
    if (loader && loaderMessage) {
        // 1. Wait 2 seconds in the initial state (bag + cursor)
        setTimeout(() => {
            // 2. Add the 'is-typing' class to change the layout
            loader.classList.add('is-typing');
            
            // 3. Start the typewriter effect
            typeWriter(loaderMessage, "The haul is open.", 80, () => {
                // 4. After typing, wait a moment then hide the loader
                setTimeout(() => {
                    loader.classList.add('hidden');
                }, 1000); // 1-second pause after message
            });
    
        }, 2000); // 2-second initial pause
    }
    
    // --- DOM ELEMENTS ---
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

    let typeInterval;
    let joinEmailValue = '';
    let scrollLockPosition = 0;
    let isScrollLocked = false;

    // --- "SHOW MORE" FUNCTIONALITY FOR HARRY'S NOTE ---
    const harrysNoteWrapper = document.getElementById('harrys-note-wrapper');
    const showMoreBtn = document.getElementById('show-more-btn');

    if (harrysNoteWrapper && showMoreBtn) {
        harrysNoteWrapper.classList.add('truncated');
        showMoreBtn.addEventListener('click', () => {
            const isTruncated = harrysNoteWrapper.classList.toggle('truncated');
            showMoreBtn.textContent = isTruncated ? 'Show more' : 'Show less';
        });
    }

    // --- LIVE DATE ---
    function setLiveDate() {
        const dateElement = document.getElementById('header-date-placeholder');
        if (dateElement) {
            const today = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateElement.textContent = today.toLocaleDateString('en-US', options).toUpperCase();
        }
    }
    setLiveDate();
    
    // --- HEADER SCROLL EFFECT ---
    if (header && headerBranding) {
        window.addEventListener('scroll', () => {
            const scrollThreshold = headerBranding.offsetHeight;
            if (window.scrollY > scrollThreshold) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // --- SEARCH MODAL ---
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


    // --- CUSTOM NOTIFICATION FUNCTION ---
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

    // --- MODAL FUNCTIONS ---
    function openModal(modal) {
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('is-open');
        document.body.classList.add('no-scroll');
        if (modal.id === 'joinModal') {
            const textToType = "For stories to tell at the supper";
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
        }
        if (typeInterval) clearInterval(typeInterval);
        if (modalTagline) {
            modalTagline.innerHTML = '';
            modalTagline.classList.remove('typing-active');
        }
    }

    // --- EVENT LISTENERS ---
    modalCloseBtns.forEach(btn => btn.addEventListener('click', (e) => closeModal(e.target.closest('.modal-overlay'))));
    if (signInModal) signInModal.addEventListener('click', (e) => { if (e.target === signInModal) closeModal(signInModal) });
    if (joinModal) joinModal.addEventListener('click', (e) => { if (e.target === joinModal) closeModal(joinModal) });
    if (goToJoinBtnFromSignIn) goToJoinBtnFromSignIn.addEventListener('click', (e) => { e.preventDefault(); closeModal(signInModal); openModal(joinModal); });
    if (goToSignInBtnFromJoin) goToSignInBtnFromJoin.addEventListener('click', (e) => { e.preventDefault(); closeModal(joinModal); openModal(signInModal); });
    if (mobileJoinLink) mobileJoinLink.addEventListener('click', (e) => { e.preventDefault(); openModal(joinModal); });
    if (mobileSignInLink) mobileSignInLink.addEventListener('click', (e) => { e.preventDefault(); openModal(signInModal); });

    // --- AUTHENTICATION FUNCTIONS ---
    const signUp = async (email, password, name, wantsNewsletter) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", userCredential.user.uid), { email, name, createdAt: serverTimestamp(), newsletter: wantsNewsletter });
            showToast('Welcome to the community!', 'success');
            closeModal(joinModal);
        } catch (error) { showToast(error.message, 'error'); }
    };
    const signIn = async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showToast('Successfully signed in!', 'success');
            closeModal(signInModal);
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

    // --- FORM SUBMISSION HANDLERS ---
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
                joinFormStep1.classList.add('hidden');
                if(joinFormStep2) joinFormStep2.classList.remove('hidden');
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

    // --- AUTH STATE LISTENER (runs on every page) ---
    onAuthStateChanged(auth, (user) => {
        const userAuthLinks = document.querySelector('.desktop-only.user-auth-links');
        if (user) {
            document.body.classList.add('logged-in');
            if (userAuthLinks) {
                userAuthLinks.innerHTML = `<a href="#" class="btn" id="myAccountBtn">MY ACCOUNT</a>`;
                document.getElementById('myAccountBtn').addEventListener('click', (e) => { 
                    e.preventDefault(); 
                    openAccountPanel();
                });
            }
        } else {
            document.body.classList.remove('logged-in');
            if (userAuthLinks) {
                userAuthLinks.innerHTML = `<a href="#" class="nav-link" id="signInLink">SIGN IN</a><a href="#" class="btn btn-primary" id="joinLink">JOIN COMMUNITY</a>`;
                document.getElementById('signInLink')?.addEventListener('click', (e) => { e.preventDefault(); openModal(signInModal); });
                document.getElementById('joinLink')?.addEventListener('click', (e) => { e.preventDefault(); openModal(joinModal); });
            }
        }
    });

    // --- ACCOUNT PANEL LOGIC ---
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
    
    // --- HOW IT WORKS PANEL LOGIC ---
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

    // --- Simple Menu Toggle ---
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

    // --- STICKY BANNER LOGIC ---
    function handleScrollLock() {
        if (isScrollLocked && window.scrollY > scrollLockPosition) {
            window.scrollTo(0, scrollLockPosition);
        }
    }

    if (stickyBanner) {
        const triggerSection = document.getElementById('imports');
        
        const bannerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !document.body.classList.contains('logged-in')) {
                    if (!stickyBanner.classList.contains('is-visible')) {
                        stickyBanner.classList.add('is-visible');
                        scrollLockPosition = entry.boundingClientRect.top + window.scrollY - window.innerHeight + stickyBanner.offsetHeight;
                        isScrollLocked = true;
                        window.addEventListener('scroll', handleScrollLock);
                    }
                }
            });
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
