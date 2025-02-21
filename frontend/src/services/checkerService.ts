import axios from "axios";
import { API_URL, ENDPOINTS } from "@/config/constants";

export const fetchCheckerRequests = async (
  search = "",
  status = "all",
  startDate = "",
  endDate = "",
  page = 1,
  limit = 10
) => {
  const response = await axios.get(
    `${API_URL}${ENDPOINTS.CHECKER.GET_ALL_REQUESTS}`,
    {
      params: { search, status, startDate, endDate, page, limit},
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );
  return response.data;
};