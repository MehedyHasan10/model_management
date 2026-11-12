import "./globals.css";
import { Toaster } from "react-hot-toast";
export const metadata = {
  title: "Model Management",
  description: "Measurement, assignments, returns and RBAC",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f6f7fb] font-sans text-[#172039] antialiased">
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
