
import "./globals.css";
import { Toaster } from "react-hot-toast";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Model Management",
  description: "Measurement, assign, returns and RBAC",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f6f7fb] font-sans text-[#172039] antialiased">
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
