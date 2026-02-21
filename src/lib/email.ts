import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "Attendance App <noreply@attendance.com>",
      to,
      subject,
      html: wrapInTemplate(subject, html),
    });
    return { success: true };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error };
  }
}

function wrapInTemplate(title: string, content: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
      <tr>
        <td style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:20px;">
            ${process.env.NEXT_PUBLIC_APP_NAME || "AttendEase"}
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          ${content}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
          This is an automated message from ${process.env.NEXT_PUBLIC_APP_NAME || "AttendEase"}.
          Please do not reply to this email.
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

// Pre-built email templates
export function regularizationRequestEmail(
  employeeName: string,
  date: string,
  type: string,
  reason: string
): string {
  return `
    <h2 style="color:#1e293b;margin:0 0 16px;">Attendance Regularization Request</h2>
    <p style="color:#475569;line-height:1.6;">
      <strong>${employeeName}</strong> has submitted an attendance regularization request.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:120px;">Date</td><td style="padding:8px 12px;">${date}</td></tr>
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;">Type</td><td style="padding:8px 12px;">${type}</td></tr>
      <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;">Reason</td><td style="padding:8px 12px;">${reason}</td></tr>
    </table>
    <p style="color:#475569;">Please review and take action in the app.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/approvals" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
      Review Request
    </a>
  `;
}

export function regularizationStatusEmail(
  status: "APPROVED" | "REJECTED",
  date: string,
  reviewNote?: string
): string {
  const color = status === "APPROVED" ? "#16a34a" : "#dc2626";
  return `
    <h2 style="color:#1e293b;margin:0 0 16px;">Regularization ${status === "APPROVED" ? "Approved" : "Rejected"}</h2>
    <p style="color:#475569;line-height:1.6;">
      Your attendance regularization request for <strong>${date}</strong> has been
      <span style="color:${color};font-weight:600;">${status.toLowerCase()}</span>.
    </p>
    ${reviewNote ? `<p style="color:#475569;"><strong>Note:</strong> ${reviewNote}</p>` : ""}
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/regularization" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
      View Details
    </a>
  `;
}
