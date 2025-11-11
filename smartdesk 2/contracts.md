# Employee Directory & Hierarchy Builder - API Contracts

## Overview
This document defines the API contracts and integration plan for the Employee Directory and Hierarchy Builder system for SMARTWORLD DEVELOPERS Pvt. Ltd.

## Current Mock Data Structure
Located in `/app/frontend/src/mock.js`:
- `mockEmployees`: Array of employee objects with all required fields
- `mockHierarchy`: Array of reporting relationships  
- `departments` & `locations`: Filter options

## API Endpoints Required

### 1. Employee Management APIs

#### GET /api/employees
- **Purpose**: Fetch all employees with search and filter capabilities
- **Query Parameters**:
  - `search` (optional): Search term for name, id, department, location, designation, mobile
  - `department` (optional): Filter by department
  - `location` (optional): Filter by location
- **Response**: Array of employee objects
- **Mock Data**: Currently returns `mockEmployees` filtered by search/filter criteria

#### PUT /api/employees/{employee_id}/image
- **Purpose**: Update employee profile image (admin functionality)
- **Body**: `{ "imageUrl": "string" }`
- **Response**: Updated employee object
- **Current Mock**: Updates `profileImage` field in local state

#### POST /api/refresh-excel
- **Purpose**: Sync with Excel file data
- **Response**: `{ "message": "Data refreshed", "count": number }`
- **Implementation**: Parse Excel file and update employee database

### 2. Hierarchy Management APIs

#### GET /api/hierarchy
- **Purpose**: Fetch all reporting relationships
- **Response**: Array of hierarchy objects `{ employeeId, reportsTo }`
- **Mock Data**: Returns `mockHierarchy`

#### POST /api/hierarchy
- **Purpose**: Add new reporting relationship
- **Body**: `{ "employeeId": "string", "reportsTo": "string" }`
- **Response**: Created hierarchy relationship
- **Current Mock**: Adds to local `hierarchyData` state

#### DELETE /api/hierarchy/{employee_id}
- **Purpose**: Remove reporting relationship
- **Response**: Success message
- **Current Mock**: Removes from local `hierarchyData` state

#### DELETE /api/hierarchy/clear
- **Purpose**: Clear all reporting relationships
- **Response**: Success message
- **Current Mock**: Empties `hierarchyData` array

## Database Collections

### employees
```javascript
{
  _id: ObjectId,
  employeeId: "80002", // EMP ID from Excel
  name: "Vikas Malhotra", // EMP NAME
  department: "Human Resources", // DEPARTMENT
  grade: "President - Human Resource", // GRADE
  reportingManager: "*", // REPORTING MANAGER from Excel
  reportingId: null, // REPORTING ID from Excel
  location: "IFC", // LOCATION
  mobile: "9910698391", // MOBILE
  extension: "6606", // EXTENSION NUMBER
  email: "vikas.malhotra@smartworlddevelopers.com", // EMAIL ID
  dateOfJoining: ISODate("2021-02-01"), // DATE OF JOINING
  profileImage: "/api/placeholder/150/150", // Custom field for uploaded images
  lastUpdated: ISODate()
}
```

### hierarchy
```javascript
{
  _id: ObjectId,
  employeeId: "80024", // References employee
  reportsTo: "80006", // References manager employee
  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

## Frontend Integration Changes

### Files to Update After Backend Development:

1. **Remove Mock Dependencies**:
   - Remove `import { mockEmployees, mockHierarchy } from "../mock"`
   - Replace with API calls using axios

2. **EmployeeDirectory.jsx**:
   - Replace `useState(mockEmployees)` with `useEffect` API call to `/api/employees`
   - Update search/filter to use query parameters
   - Update `handleImageUpdate` to call PUT `/api/employees/{id}/image`

3. **HierarchyBuilder.jsx**:
   - Replace `useState(mockHierarchy)` with API call to `/api/hierarchy`
   - Update `handleAddRelationship` to POST `/api/hierarchy`
   - Update `handleRemoveRelationship` to DELETE `/api/hierarchy/{id}`
   - Update `handleClearAll` to DELETE `/api/hierarchy/clear`

4. **Header.jsx**:
   - Update `handleRefresh` to call POST `/api/refresh-excel`

## Excel File Integration

### Implementation Strategy:
1. **File Location**: Store Excel file in `/app/backend/data/employee_directory.xlsx`
2. **Parsing Logic**: Use `openpyxl` and `pandas` to read Excel data
3. **Sync Process**: 
   - Parse Excel file
   - Update/insert employee records in MongoDB
   - Maintain existing profile images and custom hierarchy relationships
   - Return count of updated records

### Excel Column Mapping:
- `EMP ID` → `employeeId`
- `EMP NAME` → `name`
- `DEPARTMENT` → `department`
- `GRADE` → `grade`
- `REPORTING MANAGER` → `reportingManager`
- `LOCATION` → `location`
- `MOBILE` → `mobile`
- `EXTENSION NUMBER` → `extension`
- `EMAIL ID` → `email`
- `DATE OF JOINING` → `dateOfJoining`
- `REPORTING ID` → `reportingId`

## Error Handling
- Invalid employee IDs
- Duplicate hierarchy relationships
- Missing required fields
- Excel file parsing errors
- Image URL validation

## Success Criteria
1. All employee data from Excel displays correctly in frontend
2. Search and filtering works across all fields
3. Profile image updates persist and display
4. Hierarchy relationships can be created, viewed, and deleted
5. Tree and table views render correctly with real data
6. Refresh button successfully syncs Excel data