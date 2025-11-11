import React from "react";
import { User, ArrowRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";

const HierarchyTable = ({ hierarchyData, employees }) => {
  // Create employee map for quick lookup
  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

  const getEmployeeInfo = (employeeId) => {
    return employeeMap.get(employeeId) || { id: employeeId, name: 'Unknown', department: 'Unknown', grade: 'Unknown' };
  };

  if (hierarchyData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No reporting relationships to display in table format.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-gray-100 border-gray-200">
          <TableHead className="text-gray-900">Employee</TableHead>
          <TableHead className="w-16 text-center text-gray-900">→</TableHead>
          <TableHead className="text-gray-900">Reports To</TableHead>
          <TableHead className="text-gray-900">Relationship</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hierarchyData.map((relation) => {
          const employee = getEmployeeInfo(relation.employeeId);
          const manager = getEmployeeInfo(relation.reportsTo);
          
          return (
            <TableRow key={relation.employeeId} className="hover:bg-gray-50 border-gray-100">
              <TableCell>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border border-gray-300">
                    {employee.profileImage && employee.profileImage !== "/api/placeholder/150/150" ? (
                      <img 
                        src={employee.profileImage} 
                        alt={employee.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <User className="h-4 w-4 text-gray-600" style={{display: employee.profileImage && employee.profileImage !== "/api/placeholder/150/150" ? 'none' : 'block'}} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{employee.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs border-gray-300 text-gray-700">{employee.id}</Badge>
                      <span className="text-xs text-gray-600">{employee.department}</span>
                    </div>
                    <p className="text-xs text-gray-500">{employee.grade}</p>
                  </div>
                </div>
              </TableCell>
              
              <TableCell className="text-center">
                <ArrowRight className="h-4 w-4 text-gray-400 mx-auto" />
              </TableCell>
              
              <TableCell>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border border-gray-300">
                    {manager.profileImage && manager.profileImage !== "/api/placeholder/150/150" ? (
                      <img 
                        src={manager.profileImage} 
                        alt={manager.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <User className="h-4 w-4 text-gray-600" style={{display: manager.profileImage && manager.profileImage !== "/api/placeholder/150/150" ? 'none' : 'block'}} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{manager.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs border-gray-300 text-gray-700">{manager.id}</Badge>
                      <span className="text-xs text-gray-600">{manager.department}</span>
                    </div>
                    <p className="text-xs text-gray-500">{manager.grade}</p>
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="text-sm">
                  <p className="text-gray-600">Direct Report</p>
                  <p className="text-xs text-gray-500">
                    {employee.department === manager.department ? 'Same Department' : 'Cross Department'}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default HierarchyTable;