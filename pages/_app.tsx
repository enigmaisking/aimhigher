import type { AppProps } from 'next/app'
import '../styles/globals.css' // Keep this!

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
