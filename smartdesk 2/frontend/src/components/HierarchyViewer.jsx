import React, { useState, useMemo, useEffect } from "react";
import { Network, TableIcon, Eye, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { employeeAPI, hierarchyAPI } from "../services/api";
import HierarchyTree from "./HierarchyTree";
import HierarchyTable from "./HierarchyTable";
import { toast } from "sonner";

const HierarchyViewer = () => {
  const [hierarchyData, setHierarchyData] = useState([]);
  const [viewMode, setViewMode] = useState("tree");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

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
        toast.error("Error loading organizational hierarchy");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

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

    // Get managers who have direct reports
    const managersWithDirectReports = [...childrenMap.entries()]
      .filter(([managerId, children]) => children.length > 0)
      .map(([managerId]) => empMap.get(managerId))
      .filter(Boolean);

    return { empMap, childrenMap, topLevel: managersWithDirectReports };
  }, [hierarchyData, employees]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-600">Loading organizational hierarchy...</p>
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
              <Eye className="h-5 w-5" />
              <span>Organizational Hierarchy</span>
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
                <span>Cloud View</span>
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

      {/* Hierarchy Statistics */}
      <Card className="border-blue-200 shadow-sm bg-white">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="space-y-2">
              <div className="text-2xl font-bold text-blue-600">{employees.length}</div>
              <div className="text-sm text-blue-500">Total Employees</div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-blue-600">{hierarchyStructure.topLevel.length}</div>
              <div className="text-sm text-blue-500">Team Leaders</div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-blue-600">{hierarchyData.length}</div>
              <div className="text-sm text-blue-500">Reporting Relations</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hierarchy Visualization */}
      {hierarchyData.length > 0 ? (
        <Card className="border-blue-200 shadow-sm bg-white">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-lg text-blue-900">
              {viewMode === "tree" ? "Organizational Cloud Structure" : "Hierarchy Table"}
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
      ) : (
        <Card className="border-blue-200 shadow-sm bg-blue-50">
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-blue-400 opacity-50" />
            <h3 className="text-xl font-semibold text-blue-900 mb-2">No Hierarchy Structure</h3>
            <p className="text-blue-600">
              The organizational hierarchy has not been set up yet. 
              Please contact an administrator to configure reporting relationships.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HierarchyViewer;