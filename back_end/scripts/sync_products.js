// scripts/sync_products.js
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Product = require('../models/Product');

// URI kết nối MongoDB (Thay đổi nếu bạn dùng MongoDB Atlas)
const MONGO_URI = 'mongodb://127.0.0.1:27017/ecommerce_db'; 

// Đường dẫn tới file CSV
const CSV_FILE_PATH = path.join(__dirname, '../../data/processed/products.csv');

async function syncData() {
    try {
        // 1. Kết nối Database
        await mongoose.connect(MONGO_URI);
        console.log('✅ Đã kết nối MongoDB thành công!');

        // Lựa chọn: Xóa dữ liệu cũ trước khi import (để tránh lỗi duplicate ID)
        await Product.deleteMany({});
        console.log('🗑️ Đã dọn dẹp bộ sưu tập Products cũ.');

        const products = [];
        
        console.log('⏳ Đang đọc file CSV...');
        
        // 2. Đọc file CSV dạng luồng (Stream)
        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csv())
            .on('data', (row) => {
                // Ép kiểu dữ liệu cho khớp với Schema
                products.push({
                    id: parseInt(row.id),
                    name: row.name,
                    original_price: parseFloat(row.original_price) || 0,
                    price: parseFloat(row.price) || 0,
                    review_count: parseInt(row.review_count) || 0,
                    rating_average: parseFloat(row.rating_average) || 0,
                    sub_category: row.sub_category,
                    number_of_images: parseInt(row.number_of_images) || 0,
                    quantity_sold: parseInt(row.quantity_sold) || 0
                });
            })
            .on('end', async () => {
                console.log(`✅ Đã đọc xong ${products.length} sản phẩm. Đang chèn vào Database...`);
                
                // 3. Batch Insert (Chèn theo lô để không bị quá tải RAM)
                const BATCH_SIZE = 5000;
                for (let i = 0; i < products.length; i += BATCH_SIZE) {
                    const batch = products.slice(i, i + BATCH_SIZE);
                    await Product.insertMany(batch);
                    console.log(`-> Đã chèn xong lô từ ${i} đến ${i + batch.length}`);
                }

                console.log('🎉 ĐỒNG BỘ DỮ LIỆU HOÀN TẤT!');
                mongoose.connection.close();
                process.exit(0);
            })
            .on('error', (error) => {
                console.error('❌ Lỗi khi đọc file CSV:', error);
                process.exit(1);
            });

    } catch (error) {
        console.error('❌ Lỗi kết nối Database:', error);
        process.exit(1);
    }
}

// Chạy hàm
syncData();