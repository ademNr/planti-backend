const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });
    }

    async sendOrderConfirmation(order) {
        try {
            const productsHTML = order.products.map(item => `
        <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
          <strong>${item.name}</strong> × ${item.quantity}<br/>
          Prix unitaire: ${item.price} TND<br/>
          Sous-total: ${item.subtotal} TND
        </div>
      `).join('');

            const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background-color: #ffffff; padding: 25px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
              .section { margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
              .section:last-child { border-bottom: none; }
              .label { font-weight: bold; color: #059669; min-width: 120px; display: inline-block; }
              .value { color: #374151; }
              .footer { text-align: center; margin-top: 25px; color: #6b7280; font-size: 12px; padding: 15px; background: #f9fafb; border-radius: 8px; }
              .product { background: #f8f9fa; padding: 12px; margin: 8px 0; border-radius: 8px; border-left: 4px solid #10b981; }
              .address { background: #fffbeb; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 10px 0; }
              .total-section { background: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 20px; }
              .highlight { background: #10b981; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; }
              h2 { color: #059669; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #f3f4f6; }
              .customer-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 10px 0; }
              .order-number { background: #1e40af; color: white; padding: 10px; border-radius: 5px; text-align: center; font-weight: bold; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">🌱 Nouvelle Commande Planti</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Commande reçue le ${new Date(order.orderDate).toLocaleDateString('fr-FR')}</p>
              </div>
              <div class="content">
                <div class="order-number">
                  Numéro de commande: ${order.orderNumber}
                </div>
                
                <div class="section">
                  <h2>📋 Informations Client</h2>
                  <div class="customer-info">
                    <p><span class="label">Nom complet:</span><span class="value"> ${order.customer.fullName}</span></p>
                    <p><span class="label">Téléphone:</span><span class="value"> ${order.customer.phone}</span></p>
                    <p><span class="label">Email:</span><span class="value"> ${order.customer.email}</span></p>
                    <p><span class="label">Ville:</span><span class="value"> ${order.customer.city}</span></p>
                    <p><span class="label">Code postal:</span><span class="value"> ${order.customer.postalCode || 'Non spécifié'}</span></p>
                    <div class="address">
                      <p style="margin: 0 0 8px 0;"><span class="label">📍 Adresse de livraison:</span></p>
                      <p style="margin: 0; font-weight: 500; color: #92400e;">${order.customer.address}</p>
                    </div>
                  </div>
                </div>
                
                <div class="section">
                  <h2>🛍️ Détails de la Commande</h2>
                  <div class="products">
                    ${productsHTML}
                  </div>
                  
                  <div class="total-section">
                    <p><span class="label">Nombre total d'articles:</span><span class="value"> ${order.orderSummary.totalItems}</span></p>
                    <p><span class="label">Prix total des produits:</span><span class="value"> ${order.orderSummary.productsTotal} TND</span></p>
                    <p><span class="label">Frais de livraison:</span><span class="value"> ${order.orderSummary.deliveryFee} TND</span></p>
                    <p style="font-size: 18px; font-weight: bold; margin-top: 10px;">
                      <span class="label">Prix total:</span>
                      <span class="value" style="color: #059669; font-size: 20px;">${order.orderSummary.totalPrice} TND</span>
                    </p>
                  </div>
                </div>

                <div class="section">
                  <h2>🚚 Informations de Livraison</h2>
                  <p><strong>Mode de livraison:</strong> Standard (2-3 jours ouvrables)</p>
                  <p><strong>Paiement:</strong> À la livraison</p>
                  <p><strong>Statut:</strong> <span class="highlight">${order.status}</span></p>
                  <p><strong>Date estimée de livraison:</strong> ${new Date(order.deliveryInfo.estimatedDelivery).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              <div class="footer">
                <p>📧 Cet email a été généré automatiquement par le système de commande Planti.</p>
                <p>🕒 Reçu le ${new Date(order.orderDate).toLocaleString('fr-FR')}</p>
              </div>
            </div>
          </body>
        </html>
      `;

            const mailOptions = {
                from: `Planti Orders <${process.env.EMAIL_USER}>`,
                to: "ademnr2@gmail.com",
                subject: `🆕 Commande ${order.orderNumber} - ${order.customer.city} - ${order.orderSummary.totalPrice}TND`,
                html: htmlContent,
            };

            await this.transporter.sendMail(mailOptions);

            // Update order to mark email as sent
            order.emailSent = true;
            order.emailSentAt = new Date();
            await order.save();

            console.log(`✅ Order confirmation email sent for order ${order.orderNumber}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send order confirmation email:', error);
            return false;
        }
    }
}


module.exports = new EmailService();
