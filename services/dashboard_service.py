import pandas as pd
from pathlib import Path
import numpy as np
from collections import Counter
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from underthesea import word_tokenize
import os
import json
import torch
from transformers import AutoTokenizer, AutoModel
BASE_DIR = Path(__file__).resolve().parent.parent
ANALYSIS_FILE = Path("data/processed/review_analysis_full_5_aspects.csv")
PRODUCTS_FILE = Path("data/processed/products.csv")
_GLOBAL_TOKENIZER = None
_GLOBAL_MODEL = None
_DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
def load_data():
    if not ANALYSIS_FILE.exists():
        raise FileNotFoundError(f"Không tìm thấy {ANALYSIS_FILE}")
    if not PRODUCTS_FILE.exists():
        raise FileNotFoundError(f"Không tìm thấy {PRODUCTS_FILE}")

    df = pd.read_csv(ANALYSIS_FILE)
    products_df = pd.read_csv(PRODUCTS_FILE)

    required_cols = [
        "pred_quality",
        "pred_price",
        "pred_delivery",
        "pred_packaging",
        "pred_service",
        "id"
    ]

    missing = [c for c in required_cols if c not in df.columns]

    if missing:
        raise ValueError(f"Thiếu cột trong dataset: {missing}")

    return df, products_df

def calculate_overall(df):
    """Tính toán tỷ lệ cảm xúc, đảm bảo đủ 5 keys của hệ thống ABSA"""
    aspects = ['quality', 'price', 'delivery', 'packaging', 'service']
    overall_stats = {}
    standard_labels = ['positive', 'negative', 'neutral', 'none']
    
    for aspect in aspects:
        col_name = f'pred_{aspect}'
        
        if col_name not in df.columns:
            overall_stats[aspect] = {label: {"count": 0, "percentage": 0} for label in standard_labels}
            continue

        counts = df[col_name].value_counts().to_dict()
        total = len(df[col_name].dropna())
        
        if total == 0:
            overall_stats[aspect] = {label: {"count": 0, "percentage": 0} for label in standard_labels}
            continue
            
        aspect_data = {}
        for label in standard_labels:
            count = counts.get(label, 0)
            aspect_data[label] = {
                "count": count,
                "percentage": round((count / total) * 100, 2) if total > 0 else 0
            }
        overall_stats[aspect] = aspect_data
        
    return overall_stats

def calculate_top_bad_products(df, products_df, min_reviews=1):
    """Tính top sản phẩm bị chê (Xử lý fallback tên thông minh)"""
    df_calc = df.copy() 
    product_map = dict(zip(products_df['id'].astype(str), products_df['name']))
    
    df_calc['negative_count'] = (
        (df_calc['pred_quality'] == 'negative').astype(int) + 
        (df_calc['pred_price'] == 'negative').astype(int) + 
        (df_calc['pred_delivery'] == 'negative').astype(int)
    )
    
    prod_stats = df_calc.groupby('id').agg(
        total_reviews=('id', 'count'),
        total_negatives=('negative_count', 'sum')
    ).reset_index()
    
    prod_stats = prod_stats[prod_stats['total_reviews'] >= min_reviews].copy()
    prod_stats['severity_score'] = (prod_stats['total_negatives'] / (prod_stats['total_reviews'] * 3))
    
    # KHÔNG DÙNG BỘ LỌC NỮA ĐỂ TRÁNH BỊ TRỐNG BẢNG
    top_bad = prod_stats[prod_stats['total_negatives'] > 0].sort_values(
        by=['severity_score', 'total_negatives'], ascending=[False, False]
    ).head(5)
    
    result = []
    for _, row in top_bad.iterrows():
        raw_id = int(row['id'])
        str_id = str(raw_id) 
        
        # Nếu không có tên trong product.csv, hiển thị Mã sản phẩm thay vì báo "không xác định"
        fallback_name = f"Sản phẩm (Mã ID: {str_id})"
        
        result.append({
            "id": raw_id,
            # "name": product_map.get(str_id, fallback_name), 
            "total_reviews": int(row['total_reviews']),
            "total_negative_mentions": int(row['total_negatives']),
            "severity_score": round(row['severity_score'], 2)
        })
        
    return result

def get_dashboard_data():
    """Hàm Wrapper gọi toàn bộ logic"""
    df, products_df = load_data()
    
    overall = calculate_overall(df)
    top_bad_products = calculate_top_bad_products(df, products_df)
    
    return {
        "overall": overall,
        "top_negative_products": top_bad_products
    }

STOP_WORDS = set([
    'và', 'là', 'của', 'có', 'không', 'nhưng', 'thì', 'mà', 'để', 'với', 'cho', 
    'này', 'rất', 'quá', 'hơi', 'được', 'bị', 'cái', 'nó', 'đã', 'đang', 'sẽ', 
    'trong', 'ngoài', 'khi', 'sau', 'từ', 'lên', 'xuống', 'về', 'hàng', 'sản_phẩm', 
    'mua', 'nhận', 'thấy', 'mình', 'shop', 'ơi', 'à', 'nhé', 'ạ', 'nha', 'chưa', 'thật',
    'như', 'nên', 'hết', 'lại', 'luôn', 'sao', 'dùng', 'sử_dụng', 'sử dụng',
    'lần', 'còn', 'nữa', 'vẫn', 'vậy', 'nếu', 'tuy', 'dù', 'nào', 'gì',
    'ai', 'đây', 'đó', 'kia', 'vừa', 'mới', 'cứ', 'ra', 'vào',
    'thêm', 'lắm', 'khá', 'cũng', 'chỉ', 'phải', 'nói', 'thôi', 'rồi', 'với', 'luôn', 'mà',
    'nhanh', 'đúng', 'ổn', 'tốt', 'đẹp', 'ok', 'cẩn thận'
])
CACHE_FILE = 'data/processed/phobert_clusters_cache.json'

def get_cache_validity_key(analysis_file_path):
    """Tạo key dựa trên thời gian sửa đổi file gốc, để phát hiện cache bị stale"""
    mtime = os.path.getmtime(analysis_file_path)
    return str(mtime)

def get_product_cache_filename(product_id):
    """Tạo tên file cache riêng biệt cho từng sản phẩm"""
    return f'data/processed/phobert_clusters_prod_{product_id}.json'

def cluster_topics_by_product(df, products_df, product_id, max_reviews=300, analysis_file_path='data/processed/review_analysis_full.csv'):
    """
    Phân cụm review với cơ chế chống OOM: Giới hạn max_reviews, động n_clusters, 
    và trích xuất Sample Review từ Centroid.
    """
    try:
        # ĐỒNG BỘ KIỂU DỮ LIỆU ĐẦU VÀO: Xóa đuôi .0 nếu Frontend gửi lầm
        target_id_str = str(product_id).strip()
        if target_id_str.endswith('.0'):
            target_id_str = target_id_str[:-2]
        
        # TÌM THÔNG TIN SẢN PHẨM (Xóa đuôi .0 do Pandas ép kiểu)
        products_df['id_str'] = products_df['id'].dropna().astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
        product_info = products_df[products_df['id_str'] == target_id_str]
        
        if product_info.empty:
            return {"status": "error", "message": "Không tìm thấy sản phẩm."}
        
        product_name = str(product_info.iloc[0]['name'])
        
        # LỌC REVIEW CỦA ĐÚNG SẢN PHẨM ĐÓ
        df['id_str'] = df['id'].dropna().astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
        prod_df = df[df['id_str'] == target_id_str]
        total_reviews = len(prod_df)

        if total_reviews == 0:
            return {"status": "error", "message": f"Không có review nào cho sản phẩm '{product_name}'."}

        # 1. Quét review có vấn đề
        pred_cols = [col for col in prod_df.columns if col.startswith('pred_')]
        negative_mask = pd.Series(False, index=prod_df.index)
        for col in pred_cols:
            negative_mask = negative_mask | (prod_df[col] == 'negative')
            
        neg_df = prod_df[negative_mask]
        
        analysis_mode = "negative_reviews"
        # 2. Fallback: Nếu review tiêu cực < 10, dùng toàn bộ review để tránh K-Means crash
        if len(neg_df) < 10:
            working_df = prod_df
            analysis_mode = "all_reviews"
            print(f"⚠️ SP {product_id} có quá ít review tiêu cực. Fallback dùng toàn bộ data.")
        else:
            working_df = neg_df

        if len(working_df) < 10:
            return {"status": "error", "message": "Sản phẩm có dưới 10 review hợp lệ, không đủ dữ liệu để AI phân cụm."}

        # 3. GIỚI HẠN SỐ LƯỢNG ĐỂ CHỐNG TRÀN RAM (Lấy ngẫu nhiên max_reviews)
        if len(working_df) > max_reviews:
            working_df = working_df.sample(n=max_reviews, random_state=42)

        texts = working_df['review_text'].dropna().astype(str).tolist()
        
        # 4. Tự động điều chỉnh số cụm (2 đến 5 cụm) dựa trên số lượng review
        actual_clusters = min(5, max(2, len(texts) // 10))

        # 5. Caching thông minh (Bao gồm mode và số reviews)
        current_key = f"{product_id}_{actual_clusters}_{analysis_mode}_{len(texts)}"
        cache_file = f'data/processed/phobert_clusters_prod_{product_id}.json'
        
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached = json.load(f)
                if cached.get('_cache_key') == current_key:
                    print(f"⚡ Load Cache AI cho sản phẩm {product_id}...")
                    return cached['api_response']
            except Exception:
                pass

        # 6. Chạy AI Pipeline
        embeddings = get_phobert_embeddings(texts)
        kmeans = KMeans(n_clusters=actual_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(embeddings)
        centroids = kmeans.cluster_centers_

        clusters_data = []
        all_processed = [preprocess_text(t) for t in texts]
        global_vectorizer = get_global_tfidf_vectorizer(all_processed)
        
        for cluster_id in range(actual_clusters):
            # Lấy index của các review thuộc cụm hiện tại
            cluster_idx = np.where(labels == cluster_id)[0]
            cluster_texts = [texts[i] for i in cluster_idx]
            cluster_embeddings = embeddings[cluster_idx]
            
            top_keywords, cluster_name = extract_cluster_keywords(cluster_texts, global_vectorizer)
            
            # 7. TRÍCH XUẤT REVIEW ĐẠI DIỆN TỪ CENTROID
            centroid = centroids[cluster_id]
            # Tính khoảng cách Euclidean từ các điểm trong cụm tới tâm
            distances = np.linalg.norm(cluster_embeddings - centroid, axis=1)
            # Lấy 3 review gần tâm nhất
            closest_indices = distances.argsort()[:3]
            sample_reviews = [cluster_texts[idx] for idx in closest_indices]

            clusters_data.append({
                "id": cluster_id,
                "name": cluster_name,
                "keywords": top_keywords,
                "size": len(cluster_texts),
                "sample_reviews": sample_reviews
            })

        clusters_data = sorted(clusters_data, key=lambda x: x['size'], reverse=True)

        api_response = {
            "status": "success",
            "product_id": product_id,
            "product_name": product_name,
            "total_reviews": total_reviews,
            "analyzed_reviews": len(working_df),
            "analysis_mode": analysis_mode,
            "clusters": clusters_data
        }

        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump({'_cache_key': current_key, 'api_response': api_response}, f, ensure_ascii=False, indent=4)

        return api_response

    except Exception as e:
        print(f"❌ Lỗi Clustering: {e}")
        return {"status": "error", "message": str(e)}
    
def get_phobert_instance():
    """Chỉ load mô hình 1 lần duy nhất vào bộ nhớ"""
    global _GLOBAL_TOKENIZER, _GLOBAL_MODEL
    if _GLOBAL_MODEL is None:
        print(f"⏳ Đang tải mô hình PhoBERT Embedding vào ({_DEVICE}) - Chỉ tải 1 lần...")
        _GLOBAL_TOKENIZER = AutoTokenizer.from_pretrained("vinai/phobert-base-v2")
        _GLOBAL_MODEL = AutoModel.from_pretrained("vinai/phobert-base-v2").to(_DEVICE)
        _GLOBAL_MODEL.eval()
    return _GLOBAL_TOKENIZER, _GLOBAL_MODEL

def get_phobert_embeddings(texts, batch_size=16):
    """Tính toán Embedding tối ưu hóa RAM/VRAM với torch.inference_mode()"""
    tokenizer, model = get_phobert_instance()
    all_embeddings = []
    print(f"🔄 Bắt đầu xử lý {len(texts)} reviews (Batch size: {batch_size})...")
    
    # inference_mode() vô hiệu hóa tính toán gradient, giảm 50% RAM sử dụng
    with torch.inference_mode():
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            inputs = tokenizer(batch_texts, return_tensors="pt", padding=True, truncation=True, max_length=128).to(_DEVICE)
            
            outputs = model(**inputs)
            last_hidden = outputs.last_hidden_state
            mask = inputs['attention_mask'].unsqueeze(-1).expand(last_hidden.size()).float()
            summed = torch.sum(last_hidden * mask, dim=1)
            counted = torch.clamp(mask.sum(dim=1), min=1e-9)
            mean_pooled = (summed / counted).cpu().numpy()
            
            all_embeddings.extend(mean_pooled)
            
            # Xóa các tensor tạm thời ngay lập tức để giải phóng bộ nhớ
            del inputs, outputs, last_hidden, mask, summed, counted, mean_pooled
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
            if (i + batch_size) % 100 == 0 or (i + batch_size) >= len(texts):
                print(f"   Đã xử lý {min(i + batch_size, len(texts))}/{len(texts)}...")
                
    return np.array(all_embeddings)

def get_global_tfidf_vectorizer(all_processed_texts):
    """Fit 1 lần trên toàn bộ corpus, dùng chung IDF cho mọi cụm"""
    vectorizer = TfidfVectorizer(max_features=500, ngram_range=(1, 2), min_df=3)
    vectorizer.fit(all_processed_texts)
    return vectorizer


def preprocess_text(t):
    clean_text = re.sub(r'[^\w\s]', ' ', t.lower())
    words = word_tokenize(clean_text, format="text").split()
    valid_words = [w for w in words if w not in STOP_WORDS and len(w) > 2 and not w.isnumeric()]
    return " ".join(valid_words)

def extract_cluster_keywords(cluster_texts, global_vectorizer):
    """Dùng IDF toàn cục, chỉ tính điểm TF-IDF trên riêng text của cụm này"""
    processed_texts = [preprocess_text(t) for t in cluster_texts]

    try:
        # Transform bằng vectorizer ĐÃ FIT SẴN trên toàn corpus (không fit lại)
        tfidf_matrix = global_vectorizer.transform(processed_texts)
        scores = tfidf_matrix.sum(axis=0).A1
        terms = global_vectorizer.get_feature_names_out()

        sorted_indices = scores.argsort()[::-1]

        top_keywords = []
        seen_unigrams = set()
        for idx in sorted_indices:
            if scores[idx] == 0:
                continue
            w = terms[idx].replace('_', ' ')
            parts = w.split()
            if len(parts) == 2 and (parts[0] in seen_unigrams or parts[1] in seen_unigrams):
                continue
            top_keywords.append(w)
            seen_unigrams.update(parts)
            if len(top_keywords) == 5:
                break

        if not top_keywords:
            return ["Phàn nàn chung"], "Chủ Đề Khác"

        cluster_name = " & ".join(top_keywords[:3]).title()
        return top_keywords, cluster_name

    except Exception as e:
        print(f"⚠️ Lỗi TF-IDF khi đặt tên cụm: {e}")
        return ["Phàn nàn chung"], "Chủ Đề Khác"


def cluster_topics(df, n_clusters=4, analysis_file_path='data/processed/review_analysis_full.csv'):
    """Phân cụm bằng PhoBERT và trích xuất từ khóa đại diện bằng TF-IDF cục bộ"""

    # 1. Cơ chế Caching có kiểm tra tính hợp lệ (dựa trên mtime của file data gốc)
    current_key = get_cache_validity_key(analysis_file_path)

    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cached = json.load(f)
            if cached.get('_cache_key') == current_key:
                print("⚡ Phân cụm: Cache còn hợp lệ, đang load (real-time speed)...")
                return cached['clusters']
            else:
                print("🔄 Phát hiện data đã thay đổi, tính lại phân cụm...")
        except Exception as e:
            print("⚠️ Lỗi đọc Cache, hệ thống sẽ tính toán lại:", e)

    try:
        # Lấy review tiêu cực
        negative_df = df[
            (df['pred_quality'] == 'negative') |
            (df['pred_price'] == 'negative') |
            (df['pred_delivery'] == 'negative')
        ]
        if negative_df.empty:
            negative_df = df

        texts = negative_df['review_text'].dropna().astype(str).tolist()
        if len(texts) < n_clusters:
            return []

        # 2. Sinh PhoBERT Embeddings
        embeddings = get_phobert_embeddings(texts)

        # 3. Gom cụm bằng K-Means trên không gian Semantic
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=20)
        labels = kmeans.fit_predict(embeddings)
      
        # 4. Đặt tên cụm bằng TF-IDF cục bộ (đã lọc trùng bigram/unigram)
        clusters_data = []
        df_clustered = pd.DataFrame({'text': texts, 'label': labels})
        all_processed = [preprocess_text(t) for t in texts]
        global_vectorizer = get_global_tfidf_vectorizer(all_processed)
        for cluster_id in range(n_clusters):
            cluster_texts = df_clustered[df_clustered['label'] == cluster_id]['text'].tolist()
            cluster_size = len(cluster_texts)

            top_keywords, cluster_name = extract_cluster_keywords(cluster_texts, global_vectorizer)

            clusters_data.append({
                "id": cluster_id,
                "name": cluster_name,
                "keywords": top_keywords,
                "size": int(cluster_size)
            })

        clusters_data = sorted(clusters_data, key=lambda x: x['size'], reverse=True)
        print("\n[🔍 DEBUG] KIỂM TRA NỘI DUNG THEO ĐÚNG THỨ TỰ HIỂN THỊ DASHBOARD:")
        for rank, cluster_info in enumerate(clusters_data, start=1):
            original_label = cluster_info['id']  # label gốc trước khi sort
            print(f"\n--- CỤM VẤN ĐỀ {rank} (label gốc: {original_label}, keywords: {cluster_info['keywords']}) ---")
            samples = df_clustered[df_clustered['label'] == original_label].head(5)['text'].tolist()
            for s in samples:
                print(f"- {s[:100]}")
        # 5. Lưu kết quả ra Cache, kèm cache_key để lần sau biết còn hợp lệ hay không
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump({'_cache_key': current_key, 'clusters': clusters_data}, f, ensure_ascii=False, indent=4)
            print("✅ Đã lưu kết quả phân cụm vào Cache!")

        return clusters_data

    except Exception as e:
        print(f"❌ Lỗi Clustering PhoBERT: {e}")
        return []