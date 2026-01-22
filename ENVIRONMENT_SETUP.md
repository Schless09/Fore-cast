# Environment Variables Setup Guide

## Issue: Invalid API Key Error

If you're seeing "Invalid API Key" or "401 Unauthorized" errors, it means your Supabase environment variables are not configured correctly.

## Quick Fix

1. **Get your Supabase keys:**
   - Go to your Supabase project dashboard: https://supabase.com/dashboard
   - Select your project
   - Go to **Settings** → **API**
   - Copy the following:
     - **Project URL** (e.g., `https://xxxxx.supabase.co`)
     - **anon/public key** (starts with `eyJ...`)

2. **Update your environment file:**
   
   Next.js supports both `.env` and `.env.local` files. Use `.env.local` (recommended) or `.env`:
   
   **Option A: `.env.local` (Recommended - automatically ignored by git)**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   
   **Option B: `.env` (Also works)**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   
   **Note:** `.env.local` is preferred because it's automatically ignored by git and has higher priority.

3. **Restart your Next.js dev server:**
   ```bash
   # Stop the server (Ctrl+C) and restart
   npm run dev
   ```

## Verify Your Setup

Visit `/env-check` in your browser to verify your environment variables are set correctly.

## Required Environment Variables

### Supabase (Required)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin operations)

### Optional
- `NEXT_PUBLIC_APP_URL` - Your app URL (defaults to `http://localhost:3000`)
- `LIVEGOLFAPI_KEY` - API key for LiveGolfAPI.com integration

## Common Issues

### "Invalid API Key" Error
- **Cause:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is not set or is a placeholder
- **Fix:** Replace `your_anon_key_here` with your actual Supabase anon key

### "Missing Supabase environment variables"
- **Cause:** Environment variables are not loaded
- **Fix:** 
  1. Ensure `.env` or `.env.local` exists in the project root
  2. Restart your dev server after updating the environment file
  3. Check that variable names start with `NEXT_PUBLIC_` for client-side access
  4. Verify the file is in the root directory (same level as `package.json`)

### "Cannot read properties of undefined"
- **Cause:** Usually related to missing environment variables or API errors
- **Fix:** Check the browser console for detailed error logs (now with better logging!)

## Debugging

The application now includes comprehensive logging:

1. **Browser Console:** Check for detailed error messages with context
2. **Server Logs:** Check your terminal where `npm run dev` is running
3. **Error Boundary:** React errors will be caught and displayed with details
4. **Environment Check:** Visit `/env-check` to verify your setup

All errors are now logged with:
- Timestamp
- Error level (debug, info, warn, error)
- Context information
- Stack traces (for errors)

## Getting Help

If you're still having issues:

1. Check `/env-check` page for environment variable status
2. Check browser console for detailed error logs
3. Verify your Supabase project is active and accessible
4. Ensure you're using the correct keys (anon key for client, service role for server)
