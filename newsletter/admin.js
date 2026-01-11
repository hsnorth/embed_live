import { auth, db } from './firebase-init.js';
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    query, 
    where,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is admin
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || !userDoc.data().isAdmin) {
            alert('Access denied. Admin privileges required.');
            window.location.href = 'index.html';
            return;
        }
        
        loadDashboardMetrics();
        loadHowItWorksContent();
        initializeFormHandlers();
    });

    // Logout
    document.getElementById('admin-logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.href = 'index.html';
    });

    // Load metrics
    async function loadDashboardMetrics() {
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const totalUsers = usersSnapshot.size;
            const newsletterSubscribers = usersSnapshot.docs.filter(
                doc => doc.data().newsletter === true
            ).length;

            document.getElementById('total-users-count').textContent = totalUsers;
            document.getElementById('newsletter-subscribers-count').textContent = newsletterSubscribers;
        } catch (error) {
            console.error('Error loading metrics:', error);
        }
    }

    // Load "How It Works" content
    async function loadHowItWorksContent() {
        try {
            const docRef = doc(db, 'siteContent', 'howItWorks');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                document.getElementById('how-it-works-editor').value = docSnap.data().content || '';
            }
        } catch (error) {
            console.error('Error loading How It Works:', error);
        }
    }

    // Save "How It Works"
    document.getElementById('how-it-works-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = document.getElementById('how-it-works-editor').value;
        
        try {
            await setDoc(doc(db, 'siteContent', 'howItWorks'), { content });
            alert('How It Works content updated successfully!');
        } catch (error) {
            console.error('Error saving:', error);
            alert('Error saving content.');
        }
    });

    // Dynamic section handlers
    function initializeFormHandlers() {
        const addButtons = document.querySelectorAll('.add-item-btn');
        addButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                addDynamicItem(type);
            });
        });

        // Preview buttons
        document.getElementById('preview-magazine-btn')?.addEventListener('click', previewMagazine);
        document.getElementById('preview-social-btn')?.addEventListener('click', previewSocial);

        // Newsletter form submission
        document.getElementById('newsletter-form')?.addEventListener('submit', publishNewsletter);
    }

    function addDynamicItem(type) {
        const containers = {
            'essential': 'essentials-container',
            'import': 'imports-container',
            'delivery': 'deliveries-container',
            'cannoli': 'cannoli-container',
            'coffee': 'coffee-container'
        };

        const container = document.getElementById(containers[type]);
        if (!container) return;

        const itemEl = document.createElement('div');
        itemEl.className = 'dynamic-item';
        itemEl.innerHTML = `
            <button type="button" class="remove-item-btn" onclick="this.parentElement.remove()">&times;</button>
            <div class="form-group">
                <label>Title</label>
                <input type="text" class="form-input-admin item-title-input" required>
            </div>
            <div class="form-group">
                <label>Content</label>
                <textarea class="form-input-admin item-content-input" required></textarea>
            </div>
            <div class="form-group">
                <label>Image URL (optional)</label>
                <input type="url" class="form-input-admin item-image-input">
            </div>
        `;
        container.appendChild(itemEl);
    }

    function collectDynamicItems(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return [];
        
        const items = container.querySelectorAll('.dynamic-item');
        return Array.from(items).map(item => ({
            title: item.querySelector('.item-title-input').value,
            content: item.querySelector('.item-content-input').value,
            image: item.querySelector('.item-image-input').value || null
        }));
    }

    async function publishNewsletter(e) {
        e.preventDefault();
        
        const newsletterData = {
            issueNumber: parseInt(document.getElementById('issue-number').value),
            publishDate: document.getElementById('publish-date').value,
            mainTitle: document.getElementById('main-title').value,
            mainSummary: document.getElementById('main-summary').value,
            harrysNote: document.getElementById('harrys-note').value,
            essentials: collectDynamicItems('#essentials-container'),
            imports: collectDynamicItems('#imports-container'),
            deliveries: collectDynamicItems('#deliveries-container'),
            cannoli: collectDynamicItems('#cannoli-container'),
            coffee: collectDynamicItems('#coffee-container'),
            isLatest: document.getElementById('set-latest-haul').checked,
            createdAt: serverTimestamp()
        };

        try {
            // If this is set as latest, unset all others
            if (newsletterData.isLatest) {
                const q = query(collection(db, 'newsletters'), where('isLatest', '==', true));
                const snapshot = await getDocs(q);
                for (const docSnapshot of snapshot.docs) {
                    await updateDoc(doc(db, 'newsletters', docSnapshot.id), { isLatest: false });
                }
            }

            // Save newsletter
            const docRef = await addDoc(collection(db, 'newsletters'), newsletterData);
            
            // Send emails if needed
            if (confirm('Newsletter published! Send email to subscribers?')) {
                await sendNewsletterEmails(newsletterData, docRef.id);
            }
            
            alert('Newsletter published successfully!');
            document.getElementById('newsletter-form').reset();
            clearAllDynamicItems();
            
        } catch (error) {
            console.error('Error publishing:', error);
            alert('Error publishing newsletter: ' + error.message);
        }
    }

    async function sendNewsletterEmails(newsletterData, newsletterId) {
        try {
            // Get all subscribers
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const subscribers = usersSnapshot.docs
                .filter(doc => doc.data().newsletter === true)
                .map(doc => ({ id: doc.id, ...doc.data() }));

            // Create email queue entries
            const emailPromises = subscribers.map(subscriber => {
                return addDoc(collection(db, 'emailQueue'), {
                    to: subscriber.email,
                    subject: `The News Haul #${newsletterData.issueNumber}: ${newsletterData.mainTitle}`,
                    html: generateEmailHTML(newsletterData, subscriber),
                    newsletterId: newsletterId,
                    createdAt: serverTimestamp(),
                    status: 'pending'
                });
            });

            await Promise.all(emailPromises);
            alert(`Email queued for ${subscribers.length} subscribers!`);
            
        } catch (error) {
            console.error('Error queueing emails:', error);
            alert('Error sending emails: ' + error.message);
        }
    }

    function generateEmailHTML(data, subscriber) {
        // Generate beautiful email HTML
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The News Haul #${data.issueNumber}</title>
    <style>
        body { font-family: Georgia, serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background-color: #ffde3f; padding: 40px 20px; text-align: center; }
        .header h1 { font-size: 36px; margin: 0; letter-spacing: -0.05em; }
        .header p { margin: 10px 0 0; font-size: 14px; }
        .content { padding: 40px 30px; }
        .eyebrow { font-family: Arial, sans-serif; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .title { font-size: 28px; line-height: 1.3; margin: 0 0 20px; }
        .summary { font-size: 16px; line-height: 1.7; color: #333; }
        .section { margin-top: 40px; padding-top: 30px; border-top: 1px solid #e0e0e0; }
        .section-title { font-size: 24px; margin-bottom: 20px; }
        .item { margin-bottom: 30px; }
        .item-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .item-content { font-size: 15px; line-height: 1.7; }
        .footer { background-color: #f5f5f5; padding: 30px; text-align: center; font-size: 12px; color: #888; }
        .cta-button { display: inline-block; background-color: #111; color: #fff; padding: 15px 30px; text-decoration: none; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>THE NEWS HAUL</h1>
            <p>Issue #${data.issueNumber} | ${new Date(data.publishDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div class="content">
            <div class="eyebrow">THIS WEEK</div>
            <h2 class="title">${data.mainTitle}</h2>
            <p class="summary">${data.mainSummary}</p>
            
            ${data.harrysNote ? `
            <div style="background-color: #fefae0; padding: 20px; margin: 30px 0; border-left: 3px solid #ffde3f;">
                <div style="font-weight: bold; margin-bottom: 10px;">HARRY'S NOTE</div>
                <p style="margin: 0;">${data.harrysNote}</p>
            </div>
            ` : ''}
            
            <a href="https://newshaul.ca" class="cta-button">Read Full Newsletter</a>
            
            ${data.essentials.length > 0 ? `
            <div class="section">
                <h3 class="section-title">Five Essentials</h3>
                ${data.essentials.map((item, i) => `
                    <div class="item">
                        <div class="item-title">${i + 1}. ${item.title}</div>
                        <div class="item-content">${item.content.substring(0, 200)}...</div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>You're receiving this because you subscribed to The News Haul.</p>
            <p><a href="https://newshaul.ca" style="color: #888;">Visit Website</a> | <a href="#" style="color: #888;">Unsubscribe</a></p>
            <p>&copy; 2025 The News Haul. All Rights Reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    function clearAllDynamicItems() {
        ['essentials', 'imports', 'deliveries', 'cannoli', 'coffee'].forEach(type => {
            const container = document.getElementById(`${type}-container`);
            if (container) container.innerHTML = '';
        });
    }

    function previewMagazine() {
        const previewData = gatherFormData();
        sessionStorage.setItem('newsletterPreviewData', JSON.stringify(previewData));
        window.open('preview.html?view=magazine', '_blank');
    }

    function previewSocial() {
        const previewData = gatherFormData();
        sessionStorage.setItem('newsletterPreviewData', JSON.stringify(previewData));
        window.open('preview.html?view=social', '_blank');
    }

    function gatherFormData() {
        return {
            issueNumber: parseInt(document.getElementById('issue-number').value) || 1,
            publishDate: document.getElementById('publish-date').value || new Date().toISOString().split('T')[0],
            mainTitle: document.getElementById('main-title').value || 'Preview Title',
            mainSummary: document.getElementById('main-summary').value || 'Preview summary...',
            harrysNote: document.getElementById('harrys-note').value || '',
            essentials: collectDynamicItems('#essentials-container'),
            imports: collectDynamicItems('#imports-container'),
            deliveries: collectDynamicItems('#deliveries-container'),
            cannoli: collectDynamicItems('#cannoli-container'),
            coffee: collectDynamicItems('#coffee-container')
        };
    }
});
