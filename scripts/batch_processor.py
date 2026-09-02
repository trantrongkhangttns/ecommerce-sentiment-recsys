import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from underthesea import word_tokenize
from tqdm import tqdm
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

RAW_DATA_PATH = BASE_DIR / "data" / "processed" / "shopee_gold_dataset_absa.csv"
OUTPUT_ANALYSIS_PATH = BASE_DIR / "data" / "processed" / "review_analysis.csv"

PHOBERT_PATHS = {
    "quality": BASE_DIR / "models" / "label_quality_model",
    "price": BASE_DIR / "models" / "label_price_model",
    "delivery": BASE_DIR / "models" / "label_delivery_model",
}

ID_TO_LABEL = {
    0: "negative",
    1: "neutral",
    2: "positive",
    3: "none"
}

print("⏳ Đang tải các mô hình PhoBERT...")

models = {}
tokenizers = {}

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(device)

for aspect, path in PHOBERT_PATHS.items():
    tokenizers[aspect] = AutoTokenizer.from_pretrained(str(path))
    models[aspect] = AutoModelForSequenceClassification.from_pretrained(str(path)).to(device)
    models[aspect].eval()
# 2. LOAD 3 MÔ HÌNH VÀO RAM
print("⏳ Đang tải các mô hình PhoBERT để chuẩn bị phân tích theo lô...")
models = {}
tokenizers = {}
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"💻 Đang sử dụng thiết bị: {device}")

for aspect, path in PHOBERT_PATHS.items():
    tokenizers[aspect] = AutoTokenizer.from_pretrained(path)
    models[aspect] = AutoModelForSequenceClassification.from_pretrained(path).to(device)
    models[aspect].eval()

# 3. ĐỌC TẬP DỮ LIỆU CẦN THỐNG KÊ
df = pd.read_csv(RAW_DATA_PATH)
print(f"📋 Tổng số lượng review cần phân tích: {len(df)}")

# Hàm dự đoán tối ưu hóa cho xử lý hàng loạt
def predict_batch(texts, aspect_name):
    tokenizer = tokenizers[aspect_name]
    model = models[aspect_name]
    
    # Tách từ tiếng Việt
    segmented_texts = [word_tokenize(str(text), format="text") for text in texts]
    
    # Tokenize
    inputs = tokenizer(segmented_texts, return_tensors="pt", padding=True, truncation=True, max_length=128).to(device)
    
    with torch.no_grad():
        outputs = model(**inputs)
        predictions = outputs.logits.argmax(-1).cpu().numpy()
        
    return [ID_TO_LABEL[p] for p in predictions]

# 4. CHẠY PHÂN TÍCH THEO BATCH (Ví dụ mỗi lần xử lý 32 dòng để tránh tràn RAM/VRAM)
BATCH_SIZE = 32
predicted_quality = []
predicted_price = []
predicted_delivery = []

print("🏋️‍♂️ Đang tiến hành quét PhoBERT trên toàn bộ dataset...")
for i in tqdm(range(0, len(df), BATCH_SIZE)):
    batch_texts = df['review_text'].iloc[i:i+BATCH_SIZE].tolist()
    
    predicted_quality.extend(predict_batch(batch_texts, 'quality'))
    predicted_price.extend(predict_batch(batch_texts, 'price'))
    predicted_delivery.extend(predict_batch(batch_texts, 'delivery'))

# Ghi kết quả dự đoán mới từ PhoBERT vào DataFrame
df['pred_quality'] = predicted_quality
df['pred_price'] = predicted_price
df['pred_delivery'] = predicted_delivery

# Lưu lại file kết quả nguồn
os.makedirs(os.path.dirname(OUTPUT_ANALYSIS_PATH), exist_ok=True)
df.to_csv(OUTPUT_ANALYSIS_PATH, index=False)
print(f"💾 Đã xuất file dữ liệu phân tích nguồn tại: {OUTPUT_ANALYSIS_PATH}")

# 5. XUẤT THỐNG KÊ SƠ BỘ (BƯỚC 2)
print("\n📊 --- KẾT QUẢ THỐNG KÊ SƠ BỘ TOÀN HỆ THỐNG ---")
for aspect in ['pred_quality', 'pred_price', 'pred_delivery']:
    print(f"\n[Khía cạnh: {aspect.replace('pred_', '').upper()}]")
    counts = df[aspect].value_counts()
    percentages = df[aspect].value_counts(normalize=True) * 100
    for idx in counts.index:
        print(f"  - {idx}: {counts[idx]} review ({percentages[idx]:.2f}%)")