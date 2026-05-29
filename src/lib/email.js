/**
 * Sends a booking confirmation email via the /api/send-email proxy.
 *
 * In development: Vite proxies /api/send-email → api.resend.com/emails (no CORS).
 * In production:  Point this to a Supabase Edge Function URL.
 */
export async function sendBookingConfirmationEmail({
  to,
  customerEmail, // legacy compat
  customerName,
  referenceCode,
  tableLabel,
  tableName,   // legacy compat
  date,
  bookingDate, // legacy compat
  startTime,
  bookingTime, // legacy compat
  duration,
  totalPaid,
  totalAmount, // legacy compat
  isMember = false,
  discount = 0
}) {
  // Normalise field names for backward compatibility
  const _to = to || customerEmail
  const _table = tableLabel || tableName
  const _date = date || bookingDate
  const _time = startTime || bookingTime
  const _total = totalPaid || totalAmount

  const emailPayload = {
    from: 'XVI Reservations <bookings@resend.dev>',
    to: _to,
    subject: `Booking Confirmed — Code: ${referenceCode}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;
        background:#0a1f0a;border-radius:12px;overflow:hidden;">

        <div style="background:#0d2b0d;padding:2rem;text-align:center;
          border-bottom:1px solid rgba(201,168,76,0.3);">
          <h1 style="color:#c9a84c;margin:0;font-size:1.5rem;letter-spacing:2px;">
            XVI SNOOKER CLUB
          </h1>
          <p style="color:#9fc99f;margin:0.5rem 0 0;font-size:0.85rem;">
            ELEVATED RESERVATIONS
          </p>
        </div>

        <div style="padding:2rem;">
          <h2 style="color:white;margin:0 0 1rem;">Booking Confirmed ✓</h2>
          <p style="color:#9fc99f;margin:0 0 1.5rem;">
            Hi ${customerName}, your table is reserved!
          </p>

          <!-- Big Reference Code -->
          <div style="background:rgba(201,168,76,0.08);
            border:2px dashed rgba(201,168,76,0.4);
            border-radius:10px;padding:1.5rem;
            text-align:center;margin-bottom:1.5rem;">
            <p style="color:#9fc99f;font-size:0.75rem;
              text-transform:uppercase;letter-spacing:3px;margin:0 0 0.5rem;">
              Your Booking Code
            </p>
            <p style="color:#c9a84c;font-size:2.5rem;
              font-weight:800;letter-spacing:8px;
              font-family:monospace;margin:0;">
              ${referenceCode}
            </p>
            <p style="color:#9fc99f;font-size:0.75rem;margin:0.5rem 0 0;">
              Show this code when you arrive at the club
            </p>
          </div>

          <!-- Booking Details -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
            <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
              <td style="color:#9fc99f;padding:0.6rem 0;font-size:0.85rem;">Table</td>
              <td style="color:white;text-align:right;font-weight:600;font-size:0.85rem;">${_table}</td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
              <td style="color:#9fc99f;padding:0.6rem 0;font-size:0.85rem;">Date</td>
              <td style="color:white;text-align:right;font-size:0.85rem;">${_date}</td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
              <td style="color:#9fc99f;padding:0.6rem 0;font-size:0.85rem;">Time</td>
              <td style="color:white;text-align:right;font-size:0.85rem;">${_time}</td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
              <td style="color:#9fc99f;padding:0.6rem 0;font-size:0.85rem;">Duration</td>
              <td style="color:white;text-align:right;font-size:0.85rem;">${duration}</td>
            </tr>
            ${isMember && discount > 0 ? `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
              <td style="color:#4caf50;padding:0.6rem 0;font-size:0.85rem;">👑 Member Discount</td>
              <td style="color:#4caf50;text-align:right;font-size:0.85rem;font-weight:600;">
                - ₦${Number(discount).toLocaleString()}
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="color:white;padding:0.8rem 0;font-weight:700;font-size:0.95rem;">Total Paid</td>
              <td style="color:#c9a84c;text-align:right;font-weight:700;font-size:1.1rem;">
                ₦${Number(_total).toLocaleString()}
              </td>
            </tr>
          </table>

          <div style="background:rgba(255,255,255,0.03);border-radius:8px;
            padding:1rem;margin-bottom:1.5rem;text-align:center;">
            <p style="color:#9fc99f;font-size:0.8rem;margin:0;line-height:1.6;">
              📍 Ekiti Office: Onala Area, Opposite JOTAD Specialist Hospital, Balemo Street, Ado Ekiti 360102, Ekiti State, Nigeria<br/>
              📍 Lagos Office: 17, Solo Ogun Street, Aguda, Lagos State, Nigeria<br/>
              📞 +234 808 794 8773<br/>
              🕐 Open daily: 10:00 AM — 11:00 PM
            </p>
          </div>

          <p style="color:rgba(255,255,255,0.3);font-size:0.75rem;text-align:center;margin:0;">
            © 2026 XVI Snooker Club. All Rights Reserved.
          </p>
        </div>
      </div>
    `
  }

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload)
    })
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Email send failed: ${response.status} — ${error}`)
    }
    return response.json()
  } catch (err) {
    // Non-fatal: log but don't crash the booking flow
    console.warn('Email send error (non-fatal):', err.message)
  }
}
