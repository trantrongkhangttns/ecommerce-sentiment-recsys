import os
from google import genai
from dotenv import load_dotenv
from pathlib import Path
import pandas as pd

# Load biến môi trường
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Khởi tạo client mới theo chuẩn google-genai
client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    print("⚠️ Cảnh báo: Chưa tìm thấy GEMINI_API_KEY trong file .env")

BASE_DIR = Path(__file__).resolve().parent.parent
ANALYSIS_FILE = BASE_DIR / 'data' / 'processed' / 'review_analysis_full.csv'

def get_product_summary(product_id: int, max_reviews: int = 30):
    if not GEMINI_API_KEY or client is None:
        raise ValueError("Server chưa được cấu hình hoặc lỗi GEMINI_API_KEY")
        
    if not ANALYSIS_FILE.exists():
        raise FileNotFoundError("Không tìm thấy file review_analysis_full.csv")
        
    df = pd.read_csv(ANALYSIS_FILE)
    product_reviews = df[df['id'] == product_id]
    
    if product_reviews.empty:
        return "Sản phẩm này hiện chưa có đánh giá nào."
        
    sample_reviews = product_reviews['review_text'].dropna().sample(
        n=min(max_reviews, len(product_reviews)), 
        random_state=42
    ).tolist()
    
    reviews_text = "\n- ".join(sample_reviews)
    
    prompt = f"""
    Dưới đây là các đánh giá thực tế của khách hàng về một sản phẩm cụ thể:
    - {reviews_text}
    
    Hãy tóm tắt ngắn gọn trải nghiệm chung của khách hàng về sản phẩm này trong đúng 2 đến 3 câu.
    Chỉ tập trung vào 3 khía cạnh: Chất lượng, Giá cả, và Vận chuyển (nếu khách hàng có nhắc đến).
    Viết bằng giọng văn khách quan, chuyên nghiệp.
    """
    
    try:
        # Cú pháp gọi model mới của thư viện google-genai
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        raise Exception(f"Lỗi khi gọi Gemini API: {str(e)}")