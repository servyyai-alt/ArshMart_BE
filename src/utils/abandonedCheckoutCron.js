import AbandonedCheckout from '../models/AbandonedCheckout.js'
import AbandonedCheckoutList from '../models/AbandonedCheckoutList.js'
import Order from '../models/Order.js'

export const evaluateAbandonedCheckouts = async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    // Find all checkouts started > 1 hour ago that are still pending
    const checkouts = await AbandonedCheckout.find({
      status: 'pending',
      checkoutStartedAt: { $lt: oneHourAgo }
    })

    if (checkouts.length > 0) {
      console.log(`[Abandoned Checkout Job] Found ${checkouts.length} pending checkouts older than 1 hour to evaluate.`);
    }

    for (const checkout of checkouts) {
      if (!checkout.orderId) {
        // Case 2: Customer left before placing order (orderId === null)
        checkout.status = 'abandoned'
        await checkout.save()

        // Move to AbandonedCheckoutList
        await AbandonedCheckoutList.create({
          userId: checkout.userId,
          phone: checkout.phone,
          email: checkout.email,
          productsViewed: checkout.products,
          amount: checkout.cartTotal,
          abandonedAt: new Date(),
          promotionEligible: true
        })

        console.log(`[Abandoned Checkout Job] Checkout ${checkout._id} marked as abandoned (no order created).`);
      } else {
        // Check order status
        const order = await Order.findById(checkout.orderId)
        if (!order) {
          // If the order was somehow deleted
          checkout.status = 'abandoned'
          await checkout.save()

          await AbandonedCheckoutList.create({
            userId: checkout.userId,
            phone: checkout.phone,
            email: checkout.email,
            productsViewed: checkout.products,
            amount: checkout.cartTotal,
            abandonedAt: new Date(),
            promotionEligible: true
          })
          console.log(`[Abandoned Checkout Job] Checkout ${checkout._id} marked as abandoned (order not found in DB).`);
          continue
        }

        // Case 3 & 4: COD or Paid Razorpay Order
        if (order.paymentMethod === 'cod' || order.isPaid === true) {
          checkout.status = 'converted'
          await checkout.save()
          console.log(`[Abandoned Checkout Job] Checkout ${checkout._id} marked as converted (order paid or COD).`);
        } else {
          // Case 5: Unpaid Razorpay Order (failed/cancelled)
          checkout.status = 'abandoned'
          await checkout.save()

          // Move to AbandonedCheckoutList
          await AbandonedCheckoutList.create({
            userId: checkout.userId,
            phone: checkout.phone,
            email: checkout.email,
            productsViewed: checkout.products,
            amount: checkout.cartTotal,
            abandonedAt: new Date(),
            promotionEligible: true
          })
          console.log(`[Abandoned Checkout Job] Checkout ${checkout._id} marked as abandoned (unpaid Razorpay order).`);
        }
      }
    }
  } catch (err) {
    console.error('[Abandoned Checkout Job] Error during execution:', err.message)
  }
}

export const startAbandonedCheckoutCron = () => {
  console.log('[Abandoned Checkout Job] Initialized. Running every 5 minutes.')
  // Run every 5 minutes (300,000 ms)
  setInterval(evaluateAbandonedCheckouts, 5 * 60 * 1000)
}
