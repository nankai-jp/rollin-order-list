// 管理画面の状態
let adminState = {
    token: localStorage.getItem("admin_password") || "",
    orders: [],
    currentOrder: null
};

// 製作業者発注作成の状態
let makerCreateState = {
    sourceOrderNumber: null,
    items: [] // { product_code, product_name, body, design, qtys: [10] }
};

// 商品マスタのキャッシュ (手動発注や検索用)
let masterProducts = [];

// プリント用ファイルの安全ダウンロード関数（ダウンロードエラー時の画面遷移バグ防止）
window.downloadPrintFile = async function(url, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            let errorMsg = "ファイルが見つかりません。";
            try {
                const errData = await response.json();
                if (errData && errData.error) {
                    errorMsg = errData.error;
                }
            } catch (e) {}
            alert(`ダウンロードに失敗しました: ${errorMsg}`);
            return;
        }
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error("Download print file error:", err);
        alert("ダウンロード処理中に通信エラーが発生しました。");
    }
};

// 別タブでの印刷用関数（印刷閉じ時のメイン画面消失防止）
function printElement(elementId) {
    const printEl = document.getElementById(elementId);
    if (!printEl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。");
        return;
    }
    printWindow.document.write('<html><head><title>発注書印刷</title>');
    
    // スタイルシートとスタイルタグのコピー
    document.querySelectorAll('link, style').forEach(el => {
        printWindow.document.write(el.outerHTML);
    });
    
    printWindow.document.write(\`
        <style>
            @media screen {
                body {
                    background: #ffffff !important;
                    color: #000000 !important;
                    padding: 20px !important;
                    font-family: 'Outfit', 'Noto Sans JP', sans-serif;
                }
            }
            @media print {
                @page {
                    size: landscape;
                    margin: 10mm;
                }
                body {
                    background: #ffffff !important;
                    color: #000000 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
            }
            #maker-print-area-wrapper, #print-area-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                display: block !important;
            }
            .order-table {
                width: 100% !important;
                min-width: 0 !important;
                table-layout: fixed !important;
            }
            .hide-on-print {
                display: none !important;
            }
        </style>
    \`);
    
    printWindow.document.write('</head><body>');
    printWindow.document.write(printEl.outerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 600);
}


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
    toastMessage: document.getElementById('toast-message'),

    // --- 新規追加要素 ---
    // タブ切り替え用
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // お客様詳細内の転送ボタン
    btnForwardToMaker: document.getElementById('btn-forward-to-maker'),

    // 製作業者発注タブ
    btnNewMakerOrder: document.getElementById('btn-new-maker-order'),
    makerRefreshBtn: document.getElementById('maker-refresh-btn'),
    makerHistoryTbody: document.getElementById('maker-history-tbody'),

    // プリントデータ管理タブ
    printSearchInput: document.getElementById('print-search-input'),
    printMasterTbody: document.getElementById('print-master-tbody'),

    // 製作業者発注作成モーダル
    makerCreateModal: document.getElementById('maker-create-modal'),
    closeMakerCreateModalBtn: document.getElementById('close-maker-create-modal-btn'),
    makerCreateSourceInfo: document.getElementById('maker-create-source-info'),
    manualProductSelectArea: document.getElementById('manual-product-select-area'),
    makerCreateProductSelect: document.getElementById('maker-create-product-select'),
    btnMakerCreateAddRow: document.getElementById('btn-maker-create-add-row'),
    makerCreateTbody: document.getElementById('maker-create-tbody'),
    btnMakerCreateCancel: document.getElementById('btn-maker-create-cancel'),
    btnMakerCreateSubmit: document.getElementById('btn-maker-create-submit'),

    // 製作業者発注詳細モーダル
    makerDetailModal: document.getElementById('maker-detail-modal'),
    closeMakerDetailModalBtn: document.getElementById('close-maker-detail-modal-btn'),
    closeMakerDetailModalBtnLower: document.getElementById('close-maker-detail-modal-btn-lower'),
    makerDetailOrderNumber: document.getElementById('maker-detail-order-number'),
    makerDetailOrderDate: document.getElementById('maker-detail-order-date'),
    makerDetailSourceNumber: document.getElementById('maker-detail-source-number'),
    makerDetailStatusSelect: document.getElementById('maker-detail-status-select'),
    btnMakerUpdateStatus: document.getElementById('btn-maker-update-status'),
    btnMakerDeleteOrder: document.getElementById('btn-maker-delete-order'),
    makerDetailTbody: document.getElementById('maker-detail-tbody'),
    makerFootSStd: document.getElementById('maker-foot-s-std'),
    makerFootMStd: document.getElementById('maker-foot-m-std'),
    makerFootLStd: document.getElementById('maker-foot-l-std'),
    makerFootXLStd: document.getElementById('maker-foot-xl-std'),
    makerFootXXLStd: document.getElementById('maker-foot-xxl-std'),
    makerFootSBd: document.getElementById('maker-foot-s-bd'),
    makerFootMBd: document.getElementById('maker-foot-m-bd'),
    makerFootLBd: document.getElementById('maker-foot-l-bd'),
    makerFootXLBd: document.getElementById('maker-foot-xl-bd'),
    makerFootXXLBd: document.getElementById('maker-foot-xxl-bd'),
    makerFootTotal: document.getElementById('maker-foot-total'),
    btnDeleteOrder: document.getElementById('btn-delete-order'),
    systemStatusContainer: document.getElementById('system-status-container'),
    systemStatusBadge: document.getElementById('system-status-badge'),
    systemStatusDot: document.getElementById('system-status-dot'),
    systemStatusText: document.getElementById('system-status-text')
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
            // 初期タブデータのロード
            loadMakerHistory();
            loadPrintMaster();
            updateSystemStatus(); // システム接続情報の更新
        } else {
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
    
    adminState.token = password;
    const success = await loadHistory();
    if (success) {
        localStorage.setItem("admin_password", password);
        elements.loginContainer.style.display = 'none';
        elements.adminDashboard.style.display = 'block';
        loadMakerHistory();
        loadPrintMaster();
        updateSystemStatus(); // システム接続情報の更新
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
    elements.systemStatusContainer.style.display = 'none'; // ステータスも非表示
    showToast("ログアウトしました。");
}

// システムの接続状況を表示
async function updateSystemStatus() {
    try {
        const response = await fetch(`/api/admin/system-status?token=${encodeURIComponent(adminState.token)}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        
        elements.systemStatusContainer.style.display = 'block';
        
        if (data.is_persistent && !data.is_fallback) {
            elements.systemStatusBadge.style.backgroundColor = '#ecfdf5';
            elements.systemStatusBadge.style.color = '#065f46';
            elements.systemStatusBadge.style.border = '1px solid #a7f3d0';
            elements.systemStatusDot.style.backgroundColor = '#10b981';
            elements.systemStatusText.innerHTML = `🟢 データベース接続: <strong>永続ディスク（安全）</strong> | 保存先: <code style="font-family: monospace;">${data.database_path}</code>`;
        } else {
            elements.systemStatusBadge.style.backgroundColor = '#fffbeb';
            elements.systemStatusBadge.style.color = '#92400e';
            elements.systemStatusBadge.style.border = '1px solid #fde68a';
            elements.systemStatusDot.style.backgroundColor = '#f59e0b';
            
            let warningMsg = `⚠️ 警告: <strong>一時ディスク（危険 - 再起動でデータが消えます）</strong> | 保存先: <code style="font-family: monospace;">${data.database_path}</code>。`;
            if (data.is_fallback) {
                warningMsg += `（エラー詳細: <span style="font-family: monospace; color: #b91c1c;">${data.error_message}</span>）`;
            } else {
                warningMsg += `Renderの永続ディスク（Disks）および環境変数の設定を確認してください。`;
            }
            elements.systemStatusText.innerHTML = warningMsg;
        }
    } catch (e) {
        elements.systemStatusContainer.style.display = 'none';
    }
}

// 履歴一覧の取得 (Tab 1)
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

// 履歴一覧のレンダリング (Tab 1)
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
        adminState.currentOrder = data; // 転送用に保存
        
        const dateObj = new Date(order.created_at);
        elements.detailOrderDate.textContent = isNaN(dateObj.getTime()) ? '----年--月--日' :
            `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
            
        elements.detailOrderNumber.textContent = order.order_number;
        elements.detailClientCompany.textContent = order.company_name;
        elements.detailClientName.textContent = order.contact_name;
        elements.detailClientPhone.textContent = order.phone_number;
        
        elements.detailTbody.innerHTML = '';
        const sizeTotals = Array(10).fill(0);
        
        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.style.border = '1px solid #000';
            
            let sizeCellsHtml = '';
            item.qtys.forEach((qty, qIdx) => {
                sizeTotals[qIdx] += qty;
                sizeCellsHtml += `<td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: ${qty > 0 ? 'bold' : 'normal'};">${qty > 0 ? qty : '-'}</td>`;
            });
            
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
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; vertical-align: middle;">${imgHtml}</td>
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
        elements.btnDeleteOrder.onclick = () => deleteOrder(order.id);
        elements.detailModal.classList.add('active');
        
    } catch (error) {
        console.error("openOrderDetails error:", error);
        showToast(error.message, "error");
    }
}

// 顧客詳細モーダルを閉じる
function closeDetailModal() {
    elements.detailModal.classList.remove('active');
}

// 顧客注文の削除
async function deleteOrder(orderId) {
    if (!confirm("本当にこの顧客注文データを取り消し（削除）しますか？")) return;
    try {
        const response = await fetch('/api/admin/orders/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: adminState.token,
                id: orderId
            })
        });
        if (!response.ok) throw new Error("注文データの削除に失敗しました。");
        showToast("注文データを取り消しました。");
        loadHistory();
        elements.detailModal.classList.remove('active');
    } catch (error) {
        showToast(error.message, "error");
    }
}


// ==========================================================================
// 【新規】タブ切り替えロジック
// ==========================================================================
elements.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        elements.tabButtons.forEach(b => b.classList.remove('active'));
        elements.tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-tab');
        document.getElementById(targetTab).classList.add('active');

        // タブ切り替え時のデータ再読み込み
        if (targetTab === 'tab-maker-orders') {
            loadMakerHistory();
        } else if (targetTab === 'tab-print-management') {
            loadPrintMaster();
        } else if (targetTab === 'tab-customer-orders') {
            loadHistory();
        }
    });
});


// ==========================================================================
// 【新規】製作業者向け発注履歴取得・表示 (Tab 2)
// ==========================================================================
async function loadMakerHistory() {
    try {
        const response = await fetch(`/api/admin/maker-orders?token=${encodeURIComponent(adminState.token)}`);
        if (!response.ok) {
            throw new Error("外注発注履歴の取得に失敗しました。");
        }
        const data = await response.json();
        renderMakerHistory(data.orders);
    } catch (error) {
        console.error("loadMakerHistory error:", error);
        showToast(error.message, "error");
    }
}

function renderMakerHistory(orders) {
    elements.makerHistoryTbody.innerHTML = '';
    if (orders.length === 0) {
        elements.makerHistoryTbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    登録されている製作業者向け発注はありません。
                </td>
            </tr>
        `;
        return;
    }

    orders.forEach(order => {
        const tr = document.createElement('tr');
        const dateObj = new Date(order.created_at);
        const formattedDate = isNaN(dateObj.getTime()) ? order.created_at : 
            `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

        let statusClass = 'badge-warning';
        if (order.status === '納品完了') statusClass = 'badge-success';

        let imgHtml = '';
        if (order.thumbnail_url) {
            imgHtml = `<img src="${order.thumbnail_url}" alt="代表画像" class="col-thumb-img" style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px; cursor: pointer; transition: transform 0.2s;" onclick="window.open('${order.thumbnail_url}', '_blank')">`;
        } else {
            imgHtml = `<span style="color: var(--text-secondary); opacity: 0.4;">-</span>`;
        }
        
        tr.innerHTML = `
            <td style="text-align: center; vertical-align: middle;">${imgHtml}</td>
            <td>${formattedDate}</td>
            <td style="font-weight: bold; color: var(--primary);">${order.maker_order_number}</td>
            <td>${order.source_order_number ? order.source_order_number : '<span style="color:var(--text-secondary)">手動直接発注</span>'}</td>
            <td style="text-align: right; font-weight: bold;">${order.total_quantity}</td>
            <td><span class="badge ${statusClass}">${order.status}</span></td>
            <td style="text-align: center; vertical-align: middle;">
                <button class="btn btn-secondary btn-maker-detail" data-id="${order.id}">🔍 詳細表示</button>
            </td>
        `;

        tr.querySelector('.btn-maker-detail').addEventListener('click', () => openMakerOrderDetails(order.id));
        elements.makerHistoryTbody.appendChild(tr);
    });
}


// ==========================================================================
// 【新規】製作業者発注詳細表示 (Tab 2)
// ==========================================================================
async function openMakerOrderDetails(orderId) {
    try {
        const response = await fetch(`/api/admin/maker-order-details?id=${orderId}&token=${encodeURIComponent(adminState.token)}`);
        if (!response.ok) {
            throw new Error("発注詳細の取得に失敗しました。");
        }
        const data = await response.json();
        const { order, items } = data;

        elements.makerDetailOrderNumber.textContent = order.maker_order_number;
        const dateObj = new Date(order.created_at);
        elements.makerDetailOrderDate.textContent = isNaN(dateObj.getTime()) ? '----/--/--' : 
            `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
        elements.makerDetailSourceNumber.textContent = order.source_order_number || "なし（社内直接発注）";
        elements.makerDetailStatusSelect.value = order.status;

        // ボタンの保存処理用IDバインド
        elements.btnMakerUpdateStatus.onclick = () => updateMakerOrderStatus(order.id);
        elements.btnMakerDeleteOrder.onclick = () => deleteMakerOrder(order.id);

        elements.makerDetailTbody.innerHTML = '';
        const totals = Array(10).fill(0);
        let grandTotal = 0;

        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            
            let sizeCellsHtml = '';
            item.qtys.forEach((qty, qIdx) => {
                totals[qIdx] += qty;
                sizeCellsHtml += `<td style="text-align: center; font-weight: ${qty > 0 ? 'bold' : 'normal'};">${qty > 0 ? qty : '-'}</td>`;
            });
            grandTotal += item.qtys.reduce((a, b) => a + b, 0);

            let printFileCell = '';
            if (item.print_files && item.print_files.length > 0) {
                item.print_files.forEach(file => {
                    const downloadUrl = `/api/download-print?product_code=${item.product_code}&body=${encodeURIComponent(item.body_color || item.body)}&design=${encodeURIComponent(item.design)}&filename=${encodeURIComponent(file)}&token=${encodeURIComponent(adminState.token)}`;
                    printFileCell += `
                        <a href="javascript:void(0)" onclick="downloadPrintFile('${downloadUrl.replace(/'/g, "\\'")}', '${file.replace(/'/g, "\\'")}')" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:0.25rem; margin-bottom:4px; padding: 0.2rem 0.5rem; font-size: 0.8rem; background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd;" title="${file}">
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
                <td style="text-align: center;">${index + 1}</td>
                <td style="text-align: center; vertical-align: middle;">${imgHtml}</td>
                <td title="${item.product_code}">${item.product_code}</td>
                <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.product_name}">${item.product_name}</td>
                <td title="${item.body_color || ''}">${item.body_color || ''}</td>
                <td title="${item.body || ''}">${item.body || ''}</td>
                <td title="${item.design}">${item.design}</td>
                ${sizeCellsHtml}
                <td style="text-align: center;" class="hide-on-print">${printFileCell}</td>
            `;
            elements.makerDetailTbody.appendChild(tr);
        });

        // フッターバインド
        elements.makerFootSStd.innerHTML = `<strong>${totals[0] > 0 ? totals[0] : '-'}</strong>`;
        elements.makerFootMStd.innerHTML = `<strong>${totals[1] > 0 ? totals[1] : '-'}</strong>`;
        elements.makerFootLStd.innerHTML = `<strong>${totals[2] > 0 ? totals[2] : '-'}</strong>`;
        elements.makerFootXLStd.innerHTML = `<strong>${totals[3] > 0 ? totals[3] : '-'}</strong>`;
        elements.makerFootXXLStd.innerHTML = `<strong>${totals[4] > 0 ? totals[4] : '-'}</strong>`;
        elements.makerFootSBd.innerHTML = `<strong>${totals[5] > 0 ? totals[5] : '-'}</strong>`;
        elements.makerFootMBd.innerHTML = `<strong>${totals[6] > 0 ? totals[6] : '-'}</strong>`;
        elements.makerFootLBd.innerHTML = `<strong>${totals[7] > 0 ? totals[7] : '-'}</strong>`;
        elements.makerFootXLBd.innerHTML = `<strong>${totals[8] > 0 ? totals[8] : '-'}</strong>`;
        elements.makerFootXXLBd.innerHTML = `<strong>${totals[9] > 0 ? totals[9] : '-'}</strong>`;
        elements.makerFootTotal.innerHTML = `<strong>${grandTotal}</strong>`;

        elements.makerDetailModal.classList.add('active');
    } catch (error) {
        console.error("openMakerOrderDetails error:", error);
        showToast(error.message, "error");
    }
}

async function updateMakerOrderStatus(orderId) {
    const status = elements.makerDetailStatusSelect.value;
    try {
        const response = await fetch('/api/admin/maker-orders/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: adminState.token,
                id: orderId,
                status: status
            })
        });
        if (!response.ok) throw new Error("ステータスの更新に失敗しました。");
        showToast("ステータスを更新しました。");
        loadMakerHistory();
        elements.makerDetailModal.classList.remove('active');
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function deleteMakerOrder(orderId) {
    if (!confirm("本当にこの発注データを削除しますか？\n（製作業者ポータルからも閲覧できなくなります）")) return;
    try {
        const response = await fetch('/api/admin/maker-orders/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: adminState.token,
                id: orderId
            })
        });
        if (!response.ok) throw new Error("発注データの削除に失敗しました。");
        showToast("発注データを削除しました。");
        loadMakerHistory();
        elements.makerDetailModal.classList.remove('active');
    } catch (error) {
        showToast(error.message, "error");
    }
}


// ==========================================================================
// 【新規】製作業者向け発注作成モーダルの制御
// ==========================================================================

// パターン1: 顧客注文からの引継ぎ発注作成
elements.btnForwardToMaker.addEventListener('click', () => {
    if (!adminState.currentOrder) return;
    closeDetailModal();

    const { order, items } = adminState.currentOrder;
    makerCreateState.sourceOrderNumber = order.order_number;
    makerCreateState.items = items.map(item => ({
        product_code: item.product_code,
        product_name: item.product_name,
        body_color: item.body, // In customer orders, item.body is the body color!
        body: "", // Clear body model so user can input it!
        design: item.design,
        qtys: [...item.qtys],
        images: item.images || []
    }));

    elements.makerCreateSourceInfo.innerHTML = `元顧客発注連動: <strong>${order.order_number}</strong> (${order.company_name})`;
    elements.manualProductSelectArea.style.display = 'none';

    renderMakerCreateList();
    elements.makerCreateModal.classList.add('active');
});

// パターン2: 社内からの手動新規発注作成
elements.btnNewMakerOrder.addEventListener('click', () => {
    makerCreateState.sourceOrderNumber = null;
    makerCreateState.items = [];

    elements.makerCreateSourceInfo.textContent = "新規直接発注（手動追加）";
    elements.manualProductSelectArea.style.display = 'flex';

    // 商品選択セレクトボックスの構築
    elements.makerCreateProductSelect.innerHTML = '';
    masterProducts.forEach((prod, index) => {
        // csvの values [2]:品番, [3]:商品名, [4]:ボディ, [5]:デザイン
        const code = prod.values[2];
        const name = prod.values[3];
        const body = prod.values[4];
        const design = prod.values[5];
        if (code && name) {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `[${code}] ${name} (${body} / ${design})`;
            elements.makerCreateProductSelect.appendChild(option);
        }
    });

    renderMakerCreateList();
    elements.makerCreateModal.classList.add('active');
});

// 手動発注時：商品リストに1行追加する
elements.btnMakerCreateAddRow.addEventListener('click', () => {
    const idx = elements.makerCreateProductSelect.value;
    if (idx === "") return;
    const prod = masterProducts[idx];
    
    const code = prod.values[2];
    const body = prod.values[4];
    const design = prod.values[5];

    makerCreateState.items.push({
        product_code: code,
        product_name: prod.values[3],
        body_color: body, // In CSV, body is the body color!
        body: "", // Clear body model so user can input it!
        design: design,
        qtys: Array(10).fill(0),
        images: prod.images || []
    });

    renderMakerCreateList();
});

// 発注作成画面のテーブル描画
function renderMakerCreateList() {
    elements.makerCreateTbody.innerHTML = '';
    if (makerCreateState.items.length === 0) {
        elements.makerCreateTbody.innerHTML = `
            <tr>
                <td colspan="16" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    発注対象の製品がありません。
                </td>
            </tr>
        `;
        return;
    }

    makerCreateState.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        let sizeInputsHtml = '';
        item.qtys.forEach((qty, qIdx) => {
            sizeInputsHtml += `
                <td style="text-align: center; padding: 4px 2px;">
                    <input type="number" min="0" class="qty-select qty-input-field" 
                           data-item-index="${index}" data-qty-index="${qIdx}" 
                           value="${qty}" style="width: 45px; text-align: center;">
                </td>`;
        });

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
            <td style="text-align: center;">${index + 1}</td>
            <td style="text-align: center; vertical-align: middle;">${imgHtml}</td>
            <td style="font-weight:bold;">${item.product_code}</td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.product_name}">${item.product_name}</td>
            <td>${item.body_color || ''}</td>
            <td style="padding: 4px;">
                <input type="text" class="body-input-field" list="maker-bodies-list" value="${item.body}" data-index="${index}" 
                       style="width: 100px; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; font-family: var(--font-main); font-size: 0.85rem;" placeholder="品番を入力">
            </td>
            <td>${item.design}</td>
            ${sizeInputsHtml}
            <td style="text-align: center;">
                <button class="btn btn-secondary btn-delete-row" data-index="${index}" style="padding: 2px 6px; color: var(--danger); border-color: rgba(239, 68, 68, 0.2);">✕</button>
            </td>
        `;

        // 行削除ボタン
        tr.querySelector('.btn-delete-row').addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            makerCreateState.items.splice(idx, 1);
            renderMakerCreateList();
        });

        elements.makerCreateTbody.appendChild(tr);
    });

    // 数量入力フィールド値変更のバインド
    document.querySelectorAll('.qty-input-field').forEach(input => {
        input.addEventListener('change', (e) => {
            const itemIdx = parseInt(e.target.getAttribute('data-item-index'));
            const qtyIdx = parseInt(e.target.getAttribute('data-qty-index'));
            const val = parseInt(e.target.value) || 0;
            makerCreateState.items[itemIdx].qtys[qtyIdx] = Math.max(0, val);
        });
    });

    // ボディ入力フィールド値変更のバインド
    document.querySelectorAll('.body-input-field').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            const val = e.target.value.trim();
            makerCreateState.items[idx].body = val;
        });
    });
}

// 発注作成の送信
elements.btnMakerCreateSubmit.addEventListener('click', async () => {
    // 数量の合計チェック
    let totalQty = 0;
    makerCreateState.items.forEach(item => {
        totalQty += item.qtys.reduce((a, b) => a + b, 0);
    });

    if (totalQty === 0) {
        showToast("数量がすべて0個です。発注数を入力してください。", "error");
        return;
    }

    try {
        const response = await fetch('/api/admin/maker-orders/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: adminState.token,
                source_order_number: makerCreateState.sourceOrderNumber,
                items: makerCreateState.items
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "製作業者への発注作成に失敗しました。");
        }

        const res = await response.json();
        showToast(`製作業者への発注を作成しました！【発注番号: ${res.maker_order_number}】`);
        
        elements.makerCreateModal.classList.remove('active');
        // 製作業者発注タブを有効にする
        elements.tabButtons[1].click();
        loadMakerBodies(); // ボディリストの更新
    } catch (error) {
        console.error("submit maker order error:", error);
        showToast(error.message, "error");
    }
});

elements.btnMakerCreateCancel.addEventListener('click', () => {
    elements.makerCreateModal.classList.remove('active');
});


// ==========================================================================
// 【新規】プリントデータ管理 (Tab 3)
// ==========================================================================
async function loadPrintMaster() {
    try {
        const response = await fetch('/api/orders');
        if (!response.ok) throw new Error("商品マスタのロードに失敗しました。");
        const data = await response.json();
        // valuesが存在する編集可能行だけをマスタとしてキャッシュ
        masterProducts = data.rows.filter(r => r.is_editable);
        renderPrintMaster();
        loadMakerBodies(); // ボディリストの初期ロード
    } catch (error) {
        console.error("loadPrintMaster error:", error);
        showToast(error.message, "error");
    }
}

async function loadMakerBodies() {
    let datalist = document.getElementById('maker-bodies-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'maker-bodies-list';
        document.body.appendChild(datalist);
    }
    
    const csvBodies = new Set();
    masterProducts.forEach(prod => {
        const body = prod.values[4];
        if (body) csvBodies.add(body.trim());
    });
    
    const pastBodies = [];
    try {
        const response = await fetch(`/api/admin/maker-bodies?token=${encodeURIComponent(adminState.token)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.bodies) {
                data.bodies.forEach(b => {
                    if (b) pastBodies.push(b.trim());
                });
            }
        }
    } catch (e) {
        console.error("loadMakerBodies error:", e);
    }
    
    const allBodies = new Set([...csvBodies, ...pastBodies]);
    
    datalist.innerHTML = '';
    allBodies.forEach(body => {
        const option = document.createElement('option');
        option.value = body;
        datalist.appendChild(option);
    });
}

function renderPrintMaster() {
    const query = elements.printSearchInput.value.toLowerCase().trim();
    elements.printMasterTbody.innerHTML = '';

    const filtered = masterProducts.filter(prod => {
        const code = prod.values[2].toLowerCase();
        const name = prod.values[3].toLowerCase();
        return code.includes(query) || name.includes(query);
    });

    if (filtered.length === 0) {
        elements.printMasterTbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    該当する商品はありません。
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(prod => {
        const tr = document.createElement('tr');
        const code = prod.values[2];
        const name = prod.values[3];
        const body = prod.values[4];
        const design = prod.values[5];
        const printFiles = prod.print_files || [];
        const images = prod.images || [];

        let imgHtml = '';
        if (images.length > 0) {
            imgHtml = `<div style="display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: wrap;">`;
            images.forEach(imgUrl => {
                imgHtml += `<img src="${imgUrl}" alt="${name}" class="col-thumb-img" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; cursor: pointer;" onclick="window.open('${imgUrl}', '_blank')">`;
            });
            imgHtml += `</div>`;
        } else {
            imgHtml = `<span style="color: var(--text-secondary); opacity: 0.4;">-</span>`;
        }

        let statusBadgeHtml = '';
        if (printFiles.length > 0) {
            printFiles.forEach(file => {
                const downloadUrl = `/api/download-print?product_code=${code}&body=${encodeURIComponent(body)}&design=${encodeURIComponent(design)}&filename=${encodeURIComponent(file)}&token=${encodeURIComponent(adminState.token)}`;
                statusBadgeHtml += `
                    <div style="margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; background-color: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 6px; border: 1px solid var(--border-color);">
                        <span class="badge badge-success" style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file}">${file}</span>
                        <div style="display: flex; gap: 0.25rem;">
                            <a href="javascript:void(0)" onclick="downloadPrintFile('${downloadUrl.replace(/'/g, "\\'")}', '${file.replace(/'/g, "\\'")}')" class="btn btn-secondary" style="padding: 0.15rem 0.35rem; font-size: 0.75rem; background-color:#e0f2fe; color:#0369a1; border-color:#bae6fd;">📥</a>
                            <button class="btn btn-secondary btn-delete-file-specific" data-code="${code}" data-body="${body}" data-design="${design}" data-file="${file}" style="padding: 0.15rem 0.35rem; font-size: 0.75rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.2);">🗑️</button>
                        </div>
                    </div>
                `;
            });
        } else {
            statusBadgeHtml = `<span class="badge badge-warning">未登録</span>`;
        }

        let actionButtonsHtml = `
            <button class="btn btn-secondary btn-upload-trigger" data-code="${code}" data-name="${name}" data-body="${body}" data-design="${design}" style="padding: 0.35rem 0.75rem; font-size: 0.85rem;">📁 追加アップロード</button>
        `;

        tr.innerHTML = `
            <td style="text-align: center; vertical-align: middle;">${imgHtml}</td>
            <td style="font-weight:bold;">${code}</td>
            <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${name}">${name}</td>
            <td>${body}</td>
            <td>${design}</td>
            <td style="min-width: 220px;">${statusBadgeHtml}</td>
            <td style="text-align: center; vertical-align: middle;">${actionButtonsHtml}</td>
        `;

        // 個別削除ボタンのバインド
        tr.querySelectorAll('.btn-delete-file-specific').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const fileCode = target.getAttribute('data-code');
                const fileBody = target.getAttribute('data-body');
                const fileDesign = target.getAttribute('data-design');
                const fileName = target.getAttribute('data-file');
                deletePrintFile(fileCode, fileBody, fileDesign, fileName);
            });
        });

        // アップロードのバインド
        tr.querySelector('.btn-upload-trigger').addEventListener('click', () => {
            triggerUploadFileInput(code, name, body, design);
        });

        elements.printMasterTbody.appendChild(tr);
    });
}

// 検索フィルター連動
elements.printSearchInput.addEventListener('input', renderPrintMaster);

// ファイルアップロードのトリガー
let currentUploadMetadata = null;
const hiddenFileInput = document.createElement('input');
hiddenFileInput.type = 'file';
hiddenFileInput.multiple = true; // 複数ファイル選択を有効化
hiddenFileInput.style.display = 'none';
document.body.appendChild(hiddenFileInput);

function triggerUploadFileInput(code, name, body, design) {
    currentUploadMetadata = { code, name, body, design };
    hiddenFileInput.value = ''; // リセット
    hiddenFileInput.click();
}

hiddenFileInput.addEventListener('change', async (e) => {
    if (!e.target.files.length || !currentUploadMetadata) return;
    
    const files = Array.from(e.target.files);
    showToast(`${files.length}個のファイルをアップロードしています...`, "info");
    
    let successCount = 0;
    let errorMsg = null;
    
    for (const file of files) {
        const formData = new FormData();
        formData.append('token', adminState.token);
        formData.append('product_code', currentUploadMetadata.code);
        formData.append('product_name', currentUploadMetadata.name);
        formData.append('body', currentUploadMetadata.body);
        formData.append('design', currentUploadMetadata.design);
        formData.append('file', file);

        try {
            const response = await fetch('/api/admin/upload-print', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                errorMsg = err.error || "ファイルのアップロードに失敗しました。";
            } else {
                successCount++;
            }
        } catch (error) {
            console.error("upload error:", error);
            errorMsg = error.message;
        }
    }

    if (successCount > 0) {
        showToast(`${successCount}個のプリントデータを登録しました！`);
        loadPrintMaster(); // 再読み込み
    }
    
    if (errorMsg) {
        showToast(errorMsg, "error");
    }
    
    currentUploadMetadata = null;
});

async function deletePrintFile(code, body, design, filename = "") {
    const confirmMsg = filename 
        ? `この商品（品番: ${code}）のファイル「${filename}」を削除しますか？`
        : `この商品（品番: ${code}）のすべてのイラストレータデータを削除しますか？`;
    if (!confirm(confirmMsg)) return;
    try {
        const response = await fetch('/api/admin/delete-print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: adminState.token,
                product_code: code,
                body: body,
                design: design,
                filename: filename
            })
        });

        if (!response.ok) throw new Error("プリントデータの削除に失敗しました。");
        showToast("プリントデータを削除しました。");
        loadPrintMaster();
    } catch (error) {
        showToast(error.message, "error");
    }
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
    elements.makerRefreshBtn.addEventListener('click', loadMakerHistory);
    
    // モーダルを閉じるボタンたち
    elements.closeDetailModalBtn.addEventListener('click', closeDetailModal);
    elements.closeDetailModalBtnLower.addEventListener('click', closeDetailModal);
    elements.closeMakerCreateModalBtn.addEventListener('click', () => {
        elements.makerCreateModal.classList.remove('active');
    });
    elements.closeMakerDetailModalBtn.addEventListener('click', () => {
        elements.makerDetailModal.classList.remove('active');
    });
    elements.closeMakerDetailModalBtnLower.addEventListener('click', () => {
        elements.makerDetailModal.classList.remove('active');
    });
    
    // 背景クリックで閉じる
    elements.detailModal.addEventListener('click', (e) => {
        if (e.target === elements.detailModal) closeDetailModal();
    });
    elements.makerCreateModal.addEventListener('click', (e) => {
        if (e.target === elements.makerCreateModal) elements.makerCreateModal.classList.remove('active');
    });
    elements.makerDetailModal.addEventListener('click', (e) => {
        if (e.target === elements.makerDetailModal) elements.makerDetailModal.classList.remove('active');
    });
    
    // 印刷処理 (別タブ起動でメイン画面のクローズを防止)
    elements.detailPrintBtn.addEventListener('click', () => {
        printElement('print-area-wrapper');
    });
    
    const makerPrintBtn = document.getElementById('maker-detail-print-btn');
    if (makerPrintBtn) {
        makerPrintBtn.addEventListener('click', () => {
            printElement('maker-print-area-wrapper');
        });
    }
});
