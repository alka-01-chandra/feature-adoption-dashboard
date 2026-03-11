import './globals.css';

export const metadata = {
  title: 'FERMÀT Feature Adoption Dashboard',
  description: 'Feature adoption analysis for proactive brand outreach',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
