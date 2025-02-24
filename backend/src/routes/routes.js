const express = require("express");
const router = express.Router();
const { verifyToken, authorize } = require("../middleware/auth.js");

// Import controllers
const {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
} = require("../controllers/users/users.js");
const {
  fetchChangeTrackerData,
} = require("../controllers/changeTrackerData/fetchChangeTrackerData.js");
const { requestData } = require("../controllers/requestData/requestData.js");
const { table } = require("../controllers/table/table.js");
const { approve } = require("../controllers/approve/approve.js");
const { reject } = require("../controllers/reject/reject.js");
const { tableData } = require("../controllers/tableData/tableData.js");
const {
  ColumnPermission,
} = require("../controllers/ColumnPermission/ColumnPermission.js");
const { fetchColumn } = require("../controllers/fetchColumn/fetchColumn.js");
const {
  fetchColumnDropDown,
} = require("../controllers/fetchColumnDropdown/fetchColumnDropdown.js");
const {
  updateColumnDropDown,
} = require("../controllers/updateColumnDropdown/updateColumnDropdown.js");
const {
  fetchColumnStatus,
} = require("../controllers/fetchColumnStatus/fetchColumnStatus.js");
const {
  fetchDropdownOptions,
} = require("../controllers/fetchDropdownOptions/fetchDropdownOptions.js");
const { addGroup } = require("../controllers/tablesGroup/tableGroup.js");
const { addTable } = require("../controllers/tablesGroup/tableGroup.js");
const { getGroupList } = require("../controllers/getGroupList/getGroupList.js");
const { removeGroup } = require("../controllers/removeGroup/removeGroup.js");
const { removeTable } = require("../controllers/removeTable/removeTable.js");
const {
  getAllCheckerRequest,
} = require("../controllers/getAllCheckerRequest/getAllCheckerRequest.js");
const { allApprove } = require("../controllers/approveAll/allApprove.js");
const { allReject } = require("../controllers/allReject/allReject.js");
const { addRow } = require("../controllers/addRow/addRow.js");
const {
  fetchRowRequest,
} = require("../controllers/fetchRowRequest/fetchRowRequest.js");
const { acceptRow } = require("../controllers/acceptRow/acceptRow.js");
const { rejectRow } = require("../controllers/rejectRow/rejectRow.js");
const { rejectAllRow } = require("../controllers/rejectAllRow/rejectAllRow.js");
const {
  acceptAllRow,
} = require("../controllers/approveAllRow/acceptAllRow.js");
const { isActive } = require("../controllers/isActive/isActive.js");
const {
  highlightCells,
} = require("../controllers/cellsHighlight/cellsHighlight.js");
const {
  getMakerNotification,
} = require("../controllers/makerNotification/makerNotification.js");
const {
  getCheckerNotification,
} = require("../controllers/checkerNotification/checkerNotification.js");
const {
  getAdminNotification,
} = require("../controllers/adminNotification/adminNotification.js");
const { sendOTP } = require("../controllers/sendOTP/sendOTP.js");
const { verifyOTP } = require("../controllers/verifyOTP/verifyOTP.js");
const {
  fetchCheckerRequest,
} = require("../controllers/checkerRequest/fetchCheckerRequest.js");
const {
  fetchCheckerGroupRequest,
} = require("../controllers/fetchCheckerGroupRequest/fetchCheckerGroupRequest.js");
const {
  renameTable,
  getRenamedTables,
} = require("../controllers/tableMetadata/tableMetadata.js");
const {
  deleteRenamedTable,
  updateRenamedTable,
} = require("../controllers/tableMetadata/tableMetadata.js");

const { getTableData } = require("../controllers/tableData/getTableData");
const { getUserEmails } = require("../controllers/userEmails/getUserEmails.js");
const {
  markNotificationsAsSeen,
} = require("../controllers/markNotificationsAsSeen/markNotificationsAsSeen.js");

router.post("/mark-notifications-seen", verifyToken, markNotificationsAsSeen);

// users email data
router.post("/users/emails", verifyToken, getUserEmails);

// table data routes
router.get("/api/tabledata/:tableName", verifyToken, getTableData);

// Public routes
router.post("/signup", verifyToken, authorize("admin"), createUser);

//opt auth endpoints
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);

// User management routes - Admin only
router.get("/users", verifyToken, getAllUsers);
router.get("/users/:id", verifyToken, getUserById);
router.put("/users/:id", verifyToken, authorize("admin"), updateUser);
router.post("/isactive", verifyToken, authorize("admin"), isActive);

// Data routes - Authenticated users
router.get("/fetchchangetrackerdata", verifyToken, fetchChangeTrackerData);
router.post("/requestdata", verifyToken, requestData);
router.get("/table", verifyToken, table);
router.get("/tableData/:name", verifyToken, tableData);

// Request management routes - Checker role
router.post("/approve", verifyToken, authorize("checker"), approve);
router.post("/reject", verifyToken, authorize("checker"), reject);

//column configuration routes
router.post("/columnPermission", verifyToken, ColumnPermission);
router.post("/fetchcolumn", verifyToken, fetchColumn);

//dropdown configuratuon routes
router.post("/fetchColumnDropDown", verifyToken, fetchColumnDropDown);
router.post("/updateColumnDropDown", verifyToken, updateColumnDropDown);
router.post("/fetchColumnStatus", verifyToken, fetchColumnStatus);
router.post("/fetchDropdownOptions", verifyToken, fetchDropdownOptions);

// group configuration routes
router.post("/addgroup", verifyToken, authorize("admin"), addGroup); //create group
router.post("/addtable", verifyToken, authorize("admin"), addTable); // add table inside of a group
router.get("/getgrouplist", verifyToken, getGroupList); //show all group and table list respectively
router.post("/removegroup", verifyToken, authorize("admin"), removeGroup);
router.post("/removetable", verifyToken, authorize("admin"), removeTable);

//checker logs
router.get(
  "/getallcheckerrequest",
  verifyToken,
  authorize("checker", "admin"),
  getAllCheckerRequest
);
router.post("/approveall", verifyToken, authorize("checker"), allApprove);
router.post("/rejectall", verifyToken, authorize("checker"), allReject);

//endpoint to handle add of rows
router.post("/addrow", verifyToken, authorize("maker"), addRow);
router.get("/fetchrowrequest", verifyToken, fetchRowRequest);
router.post("/acceptrow", verifyToken, acceptRow);
router.post("/rejectrow", verifyToken, rejectRow);
router.post("/rejectallrow", verifyToken, rejectAllRow);
router.post("/acceptallrow", verifyToken, acceptAllRow);

// Notification routes
router.get(
  "/maker-notification",
  verifyToken,
  authorize("maker"),
  getMakerNotification
);
router.get(
  "/checker-notification",
  verifyToken,
  authorize("checker"),
  getCheckerNotification
);
router.get(
  "/admin-notification",
  verifyToken,
  authorize("admin"),
  getAdminNotification
);

// Cell highlighting endpoint
router.post(
  "/highlight-cells",
  verifyToken,
  authorize("maker"),
  highlightCells
);

// Add this new route with the existing checker routes
router.get(
  "/fetch-checker-request",
  verifyToken,
  authorize("checker"),
  fetchCheckerRequest
);

router.get(
  "/fetch-checker-group-request",
  verifyToken,
  authorize("checker"),
  fetchCheckerGroupRequest
);

// Table metadata routes
router.post("/rename-tables", verifyToken, authorize("admin"), renameTable);
router.get("/get-renamed-tables", verifyToken, getRenamedTables);
router.delete(
  "/delete-renamed-tables/:id",
  verifyToken,
  authorize("admin"),
  deleteRenamedTable
);
router.put(
  "/update-renamed-tables/:id",
  verifyToken,
  authorize("admin"),
  updateRenamedTable
);

module.exports = router;

// POST /highlight-cells - Manages cell highlighting in tables for makers// GET /maker-notification - Gets notifications for maker role
// GET /checker-notification - Gets notifications for checker role
// GET /admin-notification - Gets notifications for admin role// POST /addrow - Adds a new row to a table (requires maker role)
// GET /fetchrowrequest - Gets pending row modification requests
// POST /acceptrow - Approves a row modification request
// POST /rejectrow - Rejects a row modification request
// POST /rejectallrow - Bulk rejects multiple row requests
// POST /acceptallrow - Bulk accepts multiple row requests// POST /addgroup - Creates a new table group
// POST /addtable - Adds a table to an existing group
// GET /getgrouplist - Lists all groups and their tables
// POST /removegroup - Deletes an existing group
// POST /removetable - Removes a table from a group// POST /columnPermission - Sets permissions for column access
// POST /fetchcolumn - Retrieves column configuration
// POST /fetchColumnDropDown - Gets dropdown configuration for columns
// POST /updateColumnDropDown - Updates dropdown settings for columns
// POST /fetchColumnStatus - Gets column status information
// POST /fetchDropdownOptions - Retrieves available dropdown options// POST /approve - Approves a pending data modification request
// POST /reject - Rejects a pending data modification request
// POST /approveall - Bulk approves multiple pending requests
// POST /rejectall - Bulk rejects multiple pending requests
// GET /getallcheckerrequest - Lists all pending checker requests// GET /fetchchangetrackerdata - Retrieves audit log of data changes
// POST /requestdata - Submits a request to modify data (maker role)
// GET /table - Retrieves list of available tables
// GET /tableData/:name - Fetches data from a specific table by name// POST /signup - Admin endpoint to create new users in the system
// POST /send-otp - Initiates OTP authentication by sending code to user
// POST /verify-otp - Validates OTP code entered by user to complete authentication
// GET /users - Lists all users in the system
// GET /users/:id - Retrieves specific user details by ID
// PUT /users/:id - Admin endpoint to update user information
// POST /isactive - Admin endpoint to toggle user account active status
