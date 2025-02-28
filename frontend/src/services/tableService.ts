import { config } from '../config/env'

interface TableResponse {
  success: boolean
  tables: Array<{ table_name: string }>
  message?: string
}

export const fetchTables = async (): Promise<TableResponse> => {
  const token = localStorage.getItem('token')
  
  if (!token) {
    throw new Error('No authentication token found')
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/table`, {
      method: 'GET',
      credentials: "include",
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch tables')
    }

    const data: TableResponse = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching tables:', error)
    throw error
  }
}
