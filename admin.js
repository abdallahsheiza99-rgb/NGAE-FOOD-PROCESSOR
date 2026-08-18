// ==========================================================================
// Application State
// ==========================================================================
const state = {
    currentAdminPeriod: 'today' // 'today' | 'week' | 'month'
};

// ==========================================================================
// DOM Elements
// ==========================================================================
const loginCard = document.getElementById('admin-login-card');
const dashboardContainer = document.getElementById('admin-dashboard-container');

const loginForm = document.getElementById('admin-login-form');
const passwordInput = document.getElementById('admin-password');
const authError = document.getElementById('auth-error');

const tabButtons = document.querySelectorAll('.tab-btn');
const adminTotalRevenue = document.getElementById('admin-total-revenue');
const adminTotalItems = document.getElementById('admin-total-items');
const adminSalesBody = document.getElementById('admin-sales-body');
const resetSalesBtn = document.getElementById('reset-sales-btn');

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

function wipeSalesHistory() {
    localStorage.removeItem('stellarshop_sales_v2');
}

// ==========================================================================
// Authentication State Management
// ==========================================================================

function checkAuthentication() {
    const isAuth = sessionStorage.getItem('boss_authenticated') === 'true';
    if (isAuth) {
        loginCard.style.display = 'none';
        dashboardContainer.style.display = 'flex';
        renderAdminStats();
    } else {
        loginCard.style.display = 'block';
        dashboardContainer.style.display = 'none';
    }
}

function authenticate(password) {
    if (password === 'sheizan27') {
        sessionStorage.setItem('boss_authenticated', 'true');
        checkAuthentication();
    } else {
        authError.style.display = 'block';
        passwordInput.classList.add('invalid');
        passwordInput.focus();
    }
}

// ==========================================================================
// Dashboard Calculations & Rendering
// ==========================================================================

function renderAdminStats() {
    const history = getSalesHistory();
    const now = new Date();

    // Time boundaries
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const startOfMonth = now.getTime() - (30 * 24 * 60 * 60 * 1000);

    // Aggregation objects
    let totalRevenue = 0;
    let totalItemsCount = 0;
    const itemDistribution = {}; // item_name: {qty: 0, revenue: 0}

    history.forEach(tx => {
        const txTime = new Date(tx.timestamp).getTime();
        let isInRange = false;

        if (state.currentAdminPeriod === 'today') {
            isInRange = txTime >= startOfToday;
        } else if (state.currentAdminPeriod === 'week') {
            isInRange = txTime >= startOfWeek;
        } else if (state.currentAdminPeriod === 'month') {
            isInRange = txTime >= startOfMonth;
        }

        if (isInRange) {
            totalRevenue += tx.totalAmount;
            tx.items.forEach(it => {
                totalItemsCount++;
                if (!itemDistribution[it.name]) {
                    itemDistribution[it.name] = { qty: 0, revenue: 0 };
                }
                itemDistribution[it.name].qty += 1;
                itemDistribution[it.name].revenue += it.price;
            });
        }
    });

    // Bind stats to UI
    adminTotalRevenue.textContent = `$${totalRevenue.toFixed(2)}`;
    adminTotalItems.textContent = totalItemsCount;

    // Render distribution table
    adminSalesBody.innerHTML = '';
    const sortedItems = Object.keys(itemDistribution).map(name => ({
        name: name,
        qty: itemDistribution[name].qty,
        revenue: itemDistribution[name].revenue
    })).sort((a, b) => b.qty - a.qty);

    if (sortedItems.length === 0) {
        adminSalesBody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; color: var(--color-text-muted); padding: 30px;">
                    No transactions registered in this period.
                </td>
            </tr>
        `;
    } else {
        sortedItems.forEach(it => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${it.name}</td>
                <td class="text-right">${it.qty}</td>
                <td class="text-right text-green">$${it.revenue.toFixed(2)}</td>
            `;
            adminSalesBody.appendChild(row);
        });
    }
}

// ==========================================================================
// Event Listeners Registration
// ==========================================================================

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pwd = passwordInput.value.trim();
    authenticate(pwd);
});

passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('invalid');
    authError.style.display = 'none';
});

// Period Selector Tab buttons
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentAdminPeriod = btn.getAttribute('data-period');
        renderAdminStats();
    });
});

// Initial startup check
checkAuthentication();
