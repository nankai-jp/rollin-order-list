// 管理画面の状態
let adminState = {
    token: localStorage.getItem("admin_password") || "",
    orders: [],
    currentOrder: null
};

// DOM要素のキャッシュ
const elements = {
    loginContainer: document.getElementById('login-container'),
    adminDashboard: document.getElementById('admin-dashboard'),
    passwordInput: document.getElementById('admin-password-input'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    historyTbody: document.getElementById('history-tbody'),
    
    // 注文詳細モーダル
    detailModal: document.getElementById('detail-modal'),
    closeDetailModalBtn: document.getElementById('close-detail-modal-btn'),
    closeDetailModalBtnLower: document.getElementById('close-detail-modal-btn-lower'),
    detailPrintBtn: document.getElementById('detail-print-btn'),
    
    // 詳細の宛先・日付・情報
    detailOrderDate: document.getElementById('detail-order-date'),
    detailOrderNumber: document.getElementById('detail-order-number'),
    detailClientCompany: document.getElementById('detail-client-company'),
    detailClientName: document.getElementById('detail-client-name'),
    detailClientPhone: document.getElementById('detail-client-phone'),
    detailTbody: document.getElementById('detail-tbody'),
    
    // 集計フッター
    footGrandTotal: document.getElementById('foot-grand-total'),
    
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
    if (adminState.token) {
        const success = await loadHistory();
        if (success) {
            elements.loginContainer.style.display = 'none';
            elements.adminDashboard.style.display = 'block';
        } else {
            // パスワードが無効な場合
            localStorage.removeItem("admin_password");
            adminState.token = "";
            elements.loginContainer.style.display = 'block';
            elements.adminDashboard.style.display = 'none';
        }
    } else {
        elements.loginContainer.style.display = 'block';
        elements.adminDashboard.style.display = 'none';
    }
}

// ログインの実行
async function handleLogin() {
    const password = elements.passwordInput.value.trim();
    if (!password) {
        showToast("パスワードを入力してください。", "error");
        return;
    }
    
    // 一時的に設定して検証
    adminState.token = password;
    const success = await loadHistory();
    if (success) {
        localStorage.setItem("admin_password", password);
        elements.loginContainer.style.display = 'none';
        elements.adminDashboard.style.display = 'block';
        showToast("ログインに成功しました。");
    } else {
        adminState.token = "";
        showToast("パスワードが正しくありません。", "error");
    }
}

// ログアウト
function handleLogout() {
    localStorage.removeItem("admin_password");
    adminState.token = "";
    elements.loginContainer.style.display = 'block';
    elements.adminDashboard.style.display = 'none';
    showToast("ログアウトしました。");
}

// 履歴一覧の取得
async function loadHistory() {
    try {
        const response = await fetch(`/api/admin/orders?token=${encodeURIComponent(adminState.token)}`);
        if (response.status === 401) {
            return false;
        }
        if (!response.ok) {
            throw new Error("履歴の取得に失敗しました。");
        }
        const data = await response.json();
        adminState.orders = data.orders;
        renderHistory();
        return true;
    } catch (error) {
        console.error("loadHistory error:", error);
        showToast("データの取得中にエラーが発生しました。", "error");
        return false;
    }
}

// 履歴一覧のレンダリング
function renderHistory() {
    elements.historyTbody.innerHTML = '';
    
    if (adminState.orders.length === 0) {
        elements.historyTbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    登録されている発注履歴はありません。
                </td>
            </tr>
        `;
        return;
    }
    
    adminState.orders.forEach(order => {
        const tr = document.createElement('tr');
        
        // 日付のフォーマット (YYYY-MM-DD HH:MM)
        const dateObj = new Date(order.created_at);
        const formattedDate = isNaN(dateObj.getTime()) ? order.created_at : 
            `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
            
        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td style="font-weight: bold; color: var(--primary);">${order.order_number}</td>
            <td>${order.company_name}</td>
            <td>${order.contact_name}</td>
            <td>${order.phone_number}</td>
            <td style="text-align: right; font-weight: bold;">${order.total_quantity}</td>
            <td style="text-align: right; font-weight: bold; color: var(--accent);">¥ ${order.total_amount.toLocaleString()}</td>
            <td style="text-align: center;">
                <button class="btn btn-secondary btn-detail" data-id="${order.id}">🔍 詳細表示</button>
            </td>
        `;
        
        tr.querySelector('.btn-detail').addEventListener('click', () => openOrderDetails(order.id));
        elements.historyTbody.appendChild(tr);
    });
}

// 注文詳細モーダルを開く
async function openOrderDetails(orderId) {
    try {
        const response = await fetch(`/api/admin/order-details?id=${orderId}&token=${encodeURIComponent(adminState.token)}`);
        if (!response.ok) {
            throw new Error("詳細データの取得に失敗しました。");
        }
        
        const data = await response.json();
        const { order, items } = data;
        
        // 1. 宛先、日付等のバインド
        const dateObj = new Date(order.created_at);
        elements.detailOrderDate.textContent = isNaN(dateObj.getTime()) ? '----年--月--日' :
            `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
            
        elements.detailOrderNumber.textContent = order.order_number;
        elements.detailClientCompany.textContent = order.company_name;
        elements.detailClientName.textContent = order.contact_name;
        elements.detailClientPhone.textContent = order.phone_number;
        
        // 2. テーブル明細の描画
        elements.detailTbody.innerHTML = '';
        
        // サイズ別集計用の配列 (Std 5列, BD 5列)
        const sizeTotals = Array(10).fill(0);
        
        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.style.border = '1px solid #000';
            
            // 各サイズの描画セル
            let sizeCellsHtml = '';
            item.qtys.forEach((qty, qIdx) => {
                sizeTotals[qIdx] += qty;
                // 0 の場合は見やすさのために空またはハイフンにする
                sizeCellsHtml += `<td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: ${qty > 0 ? 'bold' : 'normal'};">${qty > 0 ? qty : '-'}</td>`;
            });
            
            tr.innerHTML = `
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid #000; padding: 6px 4px;">${item.product_code}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.product_name}</td>
                <td style="border: 1px solid #000; padding: 6px 4px;">${item.body}</td>
                <td style="border: 1px solid #000; padding: 6px 4px;">${item.design}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: right;">¥ ${item.wholesale_price.toLocaleString()}</td>
                ${sizeCellsHtml}
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold;">¥ ${item.subtotal_amount.toLocaleString()}</td>
            `;
            elements.detailTbody.appendChild(tr);
        });
        
        // 3. 集計フッターのバインド
        const sizeIds = [
            'foot-s-std', 'foot-m-std', 'foot-l-std', 'foot-xl-std', 'foot-xxl-std',
            'foot-s-bd', 'foot-m-bd', 'foot-l-bd', 'foot-xl-bd', 'foot-xxl-bd'
        ];
        sizeIds.forEach((id, idx) => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = `<strong>${sizeTotals[idx] > 0 ? sizeTotals[idx] : '-'}</strong>`;
            }
        });
        
        elements.footGrandTotal.innerHTML = `<strong>¥ ${order.total_amount.toLocaleString()}</strong>`;
        
        // 4. モーダル表示
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
    elements.refreshBtn.addEventListener('click', loadHistory);
    
    elements.closeDetailModalBtn.addEventListener('click', closeDetailModal);
    elements.closeDetailModalBtnLower.addEventListener('click', closeDetailModal);
    
    // 背景クリックで閉じる
    elements.detailModal.addEventListener('click', (e) => {
        if (e.target === elements.detailModal) closeDetailModal();
    });
    
    // 印刷処理
    elements.detailPrintBtn.addEventListener('click', () => {
        window.print();
    });
});
