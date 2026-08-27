import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Native 团队协同开发系统",
  description: "面向 AI Native 团队的项目、任务、需求与发布协同开发系统。",
  icons: {
    icon: [
      { url: "/favicon.ico?v=20260828", sizes: "any" },
      { url: "/icon.png?v=20260828", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=20260828",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem('chorify-theme')||'light'}catch(e){}`}}/>{children}</body>
    </html>
  );
}
