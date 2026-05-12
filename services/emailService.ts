import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
      console.warn('Email configuration missing. Emails will not be sent.');
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporter;
};

const baseTemplate = (content: string, title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f4f4f5; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #000000; color: #ffffff; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; letter-spacing: -0.02em; }
    .content { padding: 40px; }
    .footer { background: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #f4f4f5; }
    .button { display: inline-block; padding: 12px 24px; background: #000000; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
    .info-card { background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .info-item { margin-bottom: 10px; }
    .info-label { font-size: 11px; text-transform: uppercase; color: #71717a; font-weight: 600; letter-spacing: 0.05em; }
    .info-value { font-size: 16px; font-weight: 500; color: #18181b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} College Event Management Platform. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

export const sendRegistrationEmail = async (email: string, userName: string, event: any) => {
  const t = getTransporter();
  if (!t) return;

  const html = baseTemplate(`
    <p>Hi ${userName},</p>
    <p>Your registration for <strong>${event.title}</strong> has been confirmed! We're excited to have you join us.</p>
    <div class="info-card">
      <div class="info-item">
        <div class="info-label">Event</div>
        <div class="info-value">${event.title}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Date & Time</div>
        <div class="info-value">${new Date(event.date).toLocaleString()}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Venue</div>
        <div class="info-value">${event.venue}</div>
      </div>
    </div>
    <p>You can view your registration details and other upcoming events by logging into your dashboard.</p>
    <a href="${process.env.APP_URL}/my-registrations" class="button">View My Registrations</a>
  `, 'Registration Confirmed');

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || 'College Events <noreply@college.edu>',
      to: email,
      subject: `Registration Confirmed: ${event.title}`,
      html,
    });
  } catch (err) {
    console.error('Error sending registration email:', err);
  }
};

export const sendCancellationEmail = async (email: string, userName: string, eventTitle: string) => {
  const t = getTransporter();
  if (!t) return;

  const html = baseTemplate(`
    <p>Hi ${userName},</p>
    <p>We're writing to inform you that the event <strong>${eventTitle}</strong> has been cancelled.</p>
    <p>We apologize for any inconvenience this may cause. We hope to see you at our future events.</p>
    <a href="${process.env.APP_URL}/events" class="button">Explore Other Events</a>
  `, 'Event Cancelled');

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || 'College Events <noreply@college.edu>',
      to: email,
      subject: `Event Cancelled: ${eventTitle}`,
      html,
    });
  } catch (err) {
    console.error('Error sending cancellation email:', err);
  }
};

export const sendReminderEmail = async (email: string, userName: string, event: any) => {
  const t = getTransporter();
  if (!t) return;

  const html = baseTemplate(`
    <p>Hi ${userName},</p>
    <p>This is a friendly reminder that <strong>${event.title}</strong> is happening in 24 hours!</p>
    <div class="info-card">
      <div class="info-item">
        <div class="info-label">Event</div>
        <div class="info-value">${event.title}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Date & Time</div>
        <div class="info-value">${new Date(event.date).toLocaleString()}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Venue</div>
        <div class="info-value">${event.venue}</div>
      </div>
    </div>
    <p>We look forward to seeing you there!</p>
    <a href="${process.env.APP_URL}/events/${event._id}" class="button">Event Details</a>
  `, 'Event Reminder');

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || 'College Events <noreply@college.edu>',
      to: email,
      subject: `Reminder: ${event.title} is tomorrow!`,
      html,
    });
  } catch (err) {
    console.error('Error sending reminder email:', err);
  }
};
