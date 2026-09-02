from  pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")
db = client["ecommerce_db"] # Thay bằng tên DB thực tế
products_collection = db["products"]

products_collection.create_index(
    [("name", "text"), ("description", "text")],
    weights={"name": 10, "description": 2},
    default_language="none" 
)
print("Đã tạo Text Index thành công!")