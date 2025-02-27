export interface OTPResponse {
  success: boolean
  message: string
  error?: string
}

export interface LoginResponse {
  success: boolean
  message: string
  token?: string
  refreshToken?: string
  error?: string
  data?: {
    email: string
    role: string
    first_name: string
    last_name: string
  }
  redirectPath?: string
}

export type UserRole = 'admin' | 'maker' | 'checker'
