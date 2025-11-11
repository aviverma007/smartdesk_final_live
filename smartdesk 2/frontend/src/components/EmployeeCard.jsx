import React, { useState, useRef } from "react";
import { User, Camera, Upload, Eye } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const EmployeeCard = ({ employees, onImageUpdate, onEmployeeClick }) => {
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

  const handleImageSubmit = async () => {
    if (imageFile && selectedEmployee) {
      try {
        // Pass the actual File object for better original image handling
        await onImageUpdate(selectedEmployee.id, imageFile);
        toast.success("Profile image updated successfully!");
        setImageFile(null);
        setImagePreview("");
        setSelectedEmployee(null);
      } catch (error) {
        console.error("Error updating image:", error);
        toast.error("Failed to update profile image. Please try again.");
      }
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
      {employees.map((employee) => (
        <Card key={employee.id} className="hover:shadow-lg transition-all duration-300 border-blue-200 shadow-sm bg-white group cursor-pointer hover:border-blue-300">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col items-center space-y-3 sm:space-y-4">
              {/* Profile Image */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-200 to-blue-300 flex items-center justify-center">
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
                  <User className="h-8 w-8 text-blue-500" style={{display: employee.profileImage && employee.profileImage !== "/api/placeholder/150/150" ? 'none' : 'block'}} />
                </div>
                
                {isAdmin() && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full p-0 bg-blue-600 hover:bg-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
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
                          disabled={!imageFile}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Update Image
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {/* Employee Info - Updated Layout: Image → Emp ID → Name → Designation → Department */}
              <div className="text-center space-y-1" onClick={() => onEmployeeClick(employee)}>
                {/* Employee ID */}
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                  {employee.id}
                </Badge>
                
                {/* Employee Name */}
                <h3 className="font-semibold text-lg text-blue-900 hover:text-blue-600 transition-colors">{employee.name}</h3>
                
                {/* Designation (Grade) */}
                <p className="text-sm font-medium text-blue-800">{employee.grade}</p>
                
                {/* Department */}
                <p className="text-sm text-blue-600">{employee.department}</p>
                
                {/* View Details Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-2 text-blue-600 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEmployeeClick(employee);
                  }}
                >
                  <Eye className="h-4 w-4" />
                  <span>View Details</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default EmployeeCard;