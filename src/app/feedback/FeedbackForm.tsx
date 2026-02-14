'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

export function FeedbackForm() {
  const { user } = useUser();
  const [type, setType] = useState<'Feature Request' | 'Bug Report'>('Feature Request');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    if (!user) return;
    if (user.emailAddresses?.[0]?.emailAddress && !email) setEmail(user.emailAddresses[0].emailAddress);
    if (user.firstName && !firstName) setFirstName(user.firstName);
    if (user.lastName && !lastName) setLastName(user.lastName);
  }, [user]);
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    const formData = new FormData();
    formData.set('type', type);
    formData.set('email', email);
    formData.set('firstName', firstName);
    formData.set('lastName', lastName);
    formData.set('message', message);
    if (screenshot) formData.set('screenshot', screenshot);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong');
        return;
      }
      setStatus('success');
      setMessage('');
      setScreenshot(null);
    } catch {
      setStatus('error');
      setErrorMessage('Network error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-casino-gray mb-1">
          Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as 'Feature Request' | 'Bug Report')}
          className="w-full px-3 py-2 rounded-lg bg-casino-card border border-casino-gold/20 text-casino-text focus:border-casino-gold focus:outline-none"
        >
          <option value="Feature Request">Feature Request</option>
          <option value="Bug Report">Bug Report</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-casino-gray mb-1">
            First name
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-casino-card border border-casino-gold/20 text-casino-text focus:border-casino-gold focus:outline-none"
            placeholder="First name"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-casino-gray mb-1">
            Last name
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-casino-card border border-casino-gold/20 text-casino-text focus:border-casino-gold focus:outline-none"
            placeholder="Last name"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-casino-gray mb-1">
          Email <span className="text-red-400">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-lg bg-casino-card border border-casino-gold/20 text-casino-text focus:border-casino-gold focus:outline-none"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-casino-gray mb-1">
          Message <span className="text-red-400">*</span>
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          className="w-full px-3 py-2 rounded-lg bg-casino-card border border-casino-gold/20 text-casino-text focus:border-casino-gold focus:outline-none resize-y"
          placeholder="Describe your feature request or bug..."
        />
      </div>

      <div>
        <label htmlFor="screenshot" className="block text-sm font-medium text-casino-gray mb-1">
          Screenshot (optional)
        </label>
        <input
          id="screenshot"
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-casino-gray file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-casino-gold/20 file:text-casino-gold file:font-medium"
        />
        {screenshot && (
          <p className="mt-1 text-xs text-casino-gray">
            {screenshot.name} ({(screenshot.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {status === 'error' && (
        <p className="text-red-400 text-sm">{errorMessage}</p>
      )}
      {status === 'success' && (
        <p className="text-green-400 text-sm">Thanks! Your feedback was sent.</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full py-3 px-4 rounded-lg bg-casino-gold text-black font-semibold hover:bg-casino-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === 'sending' ? 'Sending...' : 'Send feedback'}
      </button>
    </form>
  );
}
