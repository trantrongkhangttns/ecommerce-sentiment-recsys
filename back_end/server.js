const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); // Thêm thư viện mongoose
const recommendRoutes = require('./routes/recommendRoute'); // Đảm bảo tên file route đúng với của bạn

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Kết nối MongoDB (Dùng đúng chuỗi URI bạn đã dùng ở script import)
const MONGO_URI = 'mongodb://127.0.0.1:27017/ecommerce_db';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Đã kết nối MongoDB cho API Gateway'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Routes
app.use('/api/v1/recommendations', recommendRoutes);

// Khởi động server
const PORT = 5001;
app.listen(PORT, () => {
    console.log(`🚀 Node.js API Gateway đang chạy tại http://localhost:${PORT}`);
});