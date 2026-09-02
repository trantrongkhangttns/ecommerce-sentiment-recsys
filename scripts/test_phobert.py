import json

print("\n--- RAW JSONL ---")
with open('data/raw/shopee_reviews_dataset.jsonl', 'r', encoding='utf-8') as f:
    for i in range(2):
        print(json.loads(f.readline()))