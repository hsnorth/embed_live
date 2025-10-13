import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { doc, getDoc, collection, getCountFromServer, addDoc, setDoc, serverTimestamp, query, where, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM ELEMENTS ---
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const totalUsersCountEl = document.getElementById('total-users-count');
    const newsletterSubscribersCountEl = document.getElementById('newsletter-subscribers-count');
    const newsletterForm = document.getElementById('newsletter-form');
    const howItWorksForm = document.getElementById('how-it-works-form');
    const howItWorksEditor = document.getElementById('how-it-works-editor');
    const addItemBtns = document.querySelectorAll('.add-item-btn');
    const previewMagazineBtn = document.getElementById('preview-magazine-btn');
    const previewSocialBtn = document.getElementById('preview-social-btn');

    // --- SECURITY GATEKEEPER ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().isAdmin === true) {
                console.log("Admin access granted.");
                loadDashboardData();
            } else {
                alert("You do not have permission to view this page.");
                window.location.href = 'index.html';
            }
        } else {
            alert("Please sign in to continue.");
            window.location.href = 'index.html';
        }
    });

    // --- DATA LOADING ---
    async function loadDashboardData() {
        // Load Metrics
        const usersCollection = collection(db, 'users');
        const totalUsersSnapshot = await getCountFromServer(usersCollection);
        totalUsersCountEl.textContent = totalUsersSnapshot.data().count;
        const newsletterQuery = query(usersCollection, where("newsletter", "==", true));
        const newsletterSnapshot = await getCountFromServer(newsletterQuery);
        newsletterSubscribersCountEl.textContent = newsletterSnapshot.data().count;

        // Load "How It Works" Content
        const howItWorksDoc = await getDoc(doc(db, 'siteContent', 'howItWorks'));
        if (howItWorksDoc.exists()) {
            howItWorksEditor.value = howItWorksDoc.data().content || '';
        }
    }

    // --- DYNAMIC FORM LOGIC ---
    let itemCounters = { essential: 0, import: 0, delivery: 0, cannoli: 0, coffee: 0 };

    addItemBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            itemCounters[type]++;
            const container = document.getElementById(`${type}s-container`);
            
            const div = document.createElement('div');
            div.className = 'dynamic-item';
            div.innerHTML = `
                <button type="button" class="remove-item-btn">&times;</button>
                <div class="form-group">
                    <label>${type.charAt(0).toUpperCase() + type.slice(1)} #${itemCounters[type]} Title</label>
                    <input type="text" class="form-input-admin item-title" required>
                </div>
                <div class="form-group">
                    <label>Content</label>
                    <textarea class="form-input-admin item-content" required></textarea>
                </div>
                <div class="form-group">
                    <label>Image URL (Optional)</label>
                    <input type="url" class="form-input-admin item-image">
                </div>
            `;
            container.appendChild(div);

            div.querySelector('.remove-item-btn').addEventListener('click', () => {
                div.remove();
            });
        });
    });

    // --- FORM SUBMISSION ---
    newsletterForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const publishDate = newsletterForm.querySelector('#publish-date').value;
        const issueNumber = newsletterForm.querySelector('#issue-number').value;
        const slug = `${publishDate}-issue-${issueNumber}`;
        
        const newsletterData = {
            issueNumber: parseInt(issueNumber),
            publishDate: publishDate,
            slug: slug,
            mainTitle: newsletterForm.querySelector('#main-title').value,
            mainSummary: newsletterForm.querySelector('#main-summary').value,
            harrysNote: newsletterForm.querySelector('#harrys-note').value,
            isLatest: newsletterForm.querySelector('#set-latest-haul').checked,
            publishedAt: serverTimestamp(),
            essentials: getDynamicSectionData('essentials'),
            imports: getDynamicSectionData('imports'),
            deliveries: getDynamicSectionData('deliveries'),
            cannoli: getDynamicSectionData('cannoli'),
            coffee: getDynamicSectionData('coffee'),
        };

        try {
            // If setting as latest, unset all others first
            if (newsletterData.isLatest) {
                const batch = writeBatch(db);
                const q = query(collection(db, "newsletters"), where("isLatest", "==", true));
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach((doc) => {
                    batch.update(doc.ref, { isLatest: false });
                });
                await batch.commit();
            }

            // Add the new newsletter
            await setDoc(doc(db, 'newsletters', slug), newsletterData);
            alert(`Successfully published newsletter: ${slug}`);
            newsletterForm.reset();
            // Clear dynamic items
            Object.keys(itemCounters).forEach(type => {
                document.getElementById(`${type}s-container`).innerHTML = '';
                itemCounters[type] = 0;
            });

        } catch (error) {
            console.error("Error publishing newsletter:", error);
            alert("Failed to publish newsletter.");
        }
    });
    
    howItWorksForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await setDoc(doc(db, 'siteContent', 'howItWorks'), { content: howItWorksEditor.value, lastUpdated: serverTimestamp() });
            alert('"How The Haul Works" content has been updated!');
        } catch (error) {
            alert("Failed to update content.");
        }
    });

    // --- HELPER & PREVIEW FUNCTIONS ---
    function getDynamicSectionData(type) {
        const container = document.getElementById(`${type}s-container`);
        const items = container.querySelectorAll('.dynamic-item');
        const data = [];
        items.forEach(item => {
            data.push({
                title: item.querySelector('.item-title').value,
                content: item.querySelector('.item-content').value,
                image: item.querySelector('.item-image').value || null,
            });
        });
        return data;
    }

    function gatherPreviewData() {
        return {
            mainTitle: newsletterForm.querySelector('#main-title').value,
            mainSummary: newsletterForm.querySelector('#main-summary').value,
            harrysNote: newsletterForm.querySelector('#harrys-note').value,
            issueNumber: newsletterForm.querySelector('#issue-number').value,
            publishDate: newsletterForm.querySelector('#publish-date').value,
            essentials: getDynamicSectionData('essentials'),
            imports: getDynamicSectionData('imports'),
            deliveries: getDynamicSectionData('deliveries'),
            cannoli: getDynamicSectionData('cannoli'),
            coffee: getDynamicSectionData('coffee'),
        };
    }
    
    previewMagazineBtn.addEventListener('click', () => {
        const data = gatherPreviewData();
        sessionStorage.setItem('newsletterPreviewData', JSON.stringify(data));
        window.open('preview.html?view=magazine', '_blank');
    });

    previewSocialBtn.addEventListener('click', () => {
        const data = gatherPreviewData();
        sessionStorage.setItem('newsletterPreviewData', JSON.stringify(data));
        window.open('preview.html?view=social', '_blank');
    });

    // --- LOGOUT ---
    adminLogoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).then(() => { window.location.href = 'index.html'; });
    });
});
