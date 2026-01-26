import { redirect } from 'next/navigation';

// Redirect old login page to new auth page
export default function LoginPage() {
  redirect('/auth');
}
