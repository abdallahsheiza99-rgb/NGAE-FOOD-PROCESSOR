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
 * MABADILIKO: localStorage → Firebase Firestore (real-time sync kati ya vifaa vyote)
 */

// ==========================================
// FIREBASE INITIALIZATION
// ==========================================

// Firebase imeingizwa kupitia CDN kwenye HTML files
const STORAGE_KEY = 'ngae_app_data'; // Bado tunalinda kwa localStorage kama backup

let _db = null;          // Firestore instance
let _firebaseReady = false;
let _syncListenerActive = false;
const FIRESTORE_DOC = 'main'; // Jina la document kwenye Firestore
const FIRESTORE_COLLECTION = 'ngae_data'; // Jina la collection kwenye Firestore

// Kuzuia race condition: snapshot listener isifute data tuliyoandika sisi wenyewe
let _lastSaveTimestamp = 0;
const SAVE_GRACE_PERIOD_MS = 3000; // Subiri sekunde 3 kabla ya kukubali data kutoka nje

/**
 * Anzisha Firebase na Firestore
 * Hii inaitwa mara moja ukurasa ukianza
 */
function initFirebase() {
    try {
        const config = window.FIREBASE_CONFIG;
        if (!config || config.apiKey === 'WEKA_API_KEY_YAKO_HAPA') {
            console.warn('[NGAE] Firebase config haijajazwa. Taarifa zitahifadhiwa kwenye localStorage tu (kifaa kimoja).');
            console.warn('[NGAE] Fungua firebase-config.js uweke config yako ya Firebase ili uwezesha sync kati ya vifaa.');
            _firebaseReady = false;
            return;
        }

        // Angalia kama Firebase tayari imeanziishwa
        if (firebase.apps && firebase.apps.length === 0) {
            firebase.initializeApp(config);
        }
        _db = firebase.firestore();
        _firebaseReady = true;
        console.log('[NGAE] ✅ Firebase imeanzishwa. Firestore inapatikana.');
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
    if (!data.products) data.products = [];
    if (!data.shops) data.shops = [];
    if (!data.rawMaterials) data.rawMaterials = [];
    if (!data.dispatchHistory) data.dispatchHistory = [];
    if (!data.rawMaterialsHistory) data.rawMaterialsHistory = [];
    if (!data.rawMaterialsDispatchHistory) data.rawMaterialsDispatchHistory = [];
    if (!data.productionLog) data.productionLog = [];
    if (!data.finances) data.finances = {};
    if (!data.customerOrders) data.customerOrders = [];
    if (!data.cashFlow) data.cashFlow = { balance: 0, transactions: [] };
    if (!data.suggestions) data.suggestions = [];
    if (!data.notifications) data.notifications = [];
    if (!data.manufacturerMaterials) data.manufacturerMaterials = {};
    if (!data.adminExpenses) data.adminExpenses = [];
    if (!data.salaryList) data.salaryList = [];

    return data;
}

/**
 * Merges local appData and remote Firestore data intelligently so that no
 * production logs, dispatches, receipts, or financial records are EVER lost.
 */
function _mergeAppData(local, remote) {
    local = _ensureFields(local || {});
    remote = _ensureFields(remote || {});

    // Helper: merge array of objects using unique identifier signature
    function mergeArrays(arr1, arr2, keyFn) {
        const map = new Map();
        (arr1 || []).forEach(item => {
            if (!item) return;
            const k = keyFn(item);
            map.set(k, item);
        });
        (arr2 || []).forEach(item => {
            if (!item) return;
            const k = keyFn(item);
            if (!map.has(k)) {
                map.set(k, item);
            } else {
                map.set(k, Object.assign({}, map.get(k), item));
            }
        });
        return Array.from(map.values());
    }

    // Key signatures for historical logs
    const logSig = item => item.id || `${item.dateRaw || item.date}_${item.productId || item.materialId || item.productName || item.materialName}_${item.quantity || item.qty || item.amount}`;
    const shopSig = item => (item.id || item.location || '').toString().toUpperCase().trim();
    const prodSig = item => (item.id || item.name || '').toString().toUpperCase().trim();

    // 1. Merge Logs & Histories (UNION - Never Delete)
    const productionLog = mergeArrays(local.productionLog, remote.productionLog, logSig);
    const dispatchHistory = mergeArrays(local.dispatchHistory, remote.dispatchHistory, logSig);
    const rawMaterialsHistory = mergeArrays(local.rawMaterialsHistory, remote.rawMaterialsHistory, logSig);
    const rawMaterialsDispatchHistory = mergeArrays(local.rawMaterialsDispatchHistory, remote.rawMaterialsDispatchHistory, logSig);
    const customerOrders = mergeArrays(local.customerOrders, remote.customerOrders, o => o.id || `${o.customer_name}_${o.dateRaw}`);
    const adminExpenses = mergeArrays(local.adminExpenses, remote.adminExpenses, e => e.id || `${e.description}_${e.amount}`);
    const suggestions = mergeArrays(local.suggestions, remote.suggestions, s => s.id || `${s.senderId}_${s.dateRaw}`);
    const notifications = mergeArrays(local.notifications, remote.notifications, n => n.id || `${n.title}_${n.dateRaw}`);
    const salaryList = (remote.salaryList && remote.salaryList.length > 0) ? remote.salaryList : (local.salaryList || []);

    // 2. Merge Staff Accounts (Remote override, fallback to local if remote empty)
    const staff = (remote.staff && Object.keys(remote.staff).length > 0) ? remote.staff : (local.staff || {});

    // 3. Merge Products & Catalog (Remote override, fallback to local if remote empty)
    const products = (remote.products && remote.products.length > 0) ? remote.products : (local.products || []);

    // 4. Merge Shops (Remote override, fallback to local if remote empty)
    const shops = (remote.shops && remote.shops.length > 0) ? remote.shops : (local.shops || []);

    // 5. Merge Raw Materials (Remote override, fallback to local if remote empty)
    const rawMaterials = (remote.rawMaterials && remote.rawMaterials.length > 0) ? remote.rawMaterials : (local.rawMaterials || []);

    // 6. Merge Manufacturer Materials
    const manufacturerMaterials = Object.assign({}, remote.manufacturerMaterials || {}, local.manufacturerMaterials || {});
    Object.keys(local.manufacturerMaterials || {}).forEach(mId => {
        const upper = mId.toUpperCase().trim();
        if (!manufacturerMaterials[upper]) manufacturerMaterials[upper] = {};
        Object.assign(manufacturerMaterials[upper], local.manufacturerMaterials[mId]);
    });

    // 7. Merge Finances by shopId
    const finances = Object.assign({}, remote.finances || {}, local.finances || {});
    Object.keys(local.finances || {}).forEach(shopId => {
        if (!finances[shopId]) {
            finances[shopId] = local.finances[shopId];
        } else {
            const locFin = local.finances[shopId];
            const remFin = finances[shopId];
            const mergedSales = mergeArrays(locFin.salesHistory, remFin.salesHistory, s => s.id || `${s.dateRaw}_${s.amount}`);
            const mergedExp = mergeArrays(locFin.personalExpenses, remFin.personalExpenses, e => e.id || `${e.dateRaw}_${e.amount}`);
            
            let sumSubmitted = 0;
            mergedSales.forEach(s => sumSubmitted += (Number(s.amount) || 0));

            finances[shopId] = {
                submitted: Math.max(sumSubmitted, Number(remFin.submitted) || 0, Number(locFin.submitted) || 0),
                reportedDebt: Number(remFin.reportedDebt) || Number(locFin.reportedDebt) || 0,
                salesHistory: mergedSales,
                personalExpenses: mergedExp
            };
        }
    });

    // 8. Merge Cash Flow
    const localCF = local.cashFlow || { balance: 0, transactions: [] };
    const remoteCF = remote.cashFlow || { balance: 0, transactions: [] };
    const mergedTransactions = mergeArrays(localCF.transactions, remoteCF.transactions, t => t.id || `${t.dateRaw}_${t.amount}_${t.type}`);
    let cfBal = 0;
    mergedTransactions.forEach(t => {
        if (t.type === 'IN') cfBal += (Number(t.amount) || 0);
        else if (t.type === 'OUT') cfBal -= (Number(t.amount) || 0);
    });
    const cashFlow = { balance: cfBal, transactions: mergedTransactions };

    const mergedData = _ensureFields({
        staff,
        products,
        shops,
        rawMaterials,
        dispatchHistory,
        rawMaterialsHistory,
        rawMaterialsDispatchHistory,
        productionLog,
        finances,
        customerOrders,
        cashFlow,
        suggestions,
        notifications,
        manufacturerMaterials,
        adminExpenses,
        salaryList
    });

    return _recalculateAllStocks(mergedData);
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
 * Hifadhi data:
 * 1. Smart merge na localStorage (mara moja - offline support)
 * 2. Firestore (real-time sync kwa vifaa vyote)
 */
function saveData(data) {
    appData = data;
    window.appData = appData;

    // 1. Hifadhi kwenye localStorage haraka
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));

    // 2. Rekodi muda wa save
    _lastSaveTimestamp = Date.now();

    // 3. Hifadhi kwenye Firestore (async - background) - Bila merge option ili kuruhusu deletion ya staff/products
    if (_firebaseReady && _db) {
        _db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC)
            .set(appData)
            .catch(err => {
                console.error('[NGAE] Firestore save error:', err.message);
            });
    }
}

/**
 * Anzisha real-time listener ya Firestore.
 * Ukibadilika taarifa kwenye kifaa kingine, ukurasa huu unasasishwa otomatiki.
 */
function startRealtimeSync() {
    if (!_firebaseReady || !_db || _syncListenerActive) return;

    _syncListenerActive = true;
    console.log('[NGAE] 🔄 Real-time sync imeanzishwa...');

    _db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC)
        .onSnapshot({ includeMetadataChanges: true }, doc => {
            if (doc.metadata && doc.metadata.hasPendingWrites) {
                console.log('[NGAE] ⏳ Local write pending - snapshot inapuuzwa.');
                return;
            }

            if (doc.exists) {
                const remoteData = doc.data();
                const mergedData = _mergeAppData(appData, remoteData);

                const currentStr = JSON.stringify(appData);
                const remoteStr = JSON.stringify(remoteData);
                const mergedStr = JSON.stringify(mergedData);

                let localUpdated = false;
                if (currentStr !== mergedStr) {
                    console.log('[NGAE] 📥 Data mpya kutoka kifaa kingine — inasasisha kikamilifu...');
                    appData = mergedData;
                    window.appData = appData;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
                    localUpdated = true;
                }

                // Ikiwa remoteData haina baadhi ya taarifa ambazo zipo kwenye mergedData (k.m. wakati wa merge conflicts),
                // andika mergedData kurudi kwenye Firestore ili isipotee kwenye server!
                if (remoteStr !== mergedStr) {
                    console.log('[NGAE] 📤 Server haina baadhi ya data za hapa — inasawazisha server na data mpya...');
                    _db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC)
                        .set(mergedData)
                        .catch(err => {
                            console.error('[NGAE] Firestore sync-back error:', err.message);
                        });
                }

                if (localUpdated) {
                    window.dispatchEvent(new CustomEvent('ngae-data-updated', { detail: appData }));
                    _refreshUIIfPossible();
                }
            } else {
                console.log('[NGAE] 📤 Inapakia data ya sasa kwenye Firestore kwa mara ya kwanza...');
                saveData(appData);
            }
        }, err => {
            console.error('[NGAE] Firestore listener error:', err.message);
        });
}

/**
 * Pakia data kutoka Firestore mara moja ukurasa unapoanza.
 */
async function loadFromFirestore() {
    if (!_firebaseReady || !_db) return;

    try {
        console.log('[NGAE] 📡 Inapakia data kutoka Firestore...');
        const doc = await _db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC).get();
        if (doc.exists) {
            const remoteData = doc.data();
            const mergedData = _mergeAppData(appData, remoteData);

            const remoteStr = JSON.stringify(remoteData);
            const mergedStr = JSON.stringify(mergedData);

            appData = mergedData;
            window.appData = appData;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));

            console.log('[NGAE] ✅ Data imepakiwa na ku-merge kutoka Firestore.');

            // Ikiwa remoteData haina baadhi ya taarifa ambazo zipo kwenye local au zimeunganishwa, sawazisha server
            if (remoteStr !== mergedStr) {
                console.log('[NGAE] 📤 Inasawazisha server baada ya load...');
                _db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC)
                    .set(mergedData)
                    .catch(err => console.error('[NGAE] Firestore load-sync error:', err.message));
            }

            window.dispatchEvent(new CustomEvent('ngae-data-updated', { detail: appData }));
            _refreshUIIfPossible();
        } else {
            console.log('[NGAE] 📤 Hakuna data Firestore. Inahamisha localStorage → Firestore...');
            _lastSaveTimestamp = 0;
            saveData(appData);
        }
    } catch (e) {
        console.warn('[NGAE] ⚠️ Haikuweza kupakia Firestore (labda offline):', e.message);
    }
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
        id: 'notif_' + Math.random().toString(36).substr(2, 9),
        title: title,
        message: message,
        date: `${dateStr} ${timeStr}`,
        dateRaw: now.toISOString(),
        read: false
    });
    saveData(appData);
    window.appData = appData;
}

// ==========================================
// APP STATE - Loaded Once
// ==========================================
let appData = _recalculateAllStocks(loadData());
window.appData = appData;

// Anzisha Firebase (async - background)
initFirebase();

// Pakia data ya hivi karibuni kutoka Firestore, halafu anza real-time sync
(async () => {
    await loadFromFirestore();
    startRealtimeSync();
})();

// Automatic Sync on network reconnection (online event)
window.addEventListener('online', async () => {
    console.log('[NGAE] 📶 Device went online. Synchronizing data...');
    if (!_firebaseReady) {
        initFirebase();
    }
    if (_firebaseReady && _db) {
        await loadFromFirestore();
        startRealtimeSync();
    }
});

// ==========================================
// PRODUCT MANAGEMENT API
// ==========================================

window.appGetProducts = function() {
    return appData.products || [];
};

window.appAddProduct = function(name, price, stock = 0) {
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
    saveData(appData);
    window.appData = appData;

    if (window.appAddNotification) {
        appAddNotification('Bidhaa Mpya Imesajiliwa', `Bidhaa "${formattedName}" yenye bei ya Tsh ${(parseFloat(price)||0).toLocaleString()} imesajiliwa kikamilifu.`);
    }
    return { success: true, product };
};

window.appUpdateProduct = function(id, name, price, stock) {
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
    saveData(appData);
    window.appData = appData;

    if (window.appAddNotification) {
        appAddNotification('Bidhaa Imerekebishwa', `Taarifa za bidhaa "${product.name}" (zamani: ${oldName}) zimesasishwa.`);
    }
    return true;
};

window.appDeleteProduct = function(id) {
    if (!appData.products) return false;
    const prod = appData.products.find(p => p.id === id);
    appData.products = appData.products.filter(p => p.id !== id);
    saveData(appData);
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

window.appDispatchProduct = function(productId, shopId, qty, unit) {
    const product = appData.products.find(p => p.id === productId);
    const shop = appData.shops.find(s => s.id === shopId);
    const numQty = Number(qty) || 0;

    if (!product || !shop || numQty <= 0) return false;
    if ((Number(product.stock) || 0) < numQty) return false;

    product.stock = (Number(product.stock) || 0) - numQty;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    appData.dispatchHistory.push({
        id: 'disp_log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        date: dateStr,
        dateRaw: now.toISOString(),
        productId: product.id,
        productName: product.name,
        shopId: shop.id,
        shopLocation: shop.location,
        quantity: numQty,
        unitPrice: Number(product.price) || 0,
        totalValue: (Number(product.price) || 0) * numQty,
        unit: unit || 'pcs'
    });

    if (!appData.finances[shop.id]) {
        appData.finances[shop.id] = { submitted: 0, reportedDebt: 0, salesHistory: [], personalExpenses: [] };
    }

    saveData(appData);
    window.appData = appData;

    appAddNotification('Usafirishaji Mpya', `Operator amesafirisha ${numQty} ${unit || 'pcs'} ya ${product.name} kwenda duka la ${shop.location}.`);

    return true;
};

// ==========================================
// SELLER FUNCTIONS
// ==========================================

window.appSubmitSales = function(amount, notes) {
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

    saveData(appData);
    window.appData = appData;

    const shopLoc = appData.shops.find(s => s.id === shopId)?.location || 'dukani';
    appAddNotification('Mauzo Yaliyowasilishwa', `Muuzaji wa duka la ${shopLoc} amewasilisha mauzo ya Tsh ${numAmount.toLocaleString()}.`);

    return true;
};

window.appReportDebt = function(amount, reason) {
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
    saveData(appData);
    window.appData = appData;
    return true;
};

window.appAddSellerExpense = function(amount, description, category, date, notes) {
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

    saveData(appData);
    window.appData = appData;
    return true;
};

// ==========================================
// STORE KEEPER FUNCTIONS
// ==========================================

window.appReceiveMaterial = function(materialName, unit, qty, pricePerUnit) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const numQty = Number(qty) || 0;
    const numPrice = Number(pricePerUnit) || 0;

    let mat = appData.rawMaterials.find(m => m.name.toUpperCase() === materialName.toUpperCase());
    if (!mat) {
        mat = { id: 'mat_' + materialName.toLowerCase().replace(/\s+/g,'_'), name: materialName.toUpperCase(), unit: unit, stock: 0 };
        appData.rawMaterials.push(mat);
    }

    mat.stock = (Number(mat.stock) || 0) + numQty;

    appData.rawMaterialsHistory.push({
        id: 'mat_rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        date: dateStr,
        dateRaw: now.toISOString(),
        materialName: mat.name,
        materialId: mat.id,
        unit: unit,
        qty: numQty,
        pricePerUnit: numPrice
    });

    saveData(appData);
    window.appData = appData;

    appAddNotification('Malighafi Zimepokelewa', `Stoo imepokea ${numQty} ${unit} za ${mat.name} kutoka kwa msambazaji.`);

    return true;
};

window.appDispatchMaterial = function(materialId, qty, manufacturerId) {
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

    saveData(appData);
    window.appData = appData;

    appAddNotification('Malighafi Zimetolewa', `Stoo imetoa ${numQty} ${mat.unit} za ${mat.name} kwenda kwa ${manufacturerName}.`);

    return true;
};

// ==========================================
// MANUFACTURER FUNCTIONS
// ==========================================

window.appRecordProduction = function(productId, qty, notes) {
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

    saveData(appData);
    window.appData = appData;

    if (window.appAddNotification) {
        appAddNotification('Uzalishaji Mpya', `Kiwanda kimesajili uzalishaji wa ${numQty} pcs za ${product.name}. Bakaa mpya stoo: ${product.stock} pcs.`);
    }

    return true;
};

// ==========================================
// ADMIN STORE & PRODUCTION OVERRIDE FUNCTIONS
// ==========================================

window.appAdminEditRawMaterial = function(materialId, name, unit, stock) {
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

    saveData(appData);
    window.appData = appData;
    return true;
};

window.appAdminDeleteRawMaterial = function(materialId) {
    if (!appData.rawMaterials) return false;
    appData.rawMaterials = appData.rawMaterials.filter(m => m.id !== materialId);
    saveData(appData);
    window.appData = appData;
    return true;
};

window.appAdminEditProductionLog = function(logId, newQty, newNotes) {
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

    saveData(appData);
    window.appData = appData;
    return true;
};

window.appAdminDeleteProductionLog = function(logId) {
    if (!appData.productionLog) return false;
    const entry = appData.productionLog.find(l => l.id === logId);
    if (!entry) return false;

    const qty = Number(entry.quantity) || 0;
    const prod = (appData.products || []).find(p => p.id === entry.productId || p.name.toUpperCase() === entry.productName.toUpperCase());
    if (prod) {
        prod.stock = Math.max(0, (Number(prod.stock) || 0) - qty);
    }

    appData.productionLog = appData.productionLog.filter(l => l.id !== logId);
    saveData(appData);
    window.appData = appData;
    return true;
};

// ==========================================
// CUSTOMER ORDER FUNCTIONS
// ==========================================

window.appPlaceOrder = function({ customer_name, phone, region, district, ward, street, items, total }) {
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
    saveData(appData);
    window.appData = appData;
    return orderId;
};

window.appTrackOrder = function(orderId) {
    return appData.customerOrders.find(o => o.id === orderId.toUpperCase()) || null;
};

// ==========================================
// ADMIN FUNCTIONS
// ==========================================

window.appAddStaff = function(name, role, customId, photo) {
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
    saveData(appData);
    window.appData = appData;
    return newId;
};

window.appDeleteStaff = function(staffId) {
    const staffObj = appData.staff[staffId];
    if (staffObj) {
        if (staffObj.role === 'seller' && staffObj.shopId) {
            appData.shops = (appData.shops || []).filter(s => s.id !== staffObj.shopId);
        }
        delete appData.staff[staffId];
        saveData(appData);
        window.appData = appData;
        return true;
    }
    return false;
};

// ==========================================
// CASH FLOWING FUNCTIONS (ADMIN PERSONAL)
// ==========================================

window.appAddPersonalCash = function(amount, description) {
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

    saveData(appData);
    window.appData = appData;
    return true;
};

window.appAddPersonalExpense = function(amount, description) {
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

    saveData(appData);
    window.appData = appData;
    return true;
};

window.appGetPersonalCashFlowStats = function() {
    if (!appData.cashFlow || !appData.cashFlow.transactions) {
        return { today: 0, week: 0, month: 0, year: 0 };
    }

    const now = new Date();
    let today = 0, week = 0, month = 0, year = 0;

    appData.cashFlow.transactions.forEach(t => {
        if (t.type === 'IN') {
            const tDate = new Date(t.dateRaw);

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
// STAFF SUGGESTIONS & FEEDBACK (MAPENDEKEZO)
// ==========================================

window.appSubmitSuggestion = function(message) {
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

    saveData(appData);
    window.appData = appData;
    return true;
};

window.appReplyToSuggestion = function(suggestionId, replyText) {
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

    saveData(appData);
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

window.appMarkNotificationsAsRead = function() {
    if (!appData.notifications) return;
    appData.notifications.forEach(n => n.read = true);
    saveData(appData);
    window.appData = appData;
};

window.appClearNotifications = function() {
    appData.notifications = [];
    saveData(appData);
    window.appData = appData;
};

// ==========================================
// ADMIN EXPENSES & OVERALL STATISTICS
// ==========================================

window.appAddAdminExpense = function(description, amount) {
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
    saveData(appData);
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

    return list.sort((a,b) => new Date(b.dateRaw) - new Date(a.dateRaw));
};

window.appGetOverallStatistics = function() {
    let totalSales = 0;
    const finances = appData.finances || {};
    Object.values(finances).forEach(f => {
        totalSales += f.submitted || 0;
    });

    let totalExpenses = 0;
    const expenses = window.appGetExpensesList();
    expenses.forEach(e => {
        totalExpenses += e.amount;
    });

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

window.appAddStaffSalary = function(staffId, monthlySalary, paymentMethod, nida) {
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

    saveData(appData);
    window.appData = appData;

    appAddNotification('Mshahara Umesajiliwa', `Mshahara wa ${sRecord.name} (Tsh ${parseFloat(monthlySalary).toLocaleString()}/mwezi) umesajiliwa kwenye Ledger.`);

    return true;
};

window.appPaySalaryInstallment = function(staffId, amount, method, notes) {
    if (!appData.salaryList) return false;
    const emp = appData.salaryList.find(e => e.id === staffId);
    if (!emp) return false;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    if (!emp.payments) emp.payments = [];
    emp.payments.push({
        date: dateStr,
        dateRaw: now.toISOString(),
        amount: parseFloat(amount),
        method: method,
        notes: notes || 'Malipo ya mshahara'
    });

    saveData(appData);
    window.appData = appData;

    appAddNotification('Mshahara Umelipwa', `Malipo ya sehemu ya Tsh ${parseFloat(amount).toLocaleString()} kwa ${emp.name} yamefanyika kupitia ${method}.`);

    return true;
};

window.appSaveStaffContract = function(staffId, contractObj) {
    if (!appData.salaryList) return false;
    const emp = appData.salaryList.find(e => e.id === staffId);
    if (!emp) return false;

    emp.contract = contractObj;
    saveData(appData);
    window.appData = appData;
    return true;
};

window.appSaveStaffPhoto = function(staffId, photoBase64) {
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

    saveData(appData);
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

console.log("NGAE Food App initialized. Products:", appData.products.length, "| Orders:", appData.customerOrders.length, "| Firebase:", _firebaseReady ? "✅ ON" : "⚠️ OFF (localStorage only)");
