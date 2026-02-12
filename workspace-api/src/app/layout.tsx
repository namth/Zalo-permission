import './globals.css';

export const metadata = {
  title: 'Zalo Permission Admin',
  description: 'Workspace-based permission management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
