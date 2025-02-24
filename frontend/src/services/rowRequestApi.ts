import { RowRequest } from '../types/rowRequest'
import { API_URL } from '@/config/constants'

const BASE_URL = API_URL

export const rowRequestApi = {
  fetchRequests: async (): Promise<RowRequest[]> => {
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('No authentication token found')
    }

    const response = await fetch(`${BASE_URL}/fetchrowrequest`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch requests')
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch requests')
    }

    return data.data || []
  },

  approveRequest: async (requestId: string): Promise<void> => {
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('No authentication token found')
    }

    const response = await fetch(`${BASE_URL}/approverowrequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ request_id: requestId }),
    })

    if (!response.ok) {
      throw new Error('Failed to approve request')
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.message || 'Failed to approve request')
    }
  },

  rejectRequest: async (requestId: string, comments: string): Promise<void> => {
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('No authentication token found')
    }

    const response = await fetch(`${BASE_URL}/rejectrowrequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ request_id: requestId, comments }),
    })

    if (!response.ok) {
      throw new Error('Failed to reject request')
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.message || 'Failed to reject request')
    }
  },

  bulkApprove: async (requestIds: string[]): Promise<void> => {
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('No authentication token found')
    }

    const response = await fetch(`${BASE_URL}/bulkapproverowrequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ request_ids: requestIds }),
    })

    if (!response.ok) {
      throw new Error('Failed to approve requests')
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.message || 'Failed to approve requests')
    }
  },

  bulkReject: async (requestIds: string[], comments: string): Promise<void> => {
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('No authentication token found')
    }

    const response = await fetch(`${BASE_URL}/bulkrejectrowrequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ request_ids: requestIds, comments }),
    })

    if (!response.ok) {
      throw new Error('Failed to reject requests')
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.message || 'Failed to reject requests')
    }
  },
}
