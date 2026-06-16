import { auth, db, storage } from './firebase-init.js';
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
    deleteDoc,
    query, 
    where,
    orderBy,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
    ref as storageRef,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";
 
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
    let mapPins = []; // [{ x, y, label }] in percentage coordinates

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

        initializeMapEditor();
        initializeVideoUploader();

        // Pre-fill the form with the original homepage content as Issue #9999.
        document.getElementById('load-9999-btn')?.addEventListener('click', prefillIssue9999);

        // Drafts + newsletter list management.
        document.getElementById('save-draft-btn')?.addEventListener('click', saveDraft);
        document.getElementById('refresh-newsletters-btn')?.addEventListener('click', loadNewslettersList);
        document.getElementById('new-newsletter-btn')?.addEventListener('click', resetNewsletterForm);
        loadNewslettersList();
    }

    // --- Newsletters list (drafts + published), editable/reloadable ---
    async function loadNewslettersList() {
        const listEl = document.getElementById('newsletters-list');
        if (!listEl) return;
        listEl.textContent = 'Loading…';
        try {
            const snap = await getDocs(collection(db, 'newsletters'));
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort: latest first, then published before drafts, then newest date.
            items.sort((a, b) => {
                if (!!b.isLatest - !!a.isLatest) return (!!b.isLatest) - (!!a.isLatest);
                const sa = a.status === 'published' ? 0 : 1;
                const sb = b.status === 'published' ? 0 : 1;
                if (sa !== sb) return sa - sb;
                return String(b.publishDate || '').localeCompare(String(a.publishDate || ''));
            });

            if (items.length === 0) { listEl.textContent = 'No newsletters yet.'; return; }

            listEl.innerHTML = '';
            items.forEach(n => {
                const row = document.createElement('div');
                row.className = 'newsletter-row';
                const isDraft = n.status !== 'published';
                const badge = n.isLatest
                    ? '<span class="nl-badge nl-latest">LATEST</span>'
                    : (isDraft ? '<span class="nl-badge nl-draft">DRAFT</span>' : '<span class="nl-badge nl-published">PUBLISHED</span>');
                row.innerHTML = `
                    <div class="nl-info">
                        ${badge}
                        <span class="nl-title">Issue #${n.issueNumber ?? '?'} — ${n.mainTitle || '(untitled)'}</span>
                        <span class="nl-date">${n.publishDate || ''}</span>
                    </div>
                    <div class="nl-actions">
                        <button type="button" class="btn-secondary-admin nl-edit">Edit</button>
                        ${(!n.isLatest && !isDraft) ? '<button type="button" class="btn-secondary-admin nl-latest-btn">Set Latest</button>' : ''}
                        <button type="button" class="btn-secondary-admin nl-delete" style="color:#e74c3c;">Delete</button>
                    </div>`;
                row.querySelector('.nl-edit').addEventListener('click', () => loadNewsletterIntoForm(n));
                row.querySelector('.nl-delete').addEventListener('click', () => deleteNewsletter(n));
                row.querySelector('.nl-latest-btn')?.addEventListener('click', () => setAsLatest(n));
                listEl.appendChild(row);
            });
        } catch (e) {
            console.error('Could not load newsletters:', e);
            listEl.textContent = 'Could not load newsletters.';
        }
    }

    function loadNewsletterIntoForm(n) {
        document.getElementById('editing-newsletter-id').value = n.id;
        document.getElementById('issue-number').value = n.issueNumber ?? '';
        document.getElementById('publish-date').value = n.publishDate || '';
        document.getElementById('main-title').value = n.mainTitle || '';
        document.getElementById('harrys-note').value = n.harrysNote || '';
        document.getElementById('set-latest-haul').checked = !!n.isLatest;

        // Media: load existing URLs back into the uploader UIs.
        if (videoUploader) videoUploader.setExisting(n.welcomeVideo || '');
        if (audioUploader) audioUploader.setExisting(n.audioUrl || '');

        // Map + pins.
        const mapInput = document.getElementById('import-map-image');
        mapPins = (n.importMap && Array.isArray(n.importMap.pins)) ? n.importMap.pins.slice() : [];
        if (mapInput) {
            mapInput.value = (n.importMap && n.importMap.image) || '';
            mapInput.dispatchEvent(new Event('input'));
        }
        renderMapPins();

        // Dynamic sections.
        clearAllDynamicItems();
        (n.essentials || []).forEach(item => addDynamicItem('essential', item));
        (n.imports || []).forEach(item => addDynamicItem('import', item));
        (n.deliveries || []).forEach(item => addDynamicItem('delivery', item));
        (n.cannoli || []).forEach(item => addDynamicItem('cannoli', item));
        (n.coffee || []).forEach(item => addDynamicItem('coffee', item));

        const indicator = document.getElementById('editing-indicator');
        document.getElementById('editing-issue').textContent = `Issue #${n.issueNumber ?? '?'} (${n.status || 'draft'})`;
        indicator.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function setAsLatest(n) {
        try {
            const q = query(collection(db, 'newsletters'), where('isLatest', '==', true));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
                if (d.id !== n.id) await updateDoc(doc(db, 'newsletters', d.id), { isLatest: false });
            }
            await updateDoc(doc(db, 'newsletters', n.id), { isLatest: true });
            loadNewslettersList();
        } catch (e) {
            console.error('Could not set latest:', e);
            alert('Could not set as latest: ' + e.message);
        }
    }

    async function deleteNewsletter(n) {
        if (!confirm(`Delete Issue #${n.issueNumber ?? '?'}? This cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, 'newsletters', n.id));
            // If we were editing it, clear the form.
            if (document.getElementById('editing-newsletter-id').value === n.id) resetNewsletterForm();
            loadNewslettersList();
        } catch (e) {
            console.error('Could not delete newsletter:', e);
            alert('Could not delete: ' + e.message);
        }
    }

    // The content that used to be hardcoded on the homepage, as structured data.
    const ISSUE_9999 = {
        issueNumber: 9999,
        publishDate: new Date().toISOString().split('T')[0],
        mainTitle: '5-3-2-1 newsletter: What mattered most this week in Montreal',
        harrysNote: "It\u2019s not always easy being rich \u2013 just ask Norway\u2019s prime minister. Following re-election last week, Jonas Gahr St\u00f8re holds the nation\u2019s purse strings.",
        essentials: [
            { title: '1. BLAH BLAH BLAH', content: "It\u2019s not always easy being rich \u2013 just ask Norway\u2019s prime minister. Following re-election last week, Jonas Gahr St\u00f8re holds the nation\u2019s purse strings as a cast of competitive coalition partners and critics from...\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Dictum non consectetur a erat nam at lectus. Ultricies mi quis hendrit dolor magna. Massa tempor nec feugiat nisl pretium fusce id velit ut. Sed libero enim sed faucibus turpis in eu mi. Facilisi nullam vehicula ipsum a arcu cursus vitae congue. Accumsan lacus vel facilisis volutpat est velit egestas dui. Velit laoreet id donec ultrices tincidunt arcu non sodales. Viverra justo nec ultrices dui sapien eget mi proin. Id diam vel quam elementum pulvinar etiam non quam lacus." },
            { title: '2. A Global Stance', content: "Britain, Canada and Australia confirmed on Sunday that they now formally recognize Palestinian statehood, piling pressure on Israel to ease the humanitarian crisis in Gaza and putting three major American allies at odds with the Trump administration. The widely expected announcements came on the eve of the annual gathering of the United Nations General Assembly in New York. France and Portugal have also pledged to vote for recognition of Palestinian statehood at the U.N. this week, joining some 150 members of the body who have already done so." },
            { title: '3. A Durable Tote Bag', content: 'Massa tempor nec feugiat nisl pretium fusce id velit ut. Sed libero enim sed faucibus turpis in.' },
            { title: '4. Quality Sunglasses', content: 'Facilisi nullam vehicula ipsum a arcu cursus vitae congue. Accumsan lacus vel facilisis.' },
            { title: '5. A Classic Watch', content: 'Velit laoreet id donec ultrices tincidunt arcu non sodales. Viverra justo nec ultrices dui.' }
        ],
        imports: [
            { title: 'Artisanal Ceramics', content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.' },
            { title: 'Leather Notebook', content: 'Dictum non consectetur a erat nam at lectus. Ultricies mi quis hendrit dolor magna.' },
            { title: 'Minimalist Desk Lamp', content: 'Massa tempor nec feugiat nisl pretium fusce id velit ut. Sed libero enim sed faucibus turpis in.' }
        ],
        deliveries: [
            { title: 'A Weatherproof Trench Coat', content: "Arriving just in time for the shifting seasons, this classic trench is cut from water-repellent Italian cotton. A perfect transitional piece for city life, it\u2019s tailored for a clean silhouette that works over a suit or a simple sweater." },
            { title: 'Portuguese Stoneware', content: 'Hand-finished in a family-run studio in the Algarve, our new collection of stoneware brings a rustic yet refined touch to the table. Each piece is unique, featuring a reactive glaze that creates subtle variations in colour.' },
            { title: 'The Perfect Carry-on', content: 'Engineered in Germany, this lightweight polycarbonate carry-on is designed for the modern traveler. It features a silent wheel system, an integrated power bank, and a thoughtfully organized interior to make your journey seamless.' }
        ],
        cannoli: [
            { title: 'Sweet, Sweet Perfection', content: 'Originating from Sicily, cannoli are a staple of Italian pastry, cherished for their crispy fried shell and creamy ricotta filling. Traditionally, the shells are made from flour, sugar, and a hint of cocoa, then fried until golden and crisp. The filling is a delectable blend of fresh ricotta cheese, often sweetened with sugar, flavored with vanilla or citrus zest, and sometimes studded with chocolate chips or candied fruit.' },
            { title: 'A Delicate Art', content: 'Crafting the perfect cannoli is an art form. The dough must be worked to the right consistency to achieve that signature crunch, and the ricotta filling requires careful preparation to be smooth and light. Each cannolo is typically filled just before serving to prevent the shell from becoming soggy, ensuring every bite delivers a delightful contrast between the delicate, crisp exterior and the rich, sweet interior.' }
        ],
        coffee: [
            { title: 'In the Plateau, Caf\u00e9 Tere', content: "Nestled on a quiet corner in the Plateau, Caf\u00e9 Tere offers a respite from the city's bustle. The aroma of freshly ground Ethiopian beans hits you the moment you walk in. We tried their signature single-origin pour-over, a brew that\u2019s both bright and complex with notes of citrus and jasmine. The baristas are knowledgeable and passionate, happy to guide you through their curated selection of beans. It's a small space with limited seating, but for a truly exceptional cup of coffee, it's well worth the visit." }
        ]
    };

    function prefillIssue9999() {
        const d = ISSUE_9999;
        document.getElementById('issue-number').value = d.issueNumber;
        document.getElementById('publish-date').value = d.publishDate;
        document.getElementById('main-title').value = d.mainTitle;
        document.getElementById('harrys-note').value = d.harrysNote;

        // Clear existing dynamic items, then add each section's items.
        clearAllDynamicItems();
        d.essentials.forEach(item => addDynamicItem('essential', item));
        d.imports.forEach(item => addDynamicItem('import', item));
        d.deliveries.forEach(item => addDynamicItem('delivery', item));
        d.cannoli.forEach(item => addDynamicItem('cannoli', item));
        d.coffee.forEach(item => addDynamicItem('coffee', item));

        // Tick "Set as Latest Haul" so publishing makes it the homepage version.
        const latest = document.getElementById('set-latest-haul');
        if (latest) latest.checked = true;

        const status = document.getElementById('prefill-status');
        if (status) status.textContent = 'Loaded Issue #9999 content. Review, then click Publish Newsletter.';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- Generic media (video/audio) upload to Firebase Storage ---
    function initializeMediaUploader(cfg) {
        const fileInput = document.getElementById(cfg.fileInputId);
        const hiddenUrl = document.getElementById(cfg.hiddenUrlId);
        const statusEl = document.getElementById(cfg.statusId);
        const progWrap = document.getElementById(cfg.progWrapId);
        const progBar = document.getElementById(cfg.progBarId);
        const preview = document.getElementById(cfg.previewId);
        const removeBtn = document.getElementById(cfg.removeBtnId);
        const publishBtn = document.querySelector('#newsletter-form .btn-primary-admin');
        if (!fileInput || !hiddenUrl) return null;

        const resetUI = () => {
            statusEl.textContent = '';
            progWrap.style.display = 'none';
            progBar.style.width = '0%';
            preview.style.display = 'none';
            preview.removeAttribute('src');
            removeBtn.style.display = 'none';
        };

        // Programmatically load an already-uploaded URL into the UI (used when
        // editing/reloading a saved newsletter).
        const setExisting = (url) => {
            if (!url) { resetUI(); hiddenUrl.value = ''; return; }
            hiddenUrl.value = url;
            statusEl.textContent = `${cfg.label} loaded ✓`;
            preview.src = url;
            preview.style.display = 'block';
            removeBtn.style.display = 'inline-block';
        };

        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;

            if (!file.type.startsWith(cfg.mediaPrefix)) {
                statusEl.textContent = `Please choose ${cfg.article} ${cfg.label.toLowerCase()} file.`;
                fileInput.value = '';
                return;
            }
            const MAX_MB = cfg.maxMb;
            if (file.size > MAX_MB * 1024 * 1024) {
                statusEl.textContent = `That file is ${(file.size / 1048576).toFixed(0)}MB — please keep it under ${MAX_MB}MB.`;
                fileInput.value = '';
                return;
            }

            const safeName = file.name.replace(/[^\w.\-]/g, '_');
            const path = `${cfg.folder}/${Date.now()}_${safeName}`;
            const fileRef = storageRef(storage, path);
            const task = uploadBytesResumable(fileRef, file, { contentType: file.type });

            if (publishBtn) publishBtn.disabled = true;
            progWrap.style.display = 'block';
            statusEl.textContent = 'Uploading…';

            let sawProgress = false;
            const watchdog = setTimeout(() => {
                if (!sawProgress) {
                    statusEl.textContent = 'Upload not starting — check the Storage bucket name and Storage rules, then retry.';
                }
            }, 15000);

            task.on('state_changed',
                (snap) => {
                    sawProgress = true;
                    const pct = snap.totalBytes ? (snap.bytesTransferred / snap.totalBytes) * 100 : 0;
                    progBar.style.width = `${pct.toFixed(0)}%`;
                    statusEl.textContent = `Uploading… ${pct.toFixed(0)}%`;
                },
                (err) => {
                    clearTimeout(watchdog);
                    console.error(`${cfg.label} upload failed:`, err.code, err.message);
                    statusEl.textContent = `Upload failed (${err.code || 'error'}): ${err.message}`;
                    if (publishBtn) publishBtn.disabled = false;
                    progWrap.style.display = 'none';
                },
                async () => {
                    clearTimeout(watchdog);
                    try {
                        const url = await getDownloadURL(task.snapshot.ref);
                        hiddenUrl.value = url;
                        hiddenUrl.dataset.storagePath = path;
                        statusEl.textContent = `${cfg.label} uploaded ✓`;
                        preview.src = url;
                        preview.style.display = 'block';
                        removeBtn.style.display = 'inline-block';
                    } catch (e) {
                        console.error('Could not get download URL:', e);
                        statusEl.textContent = 'Upload finished but URL retrieval failed.';
                    } finally {
                        if (publishBtn) publishBtn.disabled = false;
                    }
                }
            );
        });

        removeBtn.addEventListener('click', async () => {
            const path = hiddenUrl.dataset.storagePath;
            if (path) {
                try { await deleteObject(storageRef(storage, path)); }
                catch (e) { console.warn(`Could not delete uploaded ${cfg.label} (continuing):`, e); }
            }
            hiddenUrl.value = '';
            delete hiddenUrl.dataset.storagePath;
            fileInput.value = '';
            resetUI();
        });

        const reset = () => { hiddenUrl.value = ''; delete hiddenUrl.dataset.storagePath; if (fileInput) fileInput.value = ''; resetUI(); };
        return { reset, setExisting };
    }

    let videoUploader = null;
    let audioUploader = null;

    function initializeVideoUploader() {
        videoUploader = initializeMediaUploader({
            fileInputId: 'welcome-video-file', hiddenUrlId: 'welcome-video',
            statusId: 'video-upload-status', progWrapId: 'video-upload-progress-wrap',
            progBarId: 'video-upload-progress-bar', previewId: 'video-upload-preview',
            removeBtnId: 'video-remove-btn', folder: 'welcomeVideos',
            mediaPrefix: 'video/', label: 'Video', article: 'a', maxMb: 200
        });
        audioUploader = initializeMediaUploader({
            fileInputId: 'audio-file', hiddenUrlId: 'newsletter-audio',
            statusId: 'audio-upload-status', progWrapId: 'audio-upload-progress-wrap',
            progBarId: 'audio-upload-progress-bar', previewId: 'audio-upload-preview',
            removeBtnId: 'audio-remove-btn', folder: 'newsletterAudio',
            mediaPrefix: 'audio/', label: 'Audio', article: 'an', maxMb: 100
        });
        // Reset both after publishing.
        window.__resetVideoUploader = () => {
            if (videoUploader) videoUploader.reset();
            if (audioUploader) audioUploader.reset();
        };
    }

    function initializeMapEditor() {
        const imageInput = document.getElementById('import-map-image');
        const wrapper = document.getElementById('map-editor-wrapper');
        const img = document.getElementById('map-editor-image');
        if (!imageInput || !wrapper || !img) return;

        const showMap = (url) => {
            if (url) {
                img.src = url;
                wrapper.style.display = 'block';
            } else {
                wrapper.style.display = 'none';
            }
        };

        imageInput.addEventListener('input', () => showMap(imageInput.value.trim()));

        // Drop a pin where the admin clicks (coordinates stored as % of image).
        img.addEventListener('click', (e) => {
            const rect = img.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            const label = prompt('Pin label (optional):', '') || '';
            mapPins.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, label });
            renderMapPins();
        });
    }

    function renderMapPins() {
        const wrapper = document.getElementById('map-editor-wrapper');
        const list = document.getElementById('map-pins-list');
        if (!wrapper || !list) return;

        // Remove existing visual pins (keep the <img>).
        wrapper.querySelectorAll('.admin-map-pin').forEach(p => p.remove());

        mapPins.forEach((pin, i) => {
            const pinEl = document.createElement('div');
            pinEl.className = 'admin-map-pin';
            pinEl.title = 'Click to remove';
            pinEl.style.cssText = `position:absolute; left:${pin.x}%; top:${pin.y}%; transform:translate(-50%,-100%); width:22px; height:22px; cursor:pointer;`;
            pinEl.innerHTML = `<svg viewBox="0 0 24 24" fill="#e74c3c" stroke="#fff" stroke-width="1.2"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"></path><circle cx="12" cy="9" r="2.5" fill="#fff"></circle></svg>`;
            pinEl.addEventListener('click', (e) => {
                e.stopPropagation();
                mapPins.splice(i, 1);
                renderMapPins();
            });
            wrapper.appendChild(pinEl);
        });

        list.innerHTML = mapPins.length
            ? mapPins.map((p, i) => `<span style="display:inline-block; font-family:var(--font-sans); font-size:0.8rem; background:#f0f0f0; padding:2px 8px; margin:2px; border-radius:3px;">${i + 1}. ${p.label || '(no label)'}</span>`).join('')
            : '';
    }

    function getImportMap() {
        const image = document.getElementById('import-map-image')?.value.trim() || '';
        if (!image) return null;
        return { image, pins: mapPins.slice() };
    }
 
    function addDynamicItem(type, data = null) {
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
        if (data) {
            itemEl.querySelector('.item-title-input').value = data.title || '';
            itemEl.querySelector('.item-content-input').value = data.content || '';
            itemEl.querySelector('.item-image-input').value = data.image || '';
        }
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
 
    function gatherNewsletterData(status) {
        return {
            issueNumber: parseInt(document.getElementById('issue-number').value),
            publishDate: document.getElementById('publish-date').value,
            mainTitle: document.getElementById('main-title').value,
            harrysNote: document.getElementById('harrys-note').value,
            welcomeVideo: document.getElementById('welcome-video').value.trim() || null,
            audioUrl: document.getElementById('newsletter-audio').value.trim() || null,
            importMap: getImportMap(),
            essentials: collectDynamicItems('#essentials-container'),
            imports: collectDynamicItems('#imports-container'),
            deliveries: collectDynamicItems('#deliveries-container'),
            cannoli: collectDynamicItems('#cannoli-container'),
            coffee: collectDynamicItems('#coffee-container'),
            status: status, // 'draft' | 'published'
            // Only a published newsletter can be the latest haul.
            isLatest: status === 'published' ? document.getElementById('set-latest-haul').checked : false,
            updatedAt: serverTimestamp()
        };
    }

    async function publishNewsletter(e) {
        e.preventDefault();
        await saveNewsletter('published');
    }

    async function saveDraft() {
        await saveNewsletter('draft');
    }

    async function saveNewsletter(status) {
        // Drafts can skip the browser's required-field validation; published
        // newsletters must pass it.
        const form = document.getElementById('newsletter-form');
        if (status === 'published' && form && !form.reportValidity()) return;

        const newsletterData = gatherNewsletterData(status);
        if (!newsletterData.issueNumber) {
            alert('Please enter an issue number.');
            return;
        }
        const editingId = document.getElementById('editing-newsletter-id').value;

        try {
            // If this is set as latest, unset all others first.
            if (newsletterData.isLatest) {
                const q = query(collection(db, 'newsletters'), where('isLatest', '==', true));
                const snapshot = await getDocs(q);
                for (const docSnapshot of snapshot.docs) {
                    if (docSnapshot.id !== editingId) {
                        await updateDoc(doc(db, 'newsletters', docSnapshot.id), { isLatest: false });
                    }
                }
            }

            let docId = editingId;
            if (editingId) {
                // Update existing newsletter in place.
                await updateDoc(doc(db, 'newsletters', editingId), newsletterData);
            } else {
                newsletterData.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, 'newsletters'), newsletterData);
                docId = docRef.id;
            }

            // Mirror audio into the 'episodes' collection (published only).
            if (status === 'published' && newsletterData.audioUrl) {
                try {
                    await addDoc(collection(db, 'episodes'), {
                        title: newsletterData.mainTitle || `Issue #${newsletterData.issueNumber}`,
                        date: newsletterData.publishDate,
                        description: newsletterData.harrysNote || '',
                        audioUrl: newsletterData.audioUrl,
                        issueNumber: newsletterData.issueNumber,
                        newsletterId: docId,
                        createdAt: serverTimestamp()
                    });
                } catch (epErr) {
                    console.error('Saved, but creating the audio episode failed:', epErr);
                }
            }

            alert(status === 'published' ? 'Newsletter published successfully!' : 'Draft saved.');
            resetNewsletterForm();
            loadNewslettersList();

        } catch (error) {
            console.error('Error saving newsletter:', error);
            alert('Error saving newsletter: ' + error.message);
        }
    }

    function resetNewsletterForm() {
        document.getElementById('newsletter-form').reset();
        clearAllDynamicItems();
        mapPins = [];
        renderMapPins();
        document.getElementById('map-editor-wrapper').style.display = 'none';
        if (window.__resetVideoUploader) window.__resetVideoUploader();
        document.getElementById('editing-newsletter-id').value = '';
        document.getElementById('editing-indicator').style.display = 'none';
        const status = document.getElementById('prefill-status');
        if (status) status.textContent = '';
    }
 
    async function sendNewsletterEmails(newsletterData, newsletterId) {
        // ⚠️ SECURITY WARNING: These credentials are visible to anyone who views
        // this page's source, and this key has been committed to a public repo —
        // it should be ROTATED in the Mailgun dashboard immediately.
        // Email sending should be moved to a backend (e.g. a Firebase Cloud
        // Function) so the key never ships to the browser. Note also that
        // Mailgun's API blocks cross-origin browser requests, so this call will
        // typically fail with a CORS error when run from the client.
        const MAILGUN_API_KEY = '13367b04df52dae4d122d135f9479cdf-42b8ce75-bb25e8c2';
        const MAILGUN_DOMAIN = 'sandbox2aa9365e47274ae4b3b6b63b8dd9861d.mailgun.org';
        
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const subscribers = usersSnapshot.docs
                .filter(doc => doc.data().newsletter === true)
                .map(doc => ({ id: doc.id, ...doc.data() }));
 
            if (subscribers.length === 0) {
                alert('No subscribers found!');
                return;
            }
 
            console.log(`Sending to ${subscribers.length} subscribers...`);
 
            const emailPromises = subscribers.map(async (subscriber) => {
                const emailHTML = generateEmailHTML(newsletterData, subscriber);
                
                // Mailgun uses Basic Auth with api:YOUR_API_KEY
                const auth = btoa(`api:${MAILGUN_API_KEY}`);
                
                const formData = new FormData();
                formData.append('from', "Harry's Haul <mailgun@" + MAILGUN_DOMAIN + '>');
                formData.append('to', subscriber.email);
                formData.append('subject', `Harry's Haul #${newsletterData.issueNumber}: ${newsletterData.mainTitle}`);
                formData.append('html', emailHTML);
                
                const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`
                    },
                    body: formData
                });
 
                const result = await response.json();
                
                if (response.ok) {
                    console.log(`✅ Sent to ${subscriber.email}`);
                } else {
                    console.error(`❌ Failed to send to ${subscriber.email}:`, result);
                }
                
                return result;
            });
 
            await Promise.all(emailPromises);
            alert(`Newsletter sent to ${subscribers.length} subscribers! Check console for details.`);
            
        } catch (error) {
            console.error('Error sending emails:', error);
            alert('Error sending emails: ' + error.message);
        }
    }
 
    function generateEmailHTML(data, subscriber) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Harry's Haul #${data.issueNumber}</title>
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
            <h1>HARRY'S HAUL</h1>
            <p>Issue #${data.issueNumber} | ${new Date(data.publishDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div class="content">
            <div class="eyebrow">THIS WEEK</div>
            <h2 class="title">${data.mainTitle}</h2>
            
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
            <p>You're receiving this because you subscribed to Harry's Haul.</p>
            <p><a href="https://newshaul.ca" style="color: #888;">Visit Website</a> | <a href="#" style="color: #888;">Unsubscribe</a></p>
            <p>&copy; 2025 Harry's Haul. All Rights Reserved.</p>
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
            harrysNote: document.getElementById('harrys-note').value || '',
            welcomeVideo: document.getElementById('welcome-video').value.trim() || null,
            audioUrl: document.getElementById('newsletter-audio').value.trim() || null,
            importMap: getImportMap(),
            essentials: collectDynamicItems('#essentials-container'),
            imports: collectDynamicItems('#imports-container'),
            deliveries: collectDynamicItems('#deliveries-container'),
            cannoli: collectDynamicItems('#cannoli-container'),
            coffee: collectDynamicItems('#coffee-container')
        };
    }
});
