import React, { useState, useMemo, useEffect } from "react";
import { Search, Grid3X3, List, User, X } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useAuth } from "../context/AuthContext";
import { employeeAPI, utilityAPI } from "../services/api";
import EmployeeCard from "./EmployeeCard";
import EmployeeList from "./EmployeeList";

const EmployeeDirectory = () => {
  const [nameSearch, setNameSearch] = useState("");
  const [employeeIdSearch, setEmployeeIdSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [designationSearch, setDesignationSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState({
    name: "",
    employeeId: "",
    department: "",
    designation: "",
    location: ""
  });
  const [viewMode, setViewMode] = useState("grid");
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const { isAdmin } = useAuth();

  // Load all data on mount
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        const [employeeData, depts, locs] = await Promise.all([
          employeeAPI.getAll(),
          utilityAPI.getDepartments(),
          utilityAPI.getLocations()
        ]);
        
        setEmployees(employeeData);
        setDepartments(depts);
        setLocations(locs);
      } catch (error) {
        console.error("Error loading data:", error);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, []);

  // Debounce search terms for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerms({
        name: nameSearch,
        employeeId: employeeIdSearch,
        department: departmentSearch,
        designation: designationSearch,
        location: locationSearch
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [nameSearch, employeeIdSearch, departmentSearch, designationSearch, locationSearch]);

  // Client-side filtering with "starts with" pattern - Admin sees all, User needs to search
  const filteredEmployees = useMemo(() => {
    const hasAnySearch = debouncedSearchTerms.name || debouncedSearchTerms.employeeId || 
                        debouncedSearchTerms.department || debouncedSearchTerms.designation || debouncedSearchTerms.location;
    
    // Admin sees all employees by default, User sees none until search
    if (!hasAnySearch) {
      return isAdmin() ? employees : [];
    }

    // Apply filtering when search terms are present using "starts with" pattern
    return employees.filter(employee => {
      const nameMatch = !debouncedSearchTerms.name || 
        employee.name.toLowerCase().startsWith(debouncedSearchTerms.name.toLowerCase());
      
      const idMatch = !debouncedSearchTerms.employeeId || 
        employee.id.toLowerCase().startsWith(debouncedSearchTerms.employeeId.toLowerCase());
      
      const deptMatch = !debouncedSearchTerms.department || 
        employee.department.toLowerCase().startsWith(debouncedSearchTerms.department.toLowerCase());

      const designationMatch = !debouncedSearchTerms.designation || 
        employee.grade.toLowerCase().startsWith(debouncedSearchTerms.designation.toLowerCase());
      
      const locationMatch = !debouncedSearchTerms.location || 
        employee.location.toLowerCase().startsWith(debouncedSearchTerms.location.toLowerCase());

      return nameMatch && idMatch && deptMatch && designationMatch && locationMatch;
    });
  }, [employees, debouncedSearchTerms]);

  const hasSearched = nameSearch || employeeIdSearch || departmentSearch || designationSearch || locationSearch;

  const handleImageUpdate = async (employeeId, imageData) => {
    try {
      let updatedEmployee;
      
      // Check if imageData is a File object (actual file upload)
      if (imageData instanceof File) {
        // Use file upload API for better handling of original images
        updatedEmployee = await employeeAPI.uploadImage(employeeId, imageData);
      } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
        // Handle base64 data (fallback)
        updatedEmployee = await employeeAPI.updateImage(employeeId, imageData);
      } else {
        throw new Error('Invalid image data format');
      }
      
      // Update local state with the response from backend
      setEmployees(prev => prev.map(emp => 
        emp.id === employeeId ? updatedEmployee : emp
      ));
      
      // Update selected employee if it's being viewed
      if (selectedEmployee && selectedEmployee.id === employeeId) {
        setSelectedEmployee(updatedEmployee);
      }
      
    } catch (error) {
      console.error("Error updating image:", error);
      throw error; // Re-throw so EmployeeCard can show error
    }
  };

  const handleEmployeeClick = (employee) => {
    setSelectedEmployee(employee);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedEmployee(null);
  };

  const clearAllSearches = () => {
    setNameSearch("");
    setEmployeeIdSearch("");
    setDepartmentSearch("");
    setDesignationSearch("");
    setLocationSearch("");
  };

  // Show loading only on initial data load
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-600">Loading employee directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bars */}
      <Card className="border-blue-200 shadow-sm bg-white">
        <CardHeader className="pb-4 bg-blue-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Name Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400 h-4 w-4" />
              <Input
                placeholder="Search by name..."
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                className="pl-10 h-11 border-blue-200 focus:border-blue-400"
              />
              {nameSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNameSearch("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-blue-100"
                >
                  <X className="h-4 w-4 text-blue-500" />
                </Button>
              )}
            </div>

            {/* Employee ID Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400 h-4 w-4" />
              <Input
                placeholder="Search by employee ID..."
                value={employeeIdSearch}
                onChange={(e) => setEmployeeIdSearch(e.target.value)}
                className="pl-10 h-11 border-blue-200 focus:border-blue-400"
              />
              {employeeIdSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmployeeIdSearch("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-blue-100"
                >
                  <X className="h-4 w-4 text-blue-500" />
                </Button>
              )}
            </div>

            {/* Department Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400 h-4 w-4" />
              <Input
                placeholder="Search by department..."
                value={departmentSearch}
                onChange={(e) => setDepartmentSearch(e.target.value)}
                className="pl-10 h-11 border-blue-200 focus:border-blue-400"
              />
              {departmentSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDepartmentSearch("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-blue-100"
                >
                  <X className="h-4 w-4 text-blue-500" />
                </Button>
              )}
            </div>

            {/* Designation Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400 h-4 w-4" />
              <Input
                placeholder="Search by designation..."
                value={designationSearch}
                onChange={(e) => setDesignationSearch(e.target.value)}
                className="pl-10 h-11 border-blue-200 focus:border-blue-400"
              />
              {designationSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDesignationSearch("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-blue-100"
                >
                  <X className="h-4 w-4 text-blue-500" />
                </Button>
              )}
            </div>

            {/* Location Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400 h-4 w-4" />
              <Input
                placeholder="Search by location..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="pl-10 h-11 border-blue-200 focus:border-blue-400"
              />
              {locationSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocationSearch("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-blue-100"
                >
                  <X className="h-4 w-4 text-blue-500" />
                </Button>
              )}
            </div>
          </div>

          {/* View Toggle and Clear Button */}
          <div className="flex justify-between items-center mt-4">
            <div className="flex space-x-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={`h-10 px-3 ${viewMode === "grid" ? "bg-blue-600 hover:bg-blue-700" : "border-blue-200 text-blue-700 hover:bg-blue-50"}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={`h-10 px-3 ${viewMode === "list" ? "bg-blue-600 hover:bg-blue-700" : "border-blue-200 text-blue-700 hover:bg-blue-50"}`}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {hasSearched && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllSearches}
                className="text-blue-600 hover:bg-blue-50"
              >
                Clear all searches
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Results Summary */}
      <div className="flex justify-between items-center">
        <Badge variant="secondary" className="px-3 py-1 bg-blue-100 text-blue-700">
          {hasSearched 
            ? `${filteredEmployees.length} of ${employees.length} employees matching search criteria`
            : `Showing all ${employees.length} employees`
          }
        </Badge>
      </div>

      {/* Employee Display */}
      {filteredEmployees.length > 0 ? (
        viewMode === "grid" ? (
          <EmployeeCard 
            employees={filteredEmployees} 
            onImageUpdate={handleImageUpdate}
            onEmployeeClick={handleEmployeeClick}
          />
        ) : (
          <EmployeeList 
            employees={filteredEmployees} 
            onImageUpdate={handleImageUpdate}
            onEmployeeClick={handleEmployeeClick}
          />
        )
      ) : (
        <Card className="p-8 text-center border-blue-200 bg-blue-50">
          <div className="text-blue-500">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              {hasSearched ? "No employees found" : "No employees available"}
            </h3>
            <p>
              {hasSearched
                ? "Try adjusting your search criteria."
                : "Employee directory is loading or empty."}
            </p>
          </div>
        </Card>
      )}

      {/* Employee Detail Modal - Updated to include reporting manager and remove joining date */}
      <Dialog open={showDetailModal} onOpenChange={closeDetailModal}>
        <DialogContent className="sm:max-w-2xl border-blue-200">
          <DialogHeader>
            <DialogTitle className="text-xl text-blue-900">Employee Details</DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="space-y-6">
              {/* Profile Section */}
              <div className="flex items-center space-x-6">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-200 to-blue-300 flex items-center justify-center">
                  {selectedEmployee.profileImage && selectedEmployee.profileImage !== "/api/placeholder/150/150" ? (
                    <img 
                      src={selectedEmployee.profileImage} 
                      alt={selectedEmployee.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <User className="h-12 w-12 text-blue-500" style={{display: selectedEmployee.profileImage && selectedEmployee.profileImage !== "/api/placeholder/150/150" ? 'none' : 'block'}} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-blue-900">{selectedEmployee.name}</h2>
                  <Badge variant="secondary" className="mt-1 bg-blue-100 text-blue-700">{selectedEmployee.id}</Badge>
                  <p className="text-lg text-blue-600 mt-2">{selectedEmployee.grade}</p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-xs text-blue-600">D</span>
                    </div>
                    <div>
                      <p className="text-sm text-blue-500">Department</p>
                      <p className="font-medium text-blue-900">{selectedEmployee.department}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-xs text-blue-600">L</span>
                    </div>
                    <div>
                      <p className="text-sm text-blue-500">Location</p>
                      <p className="font-medium text-blue-900">{selectedEmployee.location}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-xs text-blue-600">P</span>
                    </div>
                    <div>
                      <p className="text-sm text-blue-500">Mobile</p>
                      <p className="font-medium text-blue-900">{selectedEmployee.mobile}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-xs text-blue-600">E</span>
                    </div>
                    <div>
                      <p className="text-sm text-blue-500">Extension</p>
                      <p className="font-medium text-blue-900">{selectedEmployee.extension !== "0" ? selectedEmployee.extension : "Not Available"}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-xs text-blue-600">@</span>
                    </div>
                    <div>
                      <p className="text-sm text-blue-500">Email</p>
                      <p className="font-medium text-blue-900 text-sm">{selectedEmployee.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-xs text-blue-600">👤</span>
                    </div>
                    <div>
                      <p className="text-sm text-blue-500">Reporting Manager</p>
                      <p className="font-medium text-blue-900">
                        {selectedEmployee.reportingManager || 'Not Assigned'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeDirectory;