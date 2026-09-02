// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    original_price: { type: Number },
    price: { type: Number },
    review_count: { type: Number, default: 0 },
    rating_average: { type: Number, default: 0 },
    sub_category: { type: String },
    number_of_images: { type: Number, default: 0 },
    quantity_sold: { type: Number, default: 0 }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Product', productSchema);