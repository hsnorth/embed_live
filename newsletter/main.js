// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBgCds3FfTRZtZaAQ0Ej6hfgPPMqeRy54s",
    authDomain: "newsletter-496de.firebaseapp.com",
    projectId: "newsletter-496de",
    storageBucket: "newsletter-496de.appspot.com",
    messagingSenderId: "524546319756",
    appId: "1:524546319756:web:947abcff220aec51aa22a9",
    measurementId: "G-B8LSKDYS99"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
console.log("Firebase v9 is connected!");

document.addEventListener('DOMContentLoaded', () => {

    // --- LOADER ---
    const loader = document.getElementById('loader');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('hidden');
        }, 2000);
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
    const stickyStep1 = stickyForm.querySelector('[data-step="1"]');
    const stickyStep2 = stickyForm.querySelector('[data-step="2"]');
    const stickyEmailInput = document.getElementById('sticky-email');

    
    let typeInterval;
    let joinEmailValue = '';
    let scrollLockPosition = 0;
    let isScrollLocked = false;

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
            const typewriterEffect = (element, text, speed, callback) => {
                let i = 0;
                element.innerHTML = '';
                element.classList.add('typing-active');
                if (typeInterval) clearInterval(typeInterval);
                typeInterval = setInterval(() => {
                    if (i < text.length) {
                        element.innerHTML += text.charAt(i);
                        i++;
                    } else {
                        clearInterval(typeInterval);
                        element.classList.remove('typing-active');
                        if (callback) callback();
                    }
                }, speed);
            }
            setTimeout(() => {
                typewriterEffect(modalTagline, textToType, 80, () => {
                    if(joinFormStep1) joinFormStep1.classList.add('form-visible');
                });
            }, 300);
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
            if (stickyBanner) {
                stickyBanner.classList.remove('is-visible');
                isScrollLocked = false;
                window.removeEventListener('scroll', handleScrollLock);
            }
        } catch (error) { showToast(error..message, 'error'); }
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
                joinFormStep2.classList.remove('hidden');
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
                userAuthLinks.innerHTML = `<a href="#" class="btn" id="signOutBtn">SIGN OUT</a>`;
                document.getElementById('signOutBtn').addEventListener('click', (e) => { e.preventDefault(); handleSignOut(); });
            }
            closeModal(signInModal);
            closeModal(joinModal);
            if (stickyBanner) {
                stickyBanner.classList.remove('is-visible');
                isScrollLocked = false;
                window.removeEventListener('scroll', handleScrollLock);
            }
        } else {
            document.body.classList.remove('logged-in');
            if (userAuthLinks) {
                userAuthLinks.innerHTML = `<a href="#" class="nav-link" id="signInLink">SIGN IN</a><a href="#" class="btn btn-primary" id="joinLink">JOIN COMMUNITY</a>`;
                const signInLink = document.getElementById('signInLink');
                const joinLink = document.getElementById('joinLink');
                if(signInLink) signInLink.addEventListener('click', (e) => { e.preventDefault(); openModal(signInModal); });
                if(joinLink) joinLink.addEventListener('click', (e) => { e.preventDefault(); openModal(joinModal); });
            }
        }
    });

    // --- Simple Menu Toggle ---
    const menuToggle = document.querySelector('.menu-toggle');
    const mobileNav = document.querySelector('.mobile-nav');
    const closeMenuBtn = document.querySelector('.close-menu-btn');

    function toggleMenu() {
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

        stickyNextBtn.addEventListener('click', () => {
            if (stickyEmailInput.value && stickyEmailInput.checkValidity()) {
                stickyStep1.classList.add('hidden');
                stickyStep2.classList.remove('hidden');
            } else {
                showToast('Please enter a valid email.', 'error');
            }
        });

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
});

