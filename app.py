from flask import Flask, request, jsonify
from google import genai
import json
from flask_cors import CORS
from pymongo import MongoClient
import pandas as pd
import numpy as np
import pickle
import os
import re
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from underthesea import word_tokenize
import scipy.sparse as sparse
from services.dashboard_service import (
    calculate_overall,
    load_data,
    cluster_topics,
    # calculate_timeline
)
app = Flask(__name__)
# Mở CORS để frontend (React) hoặc backend Node.js gọi không bị chặn cross-origin
CORS(app) 

# ==========================================
# 1. TẢI DỮ LIỆU VÀ MODEL LÊN RAM (Khởi tạo)
# ==========================================
print("⏳ Đang tải dữ liệu và các mô hình...")

MODEL_DIR = 'models'
DATA_DIR = 'data/processed'

# --- A. TẢI MÔ HÌNH GỢI Ý (ALS) ---
try:
    with open(os.path.join(MODEL_DIR, 'als_model.pkl'), 'rb') as f:
        als_model = pickle.load(f)
    with open(os.path.join(MODEL_DIR, 'user_id_map.pkl'), 'rb') as f:
        user_mapping = pickle.load(f)
    with open(os.path.join(MODEL_DIR, 'item_id_map.pkl'), 'rb') as f:
        item_mapping = pickle.load(f)

    user_id_to_index = {str(v).strip(): k for k, v in user_mapping.items()}
    sparse_user_item = sparse.load_npz(os.path.join(MODEL_DIR, 'sparse_matrix.npz'))
    products_df = pd.read_csv(os.path.join(DATA_DIR, 'products.csv'))
    products_df['id'] = products_df['id'].astype(int)
    print("✅ Đã tải thành công mô hình Gợi ý (ALS)")
except Exception as e:
    print(f"❌ Lỗi khi tải mô hình Gợi ý: {e}")

# --- B. TẢI MÔ HÌNH PHÂN TÍCH CẢM XÚC (PHOBERT) ---
PHOBERT_PATHS = {
    'quality': 'models/label_quality_model',
    'price': 'models/label_price_model',
    'delivery': 'models/label_delivery_model',
    'packaging': 'models/label_packaging_model', 
    'service': 'models/label_service_model'
}
ID_TO_LABEL = {0: 'negative', 1: 'neutral', 2: 'positive', 3: 'none'}

phobert_models = {}
phobert_tokenizers = {}

for aspect, path in PHOBERT_PATHS.items():
    try:
        phobert_tokenizers[aspect] = AutoTokenizer.from_pretrained(path)
        phobert_models[aspect] = AutoModelForSequenceClassification.from_pretrained(path)
        phobert_models[aspect].eval()
        print(f"✅ Đã tải thành công mô hình PhoBERT: {aspect}")
    except Exception as e:
        print(f"❌ Lỗi khi tải mô hình PhoBERT {aspect}: {e}")

print("🚀 Hệ thống API (Gợi ý & Cảm xúc) đã sẵn sàng!")

# ==========================================
# 2. HÀM HỖ TRỢ CHO PHOBERT
# ==========================================
def predict_aspect(text, aspect_name):
    tokenizer = phobert_tokenizers[aspect_name]
    model = phobert_models[aspect_name]
    
    segmented_text = word_tokenize(text, format="text")
    inputs = tokenizer(segmented_text, return_tensors="pt", padding="max_length", truncation=True, max_length=128)
    
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        predicted_class_id = logits.argmax(-1).item()
        
    return ID_TO_LABEL[predicted_class_id]

# ==========================================
# CẤU HÌNH GEMINI API CHO ASPECT EXTRACTION
# ==========================================
gemini_client = genai.Client(api_key="your_api_key_here")

def extract_aspects_with_gemini(review_text):
    prompt = f"""
    Bạn là một hệ thống Aspect-Based Sentiment Analysis cho thương mại điện tử.
    Nhiệm vụ: Trích xuất các tiêu chí (aspects) được nhắc đến trong đoạn review sau.
    
    CHỈ ĐƯỢC PHÉP dùng các aspect sau (nếu có):
    - "price" (giá cả)
    - "quality" (chất lượng sản phẩm)
    - "delivery" (vận chuyển, thời gian giao hàng)
    - "packaging" (đóng gói, bao bì, hộp)
    - "service" (thái độ tư vấn, chăm sóc khách hàng)
    
    Quy tắc:
    1. Tuyệt đối không tự bịa ra aspect ngoài danh sách trên.
    2. Nếu review không nhắc đến aspect nào, không trả về aspect đó.
    3. Trích xuất chính xác đoạn text ngắn gọn thể hiện aspect đó.
    
    Review: "{review_text}"
    
    Yêu cầu Output: Trả về CHỈ một chuỗi JSON hợp lệ, không markdown.
    Cấu trúc bắt buộc:
    {{
        "aspects": [
            {{
                "aspect": "tên_aspect",
                "text": "trích đoạn text"
            }}
        ]
    }}
    """
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        raw_text = response.text.strip()
        
        raw_text = re.sub(r'^```json\s*', '', raw_text)
        raw_text = re.sub(r'^```\s*', '', raw_text)
        raw_text = re.sub(r'\s*```$', '', raw_text)
        
        result = json.loads(raw_text)
        return result.get("aspects", [])
    except Exception as e:
        print(f"\n❌ Lỗi khi gọi/parse Gemini API: {repr(e)}\n")
        return []
    
# ==========================================
# 3. ENDPOINT API
# ==========================================
# --- API MỚI: ASPECT-BASED SENTIMENT ANALYSIS (ABSA) ---
@app.route('/api/analyze-absa', methods=['POST'])
def analyze_review_absa():
    try:
        data = request.get_json()
        if not data or 'review' not in data:
            return jsonify({"status": "error", "message": "Thiếu trường 'review'"}), 400
            
        review_text = data['review']
        extracted_aspects = extract_aspects_with_gemini(review_text)
        
        final_aspects = []
        # Danh sách các model đang có sẵn trên hệ thống (dựa vào key của PHOBERT_PATHS)
        available_models = list(PHOBERT_PATHS.keys()) 
        
        for item in extracted_aspects:
            aspect_name = item.get("aspect")
            aspect_text = item.get("text")
            
            # Chỉ xử lý các aspect hợp lệ
            if aspect_name in ['price', 'quality', 'delivery', 'packaging', 'service']:
                
                # NẾU CÓ MODEL PHO-BERT CHO ASPECT NÀY
                if aspect_name in available_models:
                    sentiment = predict_aspect(aspect_text, aspect_name)
                # NẾU CHƯA CÓ MODEL PHO-BERT (vd: packaging, service)
                else:
                    sentiment = "none" # Trả về none (Không xác định)
                
                final_aspects.append({
                    "aspect": aspect_name,
                    "text": aspect_text,
                    "sentiment": sentiment
                })
                
        result = {
            "status": "success",
            "data": {
                "review": review_text,
                "aspects": final_aspects
            }
        }
        
        print(f"\n[🤖 ABSA LOG] Kết quả: {final_aspects}\n")
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
# --- API 1: GỢI Ý SẢN PHẨM ---
@app.route('/api/recommend', methods=['GET'])
def get_recommendations_api():
    user_id = request.args.get('user_id')
    top_n = int(request.args.get('top_n', 10))
    weight_rating = float(request.args.get('weight', 0.2))
    
    if not user_id:
        return jsonify({"status": "error", "message": "Thiếu tham số user_id"}), 400
        
    if user_id not in user_id_to_index:
        popular_items = products_df.sort_values(by=['quantity_sold', 'rating_average'], ascending=False).head(top_n)
        return jsonify({
            "status": "success",
            "is_cold_start": True,
            "data": popular_items[['id', 'name', 'price', 'rating_average', 'quantity_sold']].to_dict('records')
        })
        
    try:
        user_idx = user_id_to_index[user_id]
        
        # --- 1. LẤY LỊCH SỬ TƯƠNG TÁC CỦA USER ---
        # Trích xuất dòng của user trong ma trận thưa, .indices sẽ lấy ra các ID sản phẩm có tương tác
        interacted_indices = sparse_user_item[user_idx].indices 
        interacted_item_ids = [item_mapping[i] for i in interacted_indices]
        
        # Map với bảng products_df để lấy thông tin     chi tiết (Lấy tối đa 5 sản phẩm gần nhất cho gọn)
        history_df = products_df[products_df['id'].isin(interacted_item_ids)].head(5)
        history_data = history_df[['id', 'name', 'price', 'rating_average', 'review_count']].to_dict('records')

        # --- 2. TÍNH TOÁN GỢI Ý ALS CÁ NHÂN HÓA ---
        item_indices, als_scores = als_model.recommend(user_idx, sparse_user_item[user_idx], N=50)
        recommended_item_ids = [item_mapping[i] for i in item_indices]
        
        recs_df = pd.DataFrame({'item_id': recommended_item_ids, 'raw_als_score': als_scores})
        recs_df['item_id'] = recs_df['item_id'].astype(int)
        
        recs_df = recs_df.merge(
            products_df[['id', 'name', 'price', 'rating_average', 'review_count', 'number_of_images']], 
            left_on='item_id', right_on='id', how='left'
        )
        
        min_als = recs_df['raw_als_score'].min()
        max_als = recs_df['raw_als_score'].max()
        recs_df['als_norm'] = (recs_df['raw_als_score'] - min_als) / (max_als - min_als) if max_als > min_als else 0.5
        recs_df['rating_norm'] = np.clip(recs_df['rating_average'].fillna(0) / 5.0, 0, 1)
        
        recs_df['final_score'] = ((1 - weight_rating) * recs_df['als_norm']) + (weight_rating * recs_df['rating_norm'])
        final_recs = recs_df.sort_values(by='final_score', ascending=False).head(top_n)
        
        result_data = final_recs[['id', 'name', 'price', 'rating_average', 'review_count', 'final_score', 'number_of_images']].to_dict('records')
        
        return jsonify({
            "status": "success",
            "is_cold_start": False,
            "history": history_data, # TRẢ VỀ THÊM MẢNG LỊCH SỬ NÀY
            "data": result_data
        })
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# --- API 2: PHÂN TÍCH CẢM XÚC ---
@app.route('/api/analyze', methods=['POST'])
def analyze_review():
    try:
        data = request.get_json()
        if not data or 'review' not in data:
            return jsonify({"status": "error", "message": "Thiếu trường 'review' trong body request"}), 400
            
        review_text = data['review']
        
        result = {
            "status": "success",
            "data": {
                "review": review_text,
                "aspects": {
                    "quality": predict_aspect(review_text, 'quality'),
                    "price": predict_aspect(review_text, 'price'),
                    "delivery": predict_aspect(review_text, 'delivery')
                }
            }
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
# --- API 3: DASHBOARD ---
# --- API 3: DASHBOARD TỔNG QUAN (ĐÃ CẬP NHẬT DATA THẬT) ---
@app.route('/api/dashboard', methods=['GET'])
def dashboard_api():
    try:
        # Load data thực tế
        df_analysis, products_df_analysis = load_data()

        # 1. TÍNH TOÁN KPI THỰC TẾ (System Overview)
        total_reviews = len(df_analysis)
        total_products = len(products_df_analysis)

        # 2. TÍNH TOÁN METRICS CHO RECOMMENDATION (ALS)
        total_users_als = len(user_mapping)
        total_items_als = len(item_mapping)
        total_interactions = sparse_user_item.nnz
        
        # Công thức tính độ thưa (Sparsity) = 1 - (tương tác / (users * items))
        sparsity = 0
        if total_users_als > 0 and total_items_als > 0:
            sparsity = 1.0 - (total_interactions / (total_users_als * total_items_als))

        # Đóng gói dữ liệu trả về Frontend
        dashboard_data = {
            "overview": {
                "total_reviews": total_reviews,
                "total_products": total_products,
            },
            "recommendation_metrics": {
                "total_users": total_users_als,
                "total_items": total_items_als,
                "total_interactions": total_interactions,
                "sparsity_percentage": round(sparsity * 100, 4) # Hiển thị % độ thưa
            },
            "overall": calculate_overall(df_analysis), # Data cho 5 Pie Charts
            "topic_clusters": cluster_topics(df_analysis) # Data cho System-wide Clustering
        }

        return jsonify({
            "status": "success",
            "data": dashboard_data
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# --- API MỚI: TRÍCH XUẤT BẰNG CHỨNG REVIEW (KHÔNG DÙNG AI) ---
@app.route('/api/evidence/<aspect_name>', methods=['GET'])
def get_aspect_evidence_api(aspect_name):
    try:
        df_analysis, _ = load_data()
        target_col = f'pred_{aspect_name}'

        if target_col not in df_analysis.columns:
            return jsonify({"status": "error", "message": f"Dữ liệu chưa có phân tích cho {aspect_name}"}), 404
            
        # 1. Lọc các review bị gán nhãn Negative
        negative_reviews = df_analysis[df_analysis[target_col] == 'negative']['review_text'].dropna()
        
        # 2. Loại bỏ các review quá ngắn (dưới 10 ký tự) để bằng chứng chất lượng hơn
        negative_reviews = negative_reviews[negative_reviews.str.len() > 10]

        total_count = len(negative_reviews)

        if negative_reviews.empty:
            return jsonify({
                "status": "success", 
                "data": {
                    "aspect": aspect_name,
                    "total_count": 0,
                    "sample_count": 0,
                    "sample_reviews": []
                }
            }), 200

        # 3. Lấy mẫu ngẫu nhiên 20 review làm bằng chứng (Evidence)
        sample_size = min(20, total_count)
        sampled_reviews = negative_reviews.sample(n=sample_size, random_state=None).tolist()

        return jsonify({
            "status": "success",
            "data": {
                "aspect": aspect_name,
                "total_count": total_count,
                "sample_count": sample_size,
                "sample_reviews": sampled_reviews
            }
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
mongo_client = MongoClient("mongodb://localhost:27017/")
db = mongo_client["ecommerce_db"]

@app.route('/api/products/search', methods=['GET'])
def search_products():
    raw_query = request.args.get('q', '')
    limit = request.args.get('limit', 12, type=int)
    clean_query = re.sub(r'\s+', ' ', raw_query).strip()

    if not clean_query:
        return jsonify({'status': 'success', 'data': []})

    pipeline = [
        {
            "$match": {
                "$text": { "$search": f'"{clean_query}"' } # Bọc trong dấu ngoặc kép để tìm theo cụm từ (Phrase Search)
            }
        },
        # Lấy thêm điểm số textScore mà thuật toán của MongoDB tính toán
        {
            "$addFields": {
                "score": { "$meta": "textScore" }
            }
        },
        # RANKING: Xắp xếp kết quả từ điểm cao xuống điểm thấp (Độ liên quan)
        {
            "$sort": {
                "score": { "$meta": "textScore" }
            }
        },
        # Giới hạn số lượng kết quả
        { "$limit": limit }
    ]

    # Thực thi truy vấn
    results_cursor = db.products.aggregate(pipeline)
    
    # Định dạng lại dữ liệu để trả về Frontend
    products = []
    for doc in results_cursor:
        doc['_id'] = str(doc['_id']) # Convert ObjectId sang string
        # Bạn có thể in ra terminal doc['score'] để xem điểm số thực tế
        products.append(doc)

    return jsonify({
        'status': 'success',
        'data': products
    })

# --- API 6: LƯU VẾT HÀNH VI NGƯỜI DÙNG (TRACKING LOG) ---
@app.route('/api/log', methods=['POST'])
def log_interaction():
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'Unknown')
        product_id = data.get('product_id')
        action = data.get('action', 'click')
        
        # IN RA TERMINAL ĐỂ SHOW CHO HỘI ĐỒNG THẤY HỆ THỐNG ĐANG TRACKING
        print(f"\n[📡 SYSTEM LOG] Khách hàng: {user_id} | Hành động: {action.upper()} | Mã SP: {product_id}")
        
        return jsonify({"status": "success", "message": "Đã lưu lịch sử hành vi"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500




if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)