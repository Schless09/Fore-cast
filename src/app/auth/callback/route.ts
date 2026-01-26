import { NextResponse } from 'next/server';

// This route is no longer needed with Clerk authentication
// Clerk handles all OAuth callbacks internally
// Keeping this file to prevent 404 errors for any old bookmarks

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get('next') ?? '/the-money-board';
  
  return NextResponse.redirect(new URL(next, request.url));
}
