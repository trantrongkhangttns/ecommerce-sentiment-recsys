const axios = require("axios");
const Product = require("../models/Product");

const getRecommendations = async (req, res) => {
    try {
        const { userId, topN = 10 } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu user_id"
            });
        }

        // ===================================================
        // BƯỚC 1: Gọi AI Server lấy danh sách sản phẩm gợi ý
        // ===================================================
        const aiServerUrl = `http://127.0.0.1:5000/api/recommend?user_id=${userId}&top_n=${topN}`;

        const aiResponse = await axios.get(aiServerUrl);

        const aiData = aiResponse.data.data;

        // Danh sách ID sản phẩm
        const recommendedIds = aiData.map(item => item.id);

        // Lưu điểm AI
        const scoreMap = {};
        aiData.forEach(item => {
            scoreMap[item.id] = item.final_score;
        });

        // ===================================================
        // BƯỚC 2: Lấy thông tin sản phẩm từ MongoDB
        // ===================================================
        const productsFromDb = await Product.find({
            id: { $in: recommendedIds }
        }).select("-_id -__v -createdAt -updatedAt");

        // Chuyển sang Map để tra cứu nhanh
        const productMap = new Map();

        productsFromDb.forEach(product => {
            productMap.set(product.id, product.toObject());
        });

        // ===================================================
        // BƯỚC 3: Ghép dữ liệu AI + MongoDB
        // ===================================================
        const finalRecommendations = recommendedIds
            .map(id => {
                const product = productMap.get(id);

                if (!product) return null;

                return {
                    ...product,
                    ai_score: scoreMap[id] || 0
                };
            })
            .filter(Boolean);

        // ===================================================
        // BƯỚC 4: Trả dữ liệu cho Frontend
        // ===================================================
        return res.status(200).json({
            success: true,
            is_cold_start: aiResponse.data.is_cold_start,
            count: finalRecommendations.length,
            data: finalRecommendations
        });

    } catch (error) {
        console.error("Lỗi khi kết nối hệ thống Backend:", error.message);

        return res.status(500).json({
            success: false,
            message: "Hệ thống gợi ý đang bảo trì hoặc mất kết nối."
        });
    }
};

module.exports = {
    getRecommendations
};