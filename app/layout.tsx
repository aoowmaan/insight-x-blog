import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Report_X',
  description: 'Security & Insight Archive',
  // 👇 여기 주목! 구글과 네이버를 동시에 설정하는 법
  verification: {
    google: 'TxZYf1g7O6RlD5mrwAP382zkb8-M7NsS_c8Swnc2IDY', // 방금 준 구글 코드
    other: {
      'naver-site-verification': 'c071df3ffc0e770e7d11c88f7010d68a74bacc70', // 아까 넣은 네이버 코드
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-white text-black antialiased">
        {children}
      </body>
    </html>
  )
}