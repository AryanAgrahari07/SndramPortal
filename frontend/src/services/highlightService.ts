import { API_URL } from "../config/constants";

export interface CellHighlight {
  row_id: string;
  changed_fields: string[];
}

export const fetchHighlightedCells = async (
  tableName: string
): Promise<CellHighlight[]> => {
  try {
    const response = await fetch(`${API_URL}/highlight-cells`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ tableName }),
    });

    const data = await response.json();
    console.log("Highlight cells response:", data);

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch highlighted cells");
    }

    if (!data.success) {
      throw new Error(data.message || "Failed to fetch highlighted cells");
    }

    return data.data || [];
  } catch (error) {
    console.error("Error fetching highlighted cells:", error);
    throw error;
  }
};
