const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: String,
    name: String,
    price: Number,
    quantity: Number,
    subtotal: Number,
    image: String,
});

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true,
        default: function () {
            // Simple synchronous order number generation
            return `PL${Date.now()}${Math.floor(Math.random() * 1000)}`;
        }
    },
    customer: {
        fullName: String,
        phone: String,
        email: String,
        city: String,
        postalCode: String,
        address: String
    },
    products: [productSchema],
    orderSummary: {
        productsTotal: Number,
        deliveryFee: { type: Number, default: 7 },
        totalPrice: Number,
        totalItems: Number
    },
    status: {
        type: String,
        default: 'pending'
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    paymentMethod: {
        type: String,
        default: 'cash_on_delivery'
    },
    deliveryInfo: {
        city: String,
        address: String,
        estimatedDelivery: Date
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    note: {
        type: String,
        default: ''
    } // Note field for dashboard users to add after confirmation calls
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);

