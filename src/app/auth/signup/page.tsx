import { redirect } from 'next/navigation';

// Redirect old signup page to new auth page
export default function SignupPage() {
  redirect('/auth');
}
