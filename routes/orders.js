// backend/routes/orders.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const emailService = require('../utils/emailService');

// Get all orders with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 100,
            status,
            city,
            startDate,
            endDate,
            sortBy = 'orderDate',
            sortOrder = 'desc'
        } = req.query;

        const filter = {};

        if (status) filter.status = status;
        if (city) filter['customer.city'] = new RegExp(city, 'i');

        if (startDate || endDate) {
            filter.orderDate = {};
            if (startDate) filter.orderDate.$gte = new Date(startDate);
            if (endDate) filter.orderDate.$lte = new Date(endDate);
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const orders = await Order.find(filter)
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(filter);

        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
});

// Get single order by ID
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching order', error: error.message });
    }
});

// Create new order (not modified)
router.post('/', async (req, res) => {
    try {
        console.log('📦 Received order data:', JSON.stringify(req.body, null, 2));

        if (!req.body.customer) {
            return res.status(400).json({ message: 'Customer information is required' });
        }

        if (!req.body.products || !Array.isArray(req.body.products) || req.body.products.length === 0) {
            return res.status(400).json({ message: 'Products array is required and cannot be empty' });
        }

        const requiredCustomerFields = ['fullName', 'phone', 'email', 'city', 'address'];
        const missingFields = requiredCustomerFields.filter(field => !req.body.customer[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Missing required customer fields: ${missingFields.join(', ')}`
            });
        }

        for (let i = 0; i < req.body.products.length; i++) {
            const product = req.body.products[i];
            if (!product.name || !product.price || !product.quantity) {
                return res.status(400).json({
                    message: `Product ${i + 1} is missing required fields (name, price, or quantity)`
                });
            }
        }

        const orderData = {
            customer: {
                fullName: req.body.customer.fullName,
                phone: req.body.customer.phone,
                email: req.body.customer.email,
                city: req.body.customer.city,
                postalCode: req.body.customer.postalCode || '',
                address: req.body.customer.address,
            },
            products: req.body.products.map(item => ({
                productId: item.productId || `prod-${Date.now()}-${Math.random()}`,
                name: item.name,
                price: parseFloat(item.price),
                quantity: parseInt(item.quantity),
                subtotal: parseFloat(item.price) * parseInt(item.quantity),
                image: item.image || '',
            })),
            orderSummary: {
                productsTotal: parseFloat(req.body.orderSummary?.productsTotal) || req.body.products.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0),
                deliveryFee: parseFloat(req.body.orderSummary?.deliveryFee) || 7,
                totalPrice: parseFloat(req.body.orderSummary?.totalPrice) || (parseFloat(req.body.orderSummary?.productsTotal) || req.body.products.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0)) + 7,
                totalItems: parseInt(req.body.orderSummary?.totalItems) || req.body.products.reduce((sum, item) => sum + parseInt(item.quantity), 0),
            },
            paymentMethod: req.body.paymentMethod || "cash_on_delivery",
            deliveryInfo: {
                city: req.body.customer.city,
                address: req.body.customer.address,
                estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            }
        };

        console.log('✅ Processed order data:', JSON.stringify(orderData, null, 2));

        const order = new Order(orderData);
        await order.save();

        console.log(`✅ Order saved successfully: ${order.orderNumber}`);

        emailService.sendOrderConfirmation(order).catch(error => {
            console.error('❌ Email sending failed:', error);
        });

        res.status(201).json({
            message: 'Order created successfully',
            order: order
        });

    } catch (error) {
        console.error('❌ Error creating order:', error);

        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                message: 'Order number already exists'
            });
        }

        res.status(400).json({
            message: 'Error creating order',
            error: error.message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
});

// Update order
router.put('/:id', async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({
            message: 'Order updated successfully',
            order: order
        });
    } catch (error) {
        res.status(400).json({ message: 'Error updating order', error: error.message });
    }
});

// Delete order
router.delete('/:id', async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting order', error: error.message });
    }
});

// Get dashboard statistics
router.get('/stats/dashboard', async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: 'pending' });
        const confirmedOrders = await Order.countDocuments({ status: 'confirmed' });
        const preparingOrders = await Order.countDocuments({ status: 'preparing' });
        const shippedOrders = await Order.countDocuments({ status: 'shipped' });
        const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
        const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });

        const revenueResult = await Order.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$orderSummary.totalPrice' } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        const revenueByStatus = await Order.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: '$status', total: { $sum: '$orderSummary.totalPrice' } } }
        ]);

        const topProducts = await Order.aggregate([
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.name',
                    totalQuantity: { $sum: '$products.quantity' },
                    totalRevenue: { $sum: '$products.subtotal' },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 }
        ]);

        const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5);

        const avgOrderValue = totalOrders > 0 ? totalRevenue / (totalOrders - cancelledOrders) : 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayOrders = await Order.countDocuments({ orderDate: { $gte: today } });
        const todayRevenueResult = await Order.aggregate([
            { $match: { orderDate: { $gte: today }, status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$orderSummary.totalPrice' } } }
        ]);
        const todayRevenue = todayRevenueResult.length > 0 ? todayRevenueResult[0].total : 0;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const ordersOverTime = await Order.aggregate([
            { $match: { orderDate: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    count: { $sum: 1 },
                    revenue: { $sum: "$orderSummary.totalPrice" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const totalCustomers = await Order.distinct('customer.email').length;

        const customerOrders = await Order.aggregate([
            { $group: { _id: '$customer.email', orderCount: { $sum: 1 } } }
        ]);
        const repeatCustomers = customerOrders.filter(c => c.orderCount > 1).length;
        const customerRetentionRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

        const processingTimes = await Order.aggregate([
            { $match: { status: 'shipped' } },
            {
                $project: {
                    processingTime: { $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 3600000] } // ms to hours
                }
            },
            { $group: { _id: null, avgProcessingTime: { $avg: '$processingTime' } } }
        ]);
        const avgOrderProcessingTime = processingTimes.length > 0 ? processingTimes[0].avgProcessingTime : 0;

        const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

        const revenueByPaymentMethod = await Order.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: '$paymentMethod', total: { $sum: '$orderSummary.totalPrice' } } }
        ]);

        res.json({
            totalOrders,
            totalRevenue,
            pendingOrders,
            confirmedOrders,
            preparingOrders,
            shippedOrders,
            deliveredOrders,
            cancelledOrders,
            avgOrderValue,
            todayOrders,
            todayRevenue,
            totalCustomers,
            customerRetentionRate,
            avgOrderProcessingTime,
            cancellationRate,
            ordersByStatus: {
                pending: pendingOrders,
                confirmed: confirmedOrders,
                preparing: preparingOrders,
                shipped: shippedOrders,
                delivered: deliveredOrders,
                cancelled: cancelledOrders
            },
            revenueByStatus: revenueByStatus.reduce((acc, item) => {
                acc[item._id] = item.total;
                return acc;
            }, {}),
            revenueByPaymentMethod: revenueByPaymentMethod.reduce((acc, item) => {
                acc[item._id] = item.total;
                return acc;
            }, {}),
            topProducts,
            recentOrders,
            ordersOverTime
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
    }
});

// Resend order confirmation email
router.post('/:id/resend-email', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const emailSent = await emailService.sendOrderConfirmation(order);

        if (emailSent) {
            res.json({ message: 'Order confirmation email sent successfully' });
        } else {
            res.status(500).json({ message: 'Failed to send email' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error sending email', error: error.message });
    }
});

// Bulk update orders status
router.patch('/bulk/status', async (req, res) => {
    try {
        const { orderIds, status } = req.body;

        if (!orderIds || !status) {
            return res.status(400).json({ message: 'Order IDs and status are required' });
        }

        const result = await Order.updateMany(
            { _id: { $in: orderIds } },
            { $set: { status: status } }
        );

        res.json({
            message: `Updated ${result.modifiedCount} orders to status: ${status}`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating orders', error: error.message });
    }
});

module.exports = router;