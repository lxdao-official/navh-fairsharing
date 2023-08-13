import {
  DB3Store,
  collection,
  query,
  addDoc,
  where,
  getDocs,
  MetamaskWallet,
  initializeDB3,
  updateDoc,
} from 'db3.js'
import { proxy } from 'valtio'
import { DocumentReference } from 'db3.js/src/store/document'

export const store = proxy<{ initDb: boolean }>({
  initDb: false,
})

let db3: DB3Store

export const addDB = async () => {
  // @ts-ignore
  const wallet = new MetamaskWallet(window)
  await wallet.connect()
  const { db } = initializeDB3(
    'https://grpc.devnet.db3.network',
    '0xf94c8287560cd1572d81e67e25c995eb23b759b4',
    wallet
  )
  db3 = db
  store.initDb = true
}

export interface Records {
  contract: string
  user: `0x${string}`
  contribution: string
  point: number
  status: number
  votes?: {
    voter: string
    approve: boolean
    signature: string
  }[]
}

export const getRecords = async (contract: string) => {
  if (!db3) return []
  const collectionRef = await collection<Records>(db3, 'records')
  const { docs } = await getDocs<Records>(
    query(collectionRef, where('contract', '==', contract))
  )
  return docs
}

export const addRecord = async (data: Records) => {
  if (!db3) return
  const collectionRef = await collection<Records>(db3, 'records')
  return await addDoc<Records>(collectionRef, data)
}

export const updateRecord = async (ref: any, data: Records) => {
  if (!db3) return
  return await updateDoc(ref, data)
}
