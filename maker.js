// 製作業者画面の状態
let makerState = {
    token: localStorage.getItem("maker_password") || "",
    orders: []
};

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
    
    printWindow.document.write(`
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
    `);
    
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
    detailStatusSelect: document.getElementById('detail-status-select'),
    btnUpdateStatus: document.getElementById('btn-update-status'),
    detailTbody: document.getElementById('detail-tbody'),
    
    // 足元数量
    footXSStd: document.getElementById('foot-xs-std'),
    footXSBd: document.getElementById('foot-xs-bd'),
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
        if (order.status === '受取済' || order.status === '納品完了') badgeClass = 'badge-success';
        else if (order.status === '製作済' || order.status === '製作中') badgeClass = 'badge-info';

        // プリントデータ HTML
        let printHtml = '';
        if (order.print_files && order.print_files.length > 0) {
            order.print_files.forEach(file => {
                printHtml += `
                    <a href="javascript:void(0)" onclick="downloadPrintFile('${file.download_url.replace(/'/g, "\\'")}', '${file.filename.replace(/'/g, "\\'")}')" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:0.25rem; margin: 2px; padding: 0.2rem 0.5rem; font-size: 0.8rem; background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd; text-decoration: none; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.filename}">
                        📥 ${file.filename}
                    </a>
                `;
            });
        } else {
            printHtml = `<span class="badge badge-warning">未登録</span>`;
        }

        tr.innerHTML = `
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

// ステータス更新のために現在開いている発注IDを保持する変数
let currentOrderIdForStatusUpdate = null;

// 詳細モーダルを開く
async function openOrderDetails(orderId) {
    try {
        const response = await fetch(`/api/maker/order-details?id=${orderId}&token=${encodeURIComponent(makerState.token)}`);
        if (!response.ok) {
            throw new Error("詳細データの取得に失敗しました。");
        }
        
        const data = await response.json();
        const { order, items } = data;
        currentOrderIdForStatusUpdate = order.id;
        
        elements.detailOrderNumber.textContent = order.maker_order_number;
        const dateObj = new Date(order.created_at);
        elements.detailOrderDate.textContent = isNaN(dateObj.getTime()) ? '----/--/--' : 
            `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
        elements.detailSourceNumber.textContent = order.source_order_number || "なし（社内直接発注）";
        
        // ステータス選択・変更の制御
        elements.detailStatusSelect.value = order.status;
        if (order.status === '受取済' || order.status === '納品完了') {
            elements.detailStatusSelect.disabled = true;
            elements.btnUpdateStatus.disabled = true;
        } else {
            elements.detailStatusSelect.disabled = false;
            elements.btnUpdateStatus.disabled = false;
        }
        
        elements.detailTbody.innerHTML = '';
        const sizeTotals = Array(12).fill(0);
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
                        <a href="javascript:void(0)" onclick="downloadPrintFile('${downloadUrl.replace(/'/g, "\\'")}', '${file.replace(/'/g, "\\'")}')" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:0.25rem; margin-bottom:4px; padding: 0.2rem 0.5rem; font-size: 0.8rem; background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd; text-decoration: none;" title="${file}">
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
                    const safeUrl = imgUrl.replace(/'/g, "\\'");
                    const safeAlt = (item.product_name || "").replace(/"/g, "&quot;");
                    imgHtml += `<img src="${imgUrl}" alt="${safeAlt}" class="col-thumb-img" style="width: 35px; height: 35px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.open('${safeUrl}', '_blank')">`;
                });
                imgHtml += `</div>`;
            } else {
                imgHtml = `<span style="color: var(--text-secondary); opacity: 0.4;">-</span>`;
            }
            
            tr.innerHTML = `
                <td style="border: 1px solid #cbd5e1; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid #cbd5e1; text-align: center; vertical-align: middle;">${imgHtml}</td>
                <td style="border: 1px solid #cbd5e1; font-weight:bold;" title="${item.product_code}">${item.product_code}</td>
                <td style="border: 1px solid #cbd5e1; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.product_name}">${item.product_name}</td>
                <td style="border: 1px solid #cbd5e1;" title="${item.body_color || ''}">${item.body_color || ''}</td>
                <td style="border: 1px solid #cbd5e1;" title="${item.body || ''}">${item.body || ''}</td>
                <td style="border: 1px solid #cbd5e1;" title="${item.design}">${item.design}</td>
                ${sizeCellsHtml}
                <td style="border: 1px solid #cbd5e1; text-align: center;" class="hide-on-print">${printFileCell}</td>
            `;
            elements.detailTbody.appendChild(tr);
        });
        
        // フッター集計
        elements.footXSStd.innerHTML = `<strong>${sizeTotals[0] > 0 ? sizeTotals[0] : '-'}</strong>`;
        elements.footSStd.innerHTML = `<strong>${sizeTotals[1] > 0 ? sizeTotals[1] : '-'}</strong>`;
        elements.footMStd.innerHTML = `<strong>${sizeTotals[2] > 0 ? sizeTotals[2] : '-'}</strong>`;
        elements.footLStd.innerHTML = `<strong>${sizeTotals[3] > 0 ? sizeTotals[3] : '-'}</strong>`;
        elements.footXLStd.innerHTML = `<strong>${sizeTotals[4] > 0 ? sizeTotals[4] : '-'}</strong>`;
        elements.footXXLStd.innerHTML = `<strong>${sizeTotals[5] > 0 ? sizeTotals[5] : '-'}</strong>`;
        elements.footXSBd.innerHTML = `<strong>${sizeTotals[6] > 0 ? sizeTotals[6] : '-'}</strong>`;
        elements.footSBd.innerHTML = `<strong>${sizeTotals[7] > 0 ? sizeTotals[7] : '-'}</strong>`;
        elements.footMBd.innerHTML = `<strong>${sizeTotals[8] > 0 ? sizeTotals[8] : '-'}</strong>`;
        elements.footLBd.innerHTML = `<strong>${sizeTotals[9] > 0 ? sizeTotals[9] : '-'}</strong>`;
        elements.footXLBd.innerHTML = `<strong>${sizeTotals[10] > 0 ? sizeTotals[10] : '-'}</strong>`;
        elements.footXXLBd.innerHTML = `<strong>${sizeTotals[11] > 0 ? sizeTotals[11] : '-'}</strong>`;
        elements.footTotal.innerHTML = `<strong>${totalCount}</strong>`;
        
        elements.detailModal.classList.add('active');
        
    } catch (error) {
        console.error("openOrderDetails error:", error);
        showToast(error.message, "error");
    }
}

// 製作業者によるステータスの更新
async function updateMakerOrderStatus(orderId) {
    const status = elements.detailStatusSelect.value;
    try {
        const response = await fetch('/api/maker/orders/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: makerState.token,
                id: orderId,
                status: status
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "ステータスの更新に失敗しました。");
        }
        showToast("ステータスを更新しました。");
        loadOrders();
        closeDetailModal();
    } catch (error) {
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
    
    elements.btnUpdateStatus.addEventListener('click', () => {
        if (currentOrderIdForStatusUpdate) {
            updateMakerOrderStatus(currentOrderIdForStatusUpdate);
        }
    });
    
    // 印刷処理 (別タブ起動でメイン画面のクローズを防止)
    const printBtn = document.getElementById('maker-detail-print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            printElement('maker-print-area-wrapper');
        });
    }

    // 背景クリックで閉じる
    elements.detailModal.addEventListener('click', (e) => {
        if (e.target === elements.detailModal) closeDetailModal();
    });
});
