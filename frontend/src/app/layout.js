import './globals.css';

export const metadata = {
  title: 'Media Scraper',
  description: 'A web application for scraping media from URLs',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
