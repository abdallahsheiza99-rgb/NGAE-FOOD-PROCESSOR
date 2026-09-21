/**
 * NGAE FOOD PROCESSORS HUB
 * Core Application Logic - Firebase Firestore (Real-time Sync)
 *
 * Staff Accounts (Role -> Valid IDs):
 *   operator     -> NGAE001 (MUSSA AMIRI SHEIZA)
 *   seller       -> NGAE016 (ISSAYA KAKOA - SONI)
 *                   NGAE017 (ZAINABU HINYA - LUSHOTO)
 *   storekeeper  -> NGAE021 (MR ACADEMIA)
 *   manufacturer -> NGAE027 (DULLAH SHEIZA)
 *
 * MABADILIKO: localStorage ΓåÆ Firebase Firestore (real-time sync kati ya vifaa vyote)
 */

// ==========================================
// FIREBASE INITIALIZATION
// ==========================================

// Firebase imeingizwa kupitia CDN kwenye HTML files
const STORAGE_KEY = 'ngae_app_data'; // Bado tunalinda kwa localStorage kama backup

let _db = null;          // Firestore instance
let _firebaseReady = false;
let _syncListenerActive = false;
let _loadedCollectionsCount = 0;
const TOTAL_COLLECTIONS = 17;
let lastSyncedAppData = null;
let _saveDataLocked = false;  // Write lock: prevents concurrent saveData race conditions
let _pendingSaveTimer = null; // Debounce timer for rapid saves

// Deep clone helper
function deepClone(obj) {
    if (!obj) return obj;
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Visual Sync Status Indicator Creator
 */
function createSyncIndicator() {
    if (typeof document === 'undefined' || !document.body) {
        document.addEventListener('DOMContentLoaded', createSyncIndicator);
        return;
    }
    const id = 'ngae-sync-badge';
    if (document.getElementById(id)) return;

    const div = document.createElement('div');
    div.id = id;
    div.style.position = 'fixed';
    div.style.bottom = '16px';
    div.style.right = '16px';
    div.style.zIndex = '99999';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.style.padding = '8px 12px';
    div.style.borderRadius = '20px';
    div.style.fontSize = '12px';
    div.style.fontWeight = '600';
    div.style.fontFamily = "'Poppins', sans-serif";
    div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    div.style.backdropFilter = 'blur(8px)';
    div.style.webkitBackdropFilter = 'blur(8px)';
    div.style.transition = 'all 0.3s ease';
    div.style.border = '1px solid rgba(255,255,255,0.2)';
    
    // Initial state: Connecting
    div.style.backgroundColor = 'rgba(217, 119, 6, 0.9)'; // Amber
    div.style.color = '#ffffff';
    div.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inatafuta mtandao...';

    document.body.appendChild(div);
}

function updateSyncIndicator(status, message) {
    const div = document.getElementById('ngae-sync-badge');
    if (!div) return;

    if (status === 'syncing') {
        div.style.backgroundColor = 'rgba(37, 99, 235, 0.9)'; // Blue
        div.style.color = '#ffffff';
        div.innerHTML = '<i class="fas fa-sync fa-spin"></i> Inasawazisha...';
    } else if (status === 'synced') {
        div.style.backgroundColor = 'rgba(16, 185, 129, 0.9)'; // Emerald Green
        div.style.color = '#ffffff';
        div.innerHTML = '<i class="fas fa-check-circle"></i> Imesawazishwa';
        setTimeout(() => {
            if (div.innerHTML && div.innerHTML.includes('Imesawazishwa')) {
                div.style.opacity = '0.7';
            }
        }, 3000);
    } else if (status === 'offline') {
        div.style.backgroundColor = 'rgba(107, 114, 128, 0.9)'; // Gray
        div.style.color = '#ffffff';
        div.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline (Kadi ya Ndani)';
        div.style.opacity = '1';
    } else if (status === 'error') {
        if (message && (message.includes('permission') || message.includes('Missing or insufficient') || message.includes('permission-denied'))) {
            console.warn('[NGAE] Firestore permission notice handled gracefully:', message);
            div.style.backgroundColor = 'rgba(107, 114, 128, 0.9)'; // Gray
            div.style.color = '#ffffff';
            div.innerHTML = '<i class="fas fa-database"></i> Kadi ya Ndani (Local Storage)';
            div.style.opacity = '1';
        } else {
            div.style.backgroundColor = 'rgba(220, 38, 38, 0.9)'; // Red
            div.style.color = '#ffffff';
            div.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Hitilafu: ${message || 'Sync error'}`;
            div.style.opacity = '1';
        }
    }
}

let _authPromise = null;

/**
 * Hakikisha Firebase Auth Session (Anonymous Auth) ipo tayari kabla ya kusoma/kuandika Firestore
 */
function ensureFirebaseAuth() {
    if (_authPromise) return _authPromise;

    _authPromise = new Promise((resolve) => {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            const auth = firebase.auth();
            const unsubscribe = auth.onAuthStateChanged((user) => {
                if (unsubscribe) unsubscribe();
                if (user) {
                    console.log('[NGAE] 🔐 Firebase Auth session tayari. User UID:', user.uid);
                    window._firebaseUser = user;
                    resolve(user);
                } else {
                    auth.signInAnonymously()
                        .then(cred => {
                            console.log('[NGAE] 🔐 Firebase Auth Session imeundwa kwa mafanikio. User UID:', cred.user.uid);
                            window._firebaseUser = cred.user;
                            resolve(cred.user);
                        })
                        .catch(authErr => {
                            console.warn('[NGAE] Firebase Auth Notice:', authErr.message);
                            resolve(null);
                        });
                }
            });
        } else {
            resolve(null);
        }
    });

    return _authPromise;
}
window.ensureFirebaseAuth = ensureFirebaseAuth;

/**
 * Anzisha Firebase na Firestore
 * Hii inaitwa mara moja ukurasa ukianza
 */
function initFirebase() {
    try {
        const config = window.FIREBASE_CONFIG;
        if (!config || config.apiKey === 'WEKA_API_KEY_YAKO_HAPA') {
            console.warn('[NGAE] Firebase config haijajazwa. Taarifa zitahifadhiwa kwenye localStorage tu (kifaa kimoja).');
            _firebaseReady = false;
            return;
        }

        // Angalia kama Firebase tayari imeanziishwa
        if (firebase.apps && firebase.apps.length === 0) {
            firebase.initializeApp(config);
        }

        // Anzisha Firebase Auth
        ensureFirebaseAuth();

        _db = firebase.firestore();
        _firebaseReady = true;
        console.log('[NGAE] ✅ Firebase imeanzishwa. Firestore inapatikana.');

        // Weka visual sync status badge
        createSyncIndicator();

        // Washa offline persistence ili data isipotee hata mtandao ukikatika
        _db.enablePersistence({ synchronizeTabs: true })
            .then(() => {
                console.log('[NGAE] 💾 Offline persistence imewezeshwa kwa mafanikio.');
            })
            .catch(err => {
                if (err.code === 'failed-precondition') {
                    console.warn('[NGAE] Offline persistence failed: multiple tabs open');
                } else if (err.code === 'unimplemented') {
                    console.warn('[NGAE] Offline persistence is not supported by the browser');
                }
            });

    } catch (e) {
        console.error('[NGAE] Firebase haikuanzishwa:', e.message);
        _firebaseReady = false;
    }
}

// ==========================================
// DATA LAYER - HYBRID (Firestore + localStorage)
// ==========================================

/**
 * Pakia data kutoka localStorage (haraka - inafanya kazi mara moja)
 * Firebase inasoma baadaye na kusasisha appData otomatiki
 */
function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const data = JSON.parse(raw);
            return _ensureFields(data);
        } catch(e) {
            console.error("Failed to parse app data, re-seeding...", e);
        }
    }
    return seedData();
}

function _ensureFields(data) {
    if (!data.staff) data.staff = {};
    if (Object.keys(data.staff).length === 0) {
        data.staff = {
            'NGAE001': { id: 'NGAE001', name: 'MUSSA AMIRI SHEIZA', role: 'operator', phone: '0712345678', shopId: '' },
            'NGAE016': { id: 'NGAE016', name: 'ISSAYA KAKOA', role: 'seller', phone: '0712345679', shopId: 'shop_soni' },
            'NGAE017': { id: 'NGAE017', name: 'ZAINABU HINYA', role: 'seller', phone: '0712345680', shopId: 'shop_lushoto' },
            'NGAE021': { id: 'NGAE021', name: 'MR ACADEMIA', role: 'storekeeper', phone: '0712345681', shopId: '' },
            'NGAE027': { id: 'NGAE027', name: 'DULLAH SHEIZA', role: 'manufacturer', phone: '0712345682', shopId: '' }
        };
    }
    if (!data.products) data.products = [];
    if (data.products.length === 0) {
        data.products = [
            { id: 'prod_mikate', name: 'MIKATE YA KAWAIDA', price: 2000, stock: 50, initialStock: 50, baseStock: 50, dateAdded: '18/09/2026' },
            { id: 'prod_maandazi', name: 'MAANDAZI BOMBA', price: 500, stock: 100, initialStock: 100, baseStock: 100, dateAdded: '18/09/2026' },
            { id: 'prod_keki', name: 'KEKI ZA VIPANDE', price: 3000, stock: 30, initialStock: 30, baseStock: 30, dateAdded: '18/09/2026' }
        ];
    }
    if (!data.shops) data.shops = [];
    if (data.shops.length === 0) {
        data.shops = [
            { id: 'shop_soni', location: 'Soni', sellerId: 'NGAE016', sellerName: 'ISSAYA KAKOA' },
            { id: 'shop_lushoto', location: 'Lushoto', sellerId: 'NGAE017', sellerName: 'ZAINABU HINYA' }
        ];
    }
    if (!data.rawMaterials) data.rawMaterials = [];
    if (data.rawMaterials.length === 0) {
        data.rawMaterials = [
            { id: 'mat_unga', name: 'UNGA WA NGANO', unit: 'kg', stock: 500, initialStock: 500, baseStock: 500 },
            { id: 'mat_sukari', name: 'SUKARI', unit: 'kg', stock: 200, initialStock: 200, baseStock: 200 },
            { id: 'mat_hamira', name: 'HAMIRA', unit: 'pkt', stock: 50, initialStock: 50, baseStock: 50 },
            { id: 'mat_mafuta', name: 'MAFUTA YA KUPIKIA', unit: 'ltr', stock: 100, initialStock: 100, baseStock: 100 }
        ];
    }
    if (!data.dispatchHistory) data.dispatchHistory = [];
    if (!data.rawMaterialsHistory) data.rawMaterialsHistory = [];
    if (!data.rawMaterialsDispatchHistory) data.rawMaterialsDispatchHistory = [];
    if (!data.productionLog) data.productionLog = [];
    if (!data.finances) data.finances = {};
    if (!data.finances['overall_stats_baseline']) {
        data.finances['overall_stats_baseline'] = { baselineDate: "2026-08-26T11:57:58+03:00" };
    }
    if (!data.customerOrders) data.customerOrders = [];
    if (!data.cashFlow) data.cashFlow = { balance: 0, transactions: [] };
    if (!data.suggestions) data.suggestions = [];
    if (!data.notifications) data.notifications = [];
    if (!data.manufacturerMaterials) data.manufacturerMaterials = {};
    if (!data.adminExpenses) data.adminExpenses = [];
    if (!data.salaryList) data.salaryList = [];
    if (!data.systemResets) data.systemResets = {};
    if (!data.systemResets.daily_report) data.systemResets.daily_report = null;
    if (!data.systemResets.cash_flow) data.systemResets.cash_flow = null;
    if (!data.systemResets.audit_trail) data.systemResets.audit_trail = { logs: [] };

    return data;
}

/**
 * Mathematical Stock Reconciliation Engine
 * Calculates True Stock = (Initial Base Stock + Total Produced/Received) - Total Dispatched.
 * Ensures stock balance ALWAYS decreases when dispatched and increases when produced.
 */
function _recalculateAllStocks(data) {
    if (!data) return data;

    // 1. Recalculate Finished Goods (Products) Stock
    const prodLog = data.productionLog || [];
    const dispHist = data.dispatchHistory || [];

    if (data.products && Array.isArray(data.products)) {
        data.products.forEach(p => {
            if (!p) return;
            const pId = (p.id || '').toUpperCase();
            const pName = (p.name || '').toUpperCase().trim();

            let totalProduced = 0;
            prodLog.forEach(l => {
                if (!l) return;
                const lId = (l.productId || '').toUpperCase();
                const lName = (l.productName || '').toUpperCase().trim();
                if ((pId && lId === pId) || (pName && lName === pName)) {
                    totalProduced += (Number(l.quantity) || 0);
                }
            });

            let totalDispatched = 0;
            dispHist.forEach(d => {
                if (!d) return;
                const dId = (d.productId || '').toUpperCase();
                const dName = (d.productName || '').toUpperCase().trim();
                if ((pId && dId === pId) || (pName && dName === pName)) {
                    totalDispatched += (Number(d.quantity) || 0);
                }
            });

            let baseStock = p.initialStock;
            if (baseStock === undefined) baseStock = p.baseStock;
            if (baseStock === undefined) {
                baseStock = Number(p.stock) || 0;
                p.initialStock = baseStock;
                p.baseStock = baseStock;
            }
            p.stock = Math.max(0, Number(baseStock) + totalProduced - totalDispatched);
        });
    }

    // 2. Recalculate Storekeeper Raw Materials Stock
    const matRecHist = data.rawMaterialsHistory || [];
    const matDispHist = data.rawMaterialsDispatchHistory || [];

    if (data.rawMaterials && Array.isArray(data.rawMaterials)) {
        data.rawMaterials.forEach(m => {
            if (!m) return;
            const mId = (m.id || '').toUpperCase();
            const mName = (m.name || '').toUpperCase().trim();

            let totalReceived = 0;
            matRecHist.forEach(r => {
                if (!r) return;
                const rId = (r.materialId || '').toUpperCase();
                const rName = (r.materialName || '').toUpperCase().trim();
                if ((mId && rId === mId) || (mName && rName === mName)) {
                    totalReceived += (Number(r.qty) || 0);
                }
            });

            let totalDispatched = 0;
            matDispHist.forEach(d => {
                if (!d) return;
                const dId = (d.materialId || '').toUpperCase();
                const dName = (d.materialName || '').toUpperCase().trim();
                if ((mId && dId === mId) || (mName && dName === mName)) {
                    totalDispatched += (Number(d.qty) || 0);
                }
            });

            let baseMatStock = m.initialStock;
            if (baseMatStock === undefined) baseMatStock = m.baseStock;
            if (baseMatStock === undefined) {
                baseMatStock = Number(m.stock) || 0;
                m.initialStock = baseMatStock;
                m.baseStock = baseMatStock;
            }
            m.stock = Math.max(0, Number(baseMatStock) + totalReceived - totalDispatched);
        });
    }

    return data;
}

function seedData() {
    const data = _ensureFields({});
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
}

/**
 * Direct document persistence helper
 */
async function persistDoc(colName, docId, item) {
    if (_firebaseReady && _db) {
        try {
            await ensureFirebaseAuth();
            await _db.collection(colName).doc(docId).set(item);
            console.log(`[NGAE] ✅ Persisted ${colName}/${docId} to Firestore.`);
            return true;
        } catch (e) {
            console.error(`[NGAE] ❌ Error persisting ${colName}/${docId}:`, e.message);
            throw e;
        }
    }
    return false;
}

/**
 * Direct document deletion helper
 */
async function removeDoc(colName, docId) {
    if (_firebaseReady && _db) {
        try {
            await ensureFirebaseAuth();
            await _db.collection(colName).doc(docId).delete();
            console.log(`[NGAE] 🗑️ Deleted ${colName}/${docId} from Firestore.`);
            return true;
        } catch (e) {
            console.error(`[NGAE] ❌ Error deleting ${colName}/${docId}:`, e.message);
            throw e;
        }
    }
    return false;
}

/**
 * Hifadhi data:
 * 1. Smart merge na localStorage (mara moja - offline support)
 * 2. Firestore Incremental updates (real-time sync kwa vifaa vyote)
 */
/**
 * saveData — persists to localStorage immediately, then syncs to Firestore.
 *
 * ARCHITECTURE:
 * 1. localStorage write is ALWAYS synchronous and immediate — data is safe even if Firebase fails.
 * 2. Firestore writes are per-document (not whole collection), so concurrent writes don't
 *    overwrite each other.
 * 3. For finances (which has embedded salesHistory arrays), we use arrayUnion to ATOMICALLY
 *    append only NEW sales/expenses — preventing the race condition where two devices
 *    simultaneously overwrite each other's embedded arrays.
 * 4. A write-lock (_saveDataLocked) prevents concurrent calls from creating races.
 */
async function saveData(data) {
    appData = data;
    window.appData = appData;

    // 1. ALWAYS save to localStorage first (instant, offline-safe)
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
        console.warn('[NGAE] LocalStorage write error:', e);
    }

    // 2. Firestore sync (graceful — never throws, UI always shows success)
    if (_firebaseReady && _db) {
        // Debounce rapid saves: cancel pending timer and reschedule
        if (_pendingSaveTimer) {
            clearTimeout(_pendingSaveTimer);
        }
        _pendingSaveTimer = setTimeout(async () => {
            _pendingSaveTimer = null;
            if (_saveDataLocked) {
                // If locked, re-schedule after 200ms
                _pendingSaveTimer = setTimeout(() => saveData(appData), 200);
                return;
            }
            _saveDataLocked = true;
            try {
                updateSyncIndicator('syncing');
                await ensureFirebaseAuth();

                if (!lastSyncedAppData) {
                    lastSyncedAppData = _ensureFields({});
                }

                const batch = _db.batch();
                let batchCount = 0;
                const MAX_BATCH = 490; // Firestore batch limit is 500

                /**
                 * Sync an array-based collection.
                 * Only writes documents that are NEW or CHANGED since last sync.
                 */
                function syncArrayCol(colName, currentArray, lastSyncedArray, key = 'id') {
                    currentArray = currentArray || [];
                    lastSyncedArray = lastSyncedArray || [];

                    const lastSyncedMap = new Map(
                        lastSyncedArray.map(item => [item && item[key], item])
                    );

                    for (const item of currentArray) {
                        if (!item || !item[key]) continue;
                        if (batchCount >= MAX_BATCH) break;
                        const lastItem = lastSyncedMap.get(item[key]);
                        if (!lastItem || JSON.stringify(item) !== JSON.stringify(lastItem)) {
                            const ref = _db.collection(colName).doc(item[key]);
                            batch.set(ref, item);
                            batchCount++;
                        }
                    }
                }

                /**
                 * Sync an object-based collection.
                 * Only writes documents that are NEW or CHANGED since last sync.
                 */
                function syncObjectCol(colName, currentObj, lastSyncedObj) {
                    currentObj = currentObj || {};
                    lastSyncedObj = lastSyncedObj || {};

                    for (const id in currentObj) {
                        if (!id || batchCount >= MAX_BATCH) continue;
                        const item = currentObj[id];
                        const lastItem = lastSyncedObj[id];
                        if (!lastItem || JSON.stringify(item) !== JSON.stringify(lastItem)) {
                            const ref = _db.collection(colName).doc(id);
                            batch.set(ref, item);
                            batchCount++;
                        }
                    }
                }

                /**
                 * ATOMIC FINANCES SYNC using arrayUnion.
                 *
                 * Instead of overwriting the entire finances document (which causes race
                 * conditions with salesHistory arrays), we:
                 * 1. Write scalar fields (submitted, reportedDebt) with set({merge: true})
                 * 2. Use arrayUnion to ATOMICALLY append only NEW sales/expense entries
                 *
                 * This means two devices can simultaneously add sales without either
                 * overwriting the other.
                 */
                async function syncFinancesAtomic(currentFinances, lastSyncedFinances) {
                    currentFinances = currentFinances || {};
                    lastSyncedFinances = lastSyncedFinances || {};

                    const atomicPromises = [];

                    for (const shopId in currentFinances) {
                        if (shopId === 'overall_stats_baseline') {
                            // Baseline is a simple object, use regular set
                            const ref = _db.collection('finances').doc(shopId);
                            atomicPromises.push(
                                ref.set(currentFinances[shopId]).catch(e =>
                                    console.error(`[NGAE] finances/${shopId} sync error:`, e.message))
                            );
                            continue;
                        }

                        const current = currentFinances[shopId] || {};
                        const lastSynced = lastSyncedFinances[shopId] || {};

                        // Find NEW sales entries not previously synced
                        const lastSyncedSaleIds = new Set(
                            (lastSynced.salesHistory || []).map(s => s.id).filter(Boolean)
                        );
                        const newSales = (current.salesHistory || []).filter(
                            s => s && s.id && !lastSyncedSaleIds.has(s.id)
                        );

                        // Find NEW expense entries not previously synced
                        const lastSyncedExpIds = new Set(
                            (lastSynced.personalExpenses || []).map(e => e.id).filter(Boolean)
                        );
                        const newExpenses = (current.personalExpenses || []).filter(
                            e => e && e.id && !lastSyncedExpIds.has(e.id)
                        );

                        // Check if scalar fields changed
                        const scalarChanged =
                            current.submitted !== lastSynced.submitted ||
                            current.reportedDebt !== lastSynced.reportedDebt;

                        if (newSales.length > 0 || newExpenses.length > 0 || scalarChanged) {
                            const ref = _db.collection('finances').doc(shopId);

                            // Build update payload using arrayUnion for arrays
                            const updatePayload = {
                                submitted: current.submitted || 0,
                                reportedDebt: current.reportedDebt || 0,
                            };

                            if (newSales.length > 0) {
                                updatePayload.salesHistory = firebase.firestore.FieldValue.arrayUnion(...newSales);
                            }
                            if (newExpenses.length > 0) {
                                updatePayload.personalExpenses = firebase.firestore.FieldValue.arrayUnion(...newExpenses);
                            }

                            atomicPromises.push(
                                // set with merge:true creates doc if not exists, then merges
                                ref.set(updatePayload, { merge: true }).catch(e =>
                                    console.error(`[NGAE] finances/${shopId} atomic sync error:`, e.message))
                            );
                        }
                    }

                    if (atomicPromises.length > 0) {
                        await Promise.all(atomicPromises);
                    }
                }

                // Sync all regular collections (except finances)
                syncObjectCol('staff', appData.staff, lastSyncedAppData.staff);
                syncArrayCol('products', appData.products, lastSyncedAppData.products, 'id');
                syncArrayCol('shops', appData.shops, lastSyncedAppData.shops, 'id');
                syncArrayCol('raw_materials', appData.rawMaterials, lastSyncedAppData.rawMaterials, 'id');
                syncArrayCol('dispatch_history', appData.dispatchHistory, lastSyncedAppData.dispatchHistory, 'id');
                syncArrayCol('raw_materials_history', appData.rawMaterialsHistory, lastSyncedAppData.rawMaterialsHistory, 'id');
                syncArrayCol('raw_materials_dispatch_history', appData.rawMaterialsDispatchHistory, lastSyncedAppData.rawMaterialsDispatchHistory, 'id');
                syncArrayCol('production_log', appData.productionLog, lastSyncedAppData.productionLog, 'id');
                syncArrayCol('customer_orders', appData.customerOrders, lastSyncedAppData.customerOrders, 'id');
                syncArrayCol('suggestions', appData.suggestions, lastSyncedAppData.suggestions, 'id');
                syncArrayCol('notifications', appData.notifications, lastSyncedAppData.notifications, 'id');
                syncObjectCol('manufacturer_materials', appData.manufacturerMaterials, lastSyncedAppData.manufacturerMaterials);
                syncArrayCol('admin_expenses', appData.adminExpenses, lastSyncedAppData.adminExpenses, 'id');
                syncArrayCol('salary_list', appData.salaryList, lastSyncedAppData.salaryList, 'id');

                // Cash flow transactions
                const currentCFT = (appData.cashFlow && appData.cashFlow.transactions) ? appData.cashFlow.transactions : [];
                const lastSyncedCFT = (lastSyncedAppData.cashFlow && lastSyncedAppData.cashFlow.transactions) ? lastSyncedAppData.cashFlow.transactions : [];
                syncArrayCol('cash_flow_transactions', currentCFT, lastSyncedCFT, 'id');

                // System resets
                syncObjectCol('system_resets', appData.systemResets, lastSyncedAppData.systemResets);

                // Commit the batch (all non-finances collections)
                if (batchCount > 0) {
                    await batch.commit();
                    console.log(`[NGAE] ✅ Batch committed ${batchCount} docs to Firestore.`);
                }

                // Finances: use atomic arrayUnion writes (separate from batch)
                await syncFinancesAtomic(appData.finances, lastSyncedAppData.finances);

                lastSyncedAppData = deepClone(appData);
                updateSyncIndicator('synced');
            } catch (err) {
                // Graceful failure — data is ALREADY in localStorage, never lost
                console.error('[NGAE] Firestore sync error (data safe in localStorage):', err.message);
                updateSyncIndicator('error', err.message);
            } finally {
                _saveDataLocked = false;
            }
        }, 150); // 150ms debounce to batch rapid sequential saves
    }
    return true;
}

/**
 * Migration helper to move data from old single-doc setup to the new collection structure
 */
async function migrateOldDataIfNeeded() {
    if (!_firebaseReady || !_db) return;

    try {
        const migDoc = await _db.collection('metadata').doc('migration').get();
        if (migDoc.exists && migDoc.data().done) {
            return;
        }

        const oldDoc = await _db.collection('ngae_data').doc('main').get();
        if (!oldDoc.exists) {
            await _db.collection('metadata').doc('migration').set({ done: true });
            return;
        }

        console.log('[NGAE] ≡ƒÜÜ Inahamisha data ya zamani kwenda kwenye mfumo mpya wa collections...');
        const oldData = oldDoc.data();

        // 1. Staff
        if (oldData.staff) {
            for (const id in oldData.staff) {
                await _db.collection('staff').doc(id).set(oldData.staff[id]);
            }
        }
        // 2. Products
        if (oldData.products) {
            for (const p of oldData.products) {
                if (p.id) await _db.collection('products').doc(p.id).set(p);
            }
        }
        // 3. Shops
        if (oldData.shops) {
            for (const s of oldData.shops) {
                if (s.id) await _db.collection('shops').doc(s.id).set(s);
            }
        }
        // 4. Raw Materials
        if (oldData.rawMaterials) {
            for (const m of oldData.rawMaterials) {
                if (m.id) await _db.collection('raw_materials').doc(m.id).set(m);
            }
        }
        // 5. Dispatch History
        if (oldData.dispatchHistory) {
            for (const d of oldData.dispatchHistory) {
                if (d.id) await _db.collection('dispatch_history').doc(d.id).set(d);
            }
        }
        // 6. Raw Materials History
        if (oldData.rawMaterialsHistory) {
            for (const h of oldData.rawMaterialsHistory) {
                if (h.id) await _db.collection('raw_materials_history').doc(h.id).set(h);
            }
        }
        // 7. Raw Materials Dispatch History
        if (oldData.rawMaterialsDispatchHistory) {
            for (const d of oldData.rawMaterialsDispatchHistory) {
                if (d.id) await _db.collection('raw_materials_dispatch_history').doc(d.id).set(d);
            }
        }
        // 8. Production Log
        if (oldData.productionLog) {
            for (const l of oldData.productionLog) {
                if (l.id) await _db.collection('production_log').doc(l.id).set(l);
            }
        }
        // 9. Finances
        if (oldData.finances) {
            for (const shopId in oldData.finances) {
                await _db.collection('finances').doc(shopId).set(oldData.finances[shopId]);
            }
        }
        // 10. Customer Orders
        if (oldData.customerOrders) {
            for (const o of oldData.customerOrders) {
                if (o.id) await _db.collection('customer_orders').doc(o.id).set(o);
            }
        }
        // 11. Suggestions
        if (oldData.suggestions) {
            for (const s of oldData.suggestions) {
                if (s.id) await _db.collection('suggestions').doc(s.id).set(s);
            }
        }
        // 12. Notifications
        if (oldData.notifications) {
            for (const n of oldData.notifications) {
                if (n.id) await _db.collection('notifications').doc(n.id).set(n);
            }
        }
        // 13. Manufacturer Materials
        if (oldData.manufacturerMaterials) {
            for (const mId in oldData.manufacturerMaterials) {
                await _db.collection('manufacturer_materials').doc(mId).set(oldData.manufacturerMaterials[mId]);
            }
        }
        // 14. Admin Expenses
        if (oldData.adminExpenses) {
            for (const e of oldData.adminExpenses) {
                if (e.id) await _db.collection('admin_expenses').doc(e.id).set(e);
            }
        }
        // 15. Salary List
        if (oldData.salaryList) {
            for (const s of oldData.salaryList) {
                if (s.id) await _db.collection('salary_list').doc(s.id).set(s);
            }
        }
        // 16. Cash Flow Transactions
        if (oldData.cashFlow && oldData.cashFlow.transactions) {
            for (const t of oldData.cashFlow.transactions) {
                if (t.id) await _db.collection('cash_flow_transactions').doc(t.id).set(t);
            }
        }

        await _db.collection('metadata').doc('migration').set({ done: true });
        console.log('[NGAE] Γ£à Data yote ya zamani imehamishwa kikamilifu!');
    } catch (e) {
        console.error('[NGAE] Hitilafu ya uhamisho wa data:', e);
    }
}

function mergeArrayById(arr1, arr2, key = 'id') {
    const map = new Map();
    // Load arr1 first (older/base), arr2 second (newer/remote) so arr2 wins on conflict
    (arr1 || []).forEach(item => { if (item && item[key]) map.set(item[key], item); });
    (arr2 || []).forEach(item => { if (item && item[key]) map.set(item[key], item); });
    return Array.from(map.values());
}

/**
 * Merge two arrays by ID, using dateRaw to pick the newer item when IDs clash.
 * Guarantees: union of all IDs — never shrinks the array.
 */
function mergeArrayByIdSafe(arr1, arr2, key = 'id') {
    const map = new Map();
    const getTime = item => {
        if (!item) return 0;
        const raw = item.dateRaw || item.timestamp || item.createdAt;
        if (!raw) return 0;
        const t = new Date(raw).getTime();
        return isNaN(t) ? 0 : t;
    };

    const insertIfNewer = item => {
        if (!item || !item[key]) return;
        const existing = map.get(item[key]);
        if (!existing || getTime(item) >= getTime(existing)) {
            map.set(item[key], item);
        }
    };

    (arr1 || []).forEach(insertIfNewer);
    (arr2 || []).forEach(insertIfNewer);
    return Array.from(map.values());
}

/**
 * Merge a Firestore snapshot into an existing local array.
 * NEVER shrinks: union of all IDs, newer item wins on conflict.
 */
function mergeArraySnapshot(existingArr, snapshot, key = 'id') {
    existingArr = Array.isArray(existingArr) ? existingArr : [];
    if (snapshot.empty) {
        // Firestore collection is empty — keep local data, don't wipe it
        return existingArr;
    }
    const remoteItems = [];
    snapshot.forEach(doc => {
        remoteItems.push({ [key]: doc.id, ...doc.data() });
    });
    // Use safe merge: union of both, newer dateRaw wins
    return mergeArrayByIdSafe(existingArr, remoteItems, key);
}

/**
 * Merge a Firestore snapshot into an existing local object-map.
 * NEVER deletes keys: union of all shopIds/staffIds.
 * For salesHistory and personalExpenses: always takes the LONGER array.
 */
function mergeObjectSnapshot(existingObj, snapshot) {
    existingObj = (existingObj && typeof existingObj === 'object') ? existingObj : {};
    if (snapshot.empty) {
        // Firestore collection is empty — keep local data, don't wipe it
        return existingObj;
    }
    const remoteObj = {};
    snapshot.forEach(doc => {
        remoteObj[doc.id] = doc.data();
    });

    const merged = { ...existingObj };
    for (const id in remoteObj) {
        if (!merged[id]) {
            merged[id] = remoteObj[id];
        } else {
            const localItem = merged[id];
            const remoteItem = remoteObj[id];
            // Merge scalar fields: remote wins (it's the authoritative server state)
            merged[id] = { ...localItem, ...remoteItem };

            // For salesHistory: ALWAYS take the union — never allow remote to shrink local
            if (Array.isArray(localItem.salesHistory) || Array.isArray(remoteItem.salesHistory)) {
                merged[id].salesHistory = mergeArrayByIdSafe(
                    localItem.salesHistory || [],
                    remoteItem.salesHistory || [],
                    'id'
                );
            }

            // Same for personalExpenses
            if (Array.isArray(localItem.personalExpenses) || Array.isArray(remoteItem.personalExpenses)) {
                merged[id].personalExpenses = mergeArrayByIdSafe(
                    localItem.personalExpenses || [],
                    remoteItem.personalExpenses || [],
                    'id'
                );
            }
        }
    }
    return merged;
}

/**
 * Listener registration helper for Firestore collections
 */
function listenToCollection(colName, type, updateFn) {
    let firstFire = true;
    _db.collection(colName).onSnapshot({ includeMetadataChanges: true }, snapshot => {
        if (snapshot.metadata && snapshot.metadata.hasPendingWrites) {
            return;
        }

        updateFn(snapshot);

        // Always sync updated memory to localStorage as backup
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        } catch (e) {
            console.warn('[NGAE] LocalStorage backup write error:', e);
        }

        if (firstFire) {
            firstFire = false;
            _loadedCollectionsCount++;
            if (_loadedCollectionsCount >= TOTAL_COLLECTIONS) {
                console.log('[NGAE] 🚀 Initial real-time sync completed for all collections!');
                lastSyncedAppData = deepClone(appData);
                _recalculateAllStocks(appData);
                _refreshUIIfPossible();
                window.dispatchEvent(new CustomEvent('ngae-data-updated', { detail: appData }));
                updateSyncIndicator('synced');
            }
        } else {
            lastSyncedAppData = deepClone(appData);
            _recalculateAllStocks(appData);
            _refreshUIIfPossible();
            window.dispatchEvent(new CustomEvent('ngae-data-updated', { detail: appData }));
            updateSyncIndicator('synced');
        }
    }, err => {
        console.warn(`[NGAE] Firestore listener notice for collection "${colName}":`, err.message);
        if (firstFire) {
            firstFire = false;
            _loadedCollectionsCount++;
            if (_loadedCollectionsCount >= TOTAL_COLLECTIONS) {
                updateSyncIndicator('offline', err.message);
            }
        }
    });
}

/**
 * Anzisha real-time listeners kwa collections zote husika.
 * Ukibadilika taarifa kwenye kifaa kingine, ukurasa huu unasasishwa otomatiki.
 */
function startRealtimeSync() {
    if (!_firebaseReady || !_db || _syncListenerActive) return;

    _syncListenerActive = true;
    console.log('[NGAE] 🔄 Real-time sync imeanzishwa kwa collections zote...');
    updateSyncIndicator('syncing');

    ensureFirebaseAuth().then(() => {
        return migrateOldDataIfNeeded();
    }).then(() => {
        listenToCollection('staff', 'object', snapshot => {
            appData.staff = mergeObjectSnapshot(appData.staff, snapshot);
        });

        listenToCollection('products', 'array', snapshot => {
            appData.products = mergeArraySnapshot(appData.products, snapshot, 'id');
        });

        listenToCollection('shops', 'array', snapshot => {
            appData.shops = mergeArraySnapshot(appData.shops, snapshot, 'id');
        });

        listenToCollection('raw_materials', 'array', snapshot => {
            appData.rawMaterials = mergeArraySnapshot(appData.rawMaterials, snapshot, 'id');
        });

        listenToCollection('dispatch_history', 'array', snapshot => {
            appData.dispatchHistory = mergeArraySnapshot(appData.dispatchHistory, snapshot, 'id');
        });

        listenToCollection('raw_materials_history', 'array', snapshot => {
            appData.rawMaterialsHistory = mergeArraySnapshot(appData.rawMaterialsHistory, snapshot, 'id');
        });

        listenToCollection('raw_materials_dispatch_history', 'array', snapshot => {
            appData.rawMaterialsDispatchHistory = mergeArraySnapshot(appData.rawMaterialsDispatchHistory, snapshot, 'id');
        });

        listenToCollection('production_log', 'array', snapshot => {
            appData.productionLog = mergeArraySnapshot(appData.productionLog, snapshot, 'id');
        });

        listenToCollection('finances', 'object', snapshot => {
            appData.finances = mergeObjectSnapshot(appData.finances, snapshot);
        });

        listenToCollection('customer_orders', 'array', snapshot => {
            appData.customerOrders = mergeArraySnapshot(appData.customerOrders, snapshot, 'id');
        });

        listenToCollection('suggestions', 'array', snapshot => {
            appData.suggestions = mergeArraySnapshot(appData.suggestions, snapshot, 'id');
        });

        listenToCollection('notifications', 'array', snapshot => {
            appData.notifications = mergeArraySnapshot(appData.notifications, snapshot, 'id');
        });

        listenToCollection('manufacturer_materials', 'object', snapshot => {
            appData.manufacturerMaterials = mergeObjectSnapshot(appData.manufacturerMaterials, snapshot);
        });

        listenToCollection('admin_expenses', 'array', snapshot => {
            appData.adminExpenses = mergeArraySnapshot(appData.adminExpenses, snapshot, 'id');
        });

        listenToCollection('salary_list', 'array', snapshot => {
            appData.salaryList = mergeArraySnapshot(appData.salaryList, snapshot, 'id');
        });

        listenToCollection('cash_flow_transactions', 'array', snapshot => {
            const arr = mergeArraySnapshot(appData.cashFlow ? appData.cashFlow.transactions : [], snapshot, 'id');
            if (!appData.cashFlow) appData.cashFlow = { balance: 0, transactions: [] };
            appData.cashFlow.transactions = arr;
            let balance = 0;
            arr.forEach(t => {
                if (t.type === 'IN') balance += (Number(t.amount) || 0);
                else if (t.type === 'OUT') balance -= (Number(t.amount) || 0);
            });
            appData.cashFlow.balance = balance;
        });

        listenToCollection('system_resets', 'object', snapshot => {
            const localResets = {};
            snapshot.forEach(doc => {
                localResets[doc.id] = doc.data();
            });
            if (!appData.systemResets) appData.systemResets = {};
            Object.assign(appData.systemResets, localResets);
        });
    });
}

/**
 * Jaribu kusasisha UI baada ya data kubadilika kutoka nje.
 */
function _refreshUIIfPossible() {
    try {
        if (typeof renderOverview === 'function') renderOverview();
        if (typeof renderStaff === 'function') renderStaff();
        if (typeof renderProducts === 'function') renderProducts();
        if (typeof renderCashFlow === 'function') renderCashFlow();
        if (typeof renderDailyReport === 'function') {
            const activeTab = document.querySelector('.tab-content:not(.hidden)');
            if (activeTab && activeTab.id === 'tab-daily-report') {
                renderDailyReport();
            }
        }
        if (typeof renderSuggestions === 'function') renderSuggestions();
        if (typeof renderNotifications === 'function') renderNotifications();
        if (typeof renderOverallStats === 'function') renderOverallStats();
        if (typeof renderExpenses === 'function') renderExpenses();
        if (typeof renderSalaryLedger === 'function') renderSalaryLedger();

        if (typeof window._refreshOperatorStats === 'function') window._refreshOperatorStats();
        if (typeof window._refreshSellerStats === 'function') window._refreshSellerStats();
        if (typeof window._refreshManufacturerStats === 'function') window._refreshManufacturerStats();
        if (typeof window._refreshStorekeeperStats === 'function') window._refreshStorekeeperStats();

        _updateNotificationBadge();
    } catch (e) {}
}

function _updateNotificationBadge() {
    try {
        const badge = document.getElementById('notificationBadge') || document.getElementById('notif-badge');
        if (badge && appData.notifications) {
            const unread = appData.notifications.filter(n => !n.read).length;
            badge.textContent = unread;
            badge.style.display = unread > 0 ? 'block' : 'none';
        }
    } catch (e) {}
}

function appAddNotification(title, message) {
    if (!appData.notifications) {
        appData.notifications = [];
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    appData.notifications.push({
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        title: title,
        message: message,
        date: `${dateStr} ${timeStr}`,
        dateRaw: now.toISOString(),
        read: false
    });

    // Save to localStorage immediately (fire-and-forget Firestore — no await to avoid re-entrant loops)
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
        console.warn('[NGAE] Notification localStorage write error:', e);
    }
    window.appData = appData;

    // Schedule async Firestore sync without blocking callers
    if (_firebaseReady && _db) {
        const notif = appData.notifications[appData.notifications.length - 1];
        ensureFirebaseAuth().then(() => {
            return _db.collection('notifications').doc(notif.id).set(notif);
        }).catch(e => console.warn('[NGAE] Notification sync warning:', e.message));
    }
}

// ==========================================
// APP STATE - Loaded Once
// ==========================================
let appData = _recalculateAllStocks(loadData());
window.appData = appData;

// Anzisha Firebase (async - background)
initFirebase();

// Anzisha real-time sync mara moja (ambayo itafanya pia load ya kwanza)
startRealtimeSync();

// Automatic Sync on network reconnection (online event)
window.addEventListener('online', async () => {
    console.log('[NGAE] ≡ƒô╢ Device went online. Synchronizing data...');
    if (!_firebaseReady) {
        initFirebase();
    }
    if (_firebaseReady && _db) {
        startRealtimeSync();
    }
});

// Automatic Sync status on network reconnection (offline event)
window.addEventListener('offline', () => {
    console.log('[NGAE] ≡ƒô┤ Device went offline. Switching to local cache.');
    updateSyncIndicator('offline');
});


// ==========================================
// PRODUCT MANAGEMENT API
// ==========================================

window.appGetProducts = function() {
    return appData.products || [];
};

window.appAddProduct = async function(name, price, stock = 0) {
    if (!appData.products) appData.products = [];
    const formattedName = name.toUpperCase().trim();
    const exists = appData.products.some(p => p.name.toUpperCase() === formattedName);
    if (exists) {
        return { success: false, message: 'Bidhaa hii tayari imesajiliwa kwenye mfumo!' };
    }
    const newId = 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const product = {
        id: newId,
        name: formattedName,
        price: parseFloat(price) || 0,
        stock: parseInt(stock) || 0,
        initialStock: parseInt(stock) || 0,
        baseStock: parseInt(stock) || 0,
        dateAdded: dateStr
    };
    appData.products.push(product);
    await saveData(appData);
    window.appData = appData;

    if (window.appAddNotification) {
        appAddNotification('Bidhaa Mpya Imesajiliwa', `Bidhaa "${formattedName}" yenye bei ya Tsh ${(parseFloat(price)||0).toLocaleString()} imesajiliwa kikamilifu.`);
    }
    return { success: true, product };
};

window.appUpdateProduct = async function(id, name, price, stock) {
    if (!appData.products) return false;
    const product = appData.products.find(p => p.id === id);
    if (!product) return false;

    const oldName = product.name;
    product.name = name.toUpperCase().trim();
    product.price = parseFloat(price) || 0;
    if (stock !== undefined && stock !== null && stock !== '') {
        const targetStock = parseInt(stock) || 0;
        const pId = (product.id || '').toUpperCase();
        const pName = (product.name || '').toUpperCase().trim();
        let totalProduced = 0;
        (appData.productionLog || []).forEach(l => {
            if (!l) return;
            const lId = (l.productId || '').toUpperCase();
            const lName = (l.productName || '').toUpperCase().trim();
            if ((pId && lId === pId) || (pName && lName === pName)) {
                totalProduced += (Number(l.quantity) || 0);
            }
        });
        let totalDispatched = 0;
        (appData.dispatchHistory || []).forEach(d => {
            if (!d) return;
            const dId = (d.productId || '').toUpperCase();
            const dName = (d.productName || '').toUpperCase().trim();
            if ((pId && dId === pId) || (pName && dName === pName)) {
                totalDispatched += (Number(d.quantity) || 0);
            }
        });

        product.stock = targetStock;
        product.initialStock = targetStock - totalProduced + totalDispatched;
        product.baseStock = targetStock - totalProduced + totalDispatched;
    }
    await saveData(appData);
    window.appData = appData;

    if (window.appAddNotification) {
        appAddNotification('Bidhaa Imerekebishwa', `Taarifa za bidhaa "${product.name}" (zamani: ${oldName}) zimesasishwa.`);
    }
    return true;
};

window.appDeleteProduct = async function(id) {
    if (!appData.products) return false;
    const prod = appData.products.find(p => p.id === id);
    appData.products = appData.products.filter(p => p.id !== id);
    await removeDoc('products', id);
    await saveData(appData);
    window.appData = appData;

    if (window.appAddNotification && prod) {
        appAddNotification('Bidhaa Imefutwa', `Bidhaa "${prod.name}" imefutwa kwenye mfumo.`);
    }
    return true;
};

// ==========================================
// AUTH FUNCTIONS
// ==========================================

window.appLogin = function(role, staffId) {
    const staffRecord = appData.staff[staffId.toUpperCase()];

    if (!staffRecord) {
        alert("Namba ya ID haikupatikana. Tafadhali hakikisha umepewa Staff ID rasmi iliyosajiliwa na Admin.");
        return false;
    }

    if (staffRecord.role !== role) {
        alert(`ID ${staffId} ni ya ${staffRecord.role.toUpperCase()}, si ${role.toUpperCase()}. Tafadhali rudi na uchague jukumu sahihi.`);
        return false;
    }

    localStorage.setItem('ngae_logged_in_role', role);
    localStorage.setItem('ngae_logged_in_id', staffId.toUpperCase());
    localStorage.setItem('ngae_logged_in_name', staffRecord.name);

    if(role === 'storekeeper') {
        window.location.href = 'store_keeper.html';
    } else {
        window.location.href = role + '.html';
    }
    return true;
};

window.appLogout = function() {
    localStorage.removeItem('ngae_logged_in_role');
    localStorage.removeItem('ngae_logged_in_id');
    localStorage.removeItem('ngae_logged_in_name');
    window.location.href = 'index.html';
};

window.appProtectRoute = function(requiredRole) {
    const loggedRole = localStorage.getItem('ngae_logged_in_role');
    const loggedId = localStorage.getItem('ngae_logged_in_id');

    if (!loggedRole || !loggedId) {
        window.location.href = 'login.html?role=' + requiredRole;
        return false;
    }

    if (loggedRole !== requiredRole) {
        alert("Huna ruhusa ya kuingia ukurasa huu.");
        window.location.href = 'login.html?role=' + requiredRole;
        return false;
    }

    const nameEl = document.getElementById('staffNameDisplay');
    const idEl = document.getElementById('staffIdDisplay');
    if (nameEl) nameEl.textContent = localStorage.getItem('ngae_logged_in_name') || loggedId;
    if (idEl) idEl.textContent = loggedId;

    return true;
};

// ==========================================
// OPERATOR FUNCTIONS
// ==========================================

window.appDispatchProduct = async function(productId, shopId, qty, unit) {
    const product = appData.products.find(p => p.id === productId);
    const shop = appData.shops.find(s => s.id === shopId);
    const numQty = Number(qty) || 0;

    if (!product || !shop || numQty <= 0) return false;
    if ((Number(product.stock) || 0) < numQty) return false;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const staffId = (localStorage.getItem('ngae_logged_in_id') || '').toUpperCase();
    const staffName = localStorage.getItem('ngae_logged_in_name') || 'Operator';

    const dispatchRecord = {
        id: 'disp_log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        date: dateStr,
        dateRaw: now.toISOString(),
        createdAt: now.toISOString(),
        productId: product.id,
        productName: product.name,
        shopId: shop.id,
        shopLocation: shop.location,
        quantity: numQty,
        originalQuantity: numQty,
        unitPrice: Number(product.price) || 0,
        totalValue: (Number(product.price) || 0) * numQty,
        unit: unit || 'pcs',
        operatorId: staffId,
        operatorName: staffName,
        auditTrail: []
    };

    appData.dispatchHistory.push(dispatchRecord);

    if (!appData.finances[shop.id]) {
        appData.finances[shop.id] = { submitted: 0, reportedDebt: 0, salesHistory: [], personalExpenses: [] };
    }

    _recalculateAllStocks(appData);
    await saveData(appData);
    window.appData = appData;

    appAddNotification('Usafirishaji Mpya', `Operator amesafirisha ${numQty} ${unit || 'pcs'} ya ${product.name} kwenda duka la ${shop.location}.`);

    return true;
};

/**
 * Helper to calculate authoritative 1-hour grace period status
 * Edit Allowed = Current Time - Shipment Creation Time < 60 minutes
 */
window.appGetDispatchGracePeriodStatus = function(dispatch) {
    if (!dispatch) {
        return { isEditable: false, remainingMs: 0, remainingSeconds: 0, formattedRemaining: '00:00', statusText: 'EDIT LOCKED – 1 HOUR EXPIRED', isExpired: true };
    }

    const createdIso = dispatch.createdAt || dispatch.dateRaw;
    const createdTime = createdIso ? new Date(createdIso).getTime() : NaN;

    if (isNaN(createdTime)) {
        return { isEditable: false, remainingMs: 0, remainingSeconds: 0, formattedRemaining: '00:00', statusText: 'EDIT LOCKED – 1 HOUR EXPIRED', isExpired: true };
    }

    const nowTime = Date.now();
    const elapsed = nowTime - createdTime;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const remainingMs = ONE_HOUR_MS - elapsed;

    if (remainingMs <= 0) {
        return {
            isEditable: false,
            remainingMs: 0,
            remainingSeconds: 0,
            minutesRemaining: 0,
            formattedRemaining: '00:00',
            statusText: 'EDIT LOCKED – 1 HOUR EXPIRED',
            isExpired: true
        };
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formatted = minutes > 0 ? `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s` : `${seconds}s`;

    return {
        isEditable: true,
        remainingMs,
        remainingSeconds: totalSeconds,
        minutesRemaining: minutes,
        formattedRemaining: formatted,
        statusText: `Edit available for: ${formatted}`,
        isExpired: false
    };
};

/**
 * Secure Server-Side/Core function to edit dispatch quantity within 1-hour grace period
 */
window.appEditDispatchQuantity = async function(dispatchId, newQuantity, reason = 'Marekebisho ya idadi') {
    if (!appData) appData = loadData();
    const dispatch = (appData.dispatchHistory || []).find(d => d.id === dispatchId);

    if (!dispatch) {
        return { success: false, message: "Kumbukumbu ya mzigo haikupatikana kwenye mfumo." };
    }

    // 1. Authoritative 1-Hour Security Check (Server/Database time baseline)
    const createdIso = dispatch.createdAt || dispatch.dateRaw;
    const createdTime = createdIso ? new Date(createdIso).getTime() : NaN;
    const nowTime = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;

    if (isNaN(createdTime) || (nowTime - createdTime) >= ONE_HOUR_MS) {
        return {
            success: false,
            message: "This shipment can no longer be edited because the 1-hour grace period has expired (Muda wa dakika 60 za marekebisho umemalizika)."
        };
    }

    // 2. Validate New Quantity
    const numNewQty = Number(newQuantity);
    if (isNaN(numNewQty) || numNewQty <= 0) {
        return { success: false, message: "Tafadhali weka idadi sahihi kubwa kuliko sifuri (0)." };
    }

    const prevQty = Number(dispatch.quantity) || 0;
    if (numNewQty === prevQty) {
        return { success: false, message: "Idadi mpya ni sawa na idadi ya sasa. Hakuna mabadiliko yaliyofanyika." };
    }

    const product = (appData.products || []).find(p => p.id === dispatch.productId || p.name.toLowerCase() === (dispatch.productName || '').toLowerCase());
    if (!product) {
        return { success: false, message: "Bidhaa husika haipatikani kwenye mfumo wa stoo." };
    }

    // 3. Check stock balance when increasing shipment quantity
    const qtyDiff = numNewQty - prevQty;
    if (qtyDiff > 0 && (Number(product.stock) || 0) < qtyDiff) {
        return {
            success: false,
            message: `Stoo haina bidhaa za kutosha kuongeza idadi hii. Zilizopo stoo kwa sasa ni ${Number(product.stock) || 0} ${dispatch.unit || 'pcs'}.`
        };
    }

    const staffId = (localStorage.getItem('ngae_logged_in_id') || '').toUpperCase();
    const staffName = localStorage.getItem('ngae_logged_in_name') || 'Operator';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // 4. Record Audit Trail
    if (!Array.isArray(dispatch.auditTrail)) {
        dispatch.auditTrail = [];
    }

    dispatch.auditTrail.push({
        originalQuantity: prevQty,
        newQuantity: numNewQty,
        difference: qtyDiff,
        changedBy: `${staffName} (${staffId || 'OPERATOR'})`,
        operatorId: staffId,
        operatorName: staffName,
        changedAt: dateStr,
        timestamp: now.toISOString(),
        reason: (reason && reason.trim()) ? reason.trim() : 'Marekebisho ya idadi ya mzigo'
    });

    // 5. Update Existing Transaction Safely (No Duplicate Transactions)
    dispatch.quantity = numNewQty;
    const unitPrice = Number(product.price) || Number(dispatch.unitPrice) || 0;
    dispatch.unitPrice = unitPrice;
    dispatch.totalValue = unitPrice * numNewQty;
    dispatch.lastModifiedAt = now.toISOString();

    // 6. Recalculate all linked stocks & balances
    _recalculateAllStocks(appData);

    // 7. Save & Sync across Firebase and LocalStorage
    await saveData(appData);
    window.appData = appData;

    // 8. Add Audit Notification
    appAddNotification(
        'Marekebisho ya Mzigo',
        `Operator (${staffName}) amerekebisha mzigo wa ${product.name} kwenda ${dispatch.shopLocation}: kutoka ${prevQty} hadi ${numNewQty} ${dispatch.unit || 'pcs'}. Sababu: ${reason || 'Marekebisho'}`
    );

    return {
        success: true,
        message: `Idadi ya mzigo imerekebishwa kikamilifu kutoka ${prevQty} hadi ${numNewQty} ${dispatch.unit || 'pcs'}.`,
        dispatch
    };
};

// ==========================================
// SELLER FUNCTIONS
// ==========================================

window.appSubmitSales = async function(amount, notes) {
    const staffId = (localStorage.getItem('ngae_logged_in_id') || '').toUpperCase().trim();
    const staffRecord = appData.staff[staffId];
    if (!staffRecord || !staffRecord.shopId) return false;

    const shopId = staffRecord.shopId;
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return false;

    if (!appData.finances[shopId]) {
        appData.finances[shopId] = { submitted: 0, reportedDebt: 0, salesHistory: [], personalExpenses: [] };
    }
    if (!appData.finances[shopId].salesHistory) {
        appData.finances[shopId].salesHistory = [];
    }

    appData.finances[shopId].submitted = (Number(appData.finances[shopId].submitted) || 0) + numAmount;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    appData.finances[shopId].salesHistory.push({
        id: 'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        amount: numAmount,
        notes: notes || 'Mauzo ya Kawaida',
        date: `${dateStr} ${timeStr}`,
        dateRaw: now.toISOString()
    });

    await saveData(appData);
    window.appData = appData;

    const shopLoc = appData.shops.find(s => s.id === shopId)?.location || 'dukani';
    appAddNotification('Mauzo Yaliyowasilishwa', `Muuzaji wa duka la ${shopLoc} amewasilisha mauzo ya Tsh ${numAmount.toLocaleString()}.`);

    return true;
};

window.appReportDebt = async function(amount, reason) {
    const staffId = (localStorage.getItem('ngae_logged_in_id') || '').toUpperCase().trim();
    const staffRecord = appData.staff[staffId];
    if (!staffRecord || !staffRecord.shopId) return false;

    const shopId = staffRecord.shopId;
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return false;

    if (!appData.finances[shopId]) {
        appData.finances[shopId] = { submitted: 0, reportedDebt: 0, salesHistory: [], personalExpenses: [] };
    }

    appData.finances[shopId].reportedDebt = (Number(appData.finances[shopId].reportedDebt) || 0) + numAmount;
    await saveData(appData);
    window.appData = appData;
    return true;
};

window.appAddSellerExpense = async function(amount, description, category, date, notes) {
    const staffId = (localStorage.getItem('ngae_logged_in_id') || '').toUpperCase().trim();
    const staffRecord = appData.staff[staffId];
    if (!staffRecord || !staffRecord.shopId) return false;

    const shopId = staffRecord.shopId;
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return false;

    if (!appData.finances[shopId]) {
        appData.finances[shopId] = { submitted: 0, reportedDebt: 0, salesHistory: [], personalExpenses: [] };
    }
    if (!appData.finances[shopId].personalExpenses) {
        appData.finances[shopId].personalExpenses = [];
    }

    let expDate = new Date();
    if (date) {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
            expDate = parsedDate;
        }
    }

    const dateStr = expDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = expDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    appData.finances[shopId].personalExpenses.push({
        id: 'seller_exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        amount: numAmount,
        description: description,
        category: category || 'Mengineyo',
        notes: notes || '',
        date: `${dateStr} ${timeStr}`,
        dateRaw: expDate.toISOString()
    });

    await saveData(appData);
    window.appData = appData;
    return true;
};

// ==========================================
// STORE KEEPER FUNCTIONS
// ==========================================

window.appReceiveMaterial = async function(materialName, unit, qty, pricePerUnit) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const numQty = Number(qty) || 0;
    const numPrice = Number(pricePerUnit) || 0;

    if (!materialName || numQty <= 0) return false;

    // Use stable deterministic ID based on name (prevents duplicate materials from multi-device entry)
    const stableMatId = 'mat_' + materialName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    let mat = appData.rawMaterials.find(m => m.name.toUpperCase().trim() === materialName.toUpperCase().trim());
    if (!mat) {
        mat = {
            id: stableMatId,
            name: materialName.toUpperCase().trim(),
            unit: unit,
            stock: 0,
            initialStock: 0,
            baseStock: 0
        };
        appData.rawMaterials.push(mat);
    }

    // Update base stock to keep reconciliation correct
    mat.initialStock = (Number(mat.initialStock) || 0) + numQty;
    mat.baseStock = (Number(mat.baseStock) || 0) + numQty;
    mat.stock = (Number(mat.stock) || 0) + numQty;
    mat.unit = unit || mat.unit; // update unit if provided

    appData.rawMaterialsHistory.push({
        id: 'mat_rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        date: dateStr,
        dateRaw: now.toISOString(),
        materialName: mat.name,
        materialId: mat.id,
        unit: unit || mat.unit,
        qty: numQty,
        pricePerUnit: numPrice
    });

    await saveData(appData);
    window.appData = appData;

    appAddNotification('Malighafi Zimepokelewa', `Stoo imepokea ${numQty} ${unit || mat.unit} za ${mat.name}.`);

    return true;
};

window.appDispatchMaterial = async function(materialId, qty, manufacturerId) {
    const mat = appData.rawMaterials.find(m => m.id === materialId);
    const numQty = Number(qty) || 0;
    const mIdUpper = (manufacturerId || '').toUpperCase().trim();

    if (!mat || (Number(mat.stock) || 0) < numQty || numQty <= 0) return false;

    mat.stock = (Number(mat.stock) || 0) - numQty;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const manufacturerName = appData.staff[mIdUpper] ? appData.staff[mIdUpper].name : 'Producer';

    appData.rawMaterialsDispatchHistory.push({
        id: 'mat_disp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        date: dateStr,
        dateRaw: now.toISOString(),
        materialName: mat.name,
        materialId: mat.id,
        unit: mat.unit,
        qty: numQty,
        manufacturerId: mIdUpper,
        manufacturerName: manufacturerName
    });

    if (!appData.manufacturerMaterials) {
        appData.manufacturerMaterials = {};
    }
    if (!appData.manufacturerMaterials[mIdUpper]) {
        appData.manufacturerMaterials[mIdUpper] = {};
    }
    appData.manufacturerMaterials[mIdUpper][mat.id] = (Number(appData.manufacturerMaterials[mIdUpper][mat.id]) || 0) + numQty;

    await saveData(appData);
    window.appData = appData;

    appAddNotification('Malighafi Zimetolewa', `Stoo imetoa ${numQty} ${mat.unit} za ${mat.name} kwenda kwa ${manufacturerName}.`);

    return true;
};

// ==========================================
// MANUFACTURER FUNCTIONS
// ==========================================

window.appRecordProduction = async function(productId, qty, notes) {
    if (!appData.products) appData.products = [];
    const numQty = Number(qty) || 0;
    if (numQty <= 0) return false;

    const searchKey = (productId || '').toString().trim().toUpperCase();
    const notesKey = (notes || '').toString().trim().toUpperCase();

    // 1. Tafuta bidhaa kwa ID au Jina
    let product = appData.products.find(p => 
        p.id === productId || 
        p.name.toUpperCase() === searchKey ||
        (notesKey && p.name.toUpperCase() === notesKey)
    );

    // 2. Ikiwa bidhaa haipo kwenye katalogi bado, isajili moja kwa moja kwenye appData.products!
    if (!product) {
        let newName = searchKey;
        if (!newName || newName.includes('PROD_') || newName === 'OTHER') {
            newName = (notesKey && !notesKey.includes('UZALISHAJI')) ? notesKey : 'BIDHAA MPYA';
        }
        const newId = 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        product = {
            id: newId,
            name: newName,
            price: 2500, // Thamani ya mwanzo ya msingi (Tsh)
            stock: 0,
            initialStock: 0,
            baseStock: 0,
            dateAdded: dateStr
        };
        appData.products.push(product);
        console.log(`[NGAE] 🆕 Bidhaa mpya "${newName}" imesajiliwa kiwandani papo hapo.`);
    }

    // 3. Weka hesabu sahihi za Namba (sio String concatenation)
    product.stock = (Number(product.stock) || 0) + numQty;
    product.price = Number(product.price) || 0;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    if (!appData.productionLog) appData.productionLog = [];
    appData.productionLog.push({
        id: 'prod_log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        date: dateStr,
        dateRaw: now.toISOString(),
        productId: product.id,
        productName: product.name,
        quantity: numQty,
        notes: notes || 'Uzalishaji wa Kiwandani'
    });

    await saveData(appData);
    window.appData = appData;

    if (window.appAddNotification) {
        appAddNotification('Uzalishaji Mpya', `Kiwanda kimesajili uzalishaji wa ${numQty} pcs za ${product.name}. Bakaa mpya stoo: ${product.stock} pcs.`);
    }

    return true;
};

// ==========================================
// ADMIN STORE & PRODUCTION OVERRIDE FUNCTIONS
// ==========================================

window.appAdminEditRawMaterial = async function(materialId, name, unit, stock) {
    const mat = (appData.rawMaterials || []).find(m => m.id === materialId);
    if (!mat) return false;
    mat.name = name.toUpperCase().trim();
    mat.unit = unit;
    
    const targetStock = Number(stock) || 0;
    const mId = (mat.id || '').toUpperCase();
    const mName = (mat.name || '').toUpperCase().trim();
    let totalReceived = 0;
    (appData.rawMaterialsHistory || []).forEach(r => {
        if (!r) return;
        const rId = (r.materialId || '').toUpperCase();
        const rName = (r.materialName || '').toUpperCase().trim();
        if ((mId && rId === mId) || (mName && rName === mName)) {
            totalReceived += (Number(r.qty) || 0);
        }
    });
    let totalDispatched = 0;
    (appData.rawMaterialsDispatchHistory || []).forEach(d => {
        if (!d) return;
        const dId = (d.materialId || '').toUpperCase();
        const dName = (d.materialName || '').toUpperCase().trim();
        if ((mId && dId === mId) || (mName && dName === mName)) {
            totalDispatched += (Number(d.qty) || 0);
        }
    });

    mat.stock = targetStock;
    mat.initialStock = targetStock - totalReceived + totalDispatched;
    mat.baseStock = targetStock - totalReceived + totalDispatched;

    await saveData(appData);
    window.appData = appData;
    return true;
};

window.appAdminDeleteRawMaterial = async function(materialId) {
    if (!appData.rawMaterials) return false;
    appData.rawMaterials = appData.rawMaterials.filter(m => m.id !== materialId);
    await removeDoc('raw_materials', materialId);
    await saveData(appData);
    window.appData = appData;
    return true;
};

window.appAdminEditProductionLog = async function(logId, newQty, newNotes) {
    if (!appData.productionLog) return false;
    const entry = appData.productionLog.find(l => l.id === logId);
    if (!entry) return false;

    const oldQty = Number(entry.quantity) || 0;
    const diff = Number(newQty) - oldQty;

    entry.quantity = Number(newQty);
    if (newNotes) entry.notes = newNotes;

    const prod = (appData.products || []).find(p => p.id === entry.productId || p.name.toUpperCase() === entry.productName.toUpperCase());
    if (prod) {
        prod.stock = Math.max(0, (Number(prod.stock) || 0) + diff);
    }

    await saveData(appData);
    window.appData = appData;
    return true;
};

window.appAdminDeleteProductionLog = async function(logId) {
    if (!appData.productionLog) return false;
    const entry = appData.productionLog.find(l => l.id === logId);
    if (!entry) return false;

    const qty = Number(entry.quantity) || 0;
    const prod = (appData.products || []).find(p => p.id === entry.productId || p.name.toUpperCase() === entry.productName.toUpperCase());
    if (prod) {
        prod.stock = Math.max(0, (Number(prod.stock) || 0) - qty);
    }

    appData.productionLog = appData.productionLog.filter(l => l.id !== logId);
    await removeDoc('production_log', logId);
    await saveData(appData);
    window.appData = appData;
    return true;
};

// ==========================================
// CUSTOMER ORDER FUNCTIONS
// ==========================================

window.appPlaceOrder = async function({ customer_name, phone, region, district, ward, street, items, total }) {
    const orderId = 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const order = {
        id: orderId,
        customer_name,
        phone,
        address: `${street}, ${ward}, ${district}, ${region}`,
        items,
        total,
        date: dateStr,
        dateRaw: now.toISOString(),
        status: 'Pending'
    };

    appData.customerOrders.push(order);
    await saveData(appData);
    window.appData = appData;
    return orderId;
};

window.appTrackOrder = function(orderId) {
    return appData.customerOrders.find(o => o.id === orderId.toUpperCase()) || null;
};

// ==========================================
// ADMIN FUNCTIONS
// ==========================================

window.appAddStaff = async function(name, role, customId, photo) {
    let newId = customId ? customId.toUpperCase().trim() : null;
    if (!newId) {
        let maxNum = 0;
        Object.keys(appData.staff).forEach(id => {
            const match = id.match(/^NGAE(\d+)$/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        });
        const nextNum = String(maxNum + 1).padStart(3, '0');
        newId = 'NGAE' + nextNum;
    }

    if (appData.staff[newId]) {
        alert(`ID ${newId} tayari inatumiwa na ${appData.staff[newId].name}.`);
        return false;
    }

    const newStaff = { name, role };
    if (photo) newStaff.photo = photo;

    if (role === 'seller') {
        const shopId = 'shop_' + name.toLowerCase().replace(/\s+/g,'_');
        newStaff.shopId = shopId;

        if (!appData.shops.some(s => s.id === shopId)) {
            appData.shops.push({
                id: shopId,
                location: 'TANGA, ' + name.toUpperCase(),
                sellerName: name,
                sellerId: newId
            });
        }
    }

    appData.staff[newId] = newStaff;
    await saveData(appData);
    window.appData = appData;
    return newId;
};

window.appDeleteStaff = async function(staffId) {
    const staffObj = appData.staff[staffId];
    if (staffObj) {
        if (staffObj.role === 'seller' && staffObj.shopId) {
            appData.shops = (appData.shops || []).filter(s => s.id !== staffObj.shopId);
        }
        delete appData.staff[staffId];
        await removeDoc('staff', staffId);
        await saveData(appData);
        window.appData = appData;
        return true;
    }
    return false;
};

// ==========================================
// CASH FLOWING FUNCTIONS (ADMIN PERSONAL)
// ==========================================

window.appAddPersonalCash = async function(amount, description) {
    if (!appData.cashFlow) {
        appData.cashFlow = { balance: 0, transactions: [] };
    }
    const amt = parseFloat(amount);
    appData.cashFlow.balance += amt;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    appData.cashFlow.transactions.push({
        id: 'cf_in_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        type: 'IN',
        amount: amt,
        description: description,
        date: `${dateStr} ${timeStr}`,
        dateRaw: now.toISOString(),
        runningBalance: appData.cashFlow.balance
    });

    await saveData(appData);
    window.appData = appData;
    return true;
};

window.appAddPersonalExpense = async function(amount, description) {
    if (!appData.cashFlow) {
        appData.cashFlow = { balance: 0, transactions: [] };
    }
    const amt = parseFloat(amount);
    appData.cashFlow.balance -= amt;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    appData.cashFlow.transactions.push({
        id: 'cf_out_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        type: 'OUT',
        amount: amt,
        description: description,
        date: `${dateStr} ${timeStr}`,
        dateRaw: now.toISOString(),
        runningBalance: appData.cashFlow.balance
    });

    await saveData(appData);
    window.appData = appData;
    return true;
};

window.appGetPersonalCashFlowStats = function() {
    if (!appData.cashFlow || !appData.cashFlow.transactions) {
        return { today: 0, week: 0, month: 0, year: 0 };
    }

    const resetPoint = window.appGetCashFlowResetPoint ? window.appGetCashFlowResetPoint() : null;
    const resetTime = (resetPoint && resetPoint.resetAt) ? new Date(resetPoint.resetAt).getTime() : null;

    const now = new Date();
    let today = 0, week = 0, month = 0, year = 0;

    appData.cashFlow.transactions.forEach(t => {
        if (t.type === 'IN') {
            const tDate = new Date(t.dateRaw);
            const tTime = tDate.getTime();

            // Ignore transactions prior to the cash flow reset point
            if (resetTime !== null && !isNaN(tTime) && tTime < resetTime) {
                return;
            }

            if (tDate.getFullYear() === now.getFullYear()) {
                year += t.amount;

                if (tDate.getMonth() === now.getMonth()) {
                    month += t.amount;

                    if (tDate.toDateString() === now.toDateString()) {
                        today += t.amount;
                    }
                }

                const diffTime = Math.abs(now - tDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 7) {
                    week += t.amount;
                }
            }
        }
    });

    return { today, week, month, year };
};

// ==========================================
// SYSTEM RESETS (DAILY REPORT & CASH FLOW)
// Zero-loss reset points synchronized across devices
// ==========================================

window.appResetDailyReport = async function(adminUser = 'Admin') {
    if (!appData.systemResets) {
        appData.systemResets = {};
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const prevReset = (appData.systemResets.daily_report && appData.systemResets.daily_report.resetAt)
        ? appData.systemResets.daily_report.resetAt
        : 'Mwanzo wa Mfumo';

    appData.systemResets.daily_report = {
        resetAt: nowIso,
        resetDateStr: now.toLocaleDateString('en-GB'),
        resetTimeStr: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        resetBy: adminUser,
        prevPeriodStart: prevReset
    };

    if (!appData.systemResets.audit_trail) {
        appData.systemResets.audit_trail = { logs: [] };
    } else if (!appData.systemResets.audit_trail.logs) {
        appData.systemResets.audit_trail.logs = [];
    }

    const auditEntry = {
        id: 'rst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        module: 'DAILY_REPORT',
        moduleName: 'Daily Report (Ripoti ya Siku)',
        adminUser: adminUser,
        timestamp: nowIso,
        formattedDate: `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
        previousResetAt: prevReset,
        newResetAt: nowIso
    };
    appData.systemResets.audit_trail.logs.push(auditEntry);

    if (appData.systemResets.audit_trail.logs.length > 100) {
        appData.systemResets.audit_trail.logs = appData.systemResets.audit_trail.logs.slice(-100);
    }

    await saveData(appData);
    window.appData = appData;

    if (typeof appAddNotification === 'function') {
        appAddNotification('Daily Report Mpya', `Ripoti ya Siku imeanzishwa upya na ${adminUser}. Mahesabu yanahesabiwa kuanzia sasa.`);
    }

    return true;
};

window.appResetCashFlow = async function(adminUser = 'Admin') {
    if (!appData.systemResets) {
        appData.systemResets = {};
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const prevReset = (appData.systemResets.cash_flow && appData.systemResets.cash_flow.resetAt)
        ? appData.systemResets.cash_flow.resetAt
        : 'Mwanzo wa Mfumo';

    appData.systemResets.cash_flow = {
        resetAt: nowIso,
        resetDateStr: now.toLocaleDateString('en-GB'),
        resetTimeStr: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        resetBy: adminUser,
        prevPeriodStart: prevReset
    };

    if (!appData.systemResets.audit_trail) {
        appData.systemResets.audit_trail = { logs: [] };
    } else if (!appData.systemResets.audit_trail.logs) {
        appData.systemResets.audit_trail.logs = [];
    }

    const auditEntry = {
        id: 'rst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        module: 'CASH_FLOW',
        moduleName: 'Cash Flow (Kitabu cha Fedha)',
        adminUser: adminUser,
        timestamp: nowIso,
        formattedDate: `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
        previousResetAt: prevReset,
        newResetAt: nowIso
    };
    appData.systemResets.audit_trail.logs.push(auditEntry);

    if (appData.systemResets.audit_trail.logs.length > 100) {
        appData.systemResets.audit_trail.logs = appData.systemResets.audit_trail.logs.slice(-100);
    }

    await saveData(appData);
    window.appData = appData;

    if (typeof appAddNotification === 'function') {
        appAddNotification('Cash Flow Mpya', `Kipindi kipya cha Cash Flow kimeanzishwa na ${adminUser}. Mahesabu yataanza sifuri.`);
    }

    return true;
};

window.appGetDailyReportResetPoint = function() {
    return (appData.systemResets && appData.systemResets.daily_report) ? appData.systemResets.daily_report : null;
};

window.appGetCashFlowResetPoint = function() {
    return (appData.systemResets && appData.systemResets.cash_flow) ? appData.systemResets.cash_flow : null;
};

window.appGetResetAuditLogs = function() {
    return (appData.systemResets && appData.systemResets.audit_trail && appData.systemResets.audit_trail.logs)
        ? appData.systemResets.audit_trail.logs
        : [];
};

window.appGetPersonalCashFlowBalance = function() {
    if (!appData.cashFlow || !appData.cashFlow.transactions) return 0;
    const resetPoint = window.appGetCashFlowResetPoint ? window.appGetCashFlowResetPoint() : null;
    const resetTime = (resetPoint && resetPoint.resetAt) ? new Date(resetPoint.resetAt).getTime() : null;

    if (resetTime === null) {
        return appData.cashFlow.balance || 0;
    }

    let activeBal = 0;
    appData.cashFlow.transactions.forEach(t => {
        const tTime = new Date(t.dateRaw).getTime();
        if (!isNaN(tTime) && tTime >= resetTime) {
            if (t.type === 'IN') activeBal += (Number(t.amount) || 0);
            else if (t.type === 'OUT') activeBal -= (Number(t.amount) || 0);
        }
    });
    return activeBal;
};

// ==========================================
// STAFF SUGGESTIONS & FEEDBACK (MAPENDEKEZO)
// ==========================================

window.appSubmitSuggestion = async function(message) {
    if (!appData.suggestions) {
        appData.suggestions = [];
    }

    const staffId = localStorage.getItem('ngae_logged_in_id');
    const staffName = localStorage.getItem('ngae_logged_in_name') || 'Mfanyakazi';
    const staffRole = localStorage.getItem('ngae_logged_in_role') || 'staff';

    if (!staffId) return false;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    appData.suggestions.push({
        id: 'sugg_' + Math.random().toString(36).substr(2, 9),
        senderId: staffId,
        senderName: staffName,
        senderRole: staffRole,
        date: `${dateStr} ${timeStr}`,
        dateRaw: now.toISOString(),
        message: message,
        replies: []
    });

    await saveData(appData);
    window.appData = appData;
    return true;
};

window.appReplyToSuggestion = async function(suggestionId, replyText) {
    if (!appData.suggestions) return false;

    const sugg = appData.suggestions.find(s => s.id === suggestionId);
    if (!sugg) return false;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    sugg.replies.push({
        sender: 'admin',
        message: replyText,
        date: `${dateStr} ${timeStr}`,
        dateRaw: now.toISOString()
    });

    await saveData(appData);
    window.appData = appData;
    return true;
};

window.appGetStaffSuggestions = function() {
    if (!appData.suggestions) return [];
    const staffId = localStorage.getItem('ngae_logged_in_id');
    if (!staffId) return [];
    return appData.suggestions.filter(s => s.senderId === staffId);
};

window.appGetAllSuggestions = function() {
    return appData.suggestions || [];
};

// ==========================================
// NOTIFICATIONS FUNCTIONS
// ==========================================

window.appGetUnreadNotificationsCount = function() {
    if (!appData.notifications) return 0;
    return appData.notifications.filter(n => !n.read).length;
};

window.appGetNotifications = function() {
    return appData.notifications || [];
};

window.appMarkNotificationsAsRead = async function() {
    if (!appData.notifications) return;
    appData.notifications.forEach(n => n.read = true);
    await saveData(appData);
    window.appData = appData;
};

window.appClearNotifications = async function() {
    appData.notifications = [];
    await saveData(appData);
    window.appData = appData;
};

// ==========================================
// ADMIN EXPENSES & OVERALL STATISTICS
// ==========================================

window.appAddAdminExpense = async function(description, amount) {
    if (!appData.adminExpenses) {
        appData.adminExpenses = [];
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    appData.adminExpenses.push({
        id: 'exp_' + Math.random().toString(36).substr(2, 9),
        description: description,
        amount: parseFloat(amount),
        date: dateStr,
        dateRaw: now.toISOString()
    });
    await saveData(appData);
    window.appData = appData;

    appAddNotification('Matumizi Mapya ya Admin', `Admin amesajili matumizi mpya: "${description}" ya Tsh ${parseFloat(amount).toLocaleString()}.`);

    return true;
};

window.appGetExpensesList = function() {
    const list = [];

    const receipts = appData.rawMaterialsHistory || [];
    receipts.forEach(r => {
        list.push({
            date: r.date,
            dateRaw: r.dateRaw,
            description: `Kununua ${r.materialName} (${r.qty} ${r.unit})`,
            amount: r.qty * r.pricePerUnit,
            type: 'Stoo'
        });
    });

    const adminExps = appData.adminExpenses || [];
    adminExps.forEach(e => {
        list.push({
            date: e.date,
            dateRaw: e.dateRaw,
            description: e.description,
            amount: e.amount,
            type: 'Admin'
        });
    });

    const salaryList = appData.salaryList || [];
    salaryList.forEach(emp => {
        const payments = emp.payments || [];
        payments.forEach(p => {
            list.push({
                date: p.date,
                dateRaw: p.dateRaw || new Date().toISOString(),
                description: `Mshahara: ${emp.name} (${p.notes || 'Malipo ya sehemu'})`,
                amount: p.amount,
                type: 'Mshahara'
            });
        });
    });

    return list.sort((a,b) => {
        const timeA = a.dateRaw ? new Date(a.dateRaw).getTime() : 0;
        const timeB = b.dateRaw ? new Date(b.dateRaw).getTime() : 0;
        const valA = isNaN(timeA) ? 0 : timeA;
        const valB = isNaN(timeB) ? 0 : timeB;
        return valB - valA;
    });
};

window.appResetOverallStatsBaseline = async function() {
    if (!appData.finances) {
        appData.finances = {};
    }
    const now = new Date();
    appData.finances['overall_stats_baseline'] = {
        baselineDate: now.toISOString()
    };
    await saveData(appData);
    window.appData = appData;
    return true;
};

window.appGetOverallStatistics = function() {
    let totalSales = 0;
    const finances = appData.finances || {};
    const baselineDate = finances['overall_stats_baseline']?.baselineDate;
    let baselineTime = null;
    if (baselineDate) {
        const d = new Date(baselineDate);
        if (!isNaN(d.getTime())) {
            baselineTime = d.getTime();
        }
    }

    if (baselineTime !== null) {
        Object.keys(finances).forEach(shopId => {
            if (shopId === 'overall_stats_baseline') return;
            const shopFin = finances[shopId] || {};
            const salesHistory = shopFin.salesHistory || [];
            salesHistory.forEach(s => {
                if (s && s.dateRaw) {
                    const sTime = new Date(s.dateRaw).getTime();
                    if (!isNaN(sTime) && sTime >= baselineTime) {
                        totalSales += s.amount || 0;
                    }
                }
            });
        });
    } else {
        Object.keys(finances).forEach(shopId => {
            if (shopId === 'overall_stats_baseline') return;
            const shopFin = finances[shopId] || {};
            totalSales += shopFin.submitted || 0;
        });
    }

    let totalExpenses = 0;
    const expenses = window.appGetExpensesList();
    if (baselineTime !== null) {
        expenses.forEach(e => {
            if (e && e.dateRaw) {
                const eTime = new Date(e.dateRaw).getTime();
                if (!isNaN(eTime) && eTime >= baselineTime) {
                    totalExpenses += e.amount || 0;
                }
            }
        });
    } else {
        expenses.forEach(e => {
            totalExpenses += e.amount || 0;
        });
    }

    const netProfit = totalSales - totalExpenses;

    return {
        totalSales,
        totalExpenses,
        netProfit,
        isLoss: netProfit < 0
    };
};

window.appGetManufacturerMaterials = function(manufacturerId) {
    if (!appData.manufacturerMaterials) return [];
    const mIdUpper = (manufacturerId || '').toUpperCase().trim();

    const allKeys = Object.keys(appData.manufacturerMaterials);
    const matchedKey = allKeys.find(k => k.toUpperCase().trim() === mIdUpper);

    if (!matchedKey) return [];

    const mats = appData.manufacturerMaterials[matchedKey] || {};
    const list = [];
    Object.keys(mats).forEach(materialId => {
        const qty = Number(mats[materialId]) || 0;
        const rawMat = (appData.rawMaterials || []).find(m => m.id === materialId || m.name.toUpperCase() === materialId.toUpperCase());
        if (qty > 0) {
            list.push({
                materialId: materialId,
                name: rawMat ? rawMat.name : materialId.toUpperCase(),
                unit: rawMat ? rawMat.unit : 'Kilo',
                qty: qty
            });
        }
    });
    return list;
};

// ==========================================
// NGAE STAFF SALARY & CONTRACT MANAGEMENT
// ==========================================

window.appAddStaffSalary = async function(staffId, monthlySalary, paymentMethod, nida) {
    if (!appData.salaryList) {
        appData.salaryList = [];
    }

    const sRecord = appData.staff[staffId];
    if (!sRecord) return false;

    const exists = appData.salaryList.some(e => e.id === staffId);
    if (exists) return false;

    appData.salaryList.push({
        id: staffId,
        name: sRecord.name,
        role: sRecord.role,
        monthlySalary: parseFloat(monthlySalary),
        paymentMethod: paymentMethod,
        nida: nida || '',
        photo: '',
        contract: null,
        payments: []
    });

    await saveData(appData);
    window.appData = appData;

    appAddNotification('Mshahara Umesajiliwa', `Mshahara wa ${sRecord.name} (Tsh ${parseFloat(monthlySalary).toLocaleString()}/mwezi) umesajiliwa kwenye Ledger.`);

    return true;
};

window.appPaySalaryInstallment = async function(staffId, amount, method, notes) {
    if (!appData.salaryList) return false;
    const emp = appData.salaryList.find(e => e.id === staffId);
    if (!emp) return false;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    if (!emp.payments) emp.payments = [];
    emp.payments.push({
        id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6), // Required for Firestore sync
        date: dateStr,
        dateRaw: now.toISOString(),
        amount: parseFloat(amount),
        method: method,
        notes: notes || 'Malipo ya mshahara'
    });

    await saveData(appData);
    window.appData = appData;

    appAddNotification('Mshahara Umelipwa', `Malipo ya sehemu ya Tsh ${parseFloat(amount).toLocaleString()} kwa ${emp.name} yamefanyika kupitia ${method}.`);

    return true;
};

window.appSaveStaffContract = async function(staffId, contractObj) {
    if (!appData.salaryList) return false;
    const emp = appData.salaryList.find(e => e.id === staffId);
    if (!emp) return false;

    emp.contract = contractObj;
    await saveData(appData);
    window.appData = appData;
    return true;
};

window.appSaveStaffPhoto = async function(staffId, photoBase64) {
    if (!appData) appData = loadData();

    if (!appData.staff) appData.staff = {};
    if (appData.staff[staffId]) {
        appData.staff[staffId].photo = photoBase64;
    } else {
        appData.staff[staffId] = { name: 'OPERATOR STAFF', role: 'operator', photo: photoBase64 };
    }

    if (appData.salaryList) {
        const emp = appData.salaryList.find(e => e.id === staffId);
        if (emp) emp.photo = photoBase64;
    }

    await saveData(appData);
    window.appData = appData;
    return true;
};

// ==========================================
// OPERATOR DASHBOARD HELPER
// ==========================================
window.appGetOperatorStats = function(staffId = '') {
    if (!appData) appData = loadData();

    const totalReadyStock = (appData.products || []).reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
    const totalShopsCount = (appData.shops || []).length;

    let dispatchedValue = 0;
    (appData.dispatchHistory || []).forEach(h => {
        const prod = (appData.products || []).find(p => p.id === h.productId || p.name.toLowerCase() === (h.productName || '').toLowerCase());
        const unitPrice = prod ? (Number(prod.price) || 0) : (Number(h.unitPrice) || 0);
        dispatchedValue += (Number(h.quantity) || 0) * unitPrice;
    });

    const undispatchedValue = (appData.products || []).reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.price) || 0)), 0);

    const currentId = (localStorage.getItem('ngae_logged_in_id') || staffId || '').toUpperCase();
    const staffObj = (appData.staff && appData.staff[currentId]) ? appData.staff[currentId] : { name: localStorage.getItem('ngae_logged_in_name') || 'Mfanyakazi', role: 'operator' };

    let photo = staffObj.photo;
    if (!photo && appData.salaryList) {
        const emp = appData.salaryList.find(e => e.id === currentId);
        if (emp && emp.photo) photo = emp.photo;
    }

    if (!photo) {
        photo = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80';
    }

    return {
        totalReadyStock,
        totalShopsCount,
        dispatchedValue,
        undispatchedValue,
        staffInfo: {
            id: currentId,
            name: staffObj.name || localStorage.getItem('ngae_logged_in_name') || 'Mfanyakazi',
            role: staffObj.role || 'operator',
            department: 'Usafirishaji wa Mizigo',
            status: 'Active (Kazini)',
            photo: photo
        }
    };
};

// ==========================================
// STOREKEEPER DASHBOARD HELPER
// ==========================================
window.appGetStorekeeperStats = function(staffId = '') {
    if (!appData) appData = loadData();

    const receipts = appData.rawMaterialsHistory || [];
    const now = new Date();
    const todayStr = now.toDateString();

    let spendToday = 0;
    let spendWeek = 0;
    let spendMonth = 0;
    let spendYear = 0;

    receipts.forEach(r => {
        const rDate = new Date(r.dateRaw || r.date);
        const amount = (Number(r.qty) || 0) * (Number(r.pricePerUnit) || 0);

        if (!isNaN(rDate.getTime())) {
            if (rDate.toDateString() === todayStr) {
                spendToday += amount;
            }
            const diffTime = now.getTime() - rDate.getTime();
            const diffDays = diffTime / (1000 * 3600 * 24);
            if (diffDays >= 0 && diffDays <= 7) {
                spendWeek += amount;
            }
            if (rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear()) {
                spendMonth += amount;
            }
            if (rDate.getFullYear() === now.getFullYear()) {
                spendYear += amount;
            }
        } else {
            spendMonth += amount;
            spendYear += amount;
        }
    });

    const currentId = (localStorage.getItem('ngae_logged_in_id') || staffId || '').toUpperCase();
    const staffObj = (appData.staff && appData.staff[currentId]) ? appData.staff[currentId] : { name: localStorage.getItem('ngae_logged_in_name') || 'Mfanyakazi', role: 'storekeeper' };

    let photo = staffObj.photo;
    if (!photo && appData.salaryList) {
        const emp = appData.salaryList.find(e => e.id === currentId);
        if (emp && emp.photo) photo = emp.photo;
    }

    if (!photo) {
        photo = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80';
    }

    return {
        spendToday,
        spendWeek,
        spendMonth,
        spendYear,
        rawMaterialsCount: (appData.rawMaterials || []).length,
        staffInfo: {
            id: currentId,
            name: staffObj.name || localStorage.getItem('ngae_logged_in_name') || 'Mfanyakazi',
            role: staffObj.role || 'storekeeper',
            department: 'Stoo ya Malighafi (Raw Materials)',
            status: 'Active (Kazini)',
            photo: photo
        }
    };
};

// ==========================================
// SELLER DASHBOARD HELPER
// ==========================================
window.appGetSellerStats = function(sellerId) {
    if (!appData) appData = loadData();
    const currentId = (sellerId || localStorage.getItem('ngae_logged_in_id') || '').toUpperCase();
    const staffObj = (appData.staff && appData.staff[currentId]) ? appData.staff[currentId] : { name: localStorage.getItem('ngae_logged_in_name') || 'Mfanyakazi', role: 'seller', shopId: '' };

    // Resolve shop using staffObj.shopId first, fall back to matching sellerId, and default to mock blank shop
    const shop = (appData.shops || []).find(s => s.id === staffObj.shopId) || 
                 (appData.shops || []).find(s => s.sellerId === currentId) || 
                 { id: '', location: 'Duka Bado Halijasajiliwa', sellerName: staffObj.name || 'Mfanyakazi' };

    const receivedDispatches = shop.id ? (appData.dispatchHistory || []).filter(h => h.shopId === shop.id) : [];
    let totalCargoValue = 0;
    receivedDispatches.forEach(item => {
        const itemVal = Number(item.totalValue) || ((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0));
        totalCargoValue += itemVal;
    });

    const shopFinance = (shop.id && appData.finances && appData.finances[shop.id]) ? appData.finances[shop.id] : { submitted: 0, reportedDebt: 0, salesHistory: [], personalExpenses: [] };
    const totalSubmittedCash = shopFinance.submitted || 0;
    const remainingDebt = Math.max(0, totalCargoValue - totalSubmittedCash);

    // Smart Stock indicator: sufficient if remaining is >= 1,000,000 OR if small shop and they still have >= 50% of what was received
    const isStockSufficient = shop.id ? (remainingDebt >= 1000000 || (totalCargoValue < 1000000 && remainingDebt >= totalCargoValue * 0.5)) : false;
    const storeStatusText = isStockSufficient ? "VITU BADO VIPO DUKANI" : "VITU VINAELEKEA KUISHA";

    const shopRankings = (appData.shops || []).map(s => {
        const fin = (appData.finances && appData.finances[s.id]) ? appData.finances[s.id] : { submitted: 0 };
        return {
            shopId: s.id,
            location: s.location,
            sellerName: s.sellerName,
            submitted: fin.submitted || 0
        };
    }).sort((a, b) => b.submitted - a.submitted);

    const rankIndex = shopRankings.findIndex(r => r.shopId === shop.id);
    const userRank = rankIndex !== -1 ? rankIndex + 1 : 1;
    const totalShopsCount = shopRankings.length || 1;
    const topShop = shopRankings[0] || shop;

    let photo = staffObj.photo;
    if (!photo && appData.salaryList) {
        const emp = appData.salaryList.find(e => e.id === currentId);
        if (emp && emp.photo) photo = emp.photo;
    }
    if (!photo) {
        photo = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80';
    }

    return {
        shop,
        staffInfo: {
            id: currentId,
            name: staffObj.name || shop.sellerName || 'Mfanyakazi',
            role: staffObj.role || 'seller',
            shopLocation: shop.location,
            photo: photo
        },
        totalCargoValue,
        totalSubmittedCash,
        remainingDebt,
        reportedDebt: shopFinance.reportedDebt || 0,
        isStockSufficient,
        storeStatusText,
        userRank,
        totalShopsCount,
        topShopName: topShop.sellerName || topShop.location,
        receivedDispatches,
        salesHistory: shopFinance.salesHistory || [],
        personalExpenses: shopFinance.personalExpenses || []
    };
};

// ==========================================
// MANUFACTURER DASHBOARD HELPER
// ==========================================
window.appGetManufacturerStats = function(manufacturerId = '') {
    if (!appData) appData = loadData();

    const log = appData.productionLog || [];
    const now = new Date();
    const todayStr = now.toDateString();

    let prodToday = 0;
    let prodMonth = 0;
    let prodYear = 0;
    let prodTotalItems = 0;
    const prodTypesSet = new Set();

    log.forEach(entry => {
        const qty = Number(entry.quantity) || 0;
        prodTotalItems += qty;

        if (entry.productId) prodTypesSet.add(entry.productId);
        else if (entry.productName) prodTypesSet.add(entry.productName);

        const d = new Date(entry.dateRaw || entry.date);
        if (!isNaN(d.getTime())) {
            if (d.getFullYear() === now.getFullYear()) {
                prodYear += qty;
                if (d.getMonth() === now.getMonth()) {
                    prodMonth += qty;
                    if (d.toDateString() === todayStr) {
                        prodToday += qty;
                    }
                }
            }
        } else {
            prodMonth += qty;
            prodYear += qty;
        }
    });

    const totalProductCatalogCount = (appData.products || []).length;
    const uniqueProducedTypesCount = prodTypesSet.size > 0 ? prodTypesSet.size : totalProductCatalogCount;

    const currentId = (localStorage.getItem('ngae_logged_in_id') || manufacturerId || '').toUpperCase();
    const staffObj = (appData.staff && appData.staff[currentId]) ? appData.staff[currentId] : { name: 'Mfanyakazi', role: 'manufacturer' };

    let photo = staffObj.photo;
    if (!photo && appData.salaryList) {
        const emp = appData.salaryList.find(e => e.id === currentId);
        if (emp && emp.photo) photo = emp.photo;
    }

    if (!photo) {
        photo = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';
    }

    return {
        prodToday,
        prodMonth,
        prodYear,
        prodTotalItems,
        prodTypesCount: uniqueProducedTypesCount,
        totalCatalogCount: totalProductCatalogCount,
        staffInfo: {
            id: currentId,
            name: staffObj.name || localStorage.getItem('ngae_logged_in_name') || 'Mfanyakazi',
            role: staffObj.role || 'manufacturer',
            department: 'Uzalishaji (Production)',
            status: 'Active (Kazini)',
            photo: photo
        }
    };
};

// ==========================================
// HOMEPAGE - Update cart badge count
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('cartBadgeCount');
    if (badge) {
        const count = appData.customerOrders ? appData.customerOrders.length : 0;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'block';
        }
    }

    // Usikilize mabadiliko ya data kutoka vifaa vingine
    window.addEventListener('ngae-data-updated', () => {
        const badge2 = document.getElementById('cartBadgeCount');
        if (badge2) {
            const count2 = appData.customerOrders ? appData.customerOrders.length : 0;
            badge2.textContent = count2;
            badge2.style.display = count2 > 0 ? 'block' : 'none';
        }
    });
});

console.log("NGAE Food App initialized. Products:", appData.products.length, "| Orders:", appData.customerOrders.length, "| Firebase:", _firebaseReady ? "Γ£à ON" : "ΓÜá∩╕Å OFF (localStorage only)");