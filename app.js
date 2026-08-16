// ==========================================================================
// Application State
// ==========================================================================
const state = {
    commodities: []
};

// ==========================================================================
// DOM Elements
// ==========================================================================
const form = document.getElementById('commodity-form');
const nameInput = document.getElementById('commodity-name');
const priceInput = document.getElementById('commodity-price');
const nameError = document.getElementById('name-error');
const priceError = document.getElementById('price-error');

const addBtn = document.getElementById('add-btn');
const demoBtn = document.getElementById('demo-btn');
const clearBtn = document.getElementById('clear-btn');

const limitCounter = document.getElementById('limit-counter');

const emptyState = document.getElementById('empty-state');
const commoditiesList = document.getElementById('commodities-list');
const analyticsDashboard = document.getElementById('analytics-dashboard');
const checkoutAction = document.getElementById('checkout-action');

// Stats Elements
const statSubtotal = document.getElementById('stat-subtotal');
const statAverage = document.getElementById('stat-average');
const statHighest = document.getElementById('stat-highest');
const statLowest = document.getElementById('stat-lowest');

// Receipt Overlay Elements
const generateReceiptBtn = document.getElementById('generate-receipt-btn');
const receiptOverlay = document.getElementById('receipt-overlay');
const closeReceiptBtn = document.getElementById('close-receipt-btn');
const printReceiptBtn = document.getElementById('print-receipt-btn');

const receiptNo = document.getElementById('receipt-no');
const receiptDate = document.getElementById('receipt-date');
const receiptItemsBody = document.getElementById('receipt-items-body');
const receiptTotalItems = document.getElementById('receipt-total-items');
const receiptAvgPrice = document.getElementById('receipt-avg-price');
const receiptGrandTotal = document.getElementById('receipt-grand-total');
const receiptTimestamp = document.getElementById('receipt-timestamp');

// ==========================================================================
// Sales History Database Helpers (localStorage)
// ==========================================================================

function getSalesHistory() {
    try {
        const data = localStorage.getItem('stellarshop_sales_v2');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Failed to parse sales history", e);
        return [];
    }
}

function saveTransactionToHistory(items, totalAmount) {
    const history = getSalesHistory();
    const transaction = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        items: items.map(it => ({ name: it.name, price: it.price })),
        totalAmount: totalAmount
    };
    history.push(transaction);
    localStorage.setItem('stellarshop_sales_v2', JSON.stringify(history));
}

// ==========================================================================
// Form Validation & Interaction Logic
// ==========================================================================

function validateForm() {
    let isValid = true;
    
    // Name validation
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.classList.add('invalid');
        nameError.style.display = 'block';
        isValid = false;
    } else {
        nameInput.classList.remove('invalid');
        nameError.style.display = 'none';
    }
    
    // Price validation
    const priceStr = priceInput.value.trim();
    const price = parseFloat(priceStr);
    
    if (!priceStr || isNaN(price) || price < 0) {
        priceInput.classList.add('invalid');
        priceError.style.display = 'block';
        isValid = false;
    } else {
        priceInput.classList.remove('invalid');
        priceError.style.display = 'none';
    }
    
    return isValid;
}

// Clear Validation styling
function resetValidation() {
    nameInput.classList.remove('invalid');
    priceInput.classList.remove('invalid');
    nameError.style.display = 'none';
    priceError.style.display = 'none';
}

// Add Item
function addCommodity(name, price) {
    state.commodities.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        name: name,
        price: parseFloat(price)
    });
    
    updateUI();
}

// Delete Item
function deleteCommodity(id) {
    state.commodities = state.commodities.filter(item => item.id !== id);
    updateUI();
}

// Clear All
function clearCatalog() {
    if (state.commodities.length === 0) return;
    if (confirm("Are you sure you want to clear your current basket?")) {
        state.commodities = [];
        updateUI();
    }
}

// Load Mock Demo Data
function loadDemoData() {
    const demoItems = [
        { name: "Wireless Headphones", price: 79.99 },
        { name: "Mechanical Keyboard", price: 129.50 },
        { name: "Ergonomic Office Chair", price: 249.00 },
        { name: "UltraWide Monitor 34\"", price: 399.99 },
        { name: "USB-C Hub Multiport", price: 45.00 }
    ];
    
    state.commodities = [];
    demoItems.forEach(item => {
        state.commodities.push({
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
            name: item.name,
            price: item.price
        });
    });
    
    updateUI();
}

// ==========================================================================
// UI Rendering & Data Binding
// ==========================================================================

function updateUI() {
    const itemCount = state.commodities.length;
    
    // Update count labels
    limitCounter.textContent = `${itemCount} Item${itemCount === 1 ? '' : 's'}`;
    
    // Handle Empty vs Display State
    if (itemCount === 0) {
        emptyState.style.display = 'flex';
        commoditiesList.style.display = 'none';
        analyticsDashboard.style.display = 'none';
        checkoutAction.style.display = 'none';
        
        commoditiesList.innerHTML = '';
    } else {
        emptyState.style.display = 'none';
        commoditiesList.style.display = 'flex';
        analyticsDashboard.style.display = 'grid';
        checkoutAction.style.display = 'block';
        
        renderCommoditiesList();
        calculateAnalytics();
    }
}

// Render dynamic catalog list
function renderCommoditiesList() {
    commoditiesList.innerHTML = '';
    
    state.commodities.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'commodity-card';
        card.setAttribute('data-id', item.id);
        
        card.innerHTML = `
            <div class="item-info">
                <span class="item-index-tag">Item #${index + 1}</span>
                <span class="item-name" title="${item.name}">${item.name}</span>
            </div>
            <div class="item-meta">
                <span class="item-price">$${item.price.toFixed(2)}</span>
                <button class="item-delete-btn" aria-label="Delete ${item.name}">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        
        // Add Delete Event Listener
        card.querySelector('.item-delete-btn').addEventListener('click', () => {
            deleteCommodity(item.id);
        });
        
        commoditiesList.appendChild(card);
    });
}

// Calculate summaries
function calculateAnalytics() {
    if (state.commodities.length === 0) return;
    
    let subtotal = 0;
    let highestPrice = -Infinity;
    let lowestPrice = Infinity;
    let highestItem = null;
    let lowestItem = null;
    
    state.commodities.forEach(item => {
        subtotal += item.price;
        if (item.price > highestPrice) {
            highestPrice = item.price;
            highestItem = item;
        }
        if (item.price < lowestPrice) {
            lowestPrice = item.price;
            lowestItem = item;
        }
    });
    
    const average = subtotal / state.commodities.length;
    
    // Bind results to display
    statSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    statAverage.textContent = `$${average.toFixed(2)}`;
    
    if (highestItem) {
        statHighest.textContent = `$${highestItem.price.toFixed(2)}`;
        statHighest.title = highestItem.name;
    }
    
    if (lowestItem) {
        statLowest.textContent = `$${lowestItem.price.toFixed(2)}`;
        statLowest.title = lowestItem.name;
    }
}

// ==========================================================================
// Digital Receipt Overlay Manager
// ==========================================================================

function checkoutBasket() {
    if (state.commodities.length === 0) return;
    
    // Calculate subtotal
    let subtotal = 0;
    state.commodities.forEach(item => subtotal += item.price);
    
    // Save to sales database
    saveTransactionToHistory(state.commodities, subtotal);
    
    // Open receipt modal view
    openReceipt(subtotal);
    
    // Clear current basket
    state.commodities = [];
    updateUI();
}

function openReceipt(subtotal) {
    // Fill receipt details
    const randomNo = Math.floor(100000 + Math.random() * 900000);
    receiptNo.textContent = `ST-${randomNo}`;
    
    const now = new Date();
    receiptDate.textContent = now.toLocaleDateString();
    receiptTimestamp.textContent = `Issued: ${now.toLocaleString()}`;
    
    // Fill items
    receiptItemsBody.innerHTML = '';
    
    const history = getSalesHistory();
    const lastTransaction = history[history.length - 1];
    const items = lastTransaction ? lastTransaction.items : [];
    
    items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="col-num">${index + 1}</td>
            <td class="col-item">${item.name}</td>
            <td class="col-price">$${item.price.toFixed(2)}</td>
        `;
        receiptItemsBody.appendChild(row);
    });
    
    const average = subtotal / items.length;
    
    receiptTotalItems.textContent = items.length;
    receiptAvgPrice.textContent = `$${average.toFixed(2)}`;
    receiptGrandTotal.textContent = `$${subtotal.toFixed(2)}`;
    
    // Show modal
    receiptOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Lock background scrolling
}

function closeReceipt() {
    receiptOverlay.style.display = 'none';
    document.body.style.overflow = 'auto'; // Unlock background scrolling
}

// ==========================================================================
// Event Listeners Registration
// ==========================================================================

form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (validateForm()) {
        const name = nameInput.value.trim();
        const price = priceInput.value.trim();
        
        addCommodity(name, price);
        
        // Reset form
        form.reset();
        resetValidation();
        nameInput.focus();
    }
});

// Clear input validation errors on input event
nameInput.addEventListener('input', () => {
    nameInput.classList.remove('invalid');
    nameError.style.display = 'none';
});

priceInput.addEventListener('input', () => {
    priceInput.classList.remove('invalid');
    priceError.style.display = 'none';
});

demoBtn.addEventListener('click', loadDemoData);
clearBtn.addEventListener('click', clearCatalog);

generateReceiptBtn.addEventListener('click', checkoutBasket);
closeReceiptBtn.addEventListener('click', closeReceipt);

// Close overlay on clicking outside modal
receiptOverlay.addEventListener('click', (e) => {
    if (e.target === receiptOverlay) {
        closeReceipt();
    }
});

// ESC key listener to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && receiptOverlay.style.display === 'flex') {
        closeReceipt();
    }
});

printReceiptBtn.addEventListener('click', () => {
    window.print();
});

// Initialize dashboard UI
updateUI();
