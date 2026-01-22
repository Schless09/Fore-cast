import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">FORE!cast Golf</h1>
          <p className="text-lg font-semibold text-green-600 mb-1">Predict. Play. Win.</p>
          <p className="text-gray-600">Create your account to start playing</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
