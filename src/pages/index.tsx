import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '@/layout'
import {
  Alert,
  Button,
  FormControl,
  IconButton,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import { LoadingButton } from '@mui/lab'
import { Add, Remove } from '@mui/icons-material'
import Image from 'next/image'
import { useAccount, useContract, useQuery, useSigner } from 'wagmi'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { array, object, string, TypeOf } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import factoryabi from '@/factoryabi.json'
import fairSharingAbi from '@/fairSharingabi.json'
import { readContract } from '@wagmi/core'
import { useRouter } from 'next/router'

const registerSchema = object({
  projectName: string({
    required_error: 'Project name is required',
  }).nonempty('Project name is required'),
  contributors: array(
    object({
      name: string().nonempty('Contributor is required'),
    })
  ),
})

type FormData = TypeOf<typeof registerSchema>

export default function Home() {
  const [isCreating, setIsCreating] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)

  const router = useRouter()
  const { isConnected } = useAccount()
  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(registerSchema),
  })
  const { fields, append, prepend, remove, swap, move, insert } = useFieldArray(
    {
      control,
      name: 'contributors',
    }
  )

  const { address } = useAccount()
  const { data: signer } = useSigner()
  const factoryContract = useContract({
    // todo put in the env
    address: '0x5d28D141Ca3d3A1CAB83b909098522F9b91309F7',
    abi: factoryabi,
    signerOrProvider: signer,
  })

  const projectQuery = useQuery(
    ['getProjects'],
    async () => {
      if (factoryContract && signer) {
        const count = await factoryContract.getCount()
        let list: string[] = []
        for (let i = 0; i < count; i++) {
          const item = await factoryContract.fairSharings(i)
          list = [...list, item]
        }
        const data = (await Promise.all(
          list.map((address: any) =>
            readContract({
              address,
              abi: fairSharingAbi,
              functionName: 'name',
            })
          )
        )) as string[]
        return data.map((item, index) => ({
          name: item,
          address: list[index],
        }))
      }
      return []
    },
    {
      enabled: !!factoryContract && !!signer,
    }
  )

  const handleFinish = useCallback(
    async (data: FormData) => {
      setIsDeploying(true)
      const { projectName, contributors } = data
      const tx = await factoryContract?.createFairSharing(
        projectName,
        projectName,
        contributors.map((item) => item.name),
        address
      )
      await tx?.wait()
      projectQuery.refetch()
      setIsCreating(false)
      setOpen(true)
      setIsDeploying(false)
      reset()
    },
    [address, factoryContract, projectQuery, reset]
  )

  const handleCreate = useCallback(() => {
    if (!isConnected) {
      return
    }
    append({ name: '' })
    setIsCreating((v) => !v)
  }, [append, isConnected])

  const handleClickDetail = useCallback(
    (address: string) => {
      router.push(`/project?address=${address}`)
    },
    [router]
  )

  const children = useMemo(() => {
    if (!hasMounted) return null
    if (projectQuery.isFetching) {
      return (
        <div className="flex w-full justify-between">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton variant="rectangular" width={286} height={184} key={i} />
          ))}
        </div>
      )
    }
    if (isCreating) {
      return (
        <>
          <Typography variant="h4" className="font-bold text-[#272D37] mb-12">
            Set up project
          </Typography>
          <FormControl className="w-[58vw]">
            <form onSubmit={handleSubmit(handleFinish)}>
              <Controller
                name="projectName"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextField
                    required
                    label="Project name"
                    margin="normal"
                    error={!!errors['projectName']}
                    helperText={
                      errors['projectName'] ? errors['projectName'].message : ''
                    }
                    {...field}
                  />
                )}
              />
              {fields.map((item, index) => (
                <div key={item.id} className="flex items-center">
                  <Controller
                    name={`contributors.${index}.name`}
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <TextField
                        required
                        margin="normal"
                        className="flex-1"
                        label="Contributor"
                        error={!!errors['contributors']?.[index]}
                        helperText={
                          errors['contributors']?.[index]
                            ? errors['contributors']?.[index]?.name?.message
                            : ''
                        }
                        {...field}
                      />
                    )}
                  />
                  <div className="pl-4">
                    {fields.length > 1 ? (
                      <IconButton onClick={() => remove(index)}>
                        <Remove />
                      </IconButton>
                    ) : null}
                    {fields.length - 1 === index ? (
                      <IconButton onClick={() => append({ name: '' })}>
                        <Add />
                      </IconButton>
                    ) : null}
                  </div>
                </div>
              ))}
              <Button
                size="large"
                variant="contained"
                className="w-[150px] mt-4 mr-8"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <LoadingButton
                loading={isDeploying}
                size="large"
                variant="contained"
                className="w-[150px] mt-4"
                type="submit"
              >
                Done
              </LoadingButton>
            </form>
          </FormControl>
        </>
      )
    }
    return (
      <>
        <Button
          size="large"
          variant="contained"
          onClick={handleCreate}
          className="mb-12"
        >
          Create a project
        </Button>
        <div className="w-full grid grid-cols-4 gap-10">
          {projectQuery.data?.map((item, index) => (
            <div
              key={index}
              className="cursor-pointer border border-[#EAEBF0] border-solid w-[286px] h-[184px] mr-4 rounded flex flex-col justify-center items-center"
              onClick={() => handleClickDetail(item.address)}
            >
              <Image
                src="/projectIcon.png"
                alt="projectIcon"
                width={48}
                height={48}
                className="mb-3"
              />
              <Typography
                variant="subtitle1"
                className="text-lg text-[#5F6D7E]"
              >
                {item.name}
              </Typography>
            </div>
          ))}
        </div>
      </>
    )
  }, [
    projectQuery.isLoading,
    projectQuery.data,
    isCreating,
    isConnected,
    control,
    fields,
    errors,
    remove,
    append,
    handleSubmit,
    handleFinish,
    handleCreate,
    hasMounted,
  ])

  useEffect(() => {
    setHasMounted(true)
  }, [])

  return (
    <Layout>
      <div className="flex items-center justify-center flex-1 flex-col mt-12">
        <Typography variant="h2" className="font-bold text-[#272D37] mb-6">
          A tool for fair sharing
        </Typography>
        <Typography
          variant="subtitle1"
          className="text-lg text-[#5F6D7E] mb-12"
        >
          Upgrade your side project into a DAO and turbocharge it. (Please
          connect wallet first)
        </Typography>
        {children}
        <Snackbar
          open={open}
          onClose={() => setOpen(false)}
          autoHideDuration={5000}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            severity="success"
            sx={{ width: '100%' }}
            onClose={() => setOpen(false)}
          >
            Create Project Success!
          </Alert>
        </Snackbar>
      </div>
    </Layout>
  )
}
