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

const INITIAL_STAFF = {};
const INITIAL_PRODUCTS = [];
const INITIAL_SHOPS = [];
const INITIAL_RAW_MATERIALS = [];
const INITIAL_DISPATCH_HISTORY = [];
const INITIAL_RAW_MATERIALS_HISTORY = [];
const INITIAL_RAW_MATERIALS_DISPATCH_HISTORY = [];
const INITIAL_PRODUCTION_LOG = [];
const INITIAL_FINANCES = {};
const INITIAL_CUSTOMER_ORDERS = [];

// ==========================================
// DATA LAYER
// ==========================================

const STORAGE_KEY = 'ngae_app_data';
const CURRENT_APP_VERSION = 'v3_force_fresh_start_20260818';

window.appResetSystem = function() {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('ngae_app_version', CURRENT_APP_VERSION);
    const freshData = seedData();
    window.appData = freshData;
    return true;
};

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const data = JSON.parse(raw);

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
        } catch(e) {
            console.error("Failed to parse app data, re-seeding...", e);
        }
    }
    // Seed initial clean data on first run
    return seedData();
}

function seedData() {
    const data = {
        staff: {},
        products: [],
        shops: [],
        rawMaterials: [],
        dispatchHistory: [],
        rawMaterialsHistory: [],
        rawMaterialsDispatchHistory: [],
        productionLog: [],
        finances: {},
        customerOrders: [],
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
        product.stock = parseInt(stock) || 0;
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
    const currentId = (localStorage.getItem('ngae_logged_in_id') || staffId || '').toUpperCase();
    const staffObj = (appData.staff && appData.staff[currentId]) ? appData.staff[currentId] : { name: 'Mfanyakazi', role: 'operator' };
    
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
            // Spend Today
            if (rDate.toDateString() === todayStr) {
                spendToday += amount;
            }
            // Spend Week (Within last 7 days)
            const diffTime = now.getTime() - rDate.getTime();
            const diffDays = diffTime / (1000 * 3600 * 24);
            if (diffDays >= 0 && diffDays <= 7) {
                spendWeek += amount;
            }
            // Spend Month
            if (rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear()) {
                spendMonth += amount;
            }
            // Spend Year
            if (rDate.getFullYear() === now.getFullYear()) {
                spendYear += amount;
            }
        } else {
            spendMonth += amount;
            spendYear += amount;
        }
    });

    // Current Staff Info
    const currentId = (localStorage.getItem('ngae_logged_in_id') || staffId || '').toUpperCase();
    const staffObj = (appData.staff && appData.staff[currentId]) ? appData.staff[currentId] : { name: 'Mfanyakazi', role: 'storekeeper' };
    
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
    const staffObj = (appData.staff && appData.staff[currentId]) ? appData.staff[currentId] : { name: 'Mfanyakazi', role: 'seller', shopId: '' };
    
    // Find matching shop for this seller
    const shop = (appData.shops || []).find(s => s.sellerId === currentId) || (appData.shops || [])[0] || { id: '', location: 'Duka Bado Halijasajiliwa', sellerName: 'Mfanyakazi' };
    
    // Dispatched cargo for this shop
    const receivedDispatches = (appData.dispatchHistory || []).filter(h => h.shopId === shop.id);
    let totalCargoValue = 0;
    receivedDispatches.forEach(item => {
        const prod = (appData.products || []).find(p => p.id === item.productId);
        const price = prod ? prod.price : 1000;
        totalCargoValue += (price * (item.quantity || 0));
    });
    
    // Shop Finances
    const shopFinance = (appData.finances && appData.finances[shop.id]) ? appData.finances[shop.id] : { submitted: 0, salesHistory: [], personalExpenses: [] };
    const totalSubmittedCash = shopFinance.submitted || 0;
    const remainingDebt = Math.max(0, totalCargoValue - totalSubmittedCash);
    
    // Hali ya duka condition logic:
    // If remaining debt >= 1000000 -> VITU BADO VIPO DUKANI
    // Else -> VITU VINAELEKEA KUISHA
    const isStockSufficient = remainingDebt >= 1000000;
    const storeStatusText = isStockSufficient ? "VITU BADO VIPO DUKANI" : "VITU VINAELEKEA KUISHA";
    
    // Calculate sales ranking among all shops
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
    
    // Photo logic
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
});

console.log("NGAE Food App initialized. Products:", appData.products.length, "| Orders:", appData.customerOrders.length);
