import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from underthesea import word_tokenize
from tqdm import tqdm
import os

print("⏳ Đang tải mô hình PhoBERT cho Packaging và Service...")

# =========================================================
# 1. LOAD MODELS
# =========================================================

models = {}

for aspect in ["packaging", "service"]:
    model_path = f"models/label_{aspect}_model"

    print(f"   Loading {aspect.upper()} model...")

    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)

    # Chế độ inference
    model.eval()

    models[aspect] = {
        "tokenizer": tokenizer,
        "model": model
    }

print("✅ Đã tải xong 2 model.")


# =========================================================
# 2. LABEL MAPPING
# =========================================================

ID_TO_LABEL = {
    0: "negative",
    1: "neutral",
    2: "positive",
    3: "none"
}


# =========================================================
# 3. PREDICT FUNCTION
# =========================================================

def predict(text, aspect):

    tokenizer = models[aspect]["tokenizer"]
    model = models[aspect]["model"]

    # Đảm bảo text không bị NaN
    text = str(text)

    # Tiền xử lý giống pipeline của hệ thống
    segmented_text = word_tokenize(text, format="text")

    inputs = tokenizer(
        segmented_text,
        return_tensors="pt",
        padding="max_length",
        truncation=True,
        max_length=128
    )

    with torch.no_grad():
        outputs = model(**inputs)
        predicted_class_id = outputs.logits.argmax(-1).item()

    return ID_TO_LABEL[predicted_class_id]


# =========================================================
# 4. READ ORIGINAL DATASET
# =========================================================

OLD_PATH = "data/processed/review_analysis_full.csv"

# Tạo file mới để tránh phá file cũ
NEW_PATH = "data/processed/review_analysis_full_5_aspects.csv"

print(f"\n📖 Đang đọc dữ liệu:")
print(f"   {OLD_PATH}")

df = pd.read_csv(OLD_PATH)

print(f"✅ Số dòng: {len(df):,}")
print("\n📋 Các cột hiện có:")
print(df.columns.tolist())


# =========================================================
# 5. CHECK REVIEW COLUMN
# =========================================================

if "review_text" not in df.columns:
    raise ValueError(
        "❌ Không tìm thấy cột 'review_text'. "
        "Hãy kiểm tra tên cột thực tế trong dataset."
    )


# =========================================================
# 6. PREDICT PACKAGING + SERVICE
# =========================================================

tqdm.pandas()

for aspect in ["packaging", "service"]:

    col_name = f"pred_{aspect}"

    if col_name in df.columns:

        print(
            f"\n✅ Cột '{col_name}' đã tồn tại → bỏ qua."
        )

    else:

        print(
            f"\n⚙️ Đang dự đoán khía cạnh: {aspect.upper()}..."
        )

        df[col_name] = df["review_text"].progress_apply(
            lambda x: predict(x, aspect)
        )

        print(
            f"✅ Hoàn thành {aspect.upper()}."
        )


# =========================================================
# 7. CHECK RESULT
# =========================================================

print("\n📊 Kiểm tra kết quả:")

for aspect in ["packaging", "service"]:

    col_name = f"pred_{aspect}"

    print(f"\n--- {col_name} ---")
    print(df[col_name].value_counts())


# =========================================================
# 8. SAVE NEW DATASET
# =========================================================

df.to_csv(
    NEW_PATH,
    index=False,
    encoding="utf-8-sig"
)

print("\n🎉 HOÀN TẤT!")
print(f"📁 Dataset mới:")
print(f"   {NEW_PATH}")

print("\n👉 File cũ vẫn được giữ nguyên.")
print("👉 Hãy kiểm tra kết quả trước khi đổi Backend sang file mới.")