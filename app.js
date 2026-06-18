// アプリケーションの状態管理
let appState = {
    headers: [],
    rows: [],
    filteredRows: [],
    visibleColIndices: [], // 描画対象の列インデックス（空ヘッダーを除く）
    dirtyRows: new Map(), // キー: original_index, 値: 数量が1以上入力された row.values 配列
    gallery: {
        images: [],
        currentIndex: 0
    },
    confirmMode: false, // 確認モード（数量入力済みのみ表示）のフラグ
    isOrderSubmitted: false, // 注文確定済みフラグ
    clientHistory: {
        orders: [],
        currentOrder: null,
        currentItems: []
    }
};

// DOM 要素のキャッシュ
const elements = {
    statTotal: document.getElementById('stat-total'),
    statHasImages: document.getElementById('stat-has-images'),
    searchInput: document.getElementById('search-input'),
    filterImagesOnly: document.getElementById('filter-images-only'),
    tableHeaderRow: document.getElementById('table-header-row'),
    tableBody: document.getElementById('table-body'),
    tableTotalsRow: document.getElementById('table-totals-row'),
    
    // アクションボタン
    confirmBtn: document.getElementById('confirm-btn'),
    resetViewBtn: document.getElementById('reset-view-btn'),
    printPdfBtn: document.getElementById('print-pdf-btn'),
    clearBtn: document.getElementById('clear-btn'),
    submitOrderBtn: document.getElementById('submit-order-btn'),
    printOrderDate: document.getElementById('print-order-date'),
    
    // 注文元情報
    inputClientCompany: document.getElementById('input-client-company'),
    inputClientName: document.getElementById('input-client-name'),
    inputClientPhone: document.getElementById('input-client-phone'),
    printClientCompany: document.getElementById('print-client-company'),
    printClientName: document.getElementById('print-client-name'),
    printClientPhone: document.getElementById('print-client-phone'),
    
    // ギャラリーモーダル
    galleryModal: document.getElementById('gallery-modal'),
    galleryImg: document.getElementById('gallery-img'),
    galleryPrevBtn: document.getElementById('gallery-prev-btn'),
    galleryNextBtn: document.getElementById('gallery-next-btn'),
    galleryCounter: document.getElementById('gallery-counter'),
    galleryFilename: document.getElementById('gallery-filename'),
    closeGalleryModal: document.getElementById('close-gallery-modal'),
    
    // 発注完了モーダル
    orderCompleteModal: document.getElementById('order-complete-modal'),
    completeOrderNumber: document.getElementById('complete-order-number'),
    closeCompleteModalBtn: document.getElementById('close-complete-modal-btn'),
    completePrintBtn: document.getElementById('complete-print-btn'),
    
    // 過去の注文履歴検索モーダル
    historyLookupBtn: document.getElementById('history-lookup-btn'),
    clientHistoryModal: document.getElementById('client-history-modal'),
    closeClientHistoryModal: document.getElementById('close-client-history-modal'),
    searchClientCompany: document.getElementById('search-client-company'),
    searchClientName: document.getElementById('search-client-name'),
    searchClientPhone: document.getElementById('search-client-phone'),
    clientHistoryClearBtn: document.getElementById('client-history-clear-btn'),
    clientHistorySearchBtn: document.getElementById('client-history-search-btn'),
    clientHistoryResultsArea: document.getElementById('client-history-results-area'),

    // 過去の注文詳細モーダル
    clientDetailModal: document.getElementById('client-detail-modal'),
    closeClientDetailModal: document.getElementById('close-client-detail-modal'),
    clientDetailOrderNumber: document.getElementById('client-detail-order-number'),
    clientDetailOrderDate: document.getElementById('client-detail-order-date'),
    clientDetailTbody: document.getElementById('client-detail-tbody'),
    clientDetailGrandTotal: document.getElementById('client-detail-grand-total'),
    clientDetailBackBtn: document.getElementById('client-detail-back-btn'),
    clientDetailReuseBtn: document.getElementById('client-detail-reuse-btn'),
    
    // トースト
    toast: document.getElementById('toast'),
    toastIcon: document.getElementById('toast-icon'),
    toastMessage: document.getElementById('toast-message')
};

// サイズ列のインデックス範囲（6行目のヘッダー基準）
const SIZE_START_IDX = 8;
const SIZE_END_IDX = 19;
const WHOLESALE_PRICE_IDX = 7; // 卸価格
const AMOUNT_TOTAL_IDX = 20;    // 金額計

// ==========================================================================
// データのロードと初期化
// ==========================================================================
async function loadData() {
    try {
        const response = await fetch('/api/orders');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        appState.headers = data.headers;
        appState.rows = data.rows.map(row => {
            if (row.images && row.images.length > 0) {
                row.images.sort((a, b) => {
                    const getFilename = (url) => decodeURIComponent(url.substring(url.lastIndexOf('/') + 1));
                    const nameA = getFilename(a);
                    const nameB = getFilename(b);
                    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                });
            }
            return row;
        });
        appState.dirtyRows.clear();
        appState.confirmMode = false;
        
        // 印刷用ヘッダーの日付に本日を設定
        const today = new Date();
        elements.printOrderDate.textContent = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
        
        // 描画対象のインデックスを抽出（サーバーから送られてくる19列分すべて）
        appState.visibleColIndices = Array.from({length: appState.headers.length}, (_, i) => i);
        
        // 統計の更新
        updateStats();
        
        // ヘッダーの描画
        renderHeader();
        
        // データの絞り込みとテーブル描画
        applyFilters();
        
    } catch (error) {
        console.error("データのロードに失敗しました:", error);
        showToast("データの読み込みに失敗しました", "error");
    }
}

function updateStats() {
    const editableRows = appState.rows.filter(r => r.is_editable);
    const hasImagesRows = editableRows.filter(r => r.images && r.images.length > 0);
    
    elements.statTotal.textContent = editableRows.length;
    elements.statHasImages.textContent = hasImagesRows.length;
}

// ==========================================================================
// 各列のCSSクラス適用ヘルパー
// ==========================================================================
function applyColClass(el, idx) {
    if (idx === 0) {
        el.classList.add('col-id');
    } else if (idx === 1) {
        el.classList.add('col-type');
    } else if (idx === 2) {
        el.classList.add('col-code');
    } else if (idx === 3) {
        el.classList.add('col-name');
    } else if (idx === 4) {
        el.classList.add('col-pattern');
    } else if (idx === 5) {
        el.classList.add('col-design');
    } else if (idx === 6) {
        el.classList.add('col-retail-price');
    } else if (idx === 7) {
        el.classList.add('col-price');
    } else if (idx >= SIZE_START_IDX && idx <= SIZE_END_IDX) {
        el.classList.add('col-size');
    } else if (idx === AMOUNT_TOTAL_IDX) {
        el.classList.add('col-amount');
    }
}

// ==========================================================================
// テーブルの描画
// ==========================================================================
function renderHeader() {
    elements.tableHeaderRow.innerHTML = '';
    
    // 先頭に画像サムネイル列を追加
    const thumbTh = document.createElement('th');
    thumbTh.textContent = '画像';
    thumbTh.classList.add('col-thumb');
    elements.tableHeaderRow.appendChild(thumbTh);
    
    appState.visibleColIndices.forEach(idx => {
        const headerText = appState.headers[idx];
        const th = document.createElement('th');
        
        applyColClass(th, idx);
        
        // サイズ列は改行してコンパクトに表示
        if (idx >= SIZE_START_IDX && idx <= SIZE_END_IDX) {
            const sizeName = headerText.split('(')[0];
            const suffix = idx < SIZE_START_IDX + 6 ? 'Std' : 'BD';
            th.innerHTML = `${sizeName}<br><span class="size-suffix">${suffix}</span>`;
        } else {
            th.textContent = headerText.replace('\n', ' ');
        }
        
        elements.tableHeaderRow.appendChild(th);
    });
}

function renderTable() {
    elements.tableBody.innerHTML = '';
    
    if (appState.filteredRows.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = appState.visibleColIndices.length + 1;
        td.textContent = appState.confirmMode ? '数量が入力された注文商品は現在ありません。' : '該当するデータが見つかりません。';
        td.style.textAlign = 'center';
        td.style.padding = '2rem';
        td.style.color = 'var(--text-secondary)';
        tr.appendChild(td);
        elements.tableBody.appendChild(tr);
        
        // フッター（合計）もクリア
        elements.tableTotalsRow.innerHTML = '';
        return;
    }
    
    appState.filteredRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.dataset.originalIndex = row.original_index;
        
        // 数量入力済みの行はハイライト
        if (appState.dirtyRows.has(row.original_index)) {
            tr.classList.add('row-dirty');
            row.values = appState.dirtyRows.get(row.original_index);
        }
        
        if (!row.is_editable) {
            tr.classList.add('row-non-editable');
        }
        
        // 1. 画像列を先頭に挿入
        const thumbTd = document.createElement('td');
        thumbTd.classList.add('col-thumb');
        
        if (row.is_editable) {
            const hasImages = row.images && row.images.length > 0;
            if (hasImages) {
                const img = document.createElement('img');
                img.src = row.images[0];
                img.alt = row.values[3] || '商品画像';
                img.classList.add('col-thumb-img');
                img.title = 'クリックして画像を拡大';
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openGallery(row.images);
                });
                thumbTd.appendChild(img);
            } else {
                const placeholder = document.createElement('span');
                placeholder.textContent = '-';
                placeholder.style.color = 'var(--text-secondary)';
                placeholder.style.opacity = '0.4';
                thumbTd.appendChild(placeholder);
            }
        } else {
            thumbTd.textContent = '';
        }
        tr.appendChild(thumbTd);
        
        // 2. 描画対象のセルのみを描画
        appState.visibleColIndices.forEach(colIdx => {
            const val = row.values[colIdx];
            const td = document.createElement('td');
            
            applyColClass(td, colIdx);
            
            // サイズ列のインライン編集コントロール（0〜30の単一セレクトボックス）
            if (row.is_editable && colIdx >= SIZE_START_IDX && colIdx <= SIZE_END_IDX) {
                const numVal = parseInt(val) || 0;
                
                const wrapper = document.createElement('div');
                wrapper.classList.add('qty-select-wrapper');
                
                const select = document.createElement('select');
                select.classList.add('qty-select');
                if (appState.isOrderSubmitted) {
                    select.disabled = true;
                }
                
                // 0から30までの選択肢を生成
                for (let i = 0; i <= 30; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = i;
                    if (i === numVal) opt.selected = true;
                    select.appendChild(opt);
                }
                
                // もし元の値が30を超えていた場合のフォールバック（特別に追加）
                if (numVal > 30) {
                    const opt = document.createElement('option');
                    opt.value = numVal;
                    opt.textContent = numVal;
                    opt.selected = true;
                    select.appendChild(opt);
                }
                
                // 数量変更時のイベントハンドラ
                const onQtyChange = () => {
                    const newQty = parseInt(select.value) || 0;
                    row.values[colIdx] = newQty === 0 ? "" : String(newQty);
                    
                    // 金額計の自動計算
                    const wholesalePrice = parseFloat(row.values[WHOLESALE_PRICE_IDX]) || 0;
                    let totalQty = 0;
                    for (let sIdx = SIZE_START_IDX; sIdx <= SIZE_END_IDX; sIdx++) {
                        totalQty += parseInt(row.values[sIdx]) || 0;
                    }
                    const totalAmount = wholesalePrice * totalQty;
                    row.values[AMOUNT_TOTAL_IDX] = String(totalAmount);
                    
                    // いずれかのサイズ数量が1以上であれば dirtyRows で状態を保持、すべて0なら除外
                    let hasQty = false;
                    for (let sIdx = SIZE_START_IDX; sIdx <= SIZE_END_IDX; sIdx++) {
                        if (parseInt(row.values[sIdx]) > 0) {
                            hasQty = true;
                            break;
                        }
                    }
                    
                    if (hasQty) {
                         appState.dirtyRows.set(row.original_index, row.values);
                        tr.classList.add('row-dirty');
                    } else {
                        appState.dirtyRows.delete(row.original_index);
                        tr.classList.remove('row-dirty');
                    }
                    
                    // 表示されている金額計のtdセルを特定して即時更新
                    // 画像列を最初に追加しているため、tdのインデックスは amountColIdx + 1 になる
                    const amountColIdx = appState.visibleColIndices.indexOf(AMOUNT_TOTAL_IDX);
                    if (amountColIdx !== -1) {
                        const amountTd = tr.children[amountColIdx + 1];
                        if (amountTd) {
                            amountTd.textContent = String(totalAmount);
                            amountTd.title = String(totalAmount);
                        }
                    }
                    
                    // 全体の合計フッターを再描画
                    renderFooter();
                };
                
                select.addEventListener('change', onQtyChange);
                wrapper.appendChild(select);
                td.appendChild(wrapper);
                
            } else {
                td.textContent = val;
                td.title = val;
            }
            tr.appendChild(td);
        });
        
        elements.tableBody.appendChild(tr);
    });
    
    // フッターの描画
    renderFooter();
}

// ==========================================================================
// テーブルフッター（合計）の描画
// ==========================================================================
function renderFooter() {
    elements.tableTotalsRow.innerHTML = '';
    
    // 画像列用ダミーセル
    const thumbTd = document.createElement('td');
    thumbTd.classList.add('col-thumb');
    elements.tableTotalsRow.appendChild(thumbTd);
    
    // 表示されている行（filteredRows）の集計
    // 非編集可能行（サブヘッダー等）は集計から除外
    const activeDataRows = appState.filteredRows.filter(r => r.is_editable);
    
    // 各列の値を集計して描画
    appState.visibleColIndices.forEach(colIdx => {
        const td = document.createElement('td');
        applyColClass(td, colIdx);
        
        // ラベル列（商品名列の位置に「合計」を表示）
        if (colIdx === 3) {
            td.innerHTML = '<strong>合計</strong>';
            td.style.textAlign = 'right';
        }
        // サイズ別数量の合計
        else if (colIdx >= SIZE_START_IDX && colIdx <= SIZE_END_IDX) {
            let colTotal = 0;
            activeDataRows.forEach(row => {
                const val = appState.dirtyRows.has(row.original_index) 
                    ? appState.dirtyRows.get(row.original_index)[colIdx] 
                    : row.values[colIdx];
                colTotal += parseInt(val) || 0;
            });
            td.innerHTML = `<strong>${colTotal}</strong>`;
        }
        // 総合計金額
        else if (colIdx === AMOUNT_TOTAL_IDX) {
            let grandTotal = 0;
            activeDataRows.forEach(row => {
                const val = appState.dirtyRows.has(row.original_index) 
                    ? appState.dirtyRows.get(row.original_index)[AMOUNT_TOTAL_IDX] 
                    : row.values[AMOUNT_TOTAL_IDX];
                grandTotal += parseFloat(val) || 0;
            });
            // カンマ区切りフォーマット
            const formattedTotal = '¥ ' + grandTotal.toLocaleString();
            td.innerHTML = `<strong>${formattedTotal}</strong>`;
        }
        
        elements.tableTotalsRow.appendChild(td);
    });
}

// ==========================================================================
// 検索とフィルタリング
// ==========================================================================
function applyFilters() {
    const searchVal = elements.searchInput.value.toLowerCase().trim();
    const imagesOnly = elements.filterImagesOnly.checked;
    
    const pIdx = appState.headers.indexOf('品番');
    const nIdx = appState.headers.indexOf('商品名');
    
    appState.filteredRows = appState.rows.filter(row => {
        // 非編集可能行（サブヘッダー等）は、常に非表示にする（合計行とメインヘッダーだけで十分なため）
        if (!row.is_editable) {
            return false;
        }
        
        // 確認モード：いずれかのサイズが1以上入力されているもののみ表示
        if (appState.confirmMode) {
            let hasQty = false;
            for (let sIdx = SIZE_START_IDX; sIdx <= SIZE_END_IDX; sIdx++) {
                const val = appState.dirtyRows.has(row.original_index)
                    ? appState.dirtyRows.get(row.original_index)[sIdx]
                    : row.values[sIdx];
                if (parseInt(val) > 0) {
                    hasQty = true;
                    break;
                }
            }
            if (!hasQty) return false;
        }
        
        if (imagesOnly && (!row.images || row.images.length === 0)) {
            return false;
        }
        
        if (searchVal) {
            const pVal = pIdx !== -1 && row.values[pIdx] ? row.values[pIdx].toLowerCase() : '';
            const nVal = nIdx !== -1 && row.values[nIdx] ? row.values[nIdx].toLowerCase() : '';
            return pVal.includes(searchVal) || nVal.includes(searchVal);
        }
        
        return true;
    });
    
    renderTable();
}

elements.searchInput.addEventListener('input', applyFilters);
elements.filterImagesOnly.addEventListener('change', applyFilters);

// ==========================================================================
// 画像ギャラリー機能
// ==========================================================================
function openGallery(images) {
    appState.gallery.images = images;
    appState.gallery.currentIndex = 0;
    
    updateGalleryImage();
    elements.galleryModal.classList.add('active');
    document.addEventListener('keydown', handleGalleryKeyPress);
}

function closeGallery() {
    elements.galleryModal.classList.remove('active');
    document.removeEventListener('keydown', handleGalleryKeyPress);
}

function updateGalleryImage() {
    const { images, currentIndex } = appState.gallery;
    if (images.length === 0) return;
    
    const imageUrl = images[currentIndex];
    elements.galleryImg.src = imageUrl;
    elements.galleryCounter.textContent = `${currentIndex + 1} / ${images.length}`;
    
    const fullWidthDigits = ["１", "２", "３", "４", "５", "６", "７", "８", "９", "１０"];
    const label = `デザインイメージ${fullWidthDigits[currentIndex] || (currentIndex + 1)}`;
    elements.galleryFilename.textContent = label;
    
    elements.galleryPrevBtn.disabled = images.length <= 1;
    elements.galleryNextBtn.disabled = images.length <= 1;
}

function navigateGallery(direction) {
    const { images } = appState.gallery;
    if (images.length <= 1) return;
    
    if (direction === 'next') {
        appState.gallery.currentIndex = (appState.gallery.currentIndex + 1) % images.length;
    } else {
        appState.gallery.currentIndex = (appState.gallery.currentIndex - 1 + images.length) % images.length;
    }
    updateGalleryImage();
}

function handleGalleryKeyPress(e) {
    if (e.key === 'ArrowRight') {
        navigateGallery('next');
    } else if (e.key === 'ArrowLeft') {
        navigateGallery('prev');
    } else if (e.key === 'Escape') {
        closeGallery();
    }
}

elements.galleryPrevBtn.addEventListener('click', () => navigateGallery('prev'));
elements.galleryNextBtn.addEventListener('click', () => navigateGallery('next'));
elements.closeGalleryModal.addEventListener('click', closeGallery);
elements.galleryModal.addEventListener('click', (e) => {
    if (e.target === elements.galleryModal) closeGallery();
});

// ==========================================================================
// 確認モード制御
// ==========================================================================
function setConfirmMode(active) {
    appState.confirmMode = active;
    if (active) {
        elements.confirmBtn.style.display = 'none';
        elements.resetViewBtn.style.display = 'block';
        elements.submitOrderBtn.style.display = 'block';
        elements.printPdfBtn.style.display = 'block';
    } else {
        elements.confirmBtn.style.display = 'block';
        elements.resetViewBtn.style.display = 'none';
        elements.submitOrderBtn.style.display = 'none';
        elements.printPdfBtn.style.display = 'none';
    }
    applyFilters();
}

elements.confirmBtn.addEventListener('click', () => setConfirmMode(true));
elements.resetViewBtn.addEventListener('click', () => setConfirmMode(false));

// ==========================================================================
// 印刷用別ウィンドウ処理 (PDFを閉じたときにアプリが閉じないようにする対策)
// ==========================================================================
function triggerPrint() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast("ポップアップがブロックされました。ブラウザの設定で許可してください。", "error");
        return;
    }

    const headerClone = document.querySelector('.print-order-header').cloneNode(true);
    const tableSectionClone = document.querySelector('.table-section').cloneNode(true);

    // selectタグの入力値（選択した数量）が複製先に引き継がれないため、手動で値をセットする
    const originalSelects = document.querySelectorAll('.table-section select');
    const clonedSelects = tableSectionClone.querySelectorAll('select');
    originalSelects.forEach((select, i) => {
        const val = select.value;
        clonedSelects[i].value = val;
        const selectedIndex = select.selectedIndex;
        if (clonedSelects[i].options[selectedIndex]) {
            clonedSelects[i].options[selectedIndex].setAttribute('selected', 'selected');
        }
    });



    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>御注文書</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body {
            background-color: #fff !important;
            color: #000 !important;
            font-family: 'Noto Sans JP', sans-serif !important;
            font-size: 11pt !important;
            padding: 20px !important;
            margin: 0 !important;
        }
        .print-only.print-order-header {
            display: block !important;
            margin-bottom: 2rem;
        }
        .app-main {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        .table-section {
            background-color: #fff !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
        }
        .table-wrapper {
            max-height: none !important;
            overflow: visible !important;
        }
        .col-thumb, .col-retail-price, .table-header-tools {
            display: none !important;
        }
        .order-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9pt !important;
        }
        .order-table th, .order-table td, .totals-row td {
            position: static !important;
            border: 1px solid #000 !important;
            padding: 6px 4px !important;
            background-color: #fff !important;
            color: #000 !important;
        }
        .order-table th {
            background-color: #f3f4f6 !important;
        }
        .totals-row td {
            background-color: #f3f4f6 !important;
        }
        .qty-select {
            background: transparent !important;
            border: none !important;
            color: #000 !important;
            width: 100% !important;
            font-size: 10pt !important;
            font-weight: 700 !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            text-align: center !important;
            padding: 0 !important;
            height: auto !important;
        }
        .qty-select option:not(:checked) {
            display: none !important;
        }
        .col-id {
            width: 25px !important;
            max-width: 25px !important;
            min-width: 25px !important;
        }
        .col-type {
            width: 50px !important;
            max-width: 50px !important;
            min-width: 50px !important;
        }
        .col-code {
            width: 70px !important;
            max-width: 70px !important;
            min-width: 70px !important;
        }
        .col-name {
            width: 95px !important;
            max-width: 95px !important;
            min-width: 95px !important;
        }
        .col-pattern {
            width: 55px !important;
            max-width: 55px !important;
            min-width: 55px !important;
        }
        .col-design {
            width: 55px !important;
            max-width: 55px !important;
            min-width: 55px !important;
        }
        .col-price {
            width: 55px !important;
            max-width: 55px !important;
            min-width: 55px !important;
        }
        .col-size {
            width: 23px !important;
            max-width: 23px !important;
            min-width: 23px !important;
        }
        .col-amount {
            width: 70px !important;
            max-width: 70px !important;
            min-width: 70px !important;
        }
        .order-table th.col-size {
            font-size: 8.5pt !important;
            line-height: 1.0 !important;
            padding: 4px 1px !important;
        }
        .size-suffix {
            font-size: 6.5pt !important;
            font-weight: normal !important;
            display: block !important;
            margin-top: 1px !important;
            color: #475569 !important;
        }
    </style>
</head>
<body>
    <div class="app-main">
        <div id="print-header-placeholder"></div>
        <div id="print-table-placeholder"></div>
    </div>
    <script>
        window.addEventListener('load', () => {
            setTimeout(() => {
                window.print();
            }, 300);
        });
    </script>
</body>
</html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.document.getElementById('print-header-placeholder').appendChild(headerClone);
    printWindow.document.getElementById('print-table-placeholder').appendChild(tableSectionClone);
}

function executePrintFlow() {
    const wasConfirmMode = appState.confirmMode;
    if (!wasConfirmMode) {
        setConfirmMode(true);
    }
    setTimeout(() => {
        triggerPrint();
        if (!wasConfirmMode) {
            setConfirmMode(false);
        }
    }, 150);
}

elements.printPdfBtn.addEventListener('click', () => {
    if (appState.dirtyRows.size === 0) {
        showToast("数量が入力されている商品がありません。数量を入力してから出力してください。", "error");
        return;
    }
    executePrintFlow();
});

// 印刷終了後に自動で全件表示に戻す
window.addEventListener('afterprint', () => {
    setConfirmMode(false);
});

// ==========================================================================
// トースト通知
// ==========================================================================
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

// ==========================================================================
// 注文元情報のリアルタイムバインド
// ==========================================================================
function setupClientInfoBinding() {
    const updateBinding = () => {
        elements.printClientCompany.textContent = elements.inputClientCompany.value.trim() || "____________________";
        elements.printClientName.textContent = elements.inputClientName.value.trim() || "__________________";
        elements.printClientPhone.textContent = elements.inputClientPhone.value.trim() || "__________________";
    };
    
    elements.inputClientCompany.addEventListener('input', updateBinding);
    elements.inputClientName.addEventListener('input', updateBinding);
    elements.inputClientPhone.addEventListener('input', updateBinding);
}

// ==========================================================================
// 入力クリア処理
// ==========================================================================
function setupClearButton() {
    elements.clearBtn.addEventListener('click', () => {
        if (!confirm("入力内容（ご発注数量およびお客様情報）をすべてクリアしてもよろしいですか？")) {
            return;
        }
        
        // 1. 全て数量を空にする
        appState.rows.forEach(row => {
            if (row.is_editable) {
                for (let idx = SIZE_START_IDX; idx <= SIZE_END_IDX; idx++) {
                    row.values[idx] = "";
                }
                row.values[AMOUNT_TOTAL_IDX] = "0";
            }
        });
        
        // 2. 変更状態をクリア
        appState.dirtyRows.clear();
        appState.isOrderSubmitted = false;
        
        // 3. 入力フォームのクリアと印刷用表示の初期化
        elements.inputClientCompany.value = "";
        elements.inputClientName.value = "";
        elements.inputClientPhone.value = "";
        elements.printClientCompany.textContent = "____________________";
        elements.printClientName.textContent = "__________________";
        elements.printClientPhone.textContent = "__________________";
        
        // 4. 検索条件とチェックボックスのリセット
        elements.searchInput.value = "";
        elements.filterImagesOnly.checked = false;
        
        // 5. 確認モード解除して再描画
        setConfirmMode(false);
        
        showToast("入力内容をクリアしました");
    });
}

// ==========================================================================
// 発注確定処理
// ==========================================================================
function setupSubmitButton() {
    elements.submitOrderBtn.addEventListener('click', async () => {
        const company = elements.inputClientCompany.value.trim();
        const name = elements.inputClientName.value.trim();
        const phone = elements.inputClientPhone.value.trim();
        
        if (!company || !name || !phone) {
            showToast("ご発注者様情報（貴社名、ご担当者名、お電話番号）を入力してください。", "error");
            return;
        }
        
        if (appState.dirtyRows.size === 0) {
            showToast("発注数量が入力されている商品がありません。", "error");
            return;
        }
        
        const items = [];
        appState.dirtyRows.forEach((vals, originalIndex) => {
            items.push({
                original_index: originalIndex,
                values: vals
            });
        });
        
        const payload = {
            clientInfo: { company, name, phone },
            items: items
        };
        
        try {
            elements.submitOrderBtn.disabled = true;
            elements.submitOrderBtn.textContent = "⌛ 送信中...";
            
            const response = await fetch('/api/submit-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || "発注の送信に失敗しました");
            }
            
            appState.isOrderSubmitted = true;
            renderTable();
            elements.completeOrderNumber.textContent = result.order_number;
            elements.orderCompleteModal.classList.add('active');
            showToast("ご発注を送信しました！");
            
        } catch (error) {
            console.error("発注送信エラー:", error);
            showToast(error.message, "error");
        } finally {
            elements.submitOrderBtn.disabled = false;
            elements.submitOrderBtn.textContent = "🚀 ご発注を確定する";
        }
    });
    
    elements.closeCompleteModalBtn.addEventListener('click', () => {
        elements.orderCompleteModal.classList.remove('active');
        // Do not clear inputs automatically to prevent user from losing their data
    });
    
    elements.completePrintBtn.addEventListener('click', () => {
        executePrintFlow();
    });
}

// ==========================================================================
// 過去の発注履歴検索・再利用処理
// ==========================================================================
function setupClientHistory() {
    // 過去履歴検索ボタン押下時
    elements.historyLookupBtn.addEventListener('click', () => {
        const currentCompany = elements.inputClientCompany.value.trim();
        const currentName = elements.inputClientName.value.trim();
        const currentPhone = elements.inputClientPhone.value.trim();
        
        if (currentCompany) elements.searchClientCompany.value = currentCompany;
        if (currentName) elements.searchClientName.value = currentName;
        if (currentPhone) elements.searchClientPhone.value = currentPhone;
        
        elements.clientHistoryModal.classList.add('active');
        
        if (elements.searchClientCompany.value && elements.searchClientName.value && elements.searchClientPhone.value) {
            elements.clientHistorySearchBtn.click();
        }
    });
    
    elements.closeClientHistoryModal.addEventListener('click', () => {
        elements.clientHistoryModal.classList.remove('active');
    });
    
    elements.clientHistoryClearBtn.addEventListener('click', () => {
        elements.searchClientCompany.value = "";
        elements.searchClientName.value = "";
        elements.searchClientPhone.value = "";
        elements.clientHistoryResultsArea.innerHTML = `
            <p style="text-align: center; padding: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                検索する発注者情報を入力し、「履歴を検索」ボタンを押してください。
            </p>
        `;
    });
    
    elements.clientHistorySearchBtn.addEventListener('click', async () => {
        const company = elements.searchClientCompany.value.trim();
        const name = elements.searchClientName.value.trim();
        const phone = elements.searchClientPhone.value.trim();
        
        if (!company || !name || !phone) {
            showToast("貴社名、ご担当者名、お電話番号をすべて入力してください。", "error");
            return;
        }
        
        elements.clientHistoryResultsArea.innerHTML = `
            <p style="text-align: center; padding: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                🔍 履歴を検索中...
            </p>
        `;
        
        try {
            const response = await fetch(`/api/client/orders?company=${encodeURIComponent(company)}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`);
            if (!response.ok) {
                const errResult = await response.json();
                throw new Error(errResult.error || "履歴の検索に失敗しました。");
            }
            
            const data = await response.json();
            appState.clientHistory.orders = data.orders;
            
            renderClientHistoryResults();
        } catch (error) {
            console.error("履歴検索エラー:", error);
            elements.clientHistoryResultsArea.innerHTML = `
                <p style="text-align: center; padding: 1.5rem; color: var(--danger); font-size: 0.9rem;">
                    ❌ エラー: ${error.message}
                </p>
            `;
        }
    });
    
    elements.closeClientDetailModal.addEventListener('click', () => {
        elements.clientDetailModal.classList.remove('active');
    });
    
    elements.clientDetailBackBtn.addEventListener('click', () => {
        elements.clientDetailModal.classList.remove('active');
    });
    
    // 発注内容の再読み込み（再利用）
    elements.clientDetailReuseBtn.addEventListener('click', () => {
        const order = appState.clientHistory.currentOrder;
        const items = appState.clientHistory.currentItems;
        
        if (!order || !items) return;
        
        if (!confirm(`発注番号 ${order.order_number} の内容を現在の注文リストに読み込みますか？\n(現在入力中の数量は上書きされます)`)) {
            return;
        }
        
        // 1. 現在の数量入力をすべてクリア
        appState.rows.forEach(row => {
            if (row.is_editable) {
                for (let idx = SIZE_START_IDX; idx <= SIZE_END_IDX; idx++) {
                    row.values[idx] = "";
                }
                row.values[AMOUNT_TOTAL_IDX] = "0";
            }
        });
        appState.dirtyRows.clear();
        appState.isOrderSubmitted = false;
        
        // 2. 過去の数量をテーブル行にセットする
        items.forEach(pastItem => {
            const row = appState.rows.find(r => 
                r.is_editable &&
                r.values[2] === pastItem.product_code &&
                r.values[4] === pastItem.body &&
                r.values[5] === pastItem.design
            );
            
            if (row) {
                let totalQty = 0;
                pastItem.qtys.forEach((qty, idx) => {
                    const colIdx = SIZE_START_IDX + idx;
                    if (qty > 0) {
                        row.values[colIdx] = String(qty);
                        totalQty += qty;
                    } else {
                        row.values[colIdx] = "";
                    }
                });
                
                const wholesalePrice = parseFloat(row.values[WHOLESALE_PRICE_IDX]) || 0;
                row.values[AMOUNT_TOTAL_IDX] = String(wholesalePrice * totalQty);
                
                if (totalQty > 0) {
                    appState.dirtyRows.set(row.original_index, row.values);
                }
            }
        });
        
        // 3. 発注者情報の自動入力
        elements.inputClientCompany.value = order.company_name;
        elements.inputClientName.value = order.contact_name;
        elements.inputClientPhone.value = order.phone_number;
        
        elements.printClientCompany.textContent = order.company_name;
        elements.printClientName.textContent = order.contact_name;
        elements.printClientPhone.textContent = order.phone_number;
        
        // 4. モーダルを閉じる
        elements.clientDetailModal.classList.remove('active');
        elements.clientHistoryModal.classList.remove('active');
        
        // 5. 確認モードにして再描画
        setConfirmMode(true);
        
        showToast("過去のご発注内容を読み込みました。");
    });
}

function renderClientHistoryResults() {
    const orders = appState.clientHistory.orders;
    const resultsArea = elements.clientHistoryResultsArea;
    
    if (orders.length === 0) {
        resultsArea.innerHTML = `
            <p style="text-align: center; padding: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                ℹ️ 一致するご発注履歴は見つかりませんでした。
            </p>
        `;
        return;
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
            <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">
                    <th style="padding: 0.5rem 0.25rem;">発注日時</th>
                    <th style="padding: 0.5rem 0.25rem;">発注番号</th>
                    <th style="padding: 0.5rem 0.25rem; text-align: right;">総数量</th>
                    <th style="padding: 0.5rem 0.25rem; text-align: right;">合計金額</th>
                    <th style="padding: 0.5rem 0.25rem; text-align: center; width: 140px;">操作</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    orders.forEach(order => {
        const dateObj = new Date(order.created_at);
        const formattedDate = isNaN(dateObj.getTime()) ? order.created_at : 
            `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.6rem 0.25rem;">${formattedDate}</td>
                <td style="padding: 0.6rem 0.25rem; font-weight: bold; color: var(--primary);">${order.order_number}</td>
                <td style="padding: 0.6rem 0.25rem; text-align: right; font-weight: bold;">${order.total_quantity}</td>
                <td style="padding: 0.6rem 0.25rem; text-align: right; color: var(--accent); font-weight: bold;">¥ ${order.total_amount.toLocaleString()}</td>
                <td style="padding: 0.6rem 0.25rem; text-align: center; display: flex; gap: 0.4rem; justify-content: center;">
                    <button class="btn btn-secondary btn-client-detail" data-id="${order.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 4px;">🔍 詳細</button>
                    <button class="btn btn-primary btn-client-reuse" data-id="${order.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background-color: var(--success); color: white; border-radius: 4px;">🔄 再読込</button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    resultsArea.innerHTML = html;
    
    resultsArea.querySelectorAll('.btn-client-detail').forEach(btn => {
        btn.addEventListener('click', () => {
            const orderId = btn.dataset.id;
            openClientOrderDetail(orderId);
        });
    });
    
    resultsArea.querySelectorAll('.btn-client-reuse').forEach(btn => {
        btn.addEventListener('click', () => {
            const orderId = btn.dataset.id;
            openClientOrderDetail(orderId, true);
        });
    });
}

async function openClientOrderDetail(orderId, directReuse = false) {
    const company = elements.searchClientCompany.value.trim();
    const name = elements.searchClientName.value.trim();
    const phone = elements.searchClientPhone.value.trim();
    
    try {
        const response = await fetch(`/api/client/order-details?id=${orderId}&company=${encodeURIComponent(company)}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`);
        if (!response.ok) {
            const errResult = await response.json();
            throw new Error(errResult.error || "詳細データの取得に失敗しました。");
        }
        
        const data = await response.json();
        appState.clientHistory.currentOrder = data.order;
        appState.clientHistory.currentItems = data.items;
        
        if (directReuse) {
            elements.clientDetailReuseBtn.click();
        } else {
            renderClientOrderDetailModal();
        }
    } catch (error) {
        console.error("過去注文詳細取得エラー:", error);
        showToast(error.message, "error");
    }
}

function renderClientOrderDetailModal() {
    const order = appState.clientHistory.currentOrder;
    const items = appState.clientHistory.currentItems;
    
    elements.clientDetailOrderNumber.textContent = order.order_number;
    
    const dateObj = new Date(order.created_at);
    const formattedDate = isNaN(dateObj.getTime()) ? order.created_at : 
        `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
    elements.clientDetailOrderDate.textContent = formattedDate;
    
    elements.clientDetailTbody.innerHTML = '';
    
    items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        
        let sizeHtml = '';
        const sizeLabels = ['S', 'M', 'L', 'XL', 'XXL'];
        item.qtys.forEach((qty, idx) => {
            if (qty > 0) {
                const isBD = idx >= 5;
                const label = sizeLabels[idx % 5] + (isBD ? '(BD)' : '(Std)');
                sizeHtml += `<span style="display:inline-block; margin-right: 0.5rem; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight:bold; font-size:0.75rem; white-space:nowrap;">${label}: ${qty}枚</span>`;
            }
        });
        
        tr.innerHTML = `
            <td style="padding: 0.5rem; text-align: center;">${index + 1}</td>
            <td style="padding: 0.5rem; font-family: monospace;">${item.product_code}</td>
            <td style="padding: 0.5rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.product_name}">${item.product_name}</td>
            <td style="padding: 0.5rem;">${item.body}</td>
            <td style="padding: 0.5rem;">${item.design}</td>
            <td style="padding: 0.5rem; text-align: right;">¥${item.wholesale_price.toLocaleString()}</td>
            <td style="padding: 0.5rem;">${sizeHtml || '<span style="color:var(--text-secondary)">-</span>'}</td>
            <td style="padding: 0.5rem; text-align: right; font-weight: bold;">¥${item.subtotal_amount.toLocaleString()}</td>
        `;
        elements.clientDetailTbody.appendChild(tr);
    });
    
    elements.clientDetailGrandTotal.textContent = `¥ ${order.total_amount.toLocaleString()}`;
    elements.clientDetailModal.classList.add('active');
}

// ==========================================================================
// 起動
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupClientInfoBinding();
    setupClearButton();
    setupSubmitButton();
    setupClientHistory();
});
