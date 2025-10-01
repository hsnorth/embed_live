// Import the shared Firebase services and specific functions
import { auth, db } from './firebase-init.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updatePassword, deleteUser, fetchSignInMethodsForEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

console.log("Firebase is connected via shared module!");

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

    let typeInterval;
    let joinEmailValue = '';
    let weekdayEmailValue = '';
    let scrollLockPosition = 0;
    let isScrollLocked = false;
    
    // --- WEEKDAY CLOSED LOGIC ---
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

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
                                newsletter: true
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

    // --- (Rest of the main.js file is unchanged) ---
    // ...
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
    if (header) {
        window.addEventListener('scroll', () => {
            // A small threshold to trigger the scrolled class
            const scrollThreshold = 10;
            
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

    /* ADDED: Helper to remove the sticky banner and scroll lock */
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

    // --- MODAL FUNCTIONS ---
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

    // --- AUTH STATE LISTENER (runs on every page) ---
    onAuthStateChanged(auth, (user) => {
        const userAuthLinks = document.querySelector('.desktop-only.user-auth-links');
        const mobileAccountTrigger = document.getElementById('mobile-account-trigger'); 

        mobileAccountTrigger?.removeEventListener('click', (e) => { e.preventDefault(); openAccountPanel(); });
        
        if (user) {
            document.body.classList.add('logged-in');
            removeStickyBannerLock();
            
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
        deleteAccountBtn.addEventListener('click', async ().
