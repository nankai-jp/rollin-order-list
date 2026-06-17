import os
import csv
import json
import urllib.parse
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(os.environ.get("PORT", 8000))
CSV_FILENAME = "注文リスト.csv"
BASE_FOLDER_NAME = os.environ.get("BASE_FOLDER_PATH", "注文リスト管理")
DATABASE_FILE = os.environ.get("DATABASE_PATH", "database.db")

IS_DATABASE_FALLBACK = False
DATABASE_ERROR_MESSAGE = ""

def init_db():
    global DATABASE_FILE, IS_DATABASE_FALLBACK, DATABASE_ERROR_MESSAGE
    print(f"Initializing database at: {DATABASE_FILE}")
    
    db_dir = os.path.dirname(DATABASE_FILE)
    if db_dir and not os.path.exists(db_dir):
        try:
            print(f"Creating database directory: {db_dir}")
            os.makedirs(db_dir, exist_ok=True)
        except Exception as e:
            print(f"WARNING: Failed to create database directory {db_dir}: {str(e)}")
            print("Falling back to local database.db")
            DATABASE_FILE = "database.db"
            IS_DATABASE_FALLBACK = True
            DATABASE_ERROR_MESSAGE = f"Directory creation failed ({db_dir}): {str(e)}"

    try:
        conn = sqlite3.connect(DATABASE_FILE)
    except Exception as e:
        print(f"WARNING: Failed to connect to database at {DATABASE_FILE}: {str(e)}")
        print("Falling back to local database.db")
        DATABASE_FILE = "database.db"
        IS_DATABASE_FALLBACK = True
        DATABASE_ERROR_MESSAGE = f"DB connection failed ({DATABASE_FILE}): {str(e)}"
        conn = sqlite3.connect(DATABASE_FILE)

    try:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number TEXT UNIQUE NOT NULL,
            company_name TEXT NOT NULL,
            contact_name TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            total_quantity INTEGER NOT NULL,
            total_amount REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_code TEXT NOT NULL,
            product_name TEXT NOT NULL,
            body TEXT NOT NULL,
            design TEXT NOT NULL,
            wholesale_price REAL NOT NULL,
            qty_s_std INTEGER DEFAULT 0,
            qty_m_std INTEGER DEFAULT 0,
            qty_l_std INTEGER DEFAULT 0,
            qty_xl_std INTEGER DEFAULT 0,
            qty_xxl_std INTEGER DEFAULT 0,
            qty_s_bd INTEGER DEFAULT 0,
            qty_m_bd INTEGER DEFAULT 0,
            qty_l_bd INTEGER DEFAULT 0,
            qty_xl_bd INTEGER DEFAULT 0,
            qty_xxl_bd INTEGER DEFAULT 0,
            subtotal_amount REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS maker_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            maker_order_number TEXT UNIQUE NOT NULL,
            source_order_number TEXT,
            total_quantity INTEGER NOT NULL,
            status TEXT DEFAULT '発注済',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS maker_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            maker_order_id INTEGER NOT NULL,
            product_code TEXT NOT NULL,
            product_name TEXT NOT NULL,
            body TEXT NOT NULL,
            design TEXT NOT NULL,
            qty_s_std INTEGER DEFAULT 0,
            qty_m_std INTEGER DEFAULT 0,
            qty_l_std INTEGER DEFAULT 0,
            qty_xl_std INTEGER DEFAULT 0,
            qty_xxl_std INTEGER DEFAULT 0,
            qty_s_bd INTEGER DEFAULT 0,
            qty_m_bd INTEGER DEFAULT 0,
            qty_l_bd INTEGER DEFAULT 0,
            qty_xl_bd INTEGER DEFAULT 0,
            qty_xxl_bd INTEGER DEFAULT 0,
            FOREIGN KEY (maker_order_id) REFERENCES maker_orders(id) ON DELETE CASCADE
        )
        """)
        conn.commit()
        conn.close()
        print("Database initialization successful.")
    except Exception as e:
        print(f"CRITICAL: Database initialization failed: {str(e)}")
        raise e

def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def clean_folder_name(name):
    replace_dict = {
        '\\': '￥',
        '/': '／',
        ':': '：',
        '*': '＊',
        '?': '？',
        '"': '”',
        '<': '＜',
        '>': '＞',
        '|': '｜'
    }
    for char, replacement in replace_dict.items():
        name = name.replace(char, replacement)
    return name.strip().strip('.')

def get_original_body_color(product_code):
    if not product_code or not os.path.exists(CSV_FILENAME):
        return ""
    try:
        with open(CSV_FILENAME, mode='r', encoding='cp932') as f:
            reader = csv.reader(f)
            rows = list(reader)
            if len(rows) > 6:
                header = rows[5]
                p_idx = header.index("品番")
                b_idx = 4
                if "ボディ" in header:
                    b_idx = header.index("ボディ")
                for r in rows[6:]:
                    if len(r) > max(p_idx, b_idx) and r[p_idx].strip() == product_code:
                        return r[b_idx].strip()
    except Exception as e:
        print(f"Error reading CSV for body color lookup: {e}")
    return ""

class OrderManagerHandler(BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        # 標準ログ出力を抑制してすっきりさせる（必要なら print を使う）
        pass

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def send_file(self, file_path, content_type):
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            self.send_error(404, "File not found")
            return
        
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        with open(file_path, 'rb') as f:
            self.wfile.write(f.read())

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        # 静的ファイルの配信
        if path == '/' or path == '/index.html':
            self.send_file('index.html', 'text/html; charset=utf-8')
            return
        elif path == '/admin.html':
            self.send_file('admin.html', 'text/html; charset=utf-8')
            return
        elif path == '/admin.js':
            self.send_file('admin.js', 'application/javascript; charset=utf-8')
            return
        elif path == '/style.css':
            self.send_file('style.css', 'text/css; charset=utf-8')
            return
        elif path == '/app.js':
            self.send_file('app.js', 'application/javascript; charset=utf-8')
            return
        elif path == '/maker.html':
            self.send_file('maker.html', 'text/html; charset=utf-8')
            return
        elif path == '/maker.js':
            self.send_file('maker.js', 'application/javascript; charset=utf-8')
            return
            
        # 画像ファイルの配信 (/images/品番_商品名/画像名)
        elif path.startswith('/images/'):
            relative_path = urllib.parse.unquote(path[8:])  # '/images/' の後を取得
            
            # まず永続ディスク側でパスを検証・取得
            safe_path = os.path.normpath(os.path.join(BASE_FOLDER_NAME, relative_path))
            abs_base = os.path.abspath(BASE_FOLDER_NAME)
            abs_target = os.path.abspath(safe_path)
            
            if os.path.exists(safe_path) and os.path.isfile(safe_path) and abs_target.startswith(abs_base):
                target_file = safe_path
            else:
                # 無ければローカルのリポジトリ側を探す
                local_base = "注文リスト管理"
                safe_path_local = os.path.normpath(os.path.join(local_base, relative_path))
                abs_base_local = os.path.abspath(local_base)
                abs_target_local = os.path.abspath(safe_path_local)
                if os.path.exists(safe_path_local) and os.path.isfile(safe_path_local) and abs_target_local.startswith(abs_base_local):
                    target_file = safe_path_local
                else:
                    self.send_error(404, "Image not found")
                    return
                
            # Content-Typeの決定
            ext = os.path.splitext(target_file)[1].lower()
            mime_types = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            }
            content_type = mime_types.get(ext, 'application/octet-stream')
            self.send_file(target_file, content_type)
            return
            
        # CSVデータ取得 API
        elif path == '/api/orders':
            if not os.path.exists(CSV_FILENAME):
                self.send_json({"error": "CSV file not found"}, 404)
                return
                
            try:
                with open(CSV_FILENAME, mode='r', encoding='cp932') as f:
                    reader = csv.reader(f)
                    rows = list(reader)
            except Exception as e:
                self.send_json({"error": f"Failed to read CSV: {str(e)}"}, 500)
                return
                
            if len(rows) < 6:
                self.send_json({"error": "CSV must have at least 6 rows (header is at row 6)"}, 400)
                return
                
            header = rows[5]
            
            try:
                p_idx = header.index("品番")
                n_idx = header.index("商品名")
            except ValueError:
                self.send_json({"error": "Header must contain '品番' and '商品名'"}, 400)
                return
                
            # 表示用ヘッダーのマージ構築 (0〜18列分)
            row5 = rows[5]
            row6 = rows[6] if len(rows) > 6 else [""] * len(row5)
            row7 = rows[7] if len(rows) > 7 else [""] * len(row5)
            
            display_headers = []
            for idx in range(19):
                h5 = row5[idx].strip() if idx < len(row5) else ""
                h6 = row6[idx].strip() if idx < len(row6) else ""
                h7 = row7[idx].strip() if idx < len(row7) else ""
                
                if idx == 4:
                    display_headers.append("ボディカラー")
                elif idx == 5:
                    display_headers.append("デザイン")
                elif idx >= 8 and idx <= 12:
                    display_headers.append(f"{h7}(Std)")
                elif idx >= 13 and idx <= 17:
                    display_headers.append(f"{h7}(BD)")
                else:
                    val = h5 if h5 else (h6 if h6 else h7)
                    display_headers.append(val)
                    
            data_rows = []
            # 7行目（インデックス6）からデータを走査
            for i, r in enumerate(rows[6:], start=6):
                # 列数が足りない場合はダミーで埋める
                while len(r) < len(header):
                    r.append("")
                    
                p_val = r[p_idx].strip()
                n_val = r[n_idx].strip()
                b_val = r[4].strip() if len(r) > 4 else ""
                d_val = r[5].strip() if len(r) > 5 else ""
                
                # 品番と商品名の両方が存在する場合のみ「編集可能・画像フォルダあり」とする
                is_editable = bool(p_val and n_val)
                images = []
                print_files = []
                
                if is_editable:
                    cleaned_n = clean_folder_name(n_val)
                    cleaned_b = clean_folder_name(b_val)
                    cleaned_d = clean_folder_name(d_val)
                    
                    folder_name = f"{p_val}_{cleaned_n}"
                    subfolder_name = f"{cleaned_b}_{cleaned_d}"
                    
                    path_persistent = os.path.join(BASE_FOLDER_NAME, folder_name, subfolder_name)
                    path_local = os.path.join("注文リスト管理", folder_name, subfolder_name)
                    
                    valid_exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
                    
                    # 永続ディスクとローカルの両方から画像をスキャン
                    scanned_images = set()
                    for folder_path in [path_persistent, path_local]:
                        if os.path.exists(folder_path) and os.path.isdir(folder_path):
                            for item in sorted(os.listdir(folder_path), key=natural_sort_key):
                                item_ext = os.path.splitext(item)[1].lower()
                                if item_ext in valid_exts:
                                    scanned_images.add(f"/images/{folder_name}/{subfolder_name}/{item}")
                    images = sorted(list(scanned_images), key=natural_sort_key)
                                
                    # プリントフォルダも両方から取得
                    scanned_prints = set()
                    for folder_path in [path_persistent, path_local]:
                        print_folder = os.path.join(folder_path, "print")
                        if os.path.exists(print_folder) and os.path.isdir(print_folder):
                            for f in os.listdir(print_folder):
                                if os.path.isfile(os.path.join(print_folder, f)):
                                    scanned_prints.add(f)
                    print_files = sorted(list(scanned_prints))
                
                data_rows.append({
                    "original_index": i,
                    "is_editable": is_editable,
                    "values": r[:19],  # フロントには19列分（0〜18）だけ送る
                    "images": images,
                    "print_files": print_files
                })
                
            self.send_json({
                "headers": display_headers,
                "rows": data_rows
            })
            return
            
        elif path == '/api/admin/orders':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            auth_token = query_params.get("token", [""])[0]
            
            ADMIN_PASSWORD = "rollin-admin"
            if auth_token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                cursor.execute("""
                SELECT id, order_number, company_name, contact_name, phone_number, total_quantity, total_amount, created_at
                FROM orders
                ORDER BY created_at DESC
                """)
                rows = cursor.fetchall()
                conn.close()
                
                orders = []
                for r in rows:
                    created_at_iso = r[7].replace(" ", "T") + "Z" if r[7] else ""
                    orders.append({
                        "id": r[0],
                        "order_number": r[1],
                        "company_name": r[2],
                        "contact_name": r[3],
                        "phone_number": r[4],
                        "total_quantity": r[5],
                        "total_amount": r[6],
                        "created_at": created_at_iso
                    })
                self.send_json({"orders": orders})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        elif path == '/api/admin/order-details':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            auth_token = query_params.get("token", [""])[0]
            order_id = query_params.get("id", [""])[0]
            
            ADMIN_PASSWORD = "rollin-admin"
            if auth_token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            if not order_id:
                self.send_json({"error": "Missing order ID"}, 400)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                
                cursor.execute("SELECT id, order_number, company_name, contact_name, phone_number, total_quantity, total_amount, created_at FROM orders WHERE id = ?", (order_id,))
                order_row = cursor.fetchone()
                if not order_row:
                    conn.close()
                    self.send_json({"error": "Order not found"}, 404)
                    return
                    
                created_at_iso = order_row[7].replace(" ", "T") + "Z" if order_row[7] else ""
                order_summary = {
                    "id": order_row[0],
                    "order_number": order_row[1],
                    "company_name": order_row[2],
                    "contact_name": order_row[3],
                    "phone_number": order_row[4],
                    "total_quantity": order_row[5],
                    "total_amount": order_row[6],
                    "created_at": created_at_iso
                }
                
                cursor.execute("""
                SELECT product_code, product_name, body, design, wholesale_price,
                       qty_s_std, qty_m_std, qty_l_std, qty_xl_std, qty_xxl_std,
                       qty_s_bd, qty_m_bd, qty_l_bd, qty_xl_bd, qty_xxl_bd,
                       subtotal_amount
                FROM order_items
                WHERE order_id = ?
                """, (order_id,))
                item_rows = cursor.fetchall()
                conn.close()
                
                items = []
                for ir in item_rows:
                    product_code = ir[0]
                    product_name = ir[1]
                    body_val = ir[2]
                    design_val = ir[3]
                    
                    images = []
                    prefix = f"{product_code}_"
                    target_parent = None
                    # 永続ディスクかローカルのいずれかで prefix が合致する親フォルダ名を探す
                    for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                        if os.path.exists(base_dir):
                            for item in os.listdir(base_dir):
                                if item.startswith(prefix) and os.path.isdir(os.path.join(base_dir, item)):
                                    target_parent = item
                                    break
                            if target_parent:
                                break
                                
                    if target_parent:
                        cleaned_b = clean_folder_name(body_val)
                        cleaned_d = clean_folder_name(design_val)
                        subfolder_name = f"{cleaned_b}_{cleaned_d}"
                        
                        # 永続ディスクとローカルの両方から画像をスキャン
                        scanned_images = set()
                        valid_exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
                        for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                            folder_path = os.path.join(base_dir, target_parent, subfolder_name)
                            if os.path.exists(folder_path) and os.path.isdir(folder_path):
                                for item in sorted(os.listdir(folder_path), key=natural_sort_key):
                                    item_ext = os.path.splitext(item)[1].lower()
                                    if item_ext in valid_exts:
                                        scanned_images.add(f"/images/{target_parent}/{subfolder_name}/{item}")
                        images = sorted(list(scanned_images), key=natural_sort_key)
                    
                    items.append({
                        "product_code": product_code,
                        "product_name": product_name,
                        "body": body_val,
                        "design": design_val,
                        "wholesale_price": ir[4],
                        "qtys": list(ir[5:15]),
                        "subtotal_amount": ir[15],
                        "images": images
                    })
                    
                self.send_json({
                    "order": order_summary,
                    "items": items
                })
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return
            
        elif path == '/api/client/orders':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            company = query_params.get("company", [""])[0].strip()
            name = query_params.get("name", [""])[0].strip()
            phone = query_params.get("phone", [""])[0].strip()
            
            if not company or not name or not phone:
                self.send_json({"error": "ご発注者様情報（貴社名、ご担当者名、お電話番号）を入力してください。"}, 400)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                conn.create_function("clean_phone", 1, lambda p: "".join(c for c in p if c.isdigit()) if p else "")
                conn.create_function("clean_text", 1, lambda t: "".join(t.split()).lower() if t else "")
                cursor = conn.cursor()
                cursor.execute("""
                SELECT id, order_number, company_name, contact_name, phone_number, total_quantity, total_amount, created_at
                FROM orders
                WHERE clean_text(company_name) = clean_text(?)
                  AND clean_text(contact_name) = clean_text(?)
                  AND clean_phone(phone_number) = clean_phone(?)
                ORDER BY created_at DESC
                """, (company, name, phone))
                rows = cursor.fetchall()
                conn.close()
                
                orders = []
                for r in rows:
                    created_at_iso = r[7].replace(" ", "T") + "Z" if r[7] else ""
                    orders.append({
                        "id": r[0],
                        "order_number": r[1],
                        "company_name": r[2],
                        "contact_name": r[3],
                        "phone_number": r[4],
                        "total_quantity": r[5],
                        "total_amount": r[6],
                        "created_at": created_at_iso
                    })
                self.send_json({"orders": orders})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        elif path == '/api/client/order-details':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            order_id = query_params.get("id", [""])[0]
            company = query_params.get("company", [""])[0].strip()
            name = query_params.get("name", [""])[0].strip()
            phone = query_params.get("phone", [""])[0].strip()
            
            if not order_id or not company or not name or not phone:
                self.send_json({"error": "必須情報が不足しています。"}, 400)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                conn.create_function("clean_phone", 1, lambda p: "".join(c for c in p if c.isdigit()) if p else "")
                conn.create_function("clean_text", 1, lambda t: "".join(t.split()).lower() if t else "")
                cursor = conn.cursor()
                
                # Verify identity matches the order
                cursor.execute("""
                SELECT id, order_number, company_name, contact_name, phone_number, total_quantity, total_amount, created_at 
                FROM orders 
                WHERE id = ? 
                  AND clean_text(company_name) = clean_text(?)
                  AND clean_text(contact_name) = clean_text(?)
                  AND clean_phone(phone_number) = clean_phone(?)
                """, (order_id, company, name, phone))
                order_row = cursor.fetchone()
                
                if not order_row:
                    conn.close()
                    self.send_json({"error": "一致するご発注履歴が見つかりませんでした。"}, 404)
                    return
                    
                created_at_iso = order_row[7].replace(" ", "T") + "Z" if order_row[7] else ""
                order_summary = {
                    "id": order_row[0],
                    "order_number": order_row[1],
                    "company_name": order_row[2],
                    "contact_name": order_row[3],
                    "phone_number": order_row[4],
                    "total_quantity": order_row[5],
                    "total_amount": order_row[6],
                    "created_at": created_at_iso
                }
                
                cursor.execute("""
                SELECT product_code, product_name, body, design, wholesale_price,
                       qty_s_std, qty_m_std, qty_l_std, qty_xl_std, qty_xxl_std,
                       qty_s_bd, qty_m_bd, qty_l_bd, qty_xl_bd, qty_xxl_bd,
                       subtotal_amount
                FROM order_items
                WHERE order_id = ?
                """, (order_id,))
                item_rows = cursor.fetchall()
                conn.close()
                
                items = []
                for ir in item_rows:
                    items.append({
                        "product_code": ir[0],
                        "product_name": ir[1],
                        "body": ir[2],
                        "design": ir[3],
                        "wholesale_price": ir[4],
                        "qtys": list(ir[5:15]),
                        "subtotal_amount": ir[15]
                    })
                    
                self.send_json({
                    "order": order_summary,
                    "items": items
                })
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return
            
        elif path == '/api/maker/orders':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            token = query_params.get("token", [""])[0].strip()
            
            MAKER_PASSWORD = "rollin-maker"
            if token != MAKER_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                cursor.execute("""
                SELECT id, maker_order_number, source_order_number, total_quantity, status, created_at
                FROM maker_orders
                ORDER BY created_at DESC
                """)
                rows = cursor.fetchall()
                
                orders = []
                for r in rows:
                    order_id = r[0]
                    created_at_iso = r[5].replace(" ", "T") + "Z" if r[5] else ""
                    
                    # Fetch items for this order to find images and print files
                    cursor.execute("""
                    SELECT product_code, product_name, body, design
                    FROM maker_order_items
                    WHERE maker_order_id = ?
                    """, (order_id,))
                    item_rows = cursor.fetchall()
                    
                    thumbnail_url = None
                    print_files = []
                    
                    for ir in item_rows:
                        product_code = ir[0]
                        body_val = ir[2]
                        design_val = ir[3]
                        
                        prefix = f"{product_code}_"
                        target_parent = None
                        for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                            if os.path.exists(base_dir):
                                for item in os.listdir(base_dir):
                                    if item.startswith(prefix) and os.path.isdir(os.path.join(base_dir, item)):
                                        target_parent = item
                                        break
                                if target_parent:
                                    break
                                    
                        if target_parent:
                            original_body = get_original_body_color(product_code) or body_val
                            cleaned_b = clean_folder_name(original_body)
                            cleaned_d = clean_folder_name(design_val)
                            subfolder_name = f"{cleaned_b}_{cleaned_d}"
                            
                            # Find thumbnail image (if not set yet)
                            if not thumbnail_url:
                                valid_exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
                                for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                                    folder_path = os.path.join(base_dir, target_parent, subfolder_name)
                                    if os.path.exists(folder_path) and os.path.isdir(folder_path):
                                        found_images = sorted(
                                            [img for img in os.listdir(folder_path) if os.path.splitext(img)[1].lower() in valid_exts],
                                            key=natural_sort_key
                                        )
                                        if found_images:
                                            thumbnail_url = f"/images/{target_parent}/{subfolder_name}/{found_images[0]}"
                                            break
                            
                            # Scan print files (Strict check under original body color folder)
                            scanned_prints = set()
                            for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                                print_folder = os.path.join(base_dir, target_parent, subfolder_name, "print")
                                if os.path.exists(print_folder) and os.path.isdir(print_folder):
                                    for f in os.listdir(print_folder):
                                        if os.path.isfile(os.path.join(print_folder, f)):
                                            scanned_prints.add(f)
                            
                            for filename in sorted(list(scanned_prints)):
                                download_url = f"/api/download-print?product_code={product_code}&body={urllib.parse.quote(original_body)}&design={urllib.parse.quote(design_val)}&filename={urllib.parse.quote(filename)}&token={token}"
                                print_files.append({
                                    "product_code": product_code,
                                    "filename": filename,
                                    "download_url": download_url
                                })
                                
                    orders.append({
                        "id": order_id,
                        "maker_order_number": r[1],
                        "source_order_number": r[2] or "",
                        "total_quantity": r[3],
                        "status": r[4],
                        "created_at": created_at_iso,
                        "thumbnail_url": thumbnail_url,
                        "print_files": print_files
                    })
                conn.close()
                self.send_json({"orders": orders})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        elif path == '/api/maker/order-details' or path == '/api/admin/maker-order-details':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            token = query_params.get("token", [""])[0].strip()
            order_id = query_params.get("id", [""])[0]
            
            ADMIN_PASSWORD = "rollin-admin"
            MAKER_PASSWORD = "rollin-maker"
            if token != ADMIN_PASSWORD and token != MAKER_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            if not order_id:
                self.send_json({"error": "Missing order ID"}, 400)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                cursor.execute("""
                SELECT id, maker_order_number, source_order_number, total_quantity, status, created_at
                FROM maker_orders WHERE id = ?
                """, (order_id,))
                order_row = cursor.fetchone()
                if not order_row:
                    conn.close()
                    self.send_json({"error": "Order not found"}, 404)
                    return
                    
                created_at_iso = order_row[5].replace(" ", "T") + "Z" if order_row[5] else ""
                order_summary = {
                    "id": order_row[0],
                    "maker_order_number": order_row[1],
                    "source_order_number": order_row[2] or "",
                    "total_quantity": order_row[3],
                    "status": order_row[4],
                    "created_at": created_at_iso
                }
                
                cursor.execute("""
                SELECT product_code, product_name, body, design,
                       qty_s_std, qty_m_std, qty_l_std, qty_xl_std, qty_xxl_std,
                       qty_s_bd, qty_m_bd, qty_l_bd, qty_xl_bd, qty_xxl_bd
                FROM maker_order_items
                WHERE maker_order_id = ?
                """, (order_id,))
                item_rows = cursor.fetchall()
                conn.close()
                
                items = []
                for ir in item_rows:
                    product_code = ir[0]
                    product_name = ir[1]
                    body_val = ir[2]
                    design_val = ir[3]
                    
                    # Fill missing product name from CSV if empty
                    if not product_name:
                        product_name = ""
                        if os.path.exists(CSV_FILENAME):
                            try:
                                with open(CSV_FILENAME, mode='r', encoding='cp932') as f:
                                    reader = csv.reader(f)
                                    csv_rows = list(reader)
                                    if len(csv_rows) > 6:
                                        header = csv_rows[5]
                                        p_idx = header.index("品番")
                                        n_idx = header.index("商品名")
                                        for r in csv_rows[6:]:
                                            if len(r) > max(p_idx, n_idx) and r[p_idx].strip() == product_code:
                                                product_name = r[n_idx].strip()
                                                break
                            except Exception as e:
                                print(f"CSV read warning: {e}")
                        if not product_name:
                            product_name = "（商品名不明）"
                    
                    images = []
                    print_files = []
                    
                    prefix = f"{product_code}_"
                    target_parent = None
                    for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                        if os.path.exists(base_dir):
                            for item in os.listdir(base_dir):
                                if item.startswith(prefix) and os.path.isdir(os.path.join(base_dir, item)):
                                    target_parent = item
                                    break
                            if target_parent:
                                break
                                
                    if target_parent:
                        original_body = get_original_body_color(product_code) or body_val
                        cleaned_b = clean_folder_name(original_body)
                        cleaned_d = clean_folder_name(design_val)
                        subfolder_name = f"{cleaned_b}_{cleaned_d}"
                        
                        # Scan images from both directories
                        scanned_images = set()
                        valid_exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
                        for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                            folder_path = os.path.join(base_dir, target_parent, subfolder_name)
                            if os.path.exists(folder_path) and os.path.isdir(folder_path):
                                for item in sorted(os.listdir(folder_path), key=natural_sort_key):
                                    item_ext = os.path.splitext(item)[1].lower()
                                    if item_ext in valid_exts:
                                        scanned_images.add(f"/images/{target_parent}/{subfolder_name}/{item}")
                        images = sorted(list(scanned_images), key=natural_sort_key)
                                    
                        # Scan print files from both directories
                        scanned_prints = set()
                        for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                            print_folder = os.path.join(base_dir, target_parent, subfolder_name, "print")
                            if os.path.exists(print_folder) and os.path.isdir(print_folder):
                                for f in os.listdir(print_folder):
                                    if os.path.isfile(os.path.join(print_folder, f)):
                                        scanned_prints.add(f)
                        print_files = sorted(list(scanned_prints))
                                
                    items.append({
                        "product_code": product_code,
                        "product_name": product_name,
                        "body": body_val,
                        "design": design_val,
                        "qtys": list(ir[4:14]),
                        "print_files": print_files,
                        "images": images
                    })
                    
                self.send_json({
                    "order": order_summary,
                    "items": items
                })
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        elif path == '/api/admin/maker-orders':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            token = query_params.get("token", [""])[0].strip()
            
            ADMIN_PASSWORD = "rollin-admin"
            if token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                cursor.execute("""
                SELECT id, maker_order_number, source_order_number, total_quantity, status, created_at
                FROM maker_orders
                ORDER BY created_at DESC
                """)
                rows = cursor.fetchall()
                
                orders = []
                for r in rows:
                    order_id = r[0]
                    created_at_iso = r[5].replace(" ", "T") + "Z" if r[5] else ""
                    
                    # Fetch items for this order to find images and print files
                    cursor.execute("""
                    SELECT product_code, product_name, body, design
                    FROM maker_order_items
                    WHERE maker_order_id = ?
                    """, (order_id,))
                    item_rows = cursor.fetchall()
                    
                    thumbnail_url = None
                    print_files = []
                    
                    for ir in item_rows:
                        product_code = ir[0]
                        body_val = ir[2]
                        design_val = ir[3]
                        
                        prefix = f"{product_code}_"
                        target_parent = None
                        for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                            if os.path.exists(base_dir):
                                for item in os.listdir(base_dir):
                                    if item.startswith(prefix) and os.path.isdir(os.path.join(base_dir, item)):
                                        target_parent = item
                                        break
                                if target_parent:
                                    break
                                    
                        if target_parent:
                            original_body = get_original_body_color(product_code) or body_val
                            cleaned_b = clean_folder_name(original_body)
                            cleaned_d = clean_folder_name(design_val)
                            subfolder_name = f"{cleaned_b}_{cleaned_d}"
                            
                            # Find thumbnail image (if not set yet)
                            if not thumbnail_url:
                                valid_exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
                                for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                                    folder_path = os.path.join(base_dir, target_parent, subfolder_name)
                                    if os.path.exists(folder_path) and os.path.isdir(folder_path):
                                        found_images = sorted(
                                            [img for img in os.listdir(folder_path) if os.path.splitext(img)[1].lower() in valid_exts],
                                            key=natural_sort_key
                                        )
                                        if found_images:
                                            thumbnail_url = f"/images/{target_parent}/{subfolder_name}/{found_images[0]}"
                                            break
                            
                            # Scan print files
                            scanned_prints = set()
                            for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                                print_folder = os.path.join(base_dir, target_parent, subfolder_name, "print")
                                if os.path.exists(print_folder) and os.path.isdir(print_folder):
                                    for f in os.listdir(print_folder):
                                        if os.path.isfile(os.path.join(print_folder, f)):
                                            scanned_prints.add(f)
                            
                            for filename in sorted(list(scanned_prints)):
                                download_url = f"/api/download-print?product_code={product_code}&body={urllib.parse.quote(original_body)}&design={urllib.parse.quote(design_val)}&filename={urllib.parse.quote(filename)}&token=rollin-maker"
                                print_files.append({
                                    "product_code": product_code,
                                    "filename": filename,
                                    "download_url": download_url
                                })
                                
                    orders.append({
                        "id": order_id,
                        "maker_order_number": r[1],
                        "source_order_number": r[2] or "",
                        "total_quantity": r[3],
                        "status": r[4],
                        "created_at": created_at_iso,
                        "thumbnail_url": thumbnail_url,
                        "print_files": print_files
                    })
                conn.close()
                self.send_json({"orders": orders})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        elif path == '/api/admin/maker-bodies':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            token = query_params.get("token", [""])[0].strip()
            
            ADMIN_PASSWORD = "rollin-admin"
            if token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                cursor.execute("SELECT DISTINCT body FROM maker_order_items WHERE body IS NOT NULL AND body != ''")
                rows = cursor.fetchall()
                conn.close()
                
                db_bodies = [r[0] for r in rows]
                self.send_json({"bodies": db_bodies})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        elif path == '/api/admin/system-status':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            token = query_params.get("token", [""])[0].strip()
            
            ADMIN_PASSWORD = "rollin-admin"
            if token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            db_dir = os.path.dirname(DATABASE_FILE) or "."
            is_db_dir_writable = os.access(db_dir, os.W_OK)
            is_persistent = "/data" in DATABASE_FILE
            
            self.send_json({
                "database_path": DATABASE_FILE,
                "is_persistent": is_persistent and not IS_DATABASE_FALLBACK,
                "is_writable": is_db_dir_writable,
                "base_folder_path": BASE_FOLDER_NAME,
                "is_fallback": IS_DATABASE_FALLBACK,
                "error_message": DATABASE_ERROR_MESSAGE
            })
            return

        elif path == '/api/download-print':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            product_code = query_params.get("product_code", [""])[0].strip()
            body = query_params.get("body", [""])[0].strip()
            design = query_params.get("design", [""])[0].strip()
            filename_param = query_params.get("filename", [""])[0].strip()
            token = query_params.get("token", [""])[0].strip()
            
            ADMIN_PASSWORD = "rollin-admin"
            MAKER_PASSWORD = "rollin-maker"
            if token != ADMIN_PASSWORD and token != MAKER_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            if not product_code:
                self.send_json({"error": "Missing product code"}, 400)
                return
                
            target_parent = None
            prefix = f"{product_code}_"
            target_parent = None
            used_base_dir = None
            
            for base_dir in [BASE_FOLDER_NAME, "注文リスト管理"]:
                if os.path.exists(base_dir):
                    for item in os.listdir(base_dir):
                        if item.startswith(prefix) and os.path.isdir(os.path.join(base_dir, item)):
                            target_parent = item
                            used_base_dir = base_dir
                            break
                    if target_parent:
                        break
            
            if not target_parent:
                self.send_json({"error": "Product folder not found"}, 404)
                return
                
            original_body = get_original_body_color(product_code) or body
            cleaned_b = clean_folder_name(original_body)
            cleaned_d = clean_folder_name(design)
            subfolder_name = f"{cleaned_b}_{cleaned_d}"
            print_folder = os.path.join(used_base_dir, target_parent, subfolder_name, "print")
            
            file_path = None
            file_name = None
            
            # Try to find the file in the exact matching directory
            if os.path.exists(print_folder) and os.path.isdir(print_folder):
                files = os.listdir(print_folder)
                if filename_param and filename_param in files:
                    file_name = filename_param
                    file_path = os.path.join(print_folder, filename_param)
                elif not filename_param and files:
                    file_name = files[0]
                    file_path = os.path.join(print_folder, file_name)
                                    
            if not file_path or not os.path.exists(file_path):
                self.send_json({"error": "Print file not found"}, 404)
                return
                
            self.send_response(200)
            quoted_filename = urllib.parse.quote(file_name)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', f"attachment; filename*=UTF-8''{quoted_filename}")
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
            return
            
        else:
            self.send_error(404, "Not Found")

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        # CSVデータ更新 API
        if path == '/api/orders':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                updated_rows = req_data.get("rows", [])
            except Exception as e:
                self.send_json({"error": f"Invalid JSON payload: {str(e)}"}, 400)
                return
                
            # CSVの書き換え
            if not os.path.exists(CSV_FILENAME):
                self.send_json({"error": "CSV file not found"}, 404)
                return
                
            try:
                # 一旦元のCSVをすべて読み込む
                with open(CSV_FILENAME, mode='r', encoding='cp932') as f:
                    reader = csv.reader(f)
                    all_rows = list(reader)
            except Exception as e:
                self.send_json({"error": f"Failed to read CSV: {str(e)}"}, 500)
                return
                
            # 送られてきたデータで行を更新
            # 各 updated_row は { original_index: N, values: [...] } の形式
            for u_row in updated_rows:
                idx = u_row.get("original_index")
                vals = u_row.get("values")
                if idx is not None and vals is not None and 6 <= idx < len(all_rows):
                    # 列数を元のヘッダー数に合わせる
                    header_len = len(all_rows[5])
                    if len(vals) > header_len:
                        vals = vals[:header_len]
                    elif len(vals) < header_len:
                        vals = vals + [""] * (header_len - len(vals))
                    all_rows[idx] = vals
                    
            # CSVに書き戻す
            try:
                with open(CSV_FILENAME, mode='w', encoding='cp932', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerows(all_rows)
            except Exception as e:
                self.send_json({"error": f"Failed to save CSV: {str(e)}"}, 500)
                return
                
            self.send_json({"status": "success", "message": "CSV updated successfully"})
            return
            
        elif path == '/api/submit-order':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                client_info = req_data.get("clientInfo", {})
                items = req_data.get("items", [])
            except Exception as e:
                self.send_json({"error": f"Invalid JSON payload: {str(e)}"}, 400)
                return
                
            company_name = client_info.get("company", "").strip()
            contact_name = client_info.get("name", "").strip()
            phone_number = client_info.get("phone", "").strip()
            
            if not company_name or not contact_name or not phone_number:
                self.send_json({"error": "ご発注者様情報（貴社名、ご担当者名、お電話番号）を入力してください。"}, 400)
                return
                
            if not items:
                self.send_json({"error": "ご発注数量が入力されている商品がありません。"}, 400)
                return
                
            try:
                import datetime
                
                today_str = datetime.datetime.now().strftime("%Y%m%d")
                
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                
                # Sequential order numbering
                cursor.execute("SELECT count(*) FROM orders WHERE order_number LIKE ?", (f"R3-{today_str}-%",))
                count = cursor.fetchone()[0]
                seq = count + 1
                order_number = f"R3-{today_str}-{seq:03d}"
                
                total_qty = 0
                total_amount = 0.0
                
                db_items = []
                for item in items:
                    vals = item.get("values", [])
                    code = vals[2]
                    name = vals[3]
                    body = vals[4]
                    design = vals[5]
                    price = float(vals[7]) if vals[7] else 0.0
                    subtotal = float(vals[18]) if vals[18] else 0.0
                    
                    qtys = []
                    for idx in range(8, 18):
                        qty = int(vals[idx]) if idx < len(vals) and vals[idx] else 0
                        qtys.append(qty)
                        total_qty += qty
                        
                    total_amount += subtotal
                    
                    db_items.append((
                        code, name, body, design, price,
                        qtys[0], qtys[1], qtys[2], qtys[3], qtys[4],
                        qtys[5], qtys[6], qtys[7], qtys[8], qtys[9],
                        subtotal
                    ))
                    
                # Save Order Summary
                cursor.execute("""
                INSERT INTO orders (order_number, company_name, contact_name, phone_number, total_quantity, total_amount)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (order_number, company_name, contact_name, phone_number, total_qty, total_amount))
                
                order_id = cursor.lastrowid
                
                # Save Items
                for db_item in db_items:
                    cursor.execute("""
                    INSERT INTO order_items (
                        order_id, product_code, product_name, body, design, wholesale_price,
                        qty_s_std, qty_m_std, qty_l_std, qty_xl_std, qty_xxl_std,
                        qty_s_bd, qty_m_bd, qty_l_bd, qty_xl_bd, qty_xxl_bd,
                        subtotal_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (order_id,) + db_item)
                    
                conn.commit()
                conn.close()
                
                self.send_json({"status": "success", "order_number": order_number})
                
            except Exception as e:
                if 'conn' in locals():
                    conn.rollback()
                    conn.close()
                self.send_json({"error": f"Database error: {str(e)}"}, 500)
                return
                
        elif path == '/api/maker/login':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                password = req_data.get("password", "").strip()
            except Exception as e:
                self.send_json({"error": f"Invalid JSON payload: {str(e)}"}, 400)
                return
                
            MAKER_PASSWORD = "rollin-maker"
            if password == MAKER_PASSWORD:
                self.send_json({"status": "success", "token": MAKER_PASSWORD})
            else:
                self.send_json({"error": "パスワードが正しくありません。"}, 401)

        elif path == '/api/admin/maker-orders/create':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                token = req_data.get("token", "")
                source_order_number = req_data.get("source_order_number", None)
                items = req_data.get("items", [])
            except Exception as e:
                self.send_json({"error": f"Invalid JSON payload: {str(e)}"}, 400)
                return
                
            ADMIN_PASSWORD = "rollin-admin"
            if token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            if not items:
                self.send_json({"error": "発注数量が入力されている商品がありません。"}, 400)
                return
                
            try:
                import datetime
                today_str = datetime.datetime.now().strftime("%Y%m%d")
                
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                
                # Generate Maker Order Number
                cursor.execute("SELECT count(*) FROM maker_orders WHERE maker_order_number LIKE ?", (f"MK-{today_str}-%",))
                count = cursor.fetchone()[0]
                seq = count + 1
                maker_order_number = f"MK-{today_str}-{seq:03d}"
                
                total_qty = 0
                db_items = []
                for item in items:
                    code = item.get("product_code")
                    name = item.get("product_name")
                    body = item.get("body")
                    design = item.get("design")
                    qtys = item.get("qtys", [0]*10)
                    
                    item_qty = sum(qtys)
                    total_qty += item_qty
                    
                    db_items.append((
                        code, name, body, design,
                        qtys[0], qtys[1], qtys[2], qtys[3], qtys[4],
                        qtys[5], qtys[6], qtys[7], qtys[8], qtys[9]
                    ))
                
                # Insert Maker Order
                cursor.execute("""
                INSERT INTO maker_orders (maker_order_number, source_order_number, total_quantity, status)
                VALUES (?, ?, ?, '発注済')
                """, (maker_order_number, source_order_number, total_qty))
                
                maker_order_id = cursor.lastrowid
                
                # Insert Items
                for db_item in db_items:
                    cursor.execute("""
                    INSERT INTO maker_order_items (
                        maker_order_id, product_code, product_name, body, design,
                        qty_s_std, qty_m_std, qty_l_std, qty_xl_std, qty_xxl_std,
                        qty_s_bd, qty_m_bd, qty_l_bd, qty_xl_bd, qty_xxl_bd
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (maker_order_id,) + db_item)
                    
                conn.commit()
                conn.close()
                
                self.send_json({"status": "success", "maker_order_number": maker_order_number})
                
            except Exception as e:
                if 'conn' in locals():
                    conn.rollback()
                    conn.close()
                self.send_json({"error": f"Database error: {str(e)}"}, 500)
                return
            return

        elif path == '/api/admin/maker-orders/update-status':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                token = req_data.get("token", "")
                order_id = req_data.get("id")
                status = req_data.get("status")
            except Exception as e:
                self.send_json({"error": f"Invalid JSON payload: {str(e)}"}, 400)
                return
                
            ADMIN_PASSWORD = "rollin-admin"
            if token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                cursor.execute("UPDATE maker_orders SET status = ? WHERE id = ?", (status, order_id))
                conn.commit()
                conn.close()
                self.send_json({"status": "success"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        elif path == '/api/admin/orders/delete':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                token = req_data.get("token", "")
                order_id = req_data.get("id")
            except Exception as e:
                self.send_json({"error": f"Invalid JSON payload: {str(e)}"}, 400)
                return
                
            ADMIN_PASSWORD = "rollin-admin"
            if token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM order_items WHERE order_id = ?", (order_id,))
                cursor.execute("DELETE FROM orders WHERE id = ?", (order_id,))
                conn.commit()
                conn.close()
                self.send_json({"status": "success"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        elif path == '/api/admin/maker-orders/delete':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                token = req_data.get("token", "")
                order_id = req_data.get("id")
            except Exception as e:
                self.send_json({"error": f"Invalid JSON payload: {str(e)}"}, 400)
                return
                
            ADMIN_PASSWORD = "rollin-admin"
            if token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM maker_order_items WHERE maker_order_id = ?", (order_id,))
                cursor.execute("DELETE FROM maker_orders WHERE id = ?", (order_id,))
                conn.commit()
                conn.close()
                self.send_json({"status": "success"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        elif path == '/api/admin/upload-print':
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                self.send_json({"error": "Content-Type must be multipart/form-data"}, 400)
                return
                
            # Read all body bytes
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            boundary_parts = content_type.split("boundary=")
            if len(boundary_parts) < 2:
                self.send_json({"error": "Boundary not found"}, 400)
                return
            boundary = boundary_parts[1].encode('utf-8')
            
            def parse_multipart(data, bound):
                parts = data.split(b'--' + bound)
                res = {}
                for part in parts:
                    if not part or part == b'\r\n' or part == b'--\r\n' or part == b'--':
                        continue
                    if b'\r\n\r\n' not in part:
                        continue
                    headers_part, body_part = part.split(b'\r\n\r\n', 1)
                    if body_part.endswith(b'\r\n'):
                        body_part = body_part[:-2]
                    
                    headers_str = headers_part.decode('utf-8', errors='ignore')
                    disposition_match = re.search(r'Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?', headers_str, re.IGNORECASE)
                    if disposition_match:
                        name = disposition_match.group(1)
                        filename = disposition_match.group(2)
                        if filename:
                            res[name] = {
                                "filename": filename,
                                "content": body_part
                            }
                        else:
                            res[name] = body_part.decode('utf-8', errors='ignore').strip()
                return res

            try:
                form_fields = parse_multipart(post_data, boundary)
            except Exception as e:
                self.send_json({"error": f"Failed to parse multipart: {str(e)}"}, 400)
                return
                
            token = form_fields.get("token", "")
            ADMIN_PASSWORD = "rollin-admin"
            if token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            product_code = form_fields.get("product_code", "")
            product_name = form_fields.get("product_name", "")
            body = form_fields.get("body", "")
            design = form_fields.get("design", "")
            file_data = form_fields.get("file")
            
            if not product_code or not product_name or not body or not design or not file_data:
                self.send_json({"error": "Missing required fields or file"}, 400)
                return
                
            try:
                cleaned_n = clean_folder_name(product_name)
                cleaned_b = clean_folder_name(body)
                cleaned_d = clean_folder_name(design)
                
                folder_name = f"{product_code}_{cleaned_n}"
                subfolder_name = f"{cleaned_b}_{cleaned_d}"
                print_folder = os.path.join(BASE_FOLDER_NAME, folder_name, subfolder_name, "print")
                
                os.makedirs(print_folder, exist_ok=True)
                
                # We no longer delete existing files, so multiple files can be uploaded!
                filename = file_data["filename"]
                filename = os.path.basename(filename)
                target_file_path = os.path.join(print_folder, filename)
                
                with open(target_file_path, "wb") as f:
                    f.write(file_data["content"])
                    
                self.send_json({"status": "success", "filename": filename})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        elif path == '/api/admin/delete-print':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                token = req_data.get("token", "")
                product_code = req_data.get("product_code", "")
                body = req_data.get("body", "")
                design = req_data.get("design", "")
                filename = req_data.get("filename", "")
            except Exception as e:
                self.send_json({"error": f"Invalid JSON payload: {str(e)}"}, 400)
                return
                
            ADMIN_PASSWORD = "rollin-admin"
            if token != ADMIN_PASSWORD:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            try:
                prefix = f"{product_code}_"
                target_parent = None
                if os.path.exists(BASE_FOLDER_NAME):
                    for item in os.listdir(BASE_FOLDER_NAME):
                        if item.startswith(prefix) and os.path.isdir(os.path.join(BASE_FOLDER_NAME, item)):
                            target_parent = item
                            break
                            
                if not target_parent:
                    self.send_json({"error": "Product folder not found"}, 404)
                    return
                    
                cleaned_b = clean_folder_name(body)
                cleaned_d = clean_folder_name(design)
                subfolder_name = f"{cleaned_b}_{cleaned_d}"
                print_folder = os.path.join(BASE_FOLDER_NAME, target_parent, subfolder_name, "print")
                
                if os.path.exists(print_folder) and os.path.isdir(print_folder):
                    if filename:
                        file_path = os.path.join(print_folder, filename)
                        if os.path.exists(file_path) and os.path.isfile(file_path):
                            os.remove(file_path)
                    else:
                        for item in os.listdir(print_folder):
                            item_path = os.path.join(print_folder, item)
                            if os.path.isfile(item_path):
                                os.remove(item_path)
                            
                self.send_json({"status": "success"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return
            
        else:
            self.send_error(404, "Not Found")

def run(server_class=HTTPServer, handler_class=OrderManagerHandler, port=PORT):
    init_db()  # Initialize database
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting server on http://localhost:{port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run()
