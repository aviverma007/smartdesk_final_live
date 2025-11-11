import React, { useState, useRef } from "react";
import { User, Camera, Upload, Eye } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const EmployeeList = ({ employees, onImageUpdate, onEmployeeClick }) => {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const fileInputRef = useRef(null);
  const { isAdmin } = useAuth();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSubmit = () => {
    if (imagePreview && selectedEmployee) {
      onImageUpdate(selectedEmployee.id, imagePreview);
      toast.success("Profile image updated successfully!");
      setImageFile(null);
      setImagePreview("");
      setSelectedEmployee(null);
    }
  };

  const resetImageForm = () => {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (employees.length === 0) {
    return (
      <Card className="p-8 text-center border-blue-200 bg-blue-50">
        <div className="text-blue-500">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No employees found matching your criteria.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 shadow-sm bg-white">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-50 border-blue-200">
              <TableHead className="w-16 text-blue-900">Photo</TableHead>
              <TableHead className="text-blue-900">Employee</TableHead>
              <TableHead className="text-blue-900">Department</TableHead>
              <TableHead className="text-blue-900">Location</TableHead>
              <TableHead className="w-32 text-blue-900">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id} className="hover:bg-blue-50 cursor-pointer border-blue-100">
                <TableCell>
                  <div className="relative group">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-200 to-blue-300 flex items-center justify-center">
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
                      <User className="h-5 w-5 text-blue-500" style={{display: employee.profileImage && employee.profileImage !== "/api/placeholder/150/150" ? 'none' : 'block'}} />
                    </div>
                    
                    {isAdmin() && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 bg-blue-600 hover:bg-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployee(employee);
                              resetImageForm();
                            }}
                          >
                            <Camera className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md border-blue-200">
                          <DialogHeader>
                            <DialogTitle className="text-blue-900">Update Profile Image</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="image-file" className="text-blue-900">Select Image File</Label>
                              <Input
                                id="image-file"
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleFileChange}
                                className="border-blue-200 focus:border-blue-400"
                              />
                              <p className="text-xs text-blue-600">Supports JPG, PNG, GIF. Max size: 5MB</p>
                            </div>
                            
                            {imagePreview && (
                              <div className="space-y-2">
                                <Label className="text-blue-900">Preview:</Label>
                                <div className="w-20 h-20 rounded-full overflow-hidden bg-blue-100 mx-auto">
                                  <img 
                                    src={imagePreview} 
                                    alt="Preview" 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                            )}
                            
                            <Button 
                              onClick={handleImageSubmit} 
                              className="w-full bg-blue-600 hover:bg-blue-700"
                              disabled={!imagePreview}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Update Image
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </TableCell>
                
                <TableCell onClick={() => onEmployeeClick(employee)}>
                  <div>
                    <p className="font-semibold text-blue-900 hover:text-blue-600 transition-colors">{employee.name}</p>
                    <Badge variant="outline" className="text-xs mt-1 border-blue-200 text-blue-700">{employee.id}</Badge>
                  </div>
                </TableCell>
                
                <TableCell onClick={() => onEmployeeClick(employee)}>
                  <span className="text-sm text-blue-700">{employee.department}</span>
                </TableCell>
                
                <TableCell onClick={() => onEmployeeClick(employee)}>
                  <span className="text-sm text-blue-700">{employee.location}</span>
                </TableCell>
                
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEmployeeClick(employee);
                    }}
                    className="flex items-center space-x-2 text-blue-600 hover:bg-blue-50"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Details</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default EmployeeList;