import pandas as pd
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

RAW_DATA_PATH = BASE_DIR / "data" / "raw" / "shopee_reviews_dataset.jsonl"
ANALYSIS_PATH = BASE_DIR / "data" / "processed" / "review_analysis.csv"
OUTPUT_MERGED_PATH = BASE_DIR / "data" / "processed" / "review_analysis_full.csv"

print("Đang đọc dữ liệu...")
# Đọc file raw gốc
df_raw = pd.read_json(RAW_DATA_PATH, lines=True)

# Đọc file đã được gán nhãn
df_analysis = pd.read_csv(ANALYSIS_PATH)

print(f"Số dòng file gốc: {len(df_raw)}")
print(f"Số dòng file phân tích: {len(df_analysis)}")

# 2. Tạo khóa để join (Chuẩn hóa chuỗi để tăng tỷ lệ match)
df_raw['join_key'] = df_raw['review'].astype(str).str.strip().str.lower()
df_analysis['join_key'] = df_analysis['review_text'].astype(str).str.strip().str.lower()

# Loại bỏ các review trùng lặp y hệt nhau trong file thô để tránh join bị nhân bản dòng
df_raw_unique = df_raw.drop_duplicates(subset=['join_key'], keep='first')

# 3. Nối (Merge) dữ liệu theo kiểu Left Join
df_merged = pd.merge(df_analysis, df_raw_unique, on='join_key', how='left')

# 4. Dọn dẹp lại DataFrame
# Bỏ đi cột join_key tạm thời và cột 'review' của file gốc (vì đã có 'review_text')
columns_to_drop = ['join_key']
if 'review' in df_merged.columns:
    columns_to_drop.append('review')
df_merged = df_merged.drop(columns=columns_to_drop)

# 5. Lưu kết quả và kiểm tra
df_merged.to_csv(OUTPUT_MERGED_PATH, index=False)
print("\n🎉 ĐÃ NỐI DỮ LIỆU THÀNH CÔNG!")
print(f"Lưu file hoàn chỉnh tại: {OUTPUT_MERGED_PATH}")
print("\nCác cột hiện có trong tập dữ liệu mới:")
print(df_merged.columns.tolist())

# Kiểm tra xem có bao nhiêu dòng bị hụt metadata (do không match được)
missing_metadata = df_merged.isnull().sum()
print("\nKiểm tra dữ liệu bị thiếu sau khi nối:")
print(missing_metadata)