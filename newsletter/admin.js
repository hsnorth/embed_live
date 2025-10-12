// Import the shared Firebase services and specific functions
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { doc, getDoc, collection, getCountFromServer, addDoc, setDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM ELEMENTS ---
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const totalUsersCountEl = document.getElementById('total-users-count');
    const newsletterSubscribersCountEl = document.getElementById('newsletter-subscribers-count');
    
    // Forms
    const newsletterForm = document.getElementById('newsletter-form');
    const audioForm = document.getElementById('audio-form');
    const howItWorksForm = document.getElementById('how-it-works-form');
    
    // Text Editors
    const howItWorksEditor = document.getElementById('how-it-works-editor');

    // --- SECURITY GATEKEEPER ---
    // This is the most important part. It checks if the user is an admin.
    // If not, it kicks them back to the homepage.
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is logged in, now check if they are an admin
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists() && userDoc.data().isAdmin === true) {
                // User is an admin! Load the dashboard data.
                console.log("Admin access granted.");
                loadDashboardData();
            } else {
                // User is not an admin, redirect them.
                console.log("Access Denied: User is not an admin.");
                alert("You do not have permission to view this page.");
                window.location.href = 'index.html';
            }
        } else {
            // User is not logged in, redirect them.
            console.log("Access Denied: User not logged in.");
            alert("Please sign in to continue.");
            window.location.href = 'index.html';
        }
    });

    // --- DATA LOADING FUNCTIONS ---
    async function loadDashboardData() {
        try {
            // 1. Load Metrics
            const usersCollection = collection(db, 'users');
            const totalUsersSnapshot = await getCountFromServer(usersCollection);
            totalUsersCountEl.textContent = totalUsersSnapshot.data().count;
            
            const newsletterQuery = query(usersCollection, where("newsletter", "==", true));
            const newsletterSnapshot = await getCountFromServer(newsletterQuery);
            newsletterSubscribersCountEl.textContent = newsletterSnapshot.data().count;

            // 2. Load "How It Works" Content
            const howItWorksDoc = await getDoc(doc(db, 'siteContent', 'howItWorks'));
            if (howItWorksDoc.exists()) {
                howItWorksEditor.value = howItWorksDoc.data().content || '';
            }

        } catch (error) {
            console.error("Error loading dashboard data:", error);
            alert("Could not load dashboard data. See console for details.");
        }
    }


    // --- EVENT LISTENERS ---

    // Logout Button
    adminLogoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error("Logout Error:", error);
        });
    });

    // Newsletter Form Submission
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const issueNumber = newsletterForm.querySelector('#issue-number').value;
            
            // In a real app, you would gather all form fields here into a structured object.
            // This is a simplified example.
            const newNewsletter = {
                issueNumber: parseInt(issueNumber),
                title: newsletterForm.querySelector('#issue-title').value,
                harrysNote: newsletterForm.querySelector('#harrys-note').value,
                publishedAt: serverTimestamp(),
                // You would add sections for essentials, imports, etc. here
            };

            try {
                const docRef = await addDoc(collection(db, 'newsletters'), newNewsletter);
                alert(`Successfully published Newsletter #${issueNumber} (ID: ${docRef.id})`);
                newsletterForm.reset();
            } catch (error) {
                console.error("Error adding newsletter:", error);
                alert("Failed to publish newsletter.");
            }
        });
    }

    // Audio Episode Form Submission
    if (audioForm) {
        audioForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newEpisode = {
                title: audioForm.querySelector('#episode-title').value,
                audioUrl: audioForm.querySelector('#audio-url').value,
                tickerHeadlines: audioForm.querySelector('#ticker-headlines').value,
                createdAt: serverTimestamp(),
            };

            try {
                await addDoc(collection(db, 'audioEpisodes'), newEpisode);
                alert('Successfully added new audio episode!');
                audioForm.reset();
            } catch (error) {
                console.error("Error adding audio episode:", error);
                alert("Failed to add episode.");
            }
        });
    }

    // "How The Haul Works" Form Submission
    if (howItWorksForm) {
        howItWorksForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newContent = {
                content: howItWorksEditor.value,
                lastUpdated: serverTimestamp()
            };

            try {
                // We use `setDoc` here because there is only ONE "how it works" document.
                await setDoc(doc(db, 'siteContent', 'howItWorks'), newContent);
                alert('"How The Haul Works" content has been updated!');
            } catch (error) {
                console.error("Error updating content:", error);
                alert("Failed to update content.");
            }
        });
    }
});
