import React, { useState, useMemo, useEffect } from "react";
import { Users, Plus, Trash2, RotateCcw, Network, Table as TableIcon, Save, Shield, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { employeeAPI, hierarchyAPI } from "../services/api";
import HierarchyTree from "./HierarchyTree";
import HierarchyTable from "./HierarchyTable";
import SearchableSelect from "./ui/searchable-select";
import { toast } from "sonner";

const HierarchyBuilder = () => {
  const [hierarchyData, setHierarchyData] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const [viewMode, setViewMode] = useState("tree");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load all employees and hierarchy data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [employeeData, hierarchyDataFromAPI] = await Promise.all([
          employeeAPI.getAll(),
          hierarchyAPI.getAll()
        ]);
        
        setEmployees(employeeData);
        setHierarchyData(hierarchyDataFromAPI);
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Error loading employee and hierarchy data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Get available employees for dropdown with search-friendly format
  const availableEmployees = useMemo(() => {
    return employees.map(emp => ({
      value: emp.id,
      label: `${emp.name} (${emp.id}) - ${emp.department}`,
      searchValue: `${emp.name} ${emp.id} ${emp.department}`.toLowerCase()
    }));
  }, [employees]);

  // Get available managers (all employees can be managers)
  const availableManagers = availableEmployees;

  // Build hierarchy structure for visualization
  const hierarchyStructure = useMemo(() => {
    const empMap = new Map(employees.map(emp => [emp.id, emp]));
    const childrenMap = new Map();
    
    // Initialize children map
    employees.forEach(emp => {
      childrenMap.set(emp.id, []);
    });

    // Build children relationships from hierarchy data
    hierarchyData.forEach(rel => {
      const managerId = rel.reportsTo;
      if (childrenMap.has(managerId)) {
        const employee = empMap.get(rel.employeeId);
        if (employee) {
          childrenMap.get(managerId).push(employee);
        }
      }
    });

    // Find true root managers (those who don't report to anyone but have people in the hierarchy)
    const employeesInHierarchy = new Set();
    const managersInHierarchy = new Set();
    
    hierarchyData.forEach(rel => {
      employeesInHierarchy.add(rel.employeeId);
      managersInHierarchy.add(rel.reportsTo);
    });
    
    // Root managers are those who:
    // 1. Are managers in the hierarchy (have people reporting to them)
    // 2. Are NOT employees in the hierarchy (don't report to anyone themselves)
    const rootManagers = [...managersInHierarchy]
      .filter(managerId => !employeesInHierarchy.has(managerId))
      .map(managerId => empMap.get(managerId))
      .filter(Boolean);

    return { empMap, childrenMap, topLevel: rootManagers };
  }, [hierarchyData, employees]);

  const handleAddRelationship = async () => {
    if (!selectedEmployee || !selectedManager) {
      toast.error("Please select both employee and manager");
      return;
    }

    if (selectedEmployee === selectedManager) {
      toast.error("Employee cannot report to themselves");
      return;
    }

    // Check if relationship already exists
    const existingRelation = hierarchyData.find(rel => rel.employeeId === selectedEmployee);
    if (existingRelation) {
      toast.error("This employee already has a reporting manager");
      return;
    }

    try {
      // Create new relationship via API
      const newRelation = await hierarchyAPI.create({
        employeeId: selectedEmployee,
        reportsTo: selectedManager
      });

      // Update local state
      setHierarchyData(prev => [...prev, newRelation]);
      setSelectedEmployee("");
      setSelectedManager("");
      toast.success("Reporting relationship added successfully!");
    } catch (error) {
      console.error("Error adding relationship:", error);
      toast.error("Failed to add reporting relationship");
    }
  };

  const handleRemoveRelationship = async (employeeId) => {
    try {
      await hierarchyAPI.remove(employeeId);
      setHierarchyData(prev => prev.filter(rel => rel.employeeId !== employeeId));
      toast.success("Reporting relationship removed successfully!");
    } catch (error) {
      console.error("Error removing relationship:", error);
      toast.error("Failed to remove reporting relationship");
    }
  };

  const handleClearAll = async () => {
    try {
      await hierarchyAPI.clearAll();
      setHierarchyData([]);
      toast.success("All reporting relationships cleared successfully!");
    } catch (error) {
      console.error("Error clearing relationships:", error);
      toast.error("Failed to clear reporting relationships");
    }
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : employeeId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-600">Loading employee and hierarchy data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <Card className="border-blue-200 shadow-sm bg-white">
        <CardHeader className="pb-4 bg-blue-50">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2 text-blue-900">
              <Shield className="h-5 w-5" />
              <span>Hierarchy Builder</span>
            </CardTitle>
            
            <div className="flex space-x-2">
              <Button
                variant={viewMode === "tree" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("tree")}
                className={`flex items-center space-x-2 ${
                  viewMode === "tree" 
                    ? "bg-blue-600 hover:bg-blue-700" 
                    : "border-blue-200 text-blue-700 hover:bg-blue-50"
                }`}
              >
                <Network className="h-4 w-4" />
                <span>Box View</span>
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={`flex items-center space-x-2 ${
                  viewMode === "table" 
                    ? "bg-blue-600 hover:bg-blue-700" 
                    : "border-blue-200 text-blue-700 hover:bg-blue-50"
                }`}
              >
                <TableIcon className="h-4 w-4" />
                <span>Table View</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Add Relationship Form */}
      <Card className="border-blue-200 shadow-sm bg-white">
        <CardHeader className="bg-blue-50">
          <CardTitle className="text-lg text-blue-900">Add Reporting Relationship</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Select Employee */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-900">Select Employee</label>
              <SearchableSelect
                value={selectedEmployee}
                onValueChange={setSelectedEmployee}
                options={availableEmployees}
                placeholder="Choose employee..."
                searchPlaceholder="Search employees..."
                className="border-blue-200 focus:border-blue-400"
              />
            </div>

            {/* Select Manager */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-900">Reports To</label>
              <SearchableSelect
                value={selectedManager}
                onValueChange={setSelectedManager}
                options={availableManagers}
                placeholder="Choose manager..."
                searchPlaceholder="Search managers..."
                className="border-blue-200 focus:border-blue-400"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 items-end">
              <Button 
                onClick={handleAddRelationship} 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
              <Button 
                variant="outline" 
                onClick={handleClearAll}
                className="flex items-center space-x-2 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Clear All</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Relationships Summary */}
      <Card className="border-blue-200 shadow-sm bg-white">
        <CardHeader className="bg-blue-50">
          <CardTitle className="text-lg text-blue-900">Current Relationships ({hierarchyData.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {hierarchyData.length === 0 ? (
            <div className="text-center py-8 text-blue-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No reporting relationships defined yet.</p>
              <p className="text-sm">Add relationships above to build the organizational hierarchy.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {hierarchyData.map(rel => (
                <div key={rel.employeeId} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="space-y-1">
                    <p className="font-medium text-sm text-blue-900">{getEmployeeName(rel.employeeId)}</p>
                    <p className="text-xs text-blue-600">reports to {getEmployeeName(rel.reportsTo)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveRelationship(rel.employeeId)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hierarchy Visualization */}
      {hierarchyData.length > 0 && (
        <Card className="border-blue-200 shadow-sm bg-white">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-lg text-blue-900">
              {viewMode === "tree" ? "Organizational Structure" : "Hierarchy Table"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {viewMode === "tree" ? (
              <HierarchyTree hierarchyStructure={hierarchyStructure} />
            ) : (
              <HierarchyTable hierarchyData={hierarchyData} employees={employees} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HierarchyBuilder;