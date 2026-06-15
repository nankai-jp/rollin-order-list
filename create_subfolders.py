import os
import csv

def clean_folder_name(name):
    # Windowsでフォルダ名に使用できない記号を全角に置換
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
    
    # フォルダ名の前後にあるスペースやドットはWindowsで不具合を起こす可能性があるためトリム
    name = name.strip().strip('.')
    return name

def main():
    csv_filename = "注文リスト.csv"
    base_folder_name = "注文リスト管理"
    
    # CSVファイルの存在確認
    if not os.path.exists(csv_filename):
        print(f"エラー: {csv_filename} が見つかりません。")
        return
        
    print(f"CSVファイル '{csv_filename}' を読み込んでいます...")
    
    try:
        with open(csv_filename, mode='r', encoding='cp932') as f:
            reader = csv.reader(f)
            rows = list(reader)
    except Exception as e:
        print(f"CSVファイルの読み込み中にエラーが発生しました: {e}")
        return

    # 6行目がヘッダー（インデックス 5）
    if len(rows) < 6:
        print("エラー: CSVファイルの行数が足りません。6行目にヘッダーがある必要があります。")
        return
        
    header = rows[5]
    
    try:
        p_idx = header.index("品番")
        n_idx = header.index("商品名")
        # ボディはインデックス4、デザインはインデックス5 (7行目のサブヘッダー基準)
        b_idx = 4
        d_idx = 5
    except ValueError:
        print(f"エラー: ヘッダー行に '品番' または '商品名' が見つかりません。")
        return
        
    print("サブフォルダを自動作成しています...")
    
    created_count = 0
    skipped_count = 0
    unique_subfolders = set()
    
    # 7行目以降（インデックス 6以降）のデータを処理
    for i, r in enumerate(rows[6:], start=7):
        if len(r) <= max(p_idx, n_idx, b_idx, d_idx):
            skipped_count += 1
            continue
            
        p_val = r[p_idx].strip()
        n_val = r[n_idx].strip()
        b_val = r[b_idx].strip()
        d_val = r[d_idx].strip()
        
        # 品番、商品名、ボディ、デザインのいずれかが空の場合はスキップ
        if not p_val or not n_val or not b_val or not d_val:
            skipped_count += 1
            continue
            
        # 禁止文字のクリーンアップ
        cleaned_n = clean_folder_name(n_val)
        cleaned_b = clean_folder_name(b_val)
        cleaned_d = clean_folder_name(d_val)
        
        # フォルダパスの構成
        # 注文リスト管理 / 品番_商品名 / ボディ_デザイン
        parent_folder = f"{p_val}_{cleaned_n}"
        sub_folder = f"{cleaned_b}_{cleaned_d}"
        
        full_path = os.path.join(base_folder_name, parent_folder, sub_folder)
        unique_subfolders.add(full_path)
        
    # サブフォルダの作成
    for path in sorted(unique_subfolders):
        try:
            os.makedirs(path, exist_ok=True)
            print(f"作成完了: {path}")
            created_count += 1
        except Exception as e:
            print(f"エラー: フォルダ '{path}' の作成に失敗しました。理由: {e}")
            
    print(f"\n処理が完了しました。")
    print(f"作成/確認したサブフォルダ数: {created_count}")
    print(f"スキップした行数: {skipped_count}")

if __name__ == "__main__":
    main()
