import React, { useState, useEffect } from 'react';
import { Input } from './input';
import { Search, ChevronDown } from 'lucide-react';

const SearchableEmployeeDropdown = ({ 
  employees, 
  selectedEmployeeId, 
  onEmployeeSelect, 
  placeholder = "Search employee by name or ID...",
  className = "",
  required = false,
  showDepartment = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
  
  // Filter employees based on search term (search by name or ID)
  const filteredEmployees = employees.filter(employee => {
    const searchLower = searchTerm.toLowerCase();
    return (
      employee.name.toLowerCase().includes(searchLower) ||
      employee.id.toLowerCase().includes(searchLower) ||
      (employee.department && employee.department.toLowerCase().includes(searchLower))
    );
  }).slice(0, 100); // Limit to 100 results for performance
  
  const handleEmployeeClick = (employee) => {
    onEmployeeSelect(employee.id);
    setIsOpen(false);
    setSearchTerm('');
    setIsSearching(false);
  };
  
  const handleInputClick = () => {
    setIsOpen(true);
    // If there's a selected employee, start fresh search
    if (selectedEmployee && !isSearching) {
      setSearchTerm('');
      setIsSearching(true);
    }
  };
  
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsSearching(true);
    if (!isOpen) setIsOpen(true);
    
    // If user clears the search completely, reset selection
    if (value === '') {
      onEmployeeSelect('');
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
      setIsSearching(false);
    } else if (e.key === 'Enter' && filteredEmployees.length > 0) {
      e.preventDefault();
      handleEmployeeClick(filteredEmployees[0]);
    } else if (e.key === 'Backspace' && !isSearching && selectedEmployee) {
      // When user starts backspacing on a selected employee, switch to search mode
      setIsSearching(true);
      setSearchTerm('');
      onEmployeeSelect('');
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.employee-dropdown-container')) {
        setIsOpen(false);
        setSearchTerm('');
        setIsSearching(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Reset search state when selectedEmployeeId changes externally
  useEffect(() => {
    if (selectedEmployeeId && !isSearching) {
      setSearchTerm('');
    }
  }, [selectedEmployeeId, isSearching]);
  
  // Display value in input
  const displayValue = () => {
    if (isSearching || searchTerm) return searchTerm;
    if (selectedEmployee) return `${selectedEmployee.name} (${selectedEmployee.id})`;
    return '';
  };
  
  return (
    <div className={`employee-dropdown-container relative ${className}`}>
      <div className="relative">
        <Input
          type="text"
          value={displayValue()}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={handleInputClick}
          placeholder={placeholder}
          className="w-full pr-10 cursor-pointer"
          autoComplete="off"
          required={required}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
          <ChevronDown className="h-4 w-4 text-gray-400 ml-1" />
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
          {filteredEmployees.length > 0 ? (
            <>
              {searchTerm && (
                <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50">
                  Showing {filteredEmployees.length} result{filteredEmployees.length !== 1 ? 's' : ''}
                  {filteredEmployees.length === 100 && ' (limited to 100)'}
                </div>
              )}
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  onClick={() => handleEmployeeClick(employee)}
                  className={`px-3 py-3 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0 ${
                    selectedEmployeeId === employee.id ? 'bg-blue-100' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{employee.name}</div>
                      <div className="text-xs text-blue-600 font-mono">ID: {employee.id}</div>
                      {showDepartment && employee.department && (
                        <div className="text-xs text-gray-500 mt-1">{employee.department}</div>
                      )}
                      {employee.location && (
                        <div className="text-xs text-gray-400">{employee.location}</div>
                      )}
                    </div>
                    {employee.profileImage && (
                      <img
                        src={employee.profileImage}
                        alt={employee.name}
                        className="w-8 h-8 rounded-full object-cover ml-2"
                      />
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              {searchTerm ? (
                <div>
                  <div>No employees found for "{searchTerm}"</div>
                  <div className="text-xs mt-1">Try searching by name, ID, or department</div>
                </div>
              ) : (
                'No employees available'
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableEmployeeDropdown;