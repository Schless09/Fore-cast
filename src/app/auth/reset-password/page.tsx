import { redirect } from 'next/navigation';

// Clerk handles password reset through its built-in UI
// Redirect to the main auth page
export default function ResetPasswordPage() {
  redirect('/auth');
}
