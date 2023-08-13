import { MetamaskWallet, initializeDB3 } from 'db3.js'
import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import Header from './header'
import Footer from './footer'
import { addDB, store } from '@/store'

// @ts-ignore
const Layout = ({ children }) => {
  const { isConnected } = useAccount()

  useEffect(() => {
    if (!isConnected) return
    addDB()
  }, [isConnected])
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FB]">
      <Header />
      <main className="flex-1 py-[86px] px-[112px] flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  )
}

export default Layout
