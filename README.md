# FinMan

M-Pesa Budgeter - A privacy-first financial transaction tracker and budgeting app.

## Features

- **SMS Transaction Parsing**: Automatically parse and track M-Pesa transactions from SMS messages
- **Budget Management**: Track spending with the 40-30-30 budgeting rule
- **Local Storage**: All data stored locally using IndexedDB for privacy
- **Cloud Authentication**: Secure Supabase authentication
- **Progressive Web App**: Install as a native app on your device
- **Real-time Charts**: Visual breakdown of income and expenses
- **Category Tracking**: Organize transactions by spending categories

## Run Locally

**Prerequisites:** Node.js 16+

1. Install dependencies:
   ```
   npm install
   ```

2. Configure environment variables in `.env.local`:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_api_key (optional)
   ```

3. Run the development server:
   ```
   npm run dev
   ```

4. Build for production:
   ```
   npm run build
   ```
