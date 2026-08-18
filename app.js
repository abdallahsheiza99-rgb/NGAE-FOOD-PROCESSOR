/**
 * NGAE FOOD PROCESSORS HUB
 * Core Application Logic - Client-Side (LocalStorage)
 * 
 * Staff Accounts (Role -> Valid IDs):
 *   operator     -> NGAE001 (MUSSA AMIRI SHEIZA)
 *   seller       -> NGAE016 (ISSAYA KAKOA - SONI)
 *                   NGAE017 (ZAINABU HINYA - LUSHOTO)
 *   storekeeper  -> NGAE021 (MR ACADEMIA)
 *   manufacturer -> NGAE027 (DULLAH SHEIZA)
 */

// ==========================================
// STATIC DATA (Seed Data)
// ==========================================

const INITIAL_STAFF = {
    'NGAE001': { name: 'MUSSA AMIRI SHEIZA', role: 'operator', photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80' },
    'NGAE002': { name: 'AMANI STAFF', role: 'operator', photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80' },
    'NGAE016': { name: 'ISSAYA KAKOA', role: 'seller', shopId: 'shop_soni' },
    'NGAE017': { name: 'ZAINABU HINYA (ZAISHA)', role: 'seller', shopId: 'shop_lushoto' },
    'NGAE018': { name: 'SONI ISLAMIC', role: 'seller', shopId: 'shop_mwalimu' },
    'NGAE019': { name: 'LWANDAI SECONDARY', role: 'seller', shopId: 'shop_lwandai' },
    'NGAE020': { name: 'ROSMIN', role: 'seller', shopId: 'shop_rosmin' },
    'NGAE021': { name: 'MR ACADEMIA', role: 'storekeeper' },
    'NGAE022': { name: 'STORE ASSIST', role: 'storekeeper' },
    'NGAE027': { name: 'DULLAH SHEIZA', role: 'manufacturer' },
    'NGAE028': { name: 'FACTORY WORKER', role: 'manufacturer' },
};

const INITIAL_PRODUCTS = [
    { id: 'p_andazi', name: 'ANDAZI', price: 1000, stock: 21112 },
    { id: 'p_andazi_kavu', name: 'ANDAZI KAVU', price: 1000, stock: 32 },
    { id: 'p_bend_rose', name: 'BEND ROSE', price: 1000, stock: 26477 },
    { id: 'p_big_sadoline', name: 'BIG SIZE SADOLINE', price: 8000, stock: 9759 },
    { id: 'p_bingo', name: 'BINGO', price: 500, stock: 15756 },
    { id: 'p_biscuit_300', name: 'BISCUIT YA MIA TATU', price: 300, stock: 4641 },
    { id: 'p_cake_kubwa', name: 'CAKE KUBWA', price: 7000, stock: 2709 },
    { id: 'p_cake_vpnd', name: 'CAKE VPND', price: 1000, stock: 28408 },
    { id: 'p_cinamon', name: 'CINAMON', price: 500, stock: 18029 },
    { id: 'p_cup_cake', name: 'CUP CAKE', price: 5000, stock: 943 },
    { id: 'p_donat', name: 'DONAT', price: 1000, stock: 13632 },
    { id: 'p_islamic_kubwa', name: 'ISLAMIC (scones kubwa)', price: 200, stock: 88520 },
    { id: 'p_islamic_ndogo', name: 'ISLAMIC (scones ndogo)', price: 100, stock: 75135 },
    { id: 'p_kfp', name: 'K.F.P', price: 1000, stock: 36786 },
    { id: 'p_ndizi', name: 'NDIZI', price: 1000, stock: 9457 },
    { id: 'p_r_sless', name: 'R.SLESS', price: 1500, stock: 18418 },
    { id: 'p_round', name: 'ROUND', price: 800, stock: 15554 },
    { id: 'p_round_kubwa', name: 'ROUND KUBWA', price: 1000, stock: 113 },
    { id: 'p_scones', name: 'SCONES', price: 1000, stock: 4890 },
    { id: 'p_scones_lwandai', name: 'SCONES LWANDAI SECONDARY', price: 1000, stock: 3010 },
    { id: 'p_small_biscuits', name: 'SMALL SIZE BISCUITS', price: 4000, stock: 1983 },
    { id: 'p_super', name: 'SUPER', price: 2000, stock: 29104 },
    { id: 'p_zain', name: 'ZAIN', price: 1000, stock: 18161 },
];

const INITIAL_SHOPS = [
    { id: 'shop_soni', location: 'TANGA, SONI', sellerName: 'ISSAYA KAKOA', sellerId: 'NGAE016' },
    { id: 'shop_lushoto', location: 'TANGA, LUSHOTO', sellerName: 'ZAINABU HINYA (ZAISHA)', sellerId: 'NGAE017' },
    { id: 'shop_mwalimu', location: 'TANGA, mwalimu wa zamu', sellerName: 'SONI ISLAMIC', sellerId: 'NGAE018' },
    { id: 'shop_lwandai', location: 'TANGA, LUSHTO LWANDAI', sellerName: 'LWANDAI SECONDARY', sellerId: 'NGAE019' },
    { id: 'shop_rosmin', location: 'TANGA, lushoto', sellerName: 'ROSMIN', sellerId: 'NGAE020' },
    { id: 'shop_cathy', location: 'TANGA, lushoto CATHY', sellerName: 'CATHY HAMMER SECONDARY', sellerId: 'NGAE025' },
];

const INITIAL_RAW_MATERIALS = [
    { id: 'mat_ngano', name: 'Ngano', unit: 'Kilo', stock: 18000 },
    { id: 'mat_mafuta', name: 'Mafuta ya Kupikia', unit: 'Lita', stock: 40 },
    { id: 'mat_umeme', name: 'Umeme', unit: 'Lita', stock: 1192 },
];

const INITIAL_DISPATCH_HISTORY = [
    { date: '16 Aug 2026', productId: 'p_andazi', productName: 'ANDAZI', shopId: 'shop_soni', shopLocation: 'TANGA (SONI)', quantity: 205, unit: 'pcs' },
    { date: '16 Aug 2026', productId: 'p_andazi_kavu', productName: 'ANDAZI KAVU', shopId: 'shop_soni', shopLocation: 'TANGA (SONI)', quantity: 18, unit: 'pcs' },
    { date: '16 Aug 2026', productId: 'p_round', productName: 'ROUND', shopId: 'shop_soni', shopLocation: 'TANGA (SONI)', quantity: 105, unit: 'pcs' },
    { date: '14 Aug 2026', productId: 'p_andazi', productName: 'ANDAZI', shopId: 'shop_soni', shopLocation: 'TANGA (SONI)', quantity: 452, unit: 'pcs' },
    { date: '14 Aug 2026', productId: 'p_super', productName: 'SUPER', shopId: 'shop_soni', shopLocation: 'TANGA (SONI)', quantity: 48, unit: 'pcs' },
    { date: '14 Aug 2026', productId: 'p_kfp', productName: 'K.F.P', shopId: 'shop_soni', shopLocation: 'TANGA (SONI)', quantity: 93, unit: 'pcs' },
    { date: '14 Aug 2026', productId: 'p_round', productName: 'ROUND', shopId: 'shop_soni', shopLocation: 'TANGA (SONI)', quantity: 387, unit: 'pcs' },
    { date: '13 Aug 2026', productId: 'p_super', productName: 'SUPER', shopId: 'shop_soni', shopLocation: 'TANGA (SONI)', quantity: 46, unit: 'pcs' },
    { date: '13 Aug 2026', productId: 'p_andazi_kavu', productName: 'ANDAZI KAVU', shopId: 'shop_soni', shopLocation: 'TANGA (SONI)', quantity: 633, unit: 'pcs' },
    { date: '16 Aug 2026', productId: 'p_andazi_kavu', productName: 'ANDAZI KAVU', shopId: 'shop_lushoto', shopLocation: 'TANGA (LUSHOTO)', quantity: 140, unit: 'pcs' },
    { date: '16 Aug 2026', productId: 'p_round', productName: 'ROUND', shopId: 'shop_lushoto', shopLocation: 'TANGA (LUSHOTO)', quantity: 140, unit: 'pcs' },
    { date: '16 Aug 2026', productId: 'p_kfp', productName: 'K.F.P', shopId: 'shop_lushoto', shopLocation: 'TANGA (LUSHOTO)', quantity: 116, unit: 'pcs' },
    { date: '17 Aug 2026', productId: 'p_scones_lwandai', productName: 'SCONES LWANDAI SECONDARY', shopId: 'shop_lwandai', shopLocation: 'TANGA (LUSHTO LWANDAI)', quantity: 200, unit: 'pcs' },
];

const INITIAL_RAW_MATERIALS_HISTORY = [
    { date: '15 Aug 2026', dateRaw: '2026-08-15', materialName: 'Ngano', unit: 'Kilo', qty: 10000, pricePerUnit: 2800, materialId: 'mat_ngano' },
    { date: '15 Aug 2026', dateRaw: '2026-08-15', materialName: 'Ngano', unit: 'Kilo', qty: 250, pricePerUnit: 1700, materialId: 'mat_ngano' },
    { date: '10 Aug 2026', dateRaw: '2026-08-10', materialName: 'Mafuta ya Kupikia', unit: 'Lita', qty: 20, pricePerUnit: 2000, materialId: 'mat_mafuta' },
    { date: '10 Aug 2026', dateRaw: '2026-08-10', materialName: 'Umeme', unit: 'Lita', qty: 1222, pricePerUnit: 100, materialId: 'mat_umeme' },
    { date: '10 Aug 2026', dateRaw: '2026-08-10', materialName: 'Ngano', unit: 'Kilo', qty: 10000, pricePerUnit: 1000, materialId: 'mat_ngano' },
    { date: '09 Aug 2026', dateRaw: '2026-08-09', materialName: 'Mafuta ya Kupikia', unit: 'Lita', qty: 100, pricePerUnit: 2000, materialId: 'mat_mafuta' },
];

const INITIAL_RAW_MATERIALS_DISPATCH_HISTORY = [
    { date: '15 Aug 2026', materialName: 'Ngano', unit: 'Kilo', qty: 500, materialId: 'mat_ngano' },
    { date: '12 Aug 2026', materialName: 'Ngano', unit: 'Kilo', qty: 1000, materialId: 'mat_ngano' },
    { date: '10 Aug 2026', materialName: 'Mafuta ya Kupikia', unit: 'Lita', qty: 80, materialId: 'mat_mafuta' },
];

const INITIAL_PRODUCTION_LOG = [
    { date: '17 Aug 2026', dateRaw: '2026-08-17', productId: 'p_andazi', productName: 'ANDAZI', quantity: 1200, notes: '' },
    { date: '17 Aug 2026', dateRaw: '2026-08-17', productId: 'p_round', productName: 'ROUND', quantity: 800, notes: '' },
    { date: '16 Aug 2026', dateRaw: '2026-08-16', productId: 'p_super', productName: 'SUPER', quantity: 600, notes: '' },
    { date: '15 Aug 2026', dateRaw: '2026-08-15', productId: 'p_cake_kubwa', productName: 'CAKE KUBWA', quantity: 200, notes: '' },
    { date: '14 Aug 2026', dateRaw: '2026-08-14', productId: 'p_andazi', productName: 'ANDAZI', quantity: 2000, notes: 'Kundi kubwa' },
];

const INITIAL_FINANCES = {
    'shop_soni': { submitted: 97618474, reportedDebt: 0 },
    'shop_lushoto': { submitted: 10000000, reportedDebt: 0 },
    'shop_mwalimu': { submitted: 5000000, reportedDebt: 0 },
    'shop_lwandai': { submitted: 1500000, reportedDebt: 0 },
    'shop_rosmin': { submitted: 800000, reportedDebt: 0 },
};

const INITIAL_CUSTOMER_ORDERS = [];

// ==========================================
// DATA LAYER
// ==========================================

const STORAGE_KEY = 'ngae_app_data';

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const data = JSON.parse(raw);
            if (!data.staff) {
                data.staff = JSON.parse(JSON.stringify(INITIAL_STAFF));
                saveData(data);
            }
            if (!data.cashFlow) {
                data.cashFlow = { balance: 0, transactions: [] };
                saveData(data);
            }
            if (!data.suggestions) {
                data.suggestions = [];
                saveData(data);
            }
            if (!data.notifications) {
                data.notifications = [];
                saveData(data);
            }
            if (!data.manufacturerMaterials) {
                data.manufacturerMaterials = {};
                saveData(data);
            }
            if (!data.adminExpenses) {
                data.adminExpenses = [];
                saveData(data);
            }
            if (!data.salaryList) {
                data.salaryList = [];
                saveData(data);
            }
            return data;
        } catch(e) {
            console.error("Failed to parse app data, re-seeding...", e);
        }
    }
    // Seed initial data on first run
    return seedData();
}

function seedData() {
    const data = {
        staff: JSON.parse(JSON.stringify(INITIAL_STAFF)),
        products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
        shops: JSON.parse(JSON.stringify(INITIAL_SHOPS)),
        rawMaterials: JSON.parse(JSON.stringify(INITIAL_RAW_MATERIALS)),
        dispatchHistory: JSON.parse(JSON.stringify(INITIAL_DISPATCH_HISTORY)),
        rawMaterialsHistory: JSON.parse(JSON.stringify(INITIAL_RAW_MATERIALS_HISTORY)),
        rawMaterialsDispatchHistory: JSON.parse(JSON.stringify(INITIAL_RAW_MATERIALS_DISPATCH_HISTORY)),
        productionLog: JSON.parse(JSON.stringify(INITIAL_PRODUCTION_LOG)),
        finances: JSON.parse(JSON.stringify(INITIAL_FINANCES)),
        customerOrders: JSON.parse(JSON.stringify(INITIAL_CUSTOMER_ORDERS)),
        cashFlow: { balance: 0, transactions: [] },
        suggestions: [],
        notifications: [],
        manufacturerMaterials: {},
        adminExpenses: [],
        salaryList: []
    };
    saveData(data);
    return data;
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
let appData = loadData();
window.appData = appData;

// ==========================================
// AUTH FUNCTIONS
// ==========================================

window.appLogin = function(role, staffId) {
    const staffRecord = appData.staff[staffId.toUpperCase()];
    
    if (!staffRecord) {
        alert("Namba ya ID haikupatikana. Tafadhali jaribu tena.\n\nMfano wa vitambulisho:\n- Operator: NGAE001\n- Seller: NGAE016\n- Store Keeper: NGAE021\n- Manufacturer: NGAE027");
        return false;
    }
    
    if (staffRecord.role !== role) {
        alert(`ID ${staffId} ni ya ${staffRecord.role.toUpperCase()}, si ${role.toUpperCase()}. Tafadhali rudi na uchague jukumu sahihi.`);
        return false;
    }
    
    localStorage.setItem('ngae_logged_in_role', role);
    localStorage.setItem('ngae_logged_in_id', staffId.toUpperCase());
    localStorage.setItem('ngae_logged_in_name', staffRecord.name);
    
    // Redirect to correct dashboard
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
    
    // Update staff name display if element exists
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
    
    if (!product || !shop) return false;
    if (product.stock < qty) return false;
    
    // Deduct from product stock
    product.stock -= qty;
    
    // Add to dispatch history
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    
    appData.dispatchHistory.push({
        date: dateStr,
        dateRaw: now.toISOString().split('T')[0],
        productId: product.id,
        productName: product.name,
        shopId: shop.id,
        shopLocation: shop.location,
        quantity: qty,
        unit: unit || 'pcs'
    });
    
    // Initialize shop finances if not exists
    if (!appData.finances[shop.id]) {
        appData.finances[shop.id] = { submitted: 0, reportedDebt: 0 };
    }
    
    saveData(appData);
    window.appData = appData;
    
    // Add notification
    appAddNotification('Usafirishaji Mpya', `Operator amesafirisha ${qty} ${unit || 'pcs'} ya ${product.name} kwenda duka la ${shop.location}.`);
    
    return true;
};

// ==========================================
// SELLER FUNCTIONS
// ==========================================

window.appSubmitSales = function(amount, notes) {
    const staffId = localStorage.getItem('ngae_logged_in_id');
    const staffRecord = appData.staff[staffId];
    if (!staffRecord || !staffRecord.shopId) return false;
    
    const shopId = staffRecord.shopId;
    if (!appData.finances[shopId]) {
        appData.finances[shopId] = { submitted: 0, reportedDebt: 0, salesHistory: [], personalExpenses: [] };
    }
    if (!appData.finances[shopId].salesHistory) {
        appData.finances[shopId].salesHistory = [];
    }
    
    appData.finances[shopId].submitted += amount;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    appData.finances[shopId].salesHistory.push({
        amount: amount,
        notes: notes || 'Mauzo ya Kawaida',
        date: `${dateStr} ${timeStr}`,
        dateRaw: now.toISOString()
    });
    
    saveData(appData);
    window.appData = appData;
    
    // Add notification
    const shopLoc = appData.shops.find(s => s.id === shopId)?.location || 'dukani';
    appAddNotification('Mauzo Yaliyowasilishwa', `Muuzaji wa duka la ${shopLoc} amewasilisha mauzo ya Tsh ${amount.toLocaleString()}.`);
    
    return true;
};

window.appReportDebt = function(amount, reason) {
    const staffId = localStorage.getItem('ngae_logged_in_id');
    const staffRecord = appData.staff[staffId];
    if (!staffRecord || !staffRecord.shopId) return false;
    
    const shopId = staffRecord.shopId;
    if (!appData.finances[shopId]) {
        appData.finances[shopId] = { submitted: 0, reportedDebt: 0, salesHistory: [], personalExpenses: [] };
    }
    
    appData.finances[shopId].reportedDebt += amount;
    saveData(appData);
    window.appData = appData;
    return true;
};

window.appAddSellerExpense = function(amount, description) {
    const staffId = localStorage.getItem('ngae_logged_in_id');
    const staffRecord = appData.staff[staffId];
    if (!staffRecord || !staffRecord.shopId) return false;
    
    const shopId = staffRecord.shopId;
    if (!appData.finances[shopId]) {
        appData.finances[shopId] = { submitted: 0, reportedDebt: 0, salesHistory: [], personalExpenses: [] };
    }
    if (!appData.finances[shopId].personalExpenses) {
        appData.finances[shopId].personalExpenses = [];
    }
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    appData.finances[shopId].personalExpenses.push({
        amount: parseFloat(amount),
        description: description,
        date: `${dateStr} ${timeStr}`,
        dateRaw: now.toISOString()
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
    
    // Find or create material
    let mat = appData.rawMaterials.find(m => m.name.toUpperCase() === materialName.toUpperCase());
    if (!mat) {
        mat = { id: 'mat_' + materialName.toLowerCase().replace(/\s+/g,'_'), name: materialName, unit: unit, stock: 0 };
        appData.rawMaterials.push(mat);
    }
    
    mat.stock += qty;
    
    appData.rawMaterialsHistory.push({
        date: dateStr,
        dateRaw: now.toISOString().split('T')[0],
        materialName: materialName,
        materialId: mat.id,
        unit: unit,
        qty: qty,
        pricePerUnit: pricePerUnit
    });
    
    saveData(appData);
    window.appData = appData;
    
    // Add notification
    appAddNotification('Malighafi Zimepokelewa', `Stoo imepokea ${qty} ${unit} za ${materialName} kutoka kwa msambazaji.`);
    
    return true;
};

window.appDispatchMaterial = function(materialId, qty, manufacturerId) {
    const mat = appData.rawMaterials.find(m => m.id === materialId);
    if (!mat || mat.stock < qty) return false;
    
    mat.stock -= qty;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const manufacturerName = appData.staff[manufacturerId] ? appData.staff[manufacturerId].name : 'Producer';
    
    appData.rawMaterialsDispatchHistory.push({
        date: dateStr,
        dateRaw: now.toISOString().split('T')[0],
        materialName: mat.name,
        materialId: mat.id,
        unit: mat.unit,
        qty: qty,
        manufacturerId: manufacturerId,
        manufacturerName: manufacturerName
    });
    
    // Increment manufacturer raw materials balance
    if (!appData.manufacturerMaterials) {
        appData.manufacturerMaterials = {};
    }
    if (!appData.manufacturerMaterials[manufacturerId]) {
        appData.manufacturerMaterials[manufacturerId] = {};
    }
    appData.manufacturerMaterials[manufacturerId][materialId] = (appData.manufacturerMaterials[manufacturerId][materialId] || 0) + qty;
    
    saveData(appData);
    window.appData = appData;
    
    // Add notification
    appAddNotification('Malighafi Zimetolewa', `Stoo imetoa ${qty} ${mat.unit} za ${mat.name} kwenda kwa ${manufacturerName}.`);
    
    return true;
};

// ==========================================
// MANUFACTURER FUNCTIONS
// ==========================================

window.appRecordProduction = function(productId, qty, notes) {
    const product = appData.products.find(p => p.id === productId);
    if (!product) return false;
    
    // Add to product stock
    product.stock += qty;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    
    appData.productionLog.push({
        date: dateStr,
        dateRaw: now.toISOString().split('T')[0],
        productId: product.id,
        productName: product.name,
        quantity: qty,
        notes: notes || ''
    });
    
    saveData(appData);
    window.appData = appData;
    
    // Add notification
    appAddNotification('Uzalishaji Mpya', `Kiwanda kimesajili uzalishaji wa ${qty} pcs za ${product.name}.`);
    
    return true;
};

// ==========================================
// CUSTOMER ORDER FUNCTIONS
// ==========================================

window.appPlaceOrder = function({ customer_name, phone, region, district, ward, street, items, total }) {
    // Generate Order ID
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

window.appAddStaff = function(name, role, customId) {
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
    if (appData.staff[staffId]) {
        delete appData.staff[staffId];
        saveData(appData);
        window.appData = appData;
        return true;
    }
    return false;
};

window.appUpdateProduct = function(productId, name, price, stock) {
    const product = appData.products.find(p => p.id === productId);
    if (!product) return false;
    product.name = name;
    product.price = parseFloat(price);
    product.stock = parseInt(stock);
    saveData(appData);
    window.appData = appData;
    return true;
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
            
            // Check Year
            if (tDate.getFullYear() === now.getFullYear()) {
                year += t.amount;

                // Check Month
                if (tDate.getMonth() === now.getMonth()) {
                    month += t.amount;

                    // Check Today
                    if (tDate.toDateString() === now.toDateString()) {
                        today += t.amount;
                    }
                }

                // Check Week
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
    
    // Add notification
    appAddNotification('Matumizi Mapya ya Admin', `Admin amesajili matumizi mpya: "${description}" ya Tsh ${parseFloat(amount).toLocaleString()}.`);
    
    return true;
};

window.appGetExpensesList = function() {
    const list = [];
    
    // Store keeper raw material purchases
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
    
    // Custom Admin expenses
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

    // Salary payments from NGAE Staff Salary List
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
    
    // Sort by latest
    return list.sort((a,b) => new Date(b.dateRaw) - new Date(a.dateRaw));
};

window.appGetOverallStatistics = function() {
    // 1. Total Sales (submitted sales from shops)
    let totalSales = 0;
    const finances = appData.finances || {};
    Object.values(finances).forEach(f => {
        totalSales += f.submitted || 0;
    });
    
    // 2. Total Expenses (Stoo purchases + Admin expenses)
    let totalExpenses = 0;
    const expenses = window.appGetExpensesList();
    expenses.forEach(e => {
        totalExpenses += e.amount;
    });
    
    // 3. Profit / Loss
    const netProfit = totalSales - totalExpenses;
    
    return {
        totalSales,
        totalExpenses,
        netProfit,
        isLoss: netProfit < 0
    };
};

window.appGetManufacturerMaterials = function(manufacturerId) {
    if (!appData.manufacturerMaterials || !appData.manufacturerMaterials[manufacturerId]) {
        return [];
    }
    const mats = appData.manufacturerMaterials[manufacturerId];
    const list = [];
    Object.keys(mats).forEach(materialId => {
        const qty = mats[materialId];
        const rawMat = appData.rawMaterials.find(m => m.id === materialId);
        if (rawMat && qty > 0) {
            list.push({
                materialId: materialId,
                name: rawMat.name,
                unit: rawMat.unit,
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
        paymentMethod: paymentMethod, // 'mobile', 'bank', 'cash'
        nida: nida || '',
        photo: '', // base64 photo
        contract: null,
        payments: []
    });

    saveData(appData);
    window.appData = appData;
    
    // Add notification
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
        method: method, // 'Mtandao wa Simu', 'Bank', 'Mkononi'
        notes: notes || 'Malipo ya mshahara'
    });

    saveData(appData);
    window.appData = appData;

    // Add notification
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
    
    // Save to staff object
    if (!appData.staff) appData.staff = {};
    if (appData.staff[staffId]) {
        appData.staff[staffId].photo = photoBase64;
    } else {
        appData.staff[staffId] = { name: 'OPERATOR STAFF', role: 'operator', photo: photoBase64 };
    }

    // Also update salaryList if present
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
window.appGetOperatorStats = function(staffId = 'NGAE001') {
    if (!appData) appData = loadData();

    // 1. Ready Stock Quantity (Bakaa ya bidhaa tayari kusafirishwa)
    const totalReadyStock = (appData.products || []).reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

    // 2. Total Shops (Idadi ya maduka)
    const totalShopsCount = (appData.shops || []).length;

    // 3. Dispatched Cargo Value (Thamani ya mizigo iliyosambazwa)
    let dispatchedValue = 0;
    (appData.dispatchHistory || []).forEach(h => {
        const prod = (appData.products || []).find(p => p.id === h.productId || p.name.toLowerCase() === (h.productName || '').toLowerCase());
        const unitPrice = prod ? (Number(prod.price) || 1000) : 1000;
        dispatchedValue += (Number(h.quantity) || 0) * unitPrice;
    });

    // 4. Undispatched Stock Value (Thamani ya mizigo ambayo bado haijasambazwa)
    const undispatchedValue = (appData.products || []).reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.price) || 0)), 0);

    // Staff Info (Card 6)
    const currentId = (localStorage.getItem('ngae_logged_in_id') || staffId).toUpperCase();
    const staffObj = (appData.staff && appData.staff[currentId]) ? appData.staff[currentId] : { name: 'MUSSA AMIRI SHEIZA', role: 'operator' };
    
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
            name: staffObj.name || localStorage.getItem('ngae_logged_in_name') || 'MUSSA AMIRI SHEIZA',
            role: staffObj.role || 'operator',
            department: 'Usafirishaji wa Mizigo',
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
});

console.log("NGAE Food App initialized. Products:", appData.products.length, "| Orders:", appData.customerOrders.length);
