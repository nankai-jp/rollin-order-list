import os
import csv

def clean_folder_name(name):
    # Windowsでフォルダ名に使用できない記号を全角に置換
    # \ / : * ? " < > |
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
    print(f"ヘッダー行を検出しました: {header}")
    
    try:
        p_idx = header.index("品番")
        n_idx = header.index("商品名")
    except ValueError:
        print(f"エラー: ヘッダー行に '品番' または '商品名' が見つかりません。")
        return
        
    print(f"'品番'の列インデックス: {p_idx}, '商品名'の列インデックス: {n_idx}")
    
    # 「注文リスト管理」フォルダを作成
    os.makedirs(base_folder_name, exist_ok=True)
    print(f"ベースフォルダ '{base_folder_name}' を確認/作成しました。")
    
    created_count = 0
    skipped_count = 0
    unique_folders = set()
    
    # 7行目以降（インデックス 6以降）のデータを処理
    for i, r in enumerate(rows[6:], start=7):
        if len(r) <= max(p_idx, n_idx):
            skipped_count += 1
            continue
            
        p_val = r[p_idx].strip()
        n_val = r[n_idx].strip()
        
        # 品番または商品名が空の場合はスキップ
        if not p_val or not n_val:
            skipped_count += 1
            continue
            
        # 禁止文字のクリーンアップ
        cleaned_n_val = clean_folder_name(n_val)
        
        # フォルダ名の決定 "品番_商品名"
        folder_name = f"{p_val}_{cleaned_n_val}"
        
        # 重複排除用のセットに追加
        unique_folders.add(folder_name)
        
    print(f"処理対象のユニークなフォルダ数: {len(unique_folders)}")
    
    # フォルダの作成
    for folder_name in sorted(unique_folders):
        target_path = os.path.join(base_folder_name, folder_name)
        try:
            os.makedirs(target_path, exist_ok=True)
            print(f"作成完了: {target_path}")
            created_count += 1
        except Exception as e:
            print(f"エラー: フォルダ '{target_path}' の作成に失敗しました。理由: {e}")
            
    print(f"\n処理が完了しました。")
    print(f"作成/確認したフォルダ数: {created_count}")
    print(f"スキップした行数: {skipped_count}")

if __name__ == "__main__":
    main()
