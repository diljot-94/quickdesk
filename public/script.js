// Global variables
let currentUser = null;
let currentPage = 1;
let categories = [];
let notifications = [];
let unreadCount = 0;
let currentChatTicket = null;
let chatMessages = [];

// DOM elements
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const loadingSpinner = document.getElementById('loadingSpinner');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        currentUser = JSON.parse(localStorage.getItem('user'));
        showApp();
        loadDashboard();
    } else {
        showAuth();
    }

    // Setup event listeners
    setupAuthListeners();
    setupNavigationListeners();
    setupFormListeners();
    setupFilterListeners();
}

// Authentication functions
function setupAuthListeners() {
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchAuthTab(tabName);
        });
    });

    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Register form
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    // Role change listener
    document.getElementById('registerRole').addEventListener('change', function() {
        const specializationsGroup = document.getElementById('specializationsGroup');
        const adminKeyGroup = document.getElementById('adminKeyGroup');
        
        if (this.value === 'agent') {
            specializationsGroup.style.display = 'block';
            adminKeyGroup.style.display = 'none';
        } else if (this.value === 'admin') {
            specializationsGroup.style.display = 'none';
            adminKeyGroup.style.display = 'block';
        } else {
            specializationsGroup.style.display = 'none';
            adminKeyGroup.style.display = 'none';
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

function switchAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'login') {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    } else {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    showLoading();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    console.log('Attempting login for:', email);

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        console.log('Login response status:', response.status);
        const data = await response.json();
        console.log('Login response data:', data);

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            showToast('Login successful!', 'success');
            showApp();
            loadDashboard();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error', 'error');
    } finally {
        hideLoading();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    showLoading();

    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const role = document.getElementById('registerRole').value;
    const specializations = document.getElementById('registerSpecializations').value;
    const adminKey = document.getElementById('registerAdminKey').value;

    // Parse specializations
    const specializationsArray = specializations
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    console.log('Attempting registration for:', email);

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username, 
                email, 
                password, 
                role, 
                specializations: specializationsArray,
                adminKey
            })
        });

        console.log('Registration response status:', response.status);
        const data = await response.json();
        console.log('Registration response data:', data);

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            showToast('Registration successful!', 'success');
            showApp();
            loadDashboard();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error', 'error');
    } finally {
        hideLoading();
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    showAuth();
    showToast('Logged out successfully', 'info');
}

// Navigation functions
function setupNavigationListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (page) {
                showPage(page);
            }
        });
    });

    // Mobile menu toggle
    document.getElementById('navToggle').addEventListener('click', function() {
        document.getElementById('navMenu').classList.toggle('active');
    });
}

function showPage(pageName) {
    console.log('Showing page:', pageName, 'Current user:', currentUser);
    
    // Check if user is logged in for protected pages
    if (!currentUser && (pageName === 'dashboard' || pageName === 'create-ticket')) {
        showToast('Please log in to access this feature', 'error');
        showAuth();
        return;
    }

    // Check admin access
    if (pageName === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
        showToast('Admin access required', 'error');
        return;
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

    // Show selected page
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
        console.log('Page element found and activated:', pageName + 'Page');
        console.log('Page display style:', targetPage.style.display);
        console.log('Page classes:', targetPage.className);
    } else {
        console.error('Page element not found:', pageName + 'Page');
    }

    // Load page-specific content
    switch (pageName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'create-ticket':
            loadCreateTicket();
            // Force show the page content
            setTimeout(() => {
                const page = document.getElementById('createTicketPage');
                if (page && !page.classList.contains('active')) {
                    page.classList.add('active');
                    console.log('Forced activation of create ticket page');
                }
                // Show debug info
                const debugInfo = document.getElementById('debugInfo');
                if (debugInfo) {
                    debugInfo.style.display = 'block';
                    console.log('Debug info shown');
                }
            }, 100);
            break;
        case 'tickets':
            loadMyTickets();
            break;
        case 'admin':
            if (currentUser.role === 'admin') {
                loadAdminPanel();
            }
            break;
    }

    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`[data-page="${pageName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Dashboard functions
async function loadDashboard() {
    showLoading();
    try {
        await loadCategories();
        await loadTickets();
        await loadNotifications();
        updateStats();
    } catch (error) {
        showToast('Error loading dashboard', 'error');
    } finally {
        hideLoading();
    }
}

async function loadTickets() {
    const search = document.getElementById('searchInput').value;
    const status = document.getElementById('statusFilter').value;
    const category = document.getElementById('categoryFilter').value;
    const sort = document.getElementById('sortFilter').value;

    try {
        const response = await fetch(`/api/tickets?page=${currentPage}&search=${search}&status=${status}&category=${category}&sort=${sort}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        const data = await response.json();

        if (response.ok) {
            displayTickets(data.tickets);
            displayPagination(data.totalPages, data.page);
        } else {
            showToast('Error loading tickets', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

async function loadMyTickets() {
    const search = document.getElementById('myTicketsSearchInput').value;
    const status = document.getElementById('myTicketsStatusFilter').value;
    const category = document.getElementById('myTicketsCategoryFilter').value;
    const sort = document.getElementById('myTicketsSortFilter').value;

    try {
        const response = await fetch(`/api/tickets/my?page=${currentPage}&search=${search}&status=${status}&category=${category}&sort=${sort}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        const data = await response.json();

        if (response.ok) {
            displayMyTickets(data.tickets);
            displayMyTicketsPagination(data.totalPages, data.page);
        } else {
            showToast('Error loading my tickets', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

function displayTickets(tickets) {
    const container = document.getElementById('ticketsContainer');
    container.innerHTML = '';

    if (tickets.length === 0) {
        container.innerHTML = '<div class="no-tickets">No tickets found</div>';
        return;
    }

    tickets.forEach(ticket => {
        const ticketElement = createTicketElement(ticket);
        container.appendChild(ticketElement);
    });
}

function displayMyTickets(tickets) {
    const container = document.getElementById('myTicketsContainer');
    container.innerHTML = '';

    if (tickets.length === 0) {
        container.innerHTML = '<div class="no-tickets">No tickets found</div>';
        return;
    }

    tickets.forEach(ticket => {
        const ticketElement = createTicketElement(ticket);
        container.appendChild(ticketElement);
    });
}

function createTicketElement(ticket) {
    const div = document.createElement('div');
    div.className = 'ticket-card';
    div.onclick = () => showTicketDetail(ticket.id);

    const category = categories.find(c => c.id === ticket.categoryId);
    const statusClass = `status-${ticket.status.replace(' ', '-')}`;

    div.innerHTML = `
        <div class="ticket-header">
            <div>
                <div class="ticket-title">${ticket.subject}</div>
                <div class="ticket-meta">
                    <span class="ticket-status ${statusClass}">${ticket.status}</span>
                    <span>${category ? category.name : 'Unknown'}</span>
                    <span>${formatDate(ticket.createdAt)}</span>
                </div>
            </div>
        </div>
        <div class="ticket-description">${ticket.description.substring(0, 150)}${ticket.description.length > 150 ? '...' : ''}</div>
        <div class="ticket-footer">
            <div class="ticket-votes">
                <button class="vote-btn" onclick="event.stopPropagation(); voteTicket('${ticket.id}', 'up')">
                    <i class="fas fa-thumbs-up"></i> ${ticket.upvotes}
                </button>
                <button class="vote-btn" onclick="event.stopPropagation(); voteTicket('${ticket.id}', 'down')">
                    <i class="fas fa-thumbs-down"></i> ${ticket.downvotes}
                </button>
            </div>
            <div class="ticket-actions">
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openChat('${ticket.id}')">
                    <i class="fas fa-comments"></i> Chat
                </button>
                <span class="comment-count">
                    <i class="fas fa-comments"></i> ${ticket.comments.length} comments
                </span>
            </div>
        </div>
    `;

    return div;
}

function displayPagination(totalPages, currentPage) {
    const container = document.getElementById('pagination');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous button
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Previous';
        prevBtn.onclick = () => changePage(currentPage - 1);
        container.appendChild(prevBtn);
    }

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.onclick = () => changePage(i);
        if (i === currentPage) {
            pageBtn.classList.add('active');
        }
        container.appendChild(pageBtn);
    }

    // Next button
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next';
        nextBtn.onclick = () => changePage(currentPage + 1);
        container.appendChild(nextBtn);
    }
}

function displayMyTicketsPagination(totalPages, currentPage) {
    const container = document.getElementById('myTicketsPagination');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous button
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Previous';
        prevBtn.onclick = () => changeMyTicketsPage(currentPage - 1);
        container.appendChild(prevBtn);
    }

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.onclick = () => changeMyTicketsPage(i);
        if (i === currentPage) {
            pageBtn.classList.add('active');
        }
        container.appendChild(pageBtn);
    }

    // Next button
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next';
        nextBtn.onclick = () => changeMyTicketsPage(currentPage + 1);
        container.appendChild(nextBtn);
    }
}

function changePage(page) {
    currentPage = page;
    loadTickets();
}

function changeMyTicketsPage(page) {
    currentPage = page;
    loadMyTickets();
}

async function updateStats() {
    try {
        const response = await fetch('/api/stats', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const stats = await response.json();
            document.getElementById('totalTickets').textContent = stats.totalTickets;
            document.getElementById('openTickets').textContent = stats.openTickets;
            document.getElementById('resolvedTickets').textContent = stats.resolvedTickets;
        }
    } catch (error) {
        console.error('Error updating stats:', error);
        // Fallback to placeholder values
        document.getElementById('totalTickets').textContent = '0';
        document.getElementById('openTickets').textContent = '0';
        document.getElementById('resolvedTickets').textContent = '0';
    }
}

// Filter functions
function setupFilterListeners() {
    // Dashboard filters
    document.getElementById('searchInput').addEventListener('input', debounce(loadTickets, 500));
    document.getElementById('statusFilter').addEventListener('change', loadTickets);
    document.getElementById('categoryFilter').addEventListener('change', loadTickets);
    document.getElementById('sortFilter').addEventListener('change', loadTickets);
    
    // My Tickets filters
    document.getElementById('myTicketsSearchInput').addEventListener('input', debounce(loadMyTickets, 500));
    document.getElementById('myTicketsStatusFilter').addEventListener('change', loadMyTickets);
    document.getElementById('myTicketsCategoryFilter').addEventListener('change', loadMyTickets);
    document.getElementById('myTicketsSortFilter').addEventListener('change', loadMyTickets);
}

// Create ticket functions
function setupFormListeners() {
    document.getElementById('createTicketForm').addEventListener('submit', handleCreateTicket);
    
    // Chat message send button
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendChatMessage);
    }
    
    // Chat message input enter key
    const chatMessageInput = document.getElementById('chatMessageInput');
    if (chatMessageInput) {
        chatMessageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
}

async function loadCreateTicket() {
    console.log('Loading create ticket page...');
    try {
        await loadCategories();
        populateCategorySelect(document.getElementById('ticketCategory'));
        console.log('Create ticket page loaded successfully');
    } catch (error) {
        console.error('Error loading create ticket page:', error);
        // Fallback: show the page even if categories fail to load
        console.log('Showing create ticket page with fallback');
        
        // Add a default category option as fallback
        const categorySelect = document.getElementById('ticketCategory');
        if (categorySelect && categorySelect.children.length <= 1) {
            const option = document.createElement('option');
            option.value = '1';
            option.textContent = 'General Support';
            categorySelect.appendChild(option);
        }
    }
}

async function handleCreateTicket(e) {
    e.preventDefault();
    showLoading();

    const formData = new FormData();
    formData.append('subject', document.getElementById('ticketSubject').value);
    formData.append('description', document.getElementById('ticketDescription').value);
    formData.append('categoryId', document.getElementById('ticketCategory').value);

    const attachment = document.getElementById('ticketAttachment').files[0];
    if (attachment) {
        formData.append('attachment', attachment);
    }

    try {
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Ticket created successfully!', 'success');
            document.getElementById('createTicketForm').reset();
            showPage('dashboard');
        } else {
            showToast(data.error || 'Error creating ticket', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    } finally {
        hideLoading();
    }
}

// Ticket detail functions
async function showTicketDetail(ticketId) {
    showLoading();
    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        const ticket = await response.json();

        if (response.ok) {
            displayTicketDetail(ticket);
            showPage('ticketDetail');
        } else {
            showToast('Error loading ticket details', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    } finally {
        hideLoading();
    }
}

function displayTicketDetail(ticket) {
    const container = document.getElementById('ticketDetailContainer');
    const category = categories.find(c => c.id === ticket.categoryId);
    const statusClass = `status-${ticket.status.replace(' ', '-')}`;

    container.innerHTML = `
        <div class="ticket-detail-header">
            <h2>${ticket.subject}</h2>
            <div class="ticket-meta">
                <span class="ticket-status ${statusClass}">${ticket.status}</span>
                <span>${category ? category.name : 'Unknown'}</span>
                <span>Created: ${formatDate(ticket.createdAt)}</span>
                <span>Updated: ${formatDate(ticket.updatedAt)}</span>
                ${ticket.assignedAgentName ? `<span>Assigned to: ${ticket.assignedAgentName}</span>` : ''}
            </div>
            <div class="ticket-actions">
                <button class="btn btn-primary" onclick="openChat('${ticket.id}')">
                    <i class="fas fa-comments"></i> Chat with Agent
                </button>
            </div>
        </div>
        <div class="ticket-detail-content">
            <p>${ticket.description}</p>
            ${ticket.attachment ? `<p><strong>Attachment:</strong> ${ticket.attachment}</p>` : ''}
        </div>
        <div class="comments-section">
            <h3>Comments (${ticket.comments.length})</h3>
            <div id="commentsList">
                ${ticket.comments.map(comment => `
                    <div class="comment">
                        <div class="comment-header">
                            <span>User</span>
                            <span>${formatDate(comment.createdAt)}</span>
                        </div>
                        <div>${comment.content}</div>
                    </div>
                `).join('')}
            </div>
            <div class="add-comment">
                <textarea id="newComment" placeholder="Add a comment..."></textarea>
                <button class="btn btn-primary" onclick="addComment('${ticket.id}')">Add Comment</button>
            </div>
        </div>
    `;
}

async function addComment(ticketId) {
    const content = document.getElementById('newComment').value;
    if (!content.trim()) return;

    try {
        const response = await fetch(`/api/tickets/${ticketId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            document.getElementById('newComment').value = '';
            showTicketDetail(ticketId);
            showToast('Comment added successfully!', 'success');
        } else {
            showToast('Error adding comment', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Vote functions
async function voteTicket(ticketId, vote) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ vote })
        });

        if (response.ok) {
            loadTickets(); // Refresh the tickets list
        } else {
            showToast('Error voting on ticket', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

// Admin functions
async function loadAdminPanel() {
    if (currentUser.role !== 'admin') return;

    await loadUsers();
    await loadCategories();
    displayCategories();
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        const users = await response.json();

        if (response.ok) {
            displayUsers(users);
        } else {
            showToast('Error loading users', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${formatDate(user.createdAt)}</td>
        `;
        tbody.appendChild(row);
    });
}

async function loadCategories() {
    try {
        const token = localStorage.getItem('token');
        console.log('Loading categories with token:', token ? 'present' : 'missing');
        
        const response = await fetch('/api/categories', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('Categories response status:', response.status);
        const data = await response.json();
        console.log('Categories response data:', data);

        if (response.ok) {
            categories = data;
            populateCategorySelects();
        } else {
            console.error('Categories error:', data);
            showToast('Error loading categories', 'error');
        }
    } catch (error) {
        console.error('Categories network error:', error);
        showToast('Network error', 'error');
    }
}

function populateCategorySelects() {
    const selects = [
        document.getElementById('categoryFilter'),
        document.getElementById('ticketCategory'),
        document.getElementById('myTicketsCategoryFilter')
    ];

    selects.forEach(select => {
        if (select) {
            populateCategorySelect(select);
        }
    });
}

function populateCategorySelect(select) {
    const currentValue = select.value;
    select.innerHTML = '<option value="">Select Category</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
    });

    if (currentValue) {
        select.value = currentValue;
    }
}

function displayCategories() {
    const container = document.getElementById('categoriesList');
    container.innerHTML = '';

    categories.forEach(category => {
        const div = document.createElement('div');
        div.className = 'category-item';
        div.innerHTML = `
            <span>${category.name}</span>
            <span>ID: ${category.id}</span>
        `;
        container.appendChild(div);
    });
}

// Admin tab switching
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('admin-tab')) {
        const tabName = e.target.dataset.tab;
        switchAdminTab(tabName);
    }
});

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.admin-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}

// Add category form
document.getElementById('addCategoryForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('newCategoryName').value;
    if (!name.trim()) return;

    try {
        const response = await fetch('/api/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ name })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('newCategoryName').value = '';
            await loadCategories();
            displayCategories();
            showToast('Category added successfully!', 'success');
        } else {
            showToast(data.error || 'Error adding category', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
});

// Utility functions
function showAuth() {
    authContainer.style.display = 'flex';
    appContainer.style.display = 'none';
}

function showApp() {
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    
    // Show/hide admin link based on user role
    const adminLink = document.querySelector('.admin-only');
    if (adminLink) {
        adminLink.style.display = currentUser.role === 'admin' ? 'block' : 'none';
    }
}

function showLoading() {
    loadingSpinner.style.display = 'flex';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Chat functions

async function openChat(ticketId) {
    try {
        showLoading();
        const response = await fetch(`/api/chat/${ticketId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        const data = await response.json();

        if (response.ok) {
            currentChatTicket = data.ticket;
            chatMessages = data.chat;
            
            // Update chat UI
            document.getElementById('chatTicketSubject').textContent = `Ticket: ${data.ticket.subject}`;
            document.getElementById('chatAgentInfo').textContent = `Agent: ${data.agent || 'Unassigned'}`;
            document.getElementById('chatStatus').textContent = data.ticket.status;
            
            displayChatMessages();
            showPage('chat');
        } else {
            showToast('Error loading chat', 'error');
        }
    } catch (error) {
        console.error('Open chat error:', error);
        showToast('Network error', 'error');
    } finally {
        hideLoading();
    }
}

function displayChatMessages() {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';

    if (chatMessages.length === 0) {
        container.innerHTML = `
            <div class="message system">
                <div class="message-content">
                    Welcome! Start the conversation by sending a message.
                </div>
            </div>
        `;
        return;
    }

    chatMessages.forEach(message => {
        const messageElement = createMessageElement(message);
        container.appendChild(messageElement);
    });

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function createMessageElement(message) {
    const div = document.createElement('div');
    const isCurrentUser = message.sender === currentUser.id;
    const messageType = isCurrentUser ? 'user' : 'agent';
    
    div.className = `message ${messageType}`;
    div.innerHTML = `
        <div class="message-content">
            ${message.content}
        </div>
        <div class="message-info">
            ${message.senderName} • ${formatDate(message.timestamp)}
        </div>
    `;

    return div;
}

async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const content = input.value.trim();
    
    if (!content) return;

    try {
        const response = await fetch(`/api/chat/${currentChatTicket.id}/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ content })
        });

        const message = await response.json();

        if (response.ok) {
            input.value = '';
            chatMessages.push(message);
            displayChatMessages();
        } else {
            showToast('Error sending message', 'error');
        }
    } catch (error) {
        console.error('Send message error:', error);
        showToast('Network error', 'error');
    }
}

// Setup chat event listeners
document.addEventListener('DOMContentLoaded', function() {
    const sendBtn = document.getElementById('sendMessageBtn');
    const chatInput = document.getElementById('chatMessageInput');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
});

// Notification functions

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            notifications = await response.json();
            updateNotificationCount();
            displayNotifications();
        }
    } catch (error) {
        console.error('Load notifications error:', error);
    }
}

function updateNotificationCount() {
    unreadCount = notifications.filter(n => !n.read).length;
    const countElement = document.getElementById('notificationCount');
    
    if (unreadCount > 0) {
        countElement.textContent = unreadCount;
        countElement.style.display = 'block';
    } else {
        countElement.style.display = 'none';
    }
}

function displayNotifications() {
    const container = document.getElementById('notificationsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (notifications.length === 0) {
        container.innerHTML = '<div class="no-notifications">No notifications</div>';
        return;
    }
    
    notifications.forEach(notification => {
        const notificationElement = createNotificationElement(notification);
        container.appendChild(notificationElement);
    });
}

function createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
    
    let actionButton = '';
    if (notification.type === 'best_providers' && notification.data.agents) {
        actionButton = `<button class="btn btn-primary btn-sm" onclick="viewBestProviders('${notification.data.ticketId}')">View Providers</button>`;
    } else if (notification.type === 'agent_response' && notification.data.ticketId) {
        actionButton = `<button class="btn btn-primary btn-sm" onclick="openChat('${notification.data.ticketId}')">View Chat</button>`;
    }
    
    div.innerHTML = `
        <div class="notification-content">
            <h4>${notification.title}</h4>
            <p>${notification.message}</p>
            <small>${formatDate(notification.createdAt)}</small>
        </div>
        <div class="notification-actions">
            ${actionButton}
            ${!notification.read ? `<button class="btn btn-secondary btn-sm" onclick="markNotificationRead('${notification.id}')">Mark Read</button>` : ''}
        </div>
    `;
    
    return div;
}

async function markNotificationRead(notificationId) {
    try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const notification = notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
                updateNotificationCount();
                displayNotifications();
            }
        }
    } catch (error) {
        console.error('Mark notification read error:', error);
    }
}

function viewBestProviders(ticketId) {
    // This would show a modal with the best service providers
    showToast('Best service providers feature coming soon!', 'info');
}

// Setup notification bell click
document.addEventListener('DOMContentLoaded', function() {
    const notificationBell = document.getElementById('notificationBell');
    if (notificationBell) {
        notificationBell.addEventListener('click', function() {
            showPage('notifications');
            loadNotifications();
        });
    }
});

// Global functions for onclick handlers
window.showPage = showPage;
window.voteTicket = voteTicket;
window.addComment = addComment;
window.openChat = openChat;
window.markNotificationRead = markNotificationRead;
window.viewBestProviders = viewBestProviders; 