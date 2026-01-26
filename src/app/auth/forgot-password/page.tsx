'use client';

import { SignIn } from '@clerk/nextjs';

// Clerk handles forgot password through its built-in UI
// This page just redirects to the sign-in with forgot password flow
export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-casino-bg via-casino-elevated to-casino-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-casino-gold mb-2 font-orbitron tracking-wider">FORE!SIGHT</h1>
          <p className="text-lg font-semibold text-casino-green mb-1">Reset Password</p>
        </div>
        
        <SignIn 
          routing="hash"
          initialValues={{ }}
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-casino-card border border-casino-gold/30 shadow-xl',
              headerTitle: 'text-casino-gold font-orbitron',
              headerSubtitle: 'text-casino-gray',
              formFieldLabel: 'text-casino-text',
              formFieldInput: 'bg-casino-elevated border border-casino-gold/50 text-casino-text focus:border-casino-gold',
              footerActionLink: 'text-casino-green hover:text-casino-gold',
              formButtonPrimary: 'bg-casino-gold hover:bg-casino-gold/90 text-black',
            },
            variables: {
              colorPrimary: '#fbbf24',
              colorBackground: '#1a1a2e',
              colorText: '#e5e5e5',
              borderRadius: '0.5rem',
            },
          }}
        />
      </div>
    </div>
  );
}
