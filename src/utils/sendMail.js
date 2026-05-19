import nodemailer from 'nodemailer'

const boolFromEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback
  const v = String(value).toLowerCase().trim()
  if (['1', 'true', 'yes', 'y'].includes(v)) return true
  if (['0', 'false', 'no', 'n'].includes(v)) return false
  return fallback
}

const getMailConfig = () => {
  const host = process.env.SMTP_HOST || ''
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = boolFromEnv(process.env.SMTP_SECURE, port === 465)
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const from = process.env.SMTP_FROM || process.env.ADMIN_EMAIL || user
  return { host, port, secure, user, pass, from }
}

export const sendMail = async ({ to, subject, html, text }) => {
  const cfg = getMailConfig()
  if (!cfg.host || !cfg.port || !cfg.user || !cfg.pass || !cfg.from) return

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  })

  await transporter.sendMail({
    from: cfg.from,
    to,
    subject,
    html,
    text,
  })
}

