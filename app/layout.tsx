import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '像素坦克大战 | Pixel Tank Battles',
  description:
    '使用 Next.js 构建的像素风格坦克大战游戏，包含关卡、道具、生命值与自定义用户名系统。'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
