// 製作業者画面の状態
let makerState = {
    token: localStorage.getItem("maker_password") || "",
    orders: []
};

// DOM要素のキャッシュ
const elements = {
    loginContainer: document.getElementById('login-container'),
    makerDashboard: document.getElementById('maker-dashboard'),
    passwordInput: document.getElementById('maker-password-input'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    historyTbody: document.getElementById('history-tbody'),
    
    // 詳細モーダル
    detailModal: document.getElementById('detail-modal'),
    closeDetailModalBtn: document.getElementById('close-detail-modal-btn'),
    closeDetailModalBtnLower: document.getElementById('close-detail-modal-btn-lower'),
    detailOrderNumber: document.getElementById('detail-order-number'),
    detailOrderDate: document.getElementById('detail-order-date'),
    detailSourceNumber: document.getElementById('detail-source-number'),
    detailStatusBadge: document.getElementById('detail-status-badge'),
    detailTbody: document.getElementById('detail-tbody'),
    
    // 足元数量
    footSStd: document.getElementById('foot-s-std'),
    footMStd: document.getElementById('foot-m-std'),
    footLStd: document.getElementById('foot-l-std'),
    footXLStd: document.getElementById('foot-xl-std'),
    footXXLStd: document.getElementById('foot-xxl-std'),
    footSBd: document.getElementById('foot-s-bd'),
    footMBd: document.getElementById('foot-m-bd'),
    footLBd: document.getElementById('foot-l-bd'),
    footXLBd: document.getElementById('foot-xl-bd'),
    footXXLBd: document.getElementById('foot-xxl-bd'),
    footTotal: document.getElementById('foot-total'),
    
    // トースト
    toast: document.getElementById('toast'),
    toastIcon: document.getElementById('toast-icon'),
    toastMessage: document.getElementById('toast-message')
};

// トースト通知を表示
function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toastIcon.textContent = type === 'success' ? '✓' : '⚠️';
    if (type === 'error') {
        elements.toast.classList.add('error');
    } else {
        elements.toast.classList.remove('error');
    }
    elements.toast.classList.add('active');
    setTimeout(() => {
        elements.toast.classList.remove('active');
    }, 3000);
}

// 認証テストと画面初期化
async function initAuth() {
    if (makerState.token) {
        const success = await loadOrders();
        if (success) {
            elements.loginContainer.style.display = 'none';
            elements.makerDashboard.style.display = 'block';
        } else {
            localStorage.removeItem("maker_password");
            makerState.token = "";
            elements.loginContainer.style.display = 'block';
            elements.makerDashboard.style.display = 'none';
        }
    } else {
        elements.loginContainer.style.display = 'block';
        elements.makerDashboard.style.display = 'none';
    }
}

// ログインの実行
async function handleLogin() {
    const password = elements.passwordInput.value.trim();
    if (!password) {
        showToast("パスワードを入力してください。", "error");
        return;
    }
    
    try {
        const response = await fetch('/api/maker/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "ログインに失敗しました。");
        }
        
        const resData = await response.json();
        makerState.token = resData.token;
        localStorage.setItem("maker_password", resData.token);
        
        elements.loginContainer.style.display = 'none';
        elements.makerDashboard.style.display = 'block';
        showToast("ログインに成功しました。");
        loadOrders();
    } catch (error) {
        showToast(error.message, "error");
    }
}

// ログアウト
function handleLogout() {
    localStorage.removeItem("maker_password");
    makerState.token = "";
    elements.loginContainer.style.display = 'block';
    elements.makerDashboard.style.display = 'none';
    showToast("ログアウトしました。");
}

// 外注発注履歴の取得
async function loadOrders() {
    try {
        const response = await fetch(`/api/maker/orders?token=${encodeURIComponent(makerState.token)}`);
        if (response.status === 401) {
            return false;
        }
        if (!response.ok) {
            throw new Error("発注データの取得に失敗しました。");
        }
        const data = await response.json();
        makerState.orders = data.orders;
        renderOrders();
        return true;
    } catch (error) {
        console.error("loadOrders error:", error);
        showToast("データの取得中にエラーが発生しました。", "error");
        return false;
    }
}

// 発注リストのレンダリング
function renderOrders() {
    elements.historyTbody.innerHTML = '';
    
    if (makerState.orders.length === 0) {
        elements.historyTbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    ご発注依頼データはありません。
                </td>
            </tr>
        `;
        return;
    }
    
    makerState.orders.forEach(order => {
        const tr = document.createElement('tr');
        
        const dateObj = new Date(order.created_at);
        const formattedDate = isNaN(dateObj.getTime()) ? order.created_at : 
            `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        
        let badgeClass = 'badge-warning';
        if (order.status === '納品完了') badgeClass = 'badge-success';

        // 代表画像 HTML
        let imgHtml = '';
        if (order.thumbnail_url) {
            imgHtml = `<img src="${order.thumbnail_url}" alt="代表画像" class="col-thumb-img" style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px; cursor: pointer; transition: transform 0.2s;" onclick="window.open('${order.thumbnail_url}', '_blank')">`;
        } else {
            imgHtml = `<span style="color: var(--text-secondary); opacity: 0.4;">-</span>`;
        }

        // プリントデータ HTML
        let printHtml = '';
        if (order.print_files && order.print_files.length > 0) {
            order.print_files.forEach(file => {
                printHtml += `
                    <a href="${file.download_url}" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:0.25rem; margin: 2px; padding: 0.2rem 0.5rem; font-size: 0.8rem; background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd; text-decoration: none; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.filename}">
                        📥 ${file.filename}
                    </a>
                `;
            });
        } else {
            printHtml = `<span class="badge badge-warning">未登録</span>`;
        }

        tr.innerHTML = `
            <td style="text-align: center; vertical-align: middle;">${imgHtml}</td>
            <td>${formattedDate}</td>
            <td style="font-weight: bold; color: var(--primary);" title="${order.maker_order_number}">${order.maker_order_number}</td>
            <td title="${order.source_order_number ? order.source_order_number : '社内直接発注'}">${order.source_order_number ? order.source_order_number : '<span style="color:var(--text-secondary)">社内直接発注</span>'}</td>
            <td style="text-align: right; font-weight: bold;">${order.total_quantity}</td>
            <td><span class="badge ${badgeClass}">${order.status}</span></td>
            <td style="vertical-align: middle;">${printHtml}</td>
            <td style="text-align: center; vertical-align: middle;">
                <button class="btn btn-secondary btn-detail" data-id="${order.id}">🔍 詳細表示</button>
            </td>
        `;
        
        tr.querySelector('.btn-detail').addEventListener('click', () => openOrderDetails(order.id));
        elements.historyTbody.appendChild(tr);
    });
}

// 詳細モーダルを開く
async function openOrderDetails(orderId) {
    try {
        const response = await fetch(`/api/maker/order-details?id=${orderId}&token=${encodeURIComponent(makerState.token)}`);
        if (!response.ok) {
            throw new Error("詳細データの取得に失敗しました。");
        }
        
        const data = await response.json();
        const { order, items } = data;
        
        elements.detailOrderNumber.textContent = order.maker_order_number;
        const dateObj = new Date(order.created_at);
        elements.detailOrderDate.textContent = isNaN(dateObj.getTime()) ? '----/--/--' : 
            `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
        elements.detailSourceNumber.textContent = order.source_order_number || "なし（社内直接発注）";
        
        // ステータスバッジ
        elements.detailStatusBadge.textContent = order.status;
        elements.detailStatusBadge.className = `badge ${order.status === '納品完了' ? 'badge-success' : 'badge-warning'}`;
        
        elements.detailTbody.innerHTML = '';
        const sizeTotals = Array(10).fill(0);
        let totalCount = 0;
        
        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.style.border = '1px solid #cbd5e1';
            
            let sizeCellsHtml = '';
            item.qtys.forEach((qty, qIdx) => {
                sizeTotals[qIdx] += qty;
                totalCount += qty;
                sizeCellsHtml += `<td style="border: 1px solid #cbd5e1; text-align: center; font-weight: ${qty > 0 ? 'bold' : 'normal'};">${qty > 0 ? qty : '-'}</td>`;
            });
            
            let printFileCell = '';
            if (item.print_files && item.print_files.length > 0) {
                item.print_files.forEach(file => {
                    const downloadUrl = `/api/download-print?product_code=${item.product_code}&body=${encodeURIComponent(item.body_color || item.body)}&design=${encodeURIComponent(item.design)}&filename=${encodeURIComponent(file)}&token=${encodeURIComponent(makerState.token)}`;
                    printFileCell += `
                        <a href="${downloadUrl}" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:0.25rem; margin-bottom:4px; padding: 0.2rem 0.5rem; font-size: 0.8rem; background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd; text-decoration: none;" title="${file}">
                            📥 ${file}
                        </a>
                    `;
                });
            } else {
                printFileCell = `<span class="badge badge-warning">未登録</span>`;
            }
            
            const images = item.images || [];
            let imgHtml = '';
            if (images.length > 0) {
                imgHtml = `<div style="display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: wrap;">`;
                images.forEach(imgUrl => {
                    imgHtml += `<img src="${imgUrl}" alt="${item.product_name}" class="col-thumb-img" style="width: 35px; height: 35px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.open('${imgUrl}', '_blank')">`;
                });
                imgHtml += `</div>`;
            } else {
                imgHtml = `<span style="color: var(--text-secondary); opacity: 0.4;">-</span>`;
            }
            
            tr.innerHTML = `
                <td style="border: 1px solid #cbd5e1; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid #cbd5e1; text-align: center; vertical-align: middle;">${imgHtml}</td>
                <td style="border: 1px solid #cbd5e1; font-weight:bold;" title="${item.product_code}">${item.product_code}</td>
                <td style="border: 1px solid #cbd5e1; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.product_name}">${item.product_name}</td>
                <td style="border: 1px solid #cbd5e1;" title="${item.body_color || ''}">${item.body_color || ''}</td>
                <td style="border: 1px solid #cbd5e1;" title="${item.body || ''}">${item.body || ''}</td>
                <td style="border: 1px solid #cbd5e1;" title="${item.design}">${item.design}</td>
                ${sizeCellsHtml}
                <td style="border: 1px solid #cbd5e1; text-align: center;" class="hide-on-print">${printFileCell}</td>
            `;
            elements.detailTbody.appendChild(tr);
        });
        
        // フッター集計
        elements.footSStd.innerHTML = `<strong>${sizeTotals[0] > 0 ? sizeTotals[0] : '-'}</strong>`;
        elements.footMStd.innerHTML = `<strong>${sizeTotals[1] > 0 ? sizeTotals[1] : '-'}</strong>`;
        elements.footLStd.innerHTML = `<strong>${sizeTotals[2] > 0 ? sizeTotals[2] : '-'}</strong>`;
        elements.footXLStd.innerHTML = `<strong>${sizeTotals[3] > 0 ? sizeTotals[3] : '-'}</strong>`;
        elements.footXXLStd.innerHTML = `<strong>${sizeTotals[4] > 0 ? sizeTotals[4] : '-'}</strong>`;
        elements.footSBd.innerHTML = `<strong>${sizeTotals[5] > 0 ? sizeTotals[5] : '-'}</strong>`;
        elements.footMBd.innerHTML = `<strong>${sizeTotals[6] > 0 ? sizeTotals[6] : '-'}</strong>`;
        elements.footLBd.innerHTML = `<strong>${sizeTotals[7] > 0 ? sizeTotals[7] : '-'}</strong>`;
        elements.footXLBd.innerHTML = `<strong>${sizeTotals[8] > 0 ? sizeTotals[8] : '-'}</strong>`;
        elements.footXXLBd.innerHTML = `<strong>${sizeTotals[9] > 0 ? sizeTotals[9] : '-'}</strong>`;
        elements.footTotal.innerHTML = `<strong>${totalCount}</strong>`;
        
        elements.detailModal.classList.add('active');
        
    } catch (error) {
        console.error("openOrderDetails error:", error);
        showToast(error.message, "error");
    }
}

// モーダルを閉じる
function closeDetailModal() {
    elements.detailModal.classList.remove('active');
}

// 起動とイベント紐付け
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.refreshBtn.addEventListener('click', loadOrders);
    
    elements.closeDetailModalBtn.addEventListener('click', closeDetailModal);
    elements.closeDetailModalBtnLower.addEventListener('click', closeDetailModal);
    
    // 印刷処理
    const printBtn = document.getElementById('maker-detail-print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            document.body.classList.add('print-mode-maker');
            window.print();
        });
    }
    
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('print-mode-maker');
    });

    // 背景クリックで閉じる
    elements.detailModal.addEventListener('click', (e) => {
        if (e.target === elements.detailModal) closeDetailModal();
    });
});
