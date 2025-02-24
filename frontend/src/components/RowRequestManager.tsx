import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardContent } from './ui/Card'
import { useToast } from '../hooks/use-toast'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Button } from './ui/button'
import { Check, X, RefreshCcw, CheckSquare, XSquare, Eye } from 'lucide-react'
import { Checkbox } from './ui/checkbox'
import { DataDialog } from './dialogs/DataDialog'
import { RejectDialog } from './dialogs/RejectDialog'
import { rowRequestApi } from '../services/rowRequestApi'
import { RowRequest } from '../types/rowRequest'

interface RowRequestManagerProps {
  selectTable?: string | null;
}

export const RowRequestManager: React.FC<RowRequestManagerProps> = ({ selectTable }) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<RowRequest[]>([])
  const [selectedData, setSelectedData] = useState<Record<string, unknown> | null>(null)
  const [selectedRequests, setSelectedRequests] = useState<string[]>([])
  const [rejectDialogState, setRejectDialogState] = useState<{
    isOpen: boolean
    requestId: string
    isBulk: boolean
  }>({
    isOpen: false,
    requestId: '',
    isBulk: false,
  })

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const data = await rowRequestApi.fetchRequests()
      
      const filteredData = selectTable
      ? data.filter(request => request.table_name === selectTable)
      : data;
    setRequests(filteredData);
    } catch (error) {
      console.error('Error fetching requests:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch requests',
      })
    } finally {
      setLoading(false)
    }
  }, [toast, selectTable])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleApprove = async (requestId: string) => {
    try {
      setLoading(true)
      await rowRequestApi.approveRequest(requestId)
      await fetchRequests()
      toast({
        title: 'Success',
        description: 'Request approved successfully',
        className: 'bg-[#003087] text-white border-none',
      })
    } catch (error) {
      console.error('Error approving request:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve request',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async (requestId: string, comments: string) => {
    try {
      setLoading(true)
      await rowRequestApi.rejectRequest(requestId, comments)
      await fetchRequests()
      setRejectDialogState({ isOpen: false, requestId: '', isBulk: false })
      toast({
        title: 'Success',
        description: 'Request rejected successfully',
        className: 'bg-[#003087] text-white border-none',
      })
    } catch (error) {
      console.error('Error rejecting request:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reject request',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBulkApprove = async () => {
    if (selectedRequests.length === 0) return

    try {
      setLoading(true)
      await rowRequestApi.bulkApprove(selectedRequests)
      await fetchRequests()
      setSelectedRequests([])
      toast({
        title: 'Success',
        description: 'Requests approved successfully',
        className: 'bg-[#003087] text-white border-none',
      })
    } catch (error) {
      console.error('Error approving requests:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve requests',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBulkReject = async (comments: string) => {
    if (selectedRequests.length === 0) return

    try {
      setLoading(true)
      await rowRequestApi.bulkReject(selectedRequests, comments)
      await fetchRequests()
      setSelectedRequests([])
      setRejectDialogState({ isOpen: false, requestId: '', isBulk: false })
      toast({
        title: 'Success',
        description: 'Requests rejected successfully',
        className: 'bg-[#003087] text-white border-none',
      })
    } catch (error) {
      console.error('Error rejecting requests:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reject requests',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pendingRequestIds = requests
        .filter((request) => request.status === 'pending')
        .map((request) => request.request_id)
      setSelectedRequests(pendingRequestIds)
    } else {
      setSelectedRequests([])
    }
  }

  const handleSelectRequest = (requestId: string, checked: boolean) => {
    if (checked) {
      setSelectedRequests((prev) => [...prev, requestId])
    } else {
      setSelectedRequests((prev) => prev.filter((id) => id !== requestId))
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold font-['Poppins']">Row Requests</h2>
          <p className="text-sm text-gray-500 font-['Poppins']">Manage row modification requests</p>
        </div>
        <div className="flex items-center gap-4">
          {selectedRequests.length > 0 && (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setRejectDialogState({ isOpen: true, requestId: '', isBulk: true })}
              >
                <XSquare className="h-4 w-4" />
                Reject Selected
              </Button>
              <Button className="gap-2" onClick={handleBulkApprove}>
                <CheckSquare className="h-4 w-4" />
                Approve Selected
              </Button>
            </>
          )}
          <Button variant="outline" onClick={fetchRequests} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      selectedRequests.length > 0 &&
                      selectedRequests.length ===
                        requests.filter((request) => request.status === 'pending').length
                    }
                    onCheckedChange={handleSelectAll}
                    disabled={loading}
                  />
                </TableHead>
                <TableHead>Table Name</TableHead>
                <TableHead>Maker</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <RefreshCcw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <span className="text-sm text-gray-500">Loading requests...</span>
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <p className="text-sm text-gray-500">No requests found</p>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.request_id}>
                    <TableCell>
                      {request.status === 'pending' && (
                        <Checkbox
                          checked={selectedRequests.includes(request.request_id)}
                          onCheckedChange={(checked) =>
                            handleSelectRequest(request.request_id, checked as boolean)
                          }
                          disabled={loading}
                        />
                      )}
                    </TableCell>
                    <TableCell>{request.table_name}</TableCell>
                    <TableCell>{request.maker}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          request.status === 'approved'
                            ? 'bg-green-50 text-green-700'
                            : request.status === 'rejected'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-yellow-50 text-yellow-700'
                        }`}
                      >
                        {request.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedData(
                            typeof request.row_data === 'string'
                              ? JSON.parse(request.row_data)
                              : request.row_data
                          )}
                          disabled={loading}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {request.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleApprove(request.request_id)}
                              disabled={loading}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setRejectDialogState({
                                  isOpen: true,
                                  requestId: request.request_id,
                                  isBulk: false,
                                })
                              }
                              disabled={loading}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <DataDialog
        isOpen={selectedData !== null}
        onClose={() => setSelectedData(null)}
        data={selectedData || {}}
      />

      <RejectDialog
        isOpen={rejectDialogState.isOpen}
        onClose={() => setRejectDialogState({ isOpen: false, requestId: '', isBulk: false })}
        onConfirm={(comments) =>
          rejectDialogState.isBulk
            ? handleBulkReject(comments)
            : handleReject(rejectDialogState.requestId, comments)
        }
        title={`Reject ${rejectDialogState.isBulk ? 'Selected Requests' : 'Request'}`}
      />
    </Card>
  )
}
