import os
import pandas as pd
import time
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from tqdm import tqdm
from pathlib import Path

# 1. Cấu hình API Key (NHỚ THAY BẰNG KEY MỚI TẠO)
GEMINI_API_KEY = "your_api_key_here"
client = genai.Client(api_key=GEMINI_API_KEY)

# 2. Định nghĩa cấu trúc JSON MỞ RỘNG (5 ASPECT)
class SentimentLabels(BaseModel):
    quality: str = Field(description="positive, negative, neutral, none")
    price: str = Field(description="positive, negative, neutral, none")
    delivery: str = Field(description="positive, negative, neutral, none")
    packaging: str = Field(description="positive, negative, neutral, none")
    service: str = Field(description="positive, negative, neutral, none")

class BatchResponse(BaseModel):
    results: list[SentimentLabels]

# 3. Đọc file
BASE_DIR = Path(__file__).resolve().parents[2]
input_path = BASE_DIR / "data" / "processed" / "shopee_sampled_for_labeling.csv"
output_path = BASE_DIR / "data" / "processed" / "shopee_gold_dataset_absa_5_aspects.csv" # Đổi tên file để không đè file cũ

df = pd.read_csv(input_path)
df_target = df 

BATCH_SIZE = 10
print(f"⏳ Bắt đầu gán nhãn theo lô (Quy mô: {BATCH_SIZE} câu/lượt gọi)...")

# Khởi tạo file CSV với 5 cột label
pd.DataFrame(columns=[
    'review_text', 'label_quality', 'label_price', 'label_delivery', 'label_packaging', 'label_service'
]).to_csv(output_path, index=False, encoding='utf-8-sig')

# 4. Vòng lặp xử lý THEO LÔ
for i in tqdm(range(0, len(df_target), BATCH_SIZE)):
    batch_df = df_target.iloc[i : i + BATCH_SIZE]
    reviews_list = batch_df['review_text'].tolist()
    
    formatted_reviews = ""
    for idx, text in enumerate(reviews_list):
        clean_text = str(text).replace('"', "'").replace('\n', ' ').strip()
        formatted_reviews += f"Câu {idx}: {clean_text}\n"
    
    prompt = f"""
    Bạn là chuyên gia gán nhãn Aspect-Based Sentiment Analysis (ABSA) cho review thương mại điện tử.
    Hãy phân tích danh sách các câu review tiếng Việt dưới đây và gán sentiment (positive, negative, neutral, none) cho 5 khía cạnh CỦA TỪNG CÂU:

    1. quality (Chất lượng sản phẩm): 
    - Nhận xét về bản thân món hàng (tốt, dỏm, ok, hiệu quả, mẫu mã, màu sắc, đúng mô tả).
    
    2. price (Giá cả): 
    - Giá, đắt, rẻ, đáng tiền, khuyến mãi, săn sale.
    
    3. delivery (Giao hàng/Vận chuyển): 
    - Thời gian giao hàng, quá trình vận chuyển, shipper (nhanh, chậm, thân thiện).
    - LƯU Ý: Không nhầm với packaging (đóng gói) và service (thái độ shop).
    
    4. packaging (Đóng gói/Bao bì): 
    - Cách đóng gói, hộp, túi, bao bì, cách bảo vệ sản phẩm.
    - Ví dụ: "đóng gói cẩn thận", "hộp bị móp méo", "bọc hàng kỹ".
    
    5. service (Dịch vụ/Hỗ trợ của shop): 
    - Thái độ phục vụ của shop, tư vấn, chăm sóc khách hàng, phản hồi tin nhắn, hỗ trợ đổi trả.
    - Ví dụ: "shop nhiệt tình", "trả lời chậm", "tư vấn có tâm".

    VÍ DỤ MẪU (Hãy học theo cách phân tích này):
    - "Sản phẩm tốt, giao hàng hơi chậm nhưng shop đóng gói cẩn thận và tư vấn rất nhiệt tình." 
      -> quality: positive, price: none, delivery: negative, packaging: positive, service: positive
    - "Giá rẻ, mua dùng thử thấy bình thường, shop rep tin nhắn chậm."
      -> quality: neutral, price: positive, delivery: none, packaging: none, service: negative

    YÊU CẦU ĐẦU RA:
    - Chỉ dùng 1 trong 4 nhãn: positive, negative, neutral, none.
    - Chỉ gán "none" khi review hoàn toàn không đề cập tới khía cạnh đó.
    - Phải trả về mảng 'results' có số lượng phần tử BẰNG ĐÚNG số lượng câu review đầu vào ({len(reviews_list)} câu).

    DANH SÁCH REVIEW CẦN PHÂN TÍCH:
    {formatted_reviews}
    """
    
    success = False
    retries = 3
    batch_records = []
    
    while retries > 0 and not success:
        try:
            response = client.models.generate_content(
                model='gemini-3.1-flash-lite',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=BatchResponse,
                    temperature=0.0
                ),
            )
            
            batch_results = response.parsed.results
            
            for idx, record in enumerate(batch_results):
                if idx < len(reviews_list):
                    batch_records.append({
                        'review_text': reviews_list[idx],
                        'label_quality': record.quality,
                        'label_price': record.price,
                        'label_delivery': record.delivery,
                        'label_packaging': record.packaging,
                        'label_service': record.service
                    })
            success = True
            
        except Exception as e:
            retries -= 1
            error_msg = str(e)
            print(f"\n⚠️ Lỗi ở lô dòng {i}: {type(e).__name__}. Còn {retries} lần thử.")
            
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                print("⏳ Google báo gọi quá nhanh. Cho code ngủ 15 giây để hồi Quota...")
                time.sleep(15.0)
            else:
                time.sleep(5.0)
            
    if not success:
        print(f"\n❌ Lô dòng {i} thất bại. Điền nhãn mặc định 'none'.")
        for text in reviews_list:
            batch_records.append({
                'review_text': text,
                'label_quality': 'none',
                'label_price': 'none',
                'label_delivery': 'none',
                'label_packaging': 'none',
                'label_service': 'none'
            })
            
    pd.DataFrame(batch_records).to_csv(output_path, mode='a', header=False, index=False, encoding='utf-8-sig')
    time.sleep(6.0)

print(f"\n🎉 HOÀN THÀNH! Đã lưu file tại: {output_path}")