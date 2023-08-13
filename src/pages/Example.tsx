import { useCallback, useMemo, useState, useEffect } from 'react'
import Layout from '@/layout'
import {
  Typography,
  Button,
  FormControl,
  TextField,
  IconButton,
  Skeleton,
  Box,
} from '@mui/material'
import { Remove, Add } from '@mui/icons-material'
import Image from 'next/image'
import { ethers, utils } from 'ethers'
import { useAccount, useContract, useSigner } from 'wagmi'
import factoryabi from '../factoryabi.json'
import instanceabi from '../fairSharingabi.json'

export default function Example() {
  const { address } = useAccount()
  const { data: signer } = useSigner()
  console.log('signer: ', signer)

  const [count, setCount] = useState(0)
  const [list, setList] = useState<string[]>([])

  const [currentDAO, setCurrentDAO] = useState<string>()

  const factoryContract = useContract({
    // todo put in the env
    address: '0x5d28D141Ca3d3A1CAB83b909098522F9b91309F7',
    abi: factoryabi,
    signerOrProvider: signer,
  })
  // todo detect and auto refresh the list

  // todo need to create a new component or find a way to update the contact address
  const fairSharingContract = useContract({
    address: '0x9c92dBdf062A2C877cB207C29d46116B989145E9',
    abi: instanceabi,
    signerOrProvider: signer,
  })
  console.log('fairSharingContract: ', fairSharingContract)

  useEffect(() => {
    ;(async () => {
      if (factoryContract && signer) {
        const count = await factoryContract.getCount()
        setCount(parseInt(count))
        let list: string[] = []
        for (let i = 0; i < count; i++) {
          const item = await factoryContract.fairSharings(i)
          list = [...list, item]
        }
        setList(list)
      }
    })()
  }, [factoryContract, signer])

  return (
    <Box>
      <Button
        onClick={async () => {
          const tx = await factoryContract?.createFairSharing(
            'FairDAO',
            'FD',
            // todo add the member lists
            ['0x303A8F5F57A7E6b6584c6C177FC246b721106455'],
            address
          )
          // todo pop up the notification or toast
          console.log('tx', tx)
        }}
      >
        Create a DAO contract with name: FairDAO
      </Button>

      <Box>There are {count} DAOs. List:</Box>

      <Box>
        {list.map((item) => {
          return <div key={item}>{item}</div>
        })}
      </Box>

      <Box>
        <Button
          onClick={() => {
            setCurrentDAO('0x9c92dBdf062A2C877cB207C29d46116B989145E9')
          }}
        >
          Use the 0x9c92dBdf062A2C877cB207C29d46116B989145E9 DAO as example
        </Button>
      </Box>
      <Box>current dao: {currentDAO}</Box>
      {currentDAO && (
        <Box marginTop={2}>
          Requester: 0x303A8F5F57A7E6b6584c6C177FC246b721106455 <br />{' '}
          ContributionID: 36f38aff-c171-4461-9c4d-a2f7eafee2da
          <br /> Reason: I contributed a lot.
          <br />
          Token: 30{' '}
          <Button
            onClick={async () => {
              const msgHash = utils.solidityKeccak256(
                ['address', 'bytes32', 'address', 'bool', 'uint256'],
                [
                  '0x303A8F5F57A7E6b6584c6C177FC246b721106455',
                  utils.formatBytes32String('1'),
                  await signer?.getAddress(),
                  true,
                  utils.parseEther('30'),
                ]
              )
              const signature = await signer?.signMessage(
                utils.arrayify(msgHash)
              )
              console.log('signature: ', signature)
            }}
          >
            Approve
          </Button>{' '}
          <Button
            onClick={async () => {
              const msgHash = utils.solidityKeccak256(
                ['address', 'bytes32', 'address', 'bool', 'uint256'],
                [
                  '0x303A8F5F57A7E6b6584c6C177FC246b721106455',
                  utils.formatBytes32String('1'),
                  await signer?.getAddress(),
                  false,
                  utils.parseEther('30'),
                ]
              )
              const signature = await signer?.signMessage(
                utils.arrayify(msgHash)
              )
              console.log('signature: ', signature)
            }}
          >
            Decline
          </Button>{' '}
          <Button
            onClick={async () => {
              console.log('fairSharingContract: ', fairSharingContract)
              console.log(utils.formatBytes32String('1'))
              const tx = fairSharingContract?.claim(
                utils.formatBytes32String('1'),
                utils.parseEther('30'),
                [
                  {
                    voter: '0x303A8F5F57A7E6b6584c6C177FC246b721106455',
                    approve: true,
                    signature:
                      '0x61a8c238f49865e62fafa38fe40832ed04b3af8ae430a6616a7c8cf7f9b42a6776022ce00a0f2974fd443f6d8adf2ecdd5cb90d5ab803f11f6d809a857f8d9eb1c',
                  },
                ]
              )
              // todo pop up the notification or toast
              console.log('tx', tx)
            }}
          >
            Claim
          </Button>
          Notes: 1. only record creator can claim. 2. the creator must be a
          member.
          <Button
            onClick={async () => {
              const amountInWei = ethers.utils.parseEther('0.02')
              const tx = await fairSharingContract?.sharing({
                value: amountInWei,
              })
              await tx.wait()
              console.log('tx', tx)
            }}
          >
            Deposit
          </Button>
        </Box>
      )}
    </Box>
  )
}
