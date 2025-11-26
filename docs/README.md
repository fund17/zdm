# Unisistem - Google Sheets Web App

A modern web application built with Next.js, TypeScript, and Tailwind CSS for accessing and displaying Google Sheets data using TanStack Table.

## 🚀 Features

- **Google Sheets Integration**: Secure access using service account authentication
- **Modern UI**: Built with Tailwind CSS and component-based architecture
- **Data Table**: Advanced table features with TanStack Table (sorting, filtering, pagination)
- **TypeScript**: Full type safety and better developer experience
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Easy Deployment**: Ready for Vercel deployment

## 🛠️ Technology Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Table**: TanStack Table (React Table v8)
- **API**: Google Sheets API v4
- **Authentication**: Google Service Account
- **Deployment**: Vercel

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Node.js** (version 18 or higher)
2. **npm** or **yarn** package manager
3. **Google Cloud Project** with Sheets API enabled
4. **Service Account** with access to your Google Sheets

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd unisistem
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your Google Sheets credentials in `.env.local`:
   ```env
   GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEET_ID=your_google_sheet_id_here
   ```

## 🔑 Google Sheets Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Sheets API

### 2. Create a Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Fill in the details and create
4. Generate a JSON key file

### 3. Share Your Google Sheet

1. Open your Google Sheet
2. Click **Share** button
3. Add your service account email with **Viewer** permissions
4. Copy the Sheet ID from the URL

### 4. Configure Environment Variables

Extract these values from your service account JSON:
- `client_email` → `GOOGLE_CLIENT_EMAIL`
- `private_key` → `GOOGLE_PRIVATE_KEY`
- Sheet ID from URL → `GOOGLE_SHEET_ID`

## 🚀 Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗️ Building for Production

```bash
npm run build
npm start
```

## 📦 Deployment to Vercel

### 1. Connect to GitHub

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Import your project

### 2. Configure Environment Variables

In Vercel dashboard, add these environment variables:
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`

### 3. Deploy

Vercel will automatically deploy your application when you push to main branch.

## 📁 Project Structure

```
src/
├── app/
│   ├── api/sheets/          # Google Sheets API endpoint
│   ├── globals.css          # Global styles with Tailwind
│   ├── layout.tsx           # Root layout component
│   └── page.tsx             # Home page
├── components/
│   ├── DataTable.tsx        # TanStack Table component
│   └── LoadingSpinner.tsx   # Loading component
└── lib/
    └── googleSheets.ts      # Google Sheets API client
```

## 🎨 CSS Architecture

The project uses a component-based CSS architecture with Tailwind CSS:

- **Global Styles**: Base styles and CSS custom properties
- **Component Classes**: Reusable component styles (buttons, cards, tables)
- **Utility Classes**: Tailwind utility classes for specific styling

### Available Component Classes

- **Buttons**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`
- **Cards**: `.card`, `.card-header`, `.card-body`, `.card-footer`
- **Tables**: `.table`, `.table-header`, `.table-body`, `.table-row`, `.table-cell`
- **Forms**: `.form-group`, `.form-label`, `.form-input`, `.form-error`
- **Layout**: `.container`, `.page-header`, `.page-title`, `.page-subtitle`

## 🔍 API Endpoints

### GET /api/sheets

Fetches data from the configured Google Sheet.

**Response:**
```json
{
  "data": [
    {
      "column1": "value1",
      "column2": "value2"
    }
  ],
  "total": 100,
  "message": "Data fetched successfully"
}
```

## 🛡️ Security

- Service account credentials are stored securely as environment variables
- Private keys are properly formatted and escaped
- API endpoints include proper error handling
- No sensitive data is exposed to the client

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Common Issues

1. **Authentication Error**
   - Check if service account email is correct
   - Verify private key format (should include \n characters)
   - Ensure service account has access to the sheet

2. **Build Errors**
   - Run `npm install` to ensure all dependencies are installed
   - Check TypeScript errors with `npm run build`

3. **API Errors**
   - Verify Google Sheets API is enabled
   - Check if Sheet ID is correct
   - Ensure service account has proper permissions

### Getting Help

If you encounter issues:
1. Check the browser console for errors
2. Review the server logs in development
3. Verify all environment variables are set correctly
4. Test Google Sheets API access independently