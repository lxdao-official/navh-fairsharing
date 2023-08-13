import React, { useCallback, useState } from 'react'
import Layout from '@/layout'
import {
  Breadcrumbs,
  Typography,
  Link,
  TableContainer,
  Table,
  Paper,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  Alert,
  Snackbar,
} from '@mui/material'
import { useRouter } from 'next/router'
import { useAccount, useContract, useQuery, useSigner } from 'wagmi'
import fairSharingAbi from '@/fairSharingabi.json'
import { addRecord, getRecords, store, Records, updateRecord } from '@/store'
import { object, string, TypeOf, coerce } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoadingButton } from '@mui/lab'
import { DocumentReference } from 'db3.js'
import { utils } from 'ethers'

const registerSchema = object({
  contribution: string().nonempty('contribution is required'),
  point: coerce.number().min(0, 'point should be greater than 0'),
})

const registerDepositSchema = object({
  value: coerce.number().min(0, 'value should be greater than 0'),
})

type FormData = TypeOf<typeof registerSchema>
type DepositFormData = TypeOf<typeof registerDepositSchema>

type CurrentRecord = {
  voteType: string
} & DocumentReference<Records>

const Project = () => {
  const router = useRouter()
  const contractAddress = router.query.address as any
  const { address } = useAccount()
  const { data: signer } = useSigner()
  const fairSharingContract = useContract({
    address: contractAddress,
    abi: fairSharingAbi,
    signerOrProvider: signer,
  })

  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(registerSchema),
  })

  const deposiForm = useForm<DepositFormData>({
    resolver: zodResolver(registerDepositSchema),
  })

  const [showVoteDialog, setShowVoteDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDepositDialog, setShowDepositDialog] = useState(false)
  const [record, setRecord] = useState<CurrentRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [snackbarInfo, setSnackbarInfo] = useState({
    open: false,
    text: '',
  })

  const recordsQuery = useQuery(
    ['getRecords', contractAddress],
    () => getRecords(contractAddress),
    {
      enabled: !!contractAddress && store.initDb,
    }
  )

  // const membersQuery = useQuery(
  //   ['getMembers'],
  //   async () => {
  //     if (!fairSharingContract) return []
  //     const members = await fairSharingContract.totalMembers()
  //     let list: string[] = []
  //     for (let i = 0; i < members; i++) {
  //       const item = await fairSharingContract.membersList(i)
  //       list = [...list, item]
  //     }
  //     return list
  //   },
  //   {
  //     enabled: !!fairSharingContract && !!fairSharingContract.provider,
  //   }
  // )
  //
  // console.log(membersQuery.data)

  const handleVoteDialog = useCallback(
    async (voteType: string, record: DocumentReference<Records>) => {
      const user = await signer?.getAddress()
      const voteData = record.entry.doc.votes?.find(
        (vote) => vote.voter === user
      )
      if (voteData && voteType !== 'claim') {
        return
      }

      setShowVoteDialog((v) => !v)
      setRecord({
        voteType,
        ...record,
      })
    },
    [signer]
  )

  const handleVote = useCallback(async () => {
    if (!record || !signer) return
    setLoading(true)
    try {
      const {
        voteType,
        entry: {
          id,
          doc: { user, point, votes = [] },
        },
      } = record
      const isApproved = voteType === 'approve'
      const voter = await signer.getAddress()

      const msgHash = utils.solidityKeccak256(
        ['address', 'bytes32', 'address', 'bool', 'uint256'],
        [
          user,
          utils.keccak256(utils.hexlify(utils.toUtf8Bytes(id))),
          voter,
          isApproved,
          utils.parseEther(point.toString()),
        ]
      )
      const signature = await signer.signMessage(utils.arrayify(msgHash))
      votes.push({
        approve: isApproved,
        voter,
        signature,
      })
      await updateRecord(record, {
        ...record.entry.doc,
        votes,
      })
      setSnackbarInfo({
        open: true,
        text: 'Vote success!',
      })
      setShowVoteDialog(false)
    } catch (e) {
      console.log(e)
    } finally {
      setLoading(false)
    }
  }, [signer, record])

  const handleClaim = useCallback(async () => {
    if (!record || !fairSharingContract) return
    setLoading(true)
    try {
      const {
        entry: {
          id,
          doc: { votes = [], point },
        },
      } = record
      const tx = await fairSharingContract.claim(
        utils.keccak256(utils.hexlify(utils.toUtf8Bytes(id))),
        utils.parseEther(point.toString()),
        votes
      )
      await tx.wait()
      await updateRecord(record, {
        ...record.entry.doc,
        status: 1,
      })
      setSnackbarInfo({
        open: true,
        text: 'Claim success!',
      })
      setShowVoteDialog(false)
    } catch (e) {
      console.log(e)
    } finally {
      setLoading(false)
    }
  }, [fairSharingContract, record])

  const handleAddDialog = useCallback(() => {
    setShowAddDialog((v) => !v)
  }, [])

  const handleFinish = useCallback(
    async (data: FormData) => {
      if (!address) return
      // TODO 鉴权
      setLoading(true)
      const { contribution, point } = data
      await addRecord({
        contribution,
        point,
        user: address,
        status: 0,
        contract: contractAddress,
      })
      setTimeout(async () => {
        await recordsQuery.refetch()
        setSnackbarInfo({
          open: true,
          text: 'Add contribution success!',
        })
        setLoading(false)
        handleAddDialog()
        reset({})
      }, 2000)
    },
    [address, contractAddress, handleAddDialog, recordsQuery, reset]
  )

  const handleDeposit = useCallback(
    async (data: DepositFormData) => {
      setLoading(true)
      try {
        const amountInWei = utils.parseEther(data.value.toString())
        const tx = await fairSharingContract?.sharing({
          value: amountInWei,
        })
        await tx.wait()
        setSnackbarInfo({
          open: true,
          text: 'Deposit success!',
        })
        setShowDepositDialog(false)
        deposiForm.reset({})
      } catch (e) {
        console.log(e)
      } finally {
        setLoading(false)
      }
    },
    [deposiForm, fairSharingContract]
  )

  return (
    <Layout>
      <Breadcrumbs
        aria-label="breadcrumb"
        className="h-[80px] flex items-center"
      >
        <Link
          underline="hover"
          color="inherit"
          className="cursor-pointer"
          onClick={() => router.push('/')}
        >
          Home
        </Link>
        <Typography>Project</Typography>
      </Breadcrumbs>
      <Typography variant="h4" className="text-[#272D37] my-6">
        Contributions
      </Typography>
      <div className="flex">
        <Button
          size="large"
          variant="contained"
          onClick={handleAddDialog}
          className="mb-8 mr-6 w-[250px]"
        >
          Add Contribution
        </Button>
        <Button
          size="large"
          variant="contained"
          onClick={() => setShowDepositDialog(true)}
          className="mb-8 w-[250px]"
        >
          Deposit
        </Button>
      </div>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Contribution</TableCell>
              <TableCell>Points</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recordsQuery.data?.map((row) => {
              const { doc, id } = row.entry
              let approveCount = 0
              let rejectCount = 0
              doc.votes?.forEach((vote) => {
                if (vote.approve) {
                  approveCount++
                } else {
                  rejectCount++
                }
              })
              return (
                <TableRow
                  key={id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {doc.user}
                  </TableCell>
                  <TableCell align="left">{doc.contribution}</TableCell>
                  <TableCell align="left">{doc.point}</TableCell>
                  <TableCell align="left">
                    {doc.status === 1
                      ? 'claimed'
                      : `approve: ${approveCount}, reject: ${rejectCount}`}
                  </TableCell>
                  <TableCell align="left">
                    <Button
                      variant="text"
                      color="error"
                      onClick={() => handleVoteDialog('reject', row)}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => handleVoteDialog('approve', row)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => handleVoteDialog('claim', row)}
                    >
                      Claim
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={recordsQuery.data?.length || 0}
        rowsPerPage={3}
        rowsPerPageOptions={[10]}
        page={0}
        onPageChange={() => {}}
      />
      <Dialog
        open={showVoteDialog}
        onClose={() => setShowVoteDialog((v) => !v)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Vote Action</DialogTitle>
        <DialogContent className="w-[400px]">
          <DialogContentText>
            Do you want to {record?.voteType} this contribution?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVoteDialog((v) => !v)}>Cancel</Button>
          <LoadingButton
            loading={loading}
            onClick={() => {
              if (record?.voteType === 'claim') {
                handleClaim()
              } else {
                handleVote()
              }
            }}
            autoFocus
          >
            {record?.voteType}
          </LoadingButton>
        </DialogActions>
      </Dialog>
      <Dialog
        open={showDepositDialog}
        onClose={() => setShowDepositDialog((v) => !v)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Deposit</DialogTitle>
        <DialogContent className="w-[400px]">
          <form className="flex flex-col min-w-[400px]">
            <Controller
              name="value"
              control={deposiForm.control}
              rules={{ required: true }}
              render={({ field }) => (
                <TextField
                  required
                  type="number"
                  label="Point"
                  margin="normal"
                  error={!!deposiForm.formState.errors['value']}
                  helperText={
                    deposiForm.formState.errors['value']
                      ? deposiForm.formState.errors['value'].message
                      : ''
                  }
                  {...field}
                />
              )}
            />
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDepositDialog((v) => !v)}>
            Cancel
          </Button>
          <LoadingButton
            loading={loading}
            onClick={deposiForm.handleSubmit(handleDeposit)}
            autoFocus
          >
            Done
          </LoadingButton>
        </DialogActions>
      </Dialog>
      <Dialog
        open={showAddDialog}
        onClose={handleAddDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Add Contribution</DialogTitle>
        <DialogContent>
          <form className="flex flex-col min-w-[400px]">
            <Controller
              name="contribution"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <TextField
                  required
                  multiline
                  label="Contribution"
                  margin="normal"
                  error={!!errors['contribution']}
                  helperText={
                    errors['contribution'] ? errors['contribution'].message : ''
                  }
                  {...field}
                />
              )}
            />
            <Controller
              name="point"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <TextField
                  required
                  type="number"
                  label="Point"
                  margin="normal"
                  error={!!errors['point']}
                  helperText={errors['point'] ? errors['point'].message : ''}
                  {...field}
                />
              )}
            />
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddDialog}>Cancel</Button>
          <LoadingButton
            loading={loading}
            onClick={handleSubmit(handleFinish)}
            autoFocus
          >
            Done
          </LoadingButton>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbarInfo.open}
        onClose={() =>
          setSnackbarInfo((v) => ({
            ...v,
            open: false,
          }))
        }
        autoHideDuration={5000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          sx={{ width: '100%' }}
          onClose={() =>
            setSnackbarInfo((v) => ({
              ...v,
              open: false,
            }))
          }
        >
          {snackbarInfo.text}
        </Alert>
      </Snackbar>
    </Layout>
  )
}

export default Project
