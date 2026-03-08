/* assets/js/shell.js - Core Shell Logic */

const Shell = {
    user: null,
    events: {},

    // Event Bus
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    },

    emit(event, data) {
        if (!this.events[event]) return;
        this.events[event].forEach(cb => cb(data));
    },

    init() {
        // Set Brand Info from Config
        document.querySelector('.brand-name').textContent = SYSTEM_CONFIG.brandName;
        document.querySelector('.brand-sub').textContent = SYSTEM_CONFIG.brandSub;
        document.querySelector('.logo-box').textContent = SYSTEM_CONFIG.logo;

        this.generateSidebar();
        this.checkSession();
    },

    generateSidebar() {
        const nav = document.querySelector('.sidebar-nav');
        if (!nav) return;
        nav.innerHTML = '';

        SYSTEM_CONFIG.apps.forEach(app => {
            if (!app.active) return;

            const label = document.createElement('div');
            label.className = 'nav-label';
            label.textContent = app.name;
            nav.appendChild(label);

            app.menu.forEach(item => {
                const el = document.createElement('div');
                el.className = 'nav-item';
                el.id = `nav-${item.id}`;
                el.innerHTML = `<span class="icon">${item.icon}</span> ${item.label}`;
                if (item.badgeId) el.innerHTML += `<span class="nav-badge" id="${item.badgeId}">0</span>`;
                el.onclick = () => {
                    this.showPage(item.id);
                    if (item.filter) this.emit('app:filter', item.filter);
                };
                nav.appendChild(el);
            });

            if (app.adminMenu?.length) {
                const adminWrap = document.createElement('div');
                adminWrap.id = `admin-nav-${app.id}`;
                adminWrap.className = 'admin-section';
                adminWrap.style.display = 'none';

                const adminLabel = document.createElement('div');
                adminLabel.className = 'nav-label';
                adminLabel.style.marginTop = '8px';
                adminLabel.textContent = 'ผู้ดูแลระบบ';
                adminWrap.appendChild(adminLabel);

                app.adminMenu.forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'nav-item';
                    el.id = `nav-${item.id}`;
                    el.innerHTML = `<span class="icon">${item.icon}</span> ${item.label}`;
                    el.onclick = () => this.showPage(item.id);
                    adminWrap.appendChild(el);
                });
                nav.appendChild(adminWrap);
            }
        });
    },

    async checkSession() {
        const session = sessionStorage.getItem('deposit_session');
        if (session) {
            const data = JSON.parse(session);
            if (Date.now() - data.loginTime < 24 * 60 * 60 * 1000) {
                const user = await validateUser(data.employeeId);
                if (user) {
                    if (user.last_session_id && user.last_session_id !== data.sessionId) {
                        alert('มีการเข้าสู่ระบบซ้อน: ระบบจะนำคุณออกจากระบบ');
                        this.logout();
                        return;
                    }
                    this.user = user;
                    this.setupUserSession();
                    return;
                }
            }
        }
        document.body.style.overflow = 'hidden';
        document.getElementById('loginOverlay').style.display = 'flex';
    },

    setupUserSession() {
        if (!this.user) return;
        document.body.style.overflow = 'auto';
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('user-display').textContent = `👤 ${this.user.name} (${this.user.role})`;

        SYSTEM_CONFIG.apps.forEach(app => {
            const adminNav = document.getElementById(`admin-nav-${app.id}`);
            if (adminNav) adminNav.style.display = (this.user.role === 'admin') ? 'block' : 'none';
        });

        // Emit session ready event
        this.emit('session:ready', this.user);
    },

    async login(e) {
        if (e) e.preventDefault();
        const id = document.getElementById('login-id').value.trim();
        const err = document.getElementById('login-error');
        try {
            const user = await validateUser(id);
            if (user) {
                const sessionId = Math.random().toString(36).substring(2) + Date.now();
                sessionStorage.setItem('deposit_session', JSON.stringify({
                    employeeId: user.employee_id, loginTime: Date.now(), sessionId: sessionId
                }));
                await updateUser(user.id, { last_session_id: sessionId });
                this.user = user;
                this.setupUserSession();
                this.toast(`ยินดีต้อนรับ ${user.name}`, 'success');
            } else {
                err.style.display = 'block';
            }
        } catch (err) { this.toast('เข้าสู่ระบบล้มเหลว', 'error'); }
    },

    logout() {
        sessionStorage.removeItem('deposit_session');
        location.reload();
    },

    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById('page-' + id);
        if (pageEl) pageEl.classList.add('active');

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.getElementById('nav-' + id);
        if (navItem) navItem.classList.add('active');

        // Page specific titles or events
        const sub = document.getElementById('topbar-sub');
        if (id === 'dashboard') {
            sub.textContent = 'รายงานสรุปภาพรวมสำหรับผู้บริหาร';
            this.emit('page:dashboard');
        } else if (id === 'users') {
            sub.textContent = 'จัดการสิทธิ์ผู้เข้าใช้งานระบบ';
            this.emit('page:users');
        } else {
            sub.textContent = 'ข้อมูลทั้งหมด · 2026';
        }
    },

    // UI Helpers
    toast(msg, type = 'info') {
        const wrap = document.getElementById('toastWrap');
        if (!wrap) return;
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span class="ti">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span class="toast-msg">${msg}</span><div class="toast-bar"></div>`;
        wrap.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }
};

// Global hooks for convenience (mapped to Shell methods)
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function handleLogin(e) { Shell.login(e); }
function logout() { Shell.logout(); }

document.addEventListener('DOMContentLoaded', () => Shell.init());
