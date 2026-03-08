/* assets/js/app-deposit-refund.js - Module Logic (Namespaced & Prefixed) */

const DepositRefundApp = {
    db: [],
    editingId: null,
    editingUserId: null,
    currentStep: 1,
    filters: { status: '', owner: '', area: '', search: '' },
    charts: { trend: null, allocation: null, owner: null },

    steps: [
        { label: 'Step 1: ขอคืนเงินประกัน', desc: 'ผู้รับเหมากรอกข้อมูลอาคาร/พื้นที่' },
        { label: 'Step 2: การเงินตรวจสอบ', desc: 'ตรวจสอบยอดเงินและประเภทการคืน' },
        { label: 'Step 3: แนบหลักฐาน', desc: 'แนบไฟล์ PDF หลักฐานการจ่ายเงิน' },
        { label: 'Step 4: มอบหมาย TL', desc: 'ทีม TL รับทราบและเตรียมเข้างาน' },
        { label: 'Step 5: TL ดำเนินการ', desc: 'อยู่ระหว่างดำเนินการรื้อถอน/ติดตั้ง' },
        { label: 'Step 6: TL ส่งมอบงาน', desc: 'แนบหลักฐานรูปถ่าย/เอกสารส่งงาน' },
        { label: 'Step 7: ขอคืนเงินอาคาร', desc: 'ส่งเอกสารให้ทางอาคารตรวจสอบ' },
        { label: 'Step 8: ปิดงาน/ได้เงินคืน', desc: 'ได้รับเงินคืนและแนบหลักฐานปิดงาน' },
    ],

    init() {
        // Listen to Shell events
        Shell.on('session:ready', () => this.refreshData());
        Shell.on('app:filter', (f) => this.setStatusFilter(f));
        Shell.on('page:dashboard', () => this.renderExecutiveDashboard());
        Shell.on('page:users', () => this.loadUserTable());

        this.setupRealtime();
    },

    async refreshData() {
        try {
            this.db = await getDeposits();
            this.renderKPI();
            this.renderTable();
        } catch (err) { Shell.toast('Error: ' + err.message, 'error'); }
    },

    renderKPI() {
        const total = this.db.length;
        const proc = this.db.filter(x => x.status === 'On Process').length;
        const done = this.db.filter(x => x.status === 'Done').length;
        const fee = this.db.reduce((s, d) => s + (d.fee || 0) + (d.other || 0), 0);
        const install = this.db.reduce((s, d) => s + (d.deposit || 0), 0);
        const demo = this.db.reduce((s, d) => s + (d.demolish || 0), 0);

        // Sidebar Badges
        const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        setTxt('nav-total', total);
        setTxt('nav-process', proc);
        setTxt('nav-done', done);
        setTxt('sb-total-amt', '฿' + (this.db.reduce((s, x) => s + (x.total || 0), 0)).toLocaleString());
        setTxt('sb-dep-amt', '฿' + install.toLocaleString());
        setTxt('sb-updated', new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));

        const kr = document.getElementById('kpiRow');
        if (kr) {
            kr.innerHTML = `
                <div class="kpi"><div class="kpi-icon2 blue">📁</div><div><div class="kpi-val">${total}</div><div class="kpi-lbl">ทั้งหมด</div></div></div>
                <div class="kpi"><div class="kpi-icon2 orange">⏳</div><div><div class="kpi-val" style="color:var(--orange)">${proc}</div><div class="kpi-lbl">กำลังดำเนินการ</div></div></div>
                <div class="kpi"><div class="kpi-icon2 green">✅</div><div><div class="kpi-val" style="color:var(--green)">${done}</div><div class="kpi-lbl">เสร็จแล้ว</div></div></div>
                <div class="kpi"><div class="kpi-icon2 violet">🏛️</div><div><div class="kpi-val" style="color:var(--violet);font-size:16px">฿${fee.toLocaleString()}</div><div class="kpi-lbl">ค่าธรรมเนียม</div></div></div>
                <div class="kpi"><div class="kpi-icon2 blue">🛡️</div><div><div class="kpi-val" style="color:var(--blue);font-size:16px">฿${install.toLocaleString()}</div><div class="kpi-lbl">ประกันติดตั้ง</div></div></div>
                <div class="kpi"><div class="kpi-icon2 red">🚧</div><div><div class="kpi-val" style="color:var(--red);font-size:16px">฿${demo.toLocaleString()}</div><div class="kpi-lbl">ประกันรื้อถอน</div></div></div>
            `;
        }
    },

    renderTable() {
        const list = this.getFilteredDB();
        const tbody = document.getElementById('tbody');
        if (!tbody) return;
        document.getElementById('tableCount').textContent = list.length + ' รายการ';
        const empty = document.getElementById('emptyState');
        if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';

        tbody.innerHTML = list.map(d => `
            <tr>
                <td class="nowrap" style="font-weight:700">#${d.id}</td>
                <td>${this.statusBadge(d.status)}</td>
                <td class="dr-td-place"><div class="dr-place">${d.place}</div><div class="dr-cust">${d.customer || '—'}</div></td>
                <td>${d.owner || '—'}</td>
                <td>${d.pr || '—'}</td>
                <td>${d.dateReq || '—'}</td>
                <td>${d.dateDue || '—'}</td>
                <td class="nowrap" style="font-family:'Figtree';font-weight:600">฿${(d.total || 0).toLocaleString()}</td>
                <td>${this.workflowSteps(d)}</td>
                <td class="nowrap">
                    <div class="dr-actions">
                        <button class="dr-act-btn view" onclick="DepositRefundApp.openDetail(${d.id})" title="ดูรายละเอียด">👁</button>
                        <button class="dr-act-btn edit" onclick="DepositRefundApp.openEdit(${d.id})" title="แก้ไข">✏️</button>
                        ${d.status !== 'Cancel' ? `<button class="dr-act-btn delete" onclick="DepositRefundApp.confirmCancel(${d.id})" title="ยกเลิก">🚫</button>` : ''}
                        ${Shell.user?.role === 'admin' ? `<button class="dr-act-btn delete" onclick="DepositRefundApp.confirmDelete(${d.id})" title="ลบถาวร">🗑</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    },

    workflowSteps(d) {
        if (d.status === 'Cancel') return `<span style="color:var(--red);font-size:11.5px;font-weight:600">✕ ยกเลิกแล้ว</span>`;
        const idx = this.getStepIndex(d);
        const bars = [1, 2, 3, 4, 5, 6, 7, 8].map(s => {
            const cls = (s - 1 < idx) ? 'done' : (s - 1 === idx) ? 'active' : 'pending';
            return `<div class="dr-ps ${cls}"><div class="dot"></div></div>`;
        }).join('<div class="dr-ps-sep"></div>');
        return `<div onclick="DepositRefundApp.openWorkflow(${d.id})" style="cursor:pointer">
            <div class="dr-progress-steps">${bars}</div>
            <div style="margin-top:4px">${this.stepLabel(d)}</div>
        </div>`;
    },

    getStepIndex(d) {
        if (!d.pr && !d.deposit) return 0;
        if ((d.pr || d.deposit) && !d.pdf_payment) return 1;
        if (d.pdf_payment && !d.tl_team) return 2;
        if (d.tl_team && d.complete !== 'Complete') return 3;
        if (d.complete === 'Complete' && d.complete_tl !== 'On Process') return 4;
        if (d.complete_tl === 'On Process' && !d.pdf_tl_work) return 5;
        if (d.pdf_tl_work && !d.return_status) return 6;
        if (d.return_status && !d.pdf_user_final) return 7;
        return 8;
    },

    stepLabel(d) {
        const idx = this.getStepIndex(d);
        if (idx >= 7 || d.status === 'Done') return `<span style="color:var(--green);font-size:11.5px;font-weight:600">✓ ปิดงาน</span>`;
        return `<span style="color:var(--orange);font-size:11.5px;font-weight:600">${this.steps[idx]?.label.split(':')[1] || '—'}</span>`;
    },

    statusBadge(s) {
        if (s === 'Done') return `<span class="badge dr-b-done"><span class="dot"></span>Done</span>`;
        if (s === 'On Process') return `<span class="badge dr-b-process"><span class="dot"></span>กำลังดำเนินการ</span>`;
        if (s === 'Cancel') return `<span class="badge dr-b-cancel"><span class="dot"></span>ยกเลิก</span>`;
        return `<span class="badge dr-b-new"><span class="dot"></span>ใหม่</span>`;
    },

    applyFilters() {
        this.filters.search = document.getElementById('searchInput').value.toLowerCase();
        this.filters.owner = document.getElementById('ownerFilter').value;
        this.filters.area = document.getElementById('areaFilter').value;
        this.renderTable();
    },

    setStatusFilter(s) {
        this.filters.status = s;
        document.querySelectorAll('#statusPills .pill').forEach(p => {
            p.classList.remove('active');
            if (p.getAttribute('data-val') === s) p.classList.add('active');
        });
        this.renderTable();
    },

    getFilteredDB() {
        let list = this.db;
        const user = Shell.user;
        if (user?.role === 'tl' && user.area) {
            const allowed = user.area.split(',').map(s => s.trim().toLowerCase());
            list = list.filter(d => allowed.includes((d.area || '').toLowerCase()));
        }
        return list.filter(d => {
            const ms = !this.filters.status || d.status === this.filters.status;
            const mo = !this.filters.owner || d.owner === this.filters.owner;
            const ma = !this.filters.area || d.area === this.filters.area;
            const mq = !this.filters.search || [d.place, d.customer, d.owner, d.project, d.pr].join(' ').toLowerCase().includes(this.filters.search);
            return ms && mo && ma && mq;
        });
    },

    openAddModal() {
        this.editingId = null;
        document.getElementById('formTitle').textContent = 'เพิ่มรายการใหม่';
        document.getElementById('mainForm').reset();
        this.goToStep(1);
        openModal('formOverlay');
    },

    openEdit(id, step = 1) {
        const d = this.db.find(x => x.id === id);
        if (!d) return;
        this.editingId = id;
        document.getElementById('formTitle').textContent = `แก้ไขรายการ #${id}`;
        const fields = ['place', 'customer', 'owner', 'area', 'project', 'deal', 'contact', 'tel', 'mobile', 'office-tel', 'email', 'cost-sheet', 'pr', 'date-req', 'date-due', 'payto', 'paytype', 'date-check', 'date-acc', 'deposit', 'demolish', 'fee', 'other', 'total', 'remark', 'tl-team', 'complete', 'dep-status', 'complete-tl', 'return-status', 'date-return', 'return-type', 'date-accounting', 'final-remark', 'status', 'status-final'];
        fields.forEach(f => { const el = document.getElementById('f-' + f); if (el) el.value = d[f] || (el.type === 'number' ? 0 : ''); });
        this.goToStep(step);
        openModal('formOverlay');
    },

    goToStep(s) {
        this.currentStep = s;
        document.querySelectorAll('.form-step').forEach(el => el.classList.remove('active'));
        document.getElementById('step-' + s).classList.add('active');
        document.querySelectorAll('.dr-w-step').forEach((el, i) => {
            el.classList.remove('active', 'done');
            if (i + 1 < s) el.classList.add('done'); else if (i + 1 === s) el.classList.add('active');
        });
        document.getElementById('btnPrev').style.display = (s === 1) ? 'none' : 'block';
        document.getElementById('btnNext').style.display = (s === 8) ? 'none' : 'block';
    },

    prevStep() { if (this.currentStep > 1) this.goToStep(this.currentStep - 1); },
    nextStep() { if (this.currentStep < 8) this.goToStep(this.currentStep + 1); },

    async submitForm(e) {
        if (e && e.preventDefault) e.preventDefault();
        const btn = document.getElementById('formSubmitBtn');
        const oldText = btn.textContent; btn.disabled = true; btn.textContent = '⌛ กำลังบันทึก...';
        const getV = (id) => { const el = document.getElementById(id); return el ? (el.value === '' ? null : el.value) : null; };
        try {
            const fileUrls = {};
            const fileF = [{ i: 'f-pdf-payment', k: 'pdf_payment', f: 'payments' }, { i: 'f-pdf-layout', k: 'pdf_layout', f: 'layouts' }, { i: 'f-pdf-tl-work', k: 'pdf_tl_work', f: 'tl_works' }, { i: 'f-pdf-user-final', k: 'pdf_user_final', f: 'final_docs' }];
            for (const ff of fileF) { const input = document.getElementById(ff.i); if (input?.files?.[0]) fileUrls[ff.k] = await uploadFile(input.files[0], ff.f); }
            let sFinal = getV('f-status') || getV('f-status-final') || 'On Process';
            const obj = {
                place: getV('f-place'), owner: getV('f-owner'), customer: getV('f-customer'), area: getV('f-area'),
                project: getV('f-project'), deal: getV('f-deal'), pr: getV('f-pr'), dateReq: getV('f-date-req'),
                dateDue: getV('f-date-due'), dateCheck: getV('f-date-check'), dateAcc: getV('f-date-acc'),
                payTo: getV('f-payto'), payType: getV('f-paytype'), deposit: +getV('f-deposit') || 0,
                demolish: +getV('f-demolish') || 0, fee: +getV('f-fee') || 0, other: +getV('f-other') || 0,
                total: +getV('f-total') || 0, status: sFinal, depStatus: getV('f-dep-status'),
                complete: getV('f-complete'), tl_team: getV('f-tl-team'), complete_tl: getV('f-complete-tl'),
                status_final: sFinal, return_status: getV('f-return-status'), date_return: getV('f-date-return'),
                return_type: getV('f-return-type'), final_remark: getV('f-final-remark'), date_accounting: getV('f-date-accounting'),
                contact: getV('f-contact'), tel: getV('f-tel'), mobile: getV('f-mobile'), office_tel: getV('f-office-tel'),
                email: getV('f-email'), remark: getV('f-remark'), cost_sheet: getV('f-cost-sheet'),
                ...fileUrls
            };
            if (this.editingId) {
                const up = await updateDeposit(this.editingId, obj);
                const idx = this.db.findIndex(x => x.id === this.editingId); this.db[idx] = up; Shell.toast('แก้ไขสำเร็จ', 'success');
            } else {
                const ins = await insertDeposit(obj); if (ins) this.db.unshift(ins); Shell.toast('เพิ่มสำเร็จ', 'success');
            }
            closeModal('formOverlay'); this.renderTable(); this.renderKPI();
        } catch (err) { Shell.toast('Error: ' + err.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = oldText; }
    },

    openDetail(id) {
        const d = this.db.find(x => x.id === id);
        document.getElementById('detailTitle').textContent = d.place;
        let html = `<div class="detail-grid">`;
        [['ลูกค้า', d.customer], ['เจ้าของงาน', d.owner], ['พื้นที่', d.area], ['PR', d.pr], ['ยอดรวม', '฿' + (d.total || 0).toLocaleString()]].forEach(([k, v]) => {
            html += `<div class="detail-row"><div class="detail-key">${k}</div><div class="detail-val">${v || '—'}</div></div>`;
        });
        html += `</div>`;
        document.getElementById('detailBody').innerHTML = html;
        document.getElementById('detailEditBtn').onclick = () => { closeModal('detailOverlay'); this.openEdit(id); };
        openModal('detailOverlay');
    },

    openWorkflow(id) {
        const d = this.db.find(x => x.id === id);
        const sIdx = this.getStepIndex(d);
        const html = this.steps.map((s, i) => {
            const cls = i < sIdx ? 'done' : i === sIdx ? 'active' : 'pending';
            return `<div class="dr-wf-step ${i === sIdx ? 'dr-active-step' : ''}">
                <div class="dr-wf-icon ${cls}">${i < sIdx ? '✓' : i + 1}</div>
                <div class="dr-wf-content">
                    <div class="dr-wf-title">${s.label}</div>
                    <div class="dr-wf-desc">${s.desc}</div>
                    ${i === sIdx ? `<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="DepositRefundApp.openEdit(${id}, ${i + 1});closeModal('wfOverlay')">ดำเนินการ →</button>` : ''}
                </div>
            </div>`;
        }).join('');
        document.getElementById('wfBody').innerHTML = `<div class="dr-workflow">${html}</div>`;
        openModal('wfOverlay');
    },

    confirmCancel(id) {
        const d = this.db.find(x => x.id === id);
        document.getElementById('cancelTitle').textContent = `ยกเลิก "${d.place}"?`;
        document.getElementById('cancelOkBtn').onclick = async () => {
            const reason = document.getElementById('f-cancel-reason').value;
            if (!reason) return Shell.toast('ระบุเหตุผล', 'error');
            await updateDeposit(id, { status: 'Cancel', final_remark: 'ยกเลิก: ' + reason });
            this.refreshData(); closeModal('cancelOverlay');
        };
        openModal('cancelOverlay');
    },

    confirmDelete(id) { if (confirm('ลบถาวร?')) deleteDeposit(id).then(() => this.refreshData()); },

    async loadUserTable() {
        const users = await getUsers();
        document.getElementById('user-tbody').innerHTML = users.map(u => `
            <tr>
                <td>${u.employee_id}</td><td>${u.name}</td>
                <td><span class="badge ${u.role === 'admin' ? 'dr-b-violet' : u.role === 'tl' ? 'dr-b-orange' : 'dr-b-blue'}">${u.role}</span></td>
                <td>${u.area || '—'}</td>
                <td>
                    <button class="dr-act-btn edit" onclick="DepositRefundApp.openEditUserModal(${u.id})">✏️</button>
                    <button class="dr-act-btn delete" onclick="DepositRefundApp.deleteUserPrompt(${u.id}, '${u.name}')">🗑</button>
                </td>
            </tr>
        `).join('');
    },

    openAddUserModal() {
        this.editingUserId = null;
        document.getElementById('userModalTitle').textContent = 'เพิ่มผู้ใช้';
        document.getElementById('u-id').value = '';
        document.getElementById('u-name').value = '';
        document.getElementById('u-role').value = 'user';
        document.getElementById('u-area').value = '';
        openModal('userOverlay');
    },

    async openEditUserModal(id) {
        const users = await getUsers(); const u = users.find(x => x.id === id);
        this.editingUserId = id;
        document.getElementById('userModalTitle').textContent = 'แก้ไขผู้ใช้';
        document.getElementById('u-id').value = u.employee_id;
        document.getElementById('u-name').value = u.name;
        document.getElementById('u-role').value = u.role;
        document.getElementById('u-area').value = u.area || '';
        this.toggleAreaSelect(u.role);
        openModal('userOverlay');
    },

    async handleUserSubmit(e) {
        if (e) e.preventDefault();
        const obj = {
            employee_id: document.getElementById('u-id').value,
            name: document.getElementById('u-name').value,
            role: document.getElementById('u-role').value,
            area: document.getElementById('u-area').value
        };
        if (this.editingUserId) await updateUser(this.editingUserId, obj); else await updateUser(null, obj);
        closeModal('userOverlay'); this.loadUserTable();
    },

    toggleAreaSelect(role) { document.getElementById('u-area-group').style.display = (role === 'tl') ? 'block' : 'none'; },
    handleFileSelect(input) { if (input.files[0]) document.getElementById(input.id + '-name')?.textContent = input.files[0].name; },

    setupRealtime() { _supabase.channel('public:deposits').on('postgres_changes', { event: '*', schema: 'public', table: 'deposits' }, () => this.refreshData()).subscribe(); },

    renderExecutiveDashboard() {
        const totalVal = this.db.reduce((s, d) => s + (d.total || 0), 0);
        const totalInstall = this.db.reduce((s, d) => s + (d.deposit || 0), 0);
        const totalDemo = this.db.reduce((s, d) => s + (d.demolish || 0), 0);
        const totalFee = this.db.reduce((s, d) => s + (d.fee || 0) + (d.other || 0), 0);
        const valEl = document.getElementById('db-total-valuation');
        if (!valEl) return;
        valEl.textContent = '฿' + totalVal.toLocaleString();
        document.getElementById('db-total-install').textContent = '฿' + totalInstall.toLocaleString();
        document.getElementById('db-total-demo').textContent = '฿' + totalDemo.toLocaleString();
        document.getElementById('db-total-fee').textContent = '฿' + totalFee.toLocaleString();

        const feed = new Array(12).fill(0); const depd = new Array(12).fill(0);
        this.db.forEach(d => { if (d.dateReq) { const m = new Date(d.dateReq).getMonth(); feed[m] += (d.fee || 0); depd[m] += ((d.deposit || 0) + (d.demolish || 0)); } });

        if (this.charts.trend) this.charts.trend.destroy();
        this.charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'line', data: { labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], datasets: [{ label: 'ค่าธรรมเนียม', data: feed, borderColor: '#94a3b8', fill: true }, { label: 'เงินประกัน', data: depd, borderColor: '#d4af37', fill: true }] },
            options: { maintainAspectRatio: false }
        });

        if (this.charts.allocation) this.charts.allocation.destroy();
        this.charts.allocation = new Chart(document.getElementById('financeAllocationChart'), {
            type: 'doughnut', data: { labels: ['ประกันติดตั้ง', 'ประกันรื้อถอน', 'ค่าธรรมเนียม'], datasets: [{ data: [totalInstall, totalDemo, totalFee], backgroundColor: ['#1e293b', '#d4af37', '#94a3b8'] }] },
            options: { maintainAspectRatio: false, cutout: '70%' }
        });

        const ownerFin = {};
        this.db.forEach(d => { if (d.owner) ownerFin[d.owner] = (ownerFin[d.owner] || 0) + (d.total || 0); });
        if (this.charts.owner) this.charts.owner.destroy();
        this.charts.owner = new Chart(document.getElementById('ownerFinanceChart'), {
            type: 'bar', data: { labels: Object.keys(ownerFin), datasets: [{ label: 'มูลค่า (฿)', data: Object.values(ownerFin), backgroundColor: '#1e293b' }] },
            options: { maintainAspectRatio: false, indexAxis: 'y' }
        });
    },

    exportCSV() {
        const rows = this.db.map(d => [d.id, d.status, d.place, d.owner, d.total]);
        let csv = 'ID,Status,Building,Owner,Total\n' + rows.map(r => r.join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'data.csv'; link.click();
    }
};

DepositRefundApp.init();
