import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FEEDBACK_TO = 'arschuessler90@gmail.com';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

/**
 * POST /api/feedback
 * Feature request or bug report form. Sends email to arschuessler90@gmail.com
 * with subject 🔴 Feature Request or 🔴 Bug Report, body: email, first name, last name, submission.
 * Optional screenshot attachment.
 */
export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const type = (formData.get('type') as string) || 'Feature Request';
    const email = (formData.get('email') as string)?.trim();
    const firstName = (formData.get('firstName') as string)?.trim();
    const lastName = (formData.get('lastName') as string)?.trim();
    const message = (formData.get('message') as string)?.trim();
    const screenshot = formData.get('screenshot') as File | null;

    if (!email || !message) {
      return NextResponse.json(
        { error: 'Email and message are required' },
        { status: 400 }
      );
    }

    const username = [firstName, lastName].filter(Boolean).join(' ') || email;
    const subject = type === 'Bug Report'
      ? `🚨 Bug report from ${username}`
      : `🚨 Feature request from ${username}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #d97706;">${subject}</h2>
        <p><strong>Submitted by:</strong></p>
        <p>${firstName || '—'} ${lastName || '—'}<br />${email}</p>
        <hr style="border: 1px solid #eee;" />
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        ${screenshot?.size ? '<p><em>Screenshot attached.</em></p>' : ''}
      </div>
    `;

    const attachments: { filename: string; content: string }[] = [];
    if (screenshot && screenshot.size > 0) {
      if (screenshot.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { error: 'Screenshot must be under 5MB' },
          { status: 400 }
        );
      }
      if (!ALLOWED_IMAGE_TYPES.includes(screenshot.type)) {
        return NextResponse.json(
          { error: 'Screenshot must be PNG, JPEG, GIF, or WebP' },
          { status: 400 }
        );
      }
      const bytes = await screenshot.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const ext = screenshot.name.split('.').pop() || 'png';
      attachments.push({
        filename: `screenshot.${ext}`,
        content: base64,
      });
    }

    const { error } = await resend.emails.send({
      from: 'FORE!SIGHT <andy@foresightgolfleague.com>',
      to: FEEDBACK_TO,
      replyTo: email,
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (error) {
      console.error('[Feedback] Resend error:', error);
      return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Feedback] Error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
