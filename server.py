import os
import csv
import json
import urllib.parse
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(os.environ.get("PORT", 8000))
CSV_FILENAME = "注文リスト.csv"
BASE_FOLDER_NAME = "注文リスト管理"
DATABASE_FILE = os.environ.get("DATABASE_PATH", "database.db")

def init_db():
    conn = sqlite3.connect(DATABASE_FILE)
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
    conn.commit()
    conn.close()

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
            
        # 画像ファイルの配信 (/images/品番_商品名/画像名)
        elif path.startswith('/images/'):
            # デコードしてセキュリティチェック
            relative_path = urllib.parse.unquote(path[8:])  # '/images/' の後を取得
            # ディレクトリトラバーサル防止
            safe_path = os.path.normpath(os.path.join(BASE_FOLDER_NAME, relative_path))
            
            # 安全確認: BASE_FOLDER_NAME の配下に収まっているか
            abs_base = os.path.abspath(BASE_FOLDER_NAME)
            abs_target = os.path.abspath(safe_path)
            if not abs_target.startswith(abs_base):
                self.send_error(403, "Access Denied")
                return
                
            # Content-Typeの決定
            ext = os.path.splitext(safe_path)[1].lower()
            mime_types = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            }
            content_type = mime_types.get(ext, 'application/octet-stream')
            self.send_file(safe_path, content_type)
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
                    display_headers.append("ボディ")
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
                
                if is_editable:
                    cleaned_n = clean_folder_name(n_val)
                    cleaned_b = clean_folder_name(b_val)
                    cleaned_d = clean_folder_name(d_val)
                    
                    folder_name = f"{p_val}_{cleaned_n}"
                    subfolder_name = f"{cleaned_b}_{cleaned_d}"
                    folder_path = os.path.join(BASE_FOLDER_NAME, folder_name, subfolder_name)
                    
                    if os.path.exists(folder_path) and os.path.isdir(folder_path):
                        # 画像ファイルをスキャン
                        valid_exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
                        for item in sorted(os.listdir(folder_path), key=natural_sort_key):
                            item_ext = os.path.splitext(item)[1].lower()
                            if item_ext in valid_exts:
                                # ブラウザからアクセス可能な画像URLを構築
                                images.append(f"/images/{folder_name}/{subfolder_name}/{item}")
                
                data_rows.append({
                    "original_index": i,
                    "is_editable": is_editable,
                    "values": r[:19],  # フロントには19列分（0〜18）だけ送る
                    "images": images
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
