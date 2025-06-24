import { config } from "./env"; 
export const API_URL = config.apiBaseUrl;

export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    VERIFY_OTP: "/auth/verify-otp",
    LOGOUT: "/auth/logout",
  },
  NOTIFICATIONS: {
    MAKER: "/maker-notification",
    CHECKER: "/checker-notification",
    ADMIN: "/admin-notification",
    // UNREAD_COUNT: "/notifications/unread-count",
    // MARK_READ: "/notifications/mark-read",
  },
  TABLE: {
    FETCH_TABLE_DATA: "/api/tableData",
    FETCH_COLUMN_STATUS: "/fetchColumnStatus",
    REQUEST_DATA: "/requestdata",
    FETCH_DROPDOWN_OPTIONS: "/fetchDropdownOptions",
    FETCH_COLUMN_DROPDOWN: "/fetchColumnDropDown",
  },
  CHECKER: {
    GET_REQUESTS: "/fetch-checker-request",
    GET_GROUP_REQUESTS: "/fetch-checker-group-request",
    GET_ALL_REQUESTS: "/getallcheckerrequest",
    APPROVE: "/approve",
    REJECT: "/reject",
    APPROVE_ALL: "/approveall",
    REJECT_ALL: "/rejectall",
    GET_RENAMED: "/renamed",
  },
};
