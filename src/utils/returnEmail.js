import { sendMail } from './sendMail.js'

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN') : '')

const subjectForReturnStatus = (status) => {
  const s = String(status || '')
  if (s === 'requested') return 'Return initiated'
  if (s === 'pickup_scheduled') return 'Return pickup scheduled'
  if (s === 'picked_up') return 'Return picked up'
  if (s === 'received') return 'Return received'
  if (s === 'qc_failed') return 'Return QC failed'
  if (s === 'qc_passed') return 'Return QC passed'
  return `Return update: ${s}`
}

export const sendReturnStatusEmails = async ({ returnRequest, order, user }) => {
  const to = user?.email
  if (!to) return
  const orderIdShort = order?._id?.toString()?.slice(-8)?.toUpperCase()
  const status = returnRequest?.status
  const awb = returnRequest?.shiprocket?.awb
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>Return Update</h2>
      <p><strong>Order:</strong> #${orderIdShort}</p>
      <p><strong>Status:</strong> ${status}</p>
      ${awb ? `<p><strong>AWB:</strong> ${awb}</p>` : ''}
      <p><strong>Updated at:</strong> ${fmt(new Date())}</p>
      <p>Thanks,<br/>Sandhaikart</p>
    </div>
  `
  await sendMail({ to, subject: subjectForReturnStatus(status), html })
}

const subjectForRefundStatus = (status) => {
  const s = String(status || '')
  if (s === 'processed') return 'Refund processed'
  if (s === 'failed') return 'Refund failed'
  return 'Refund update'
}

export const sendRefundStatusEmails = async ({ returnRequest, order, user }) => {
  const to = user?.email
  if (!to) return
  const orderIdShort = order?._id?.toString()?.slice(-8)?.toUpperCase()
  const refund = returnRequest?.refund || {}
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>Refund Update</h2>
      <p><strong>Order:</strong> #${orderIdShort}</p>
      <p><strong>Refund status:</strong> ${refund.status}</p>
      <p><strong>Refund amount:</strong> ₹${((Number(refund.amount) || 0) / 100).toLocaleString('en-IN')}</p>
      ${refund.refundId ? `<p><strong>Refund ID:</strong> ${refund.refundId}</p>` : ''}
      <p>Thanks,<br/>Sandhaikart</p>
    </div>
  `
  await sendMail({ to, subject: subjectForRefundStatus(refund.status), html })
}

