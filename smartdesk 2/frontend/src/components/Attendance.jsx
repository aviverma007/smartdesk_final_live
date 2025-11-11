import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Search, Calendar, MapPin, Clock, User, Filter } from 'lucide-react';
import { attendanceAPI, employeeAPI } from '../services/api';

const Attendance = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20;

  useEffect(() => {
    fetchAttendance();
    fetchEmployees();
  }, []);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const searchParams = searchTerm ? { search: searchTerm } : {};
      const data = await attendanceAPI.getAll(searchParams);
      setAttendanceRecords(data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await employeeAPI.getAll();
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Filter records based on search and filters
  const filteredRecords = attendanceRecords.filter(record => {
    const matchesSearch = searchTerm === '' || 
      record.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    
    const matchesLocation = locationFilter === 'all' || 
      record.punch_in_location?.toLowerCase().includes(locationFilter.toLowerCase()) ||
      record.punch_out_location?.toLowerCase().includes(locationFilter.toLowerCase());
    
    const matchesDate = dateFilter === '' || record.date === dateFilter;
    
    return matchesSearch && matchesStatus && matchesLocation && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + recordsPerPage);

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      case 'half_day':
        return 'bg-orange-100 text-orange-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      return new Date(timeString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Invalid time';
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const getUniqueStatuses = () => {
    const statuses = [...new Set(attendanceRecords.map(record => record.status))];
    return statuses.filter(status => status);
  };

  const getUniqueLocations = () => {
    const locations = new Set();
    attendanceRecords.forEach(record => {
      if (record.punch_in_location) locations.add(record.punch_in_location);
      if (record.punch_out_location) locations.add(record.punch_out_location);
    });
    return Array.from(locations);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setLocationFilter('all');
    setDateFilter('');
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading attendance records...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
        <div className="text-sm text-gray-600">
          Attendance records are auto-synced from punch-in/out systems
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search employee name or ID"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full p-2 border rounded-md"
              >
                <option value="all">All Status</option>
                {getUniqueStatuses().map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <select
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full p-2 border rounded-md"
              >
                <option value="all">All Locations</option>
                {getUniqueLocations().map(location => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <User className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-bold">{filteredRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Present Today</p>
                <p className="text-2xl font-bold">
                  {filteredRecords.filter(r => 
                    r.status === 'present' && r.date === new Date().toISOString().split('T')[0]
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <MapPin className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Remote Work</p>
                <p className="text-2xl font-bold">
                  {filteredRecords.filter(r => 
                    r.punch_in_location === 'Remote' || r.punch_out_location === 'Remote'
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Late Arrivals</p>
                <p className="text-2xl font-bold">
                  {filteredRecords.filter(r => r.status === 'late').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Employee</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Punch In</th>
                  <th className="text-left p-2">Punch Out</th>
                  <th className="text-left p-2">Location</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Hours</th>
                  <th className="text-left p-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map(record => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{record.employee_name}</div>
                        <div className="text-gray-500 text-xs">{record.employee_id}</div>
                      </div>
                    </td>
                    <td className="p-2">{formatDate(record.date)}</td>
                    <td className="p-2">
                      <div>
                        <div>{formatTime(record.punch_in)}</div>
                        {record.punch_in_location && (
                          <div className="text-xs text-gray-500">{record.punch_in_location}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div>
                        <div>{formatTime(record.punch_out)}</div>
                        {record.punch_out_location && (
                          <div className="text-xs text-gray-500">{record.punch_out_location}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 text-gray-400 mr-1" />
                        {record.punch_in_location || 'N/A'}
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge className={getStatusColor(record.status)}>
                        {record.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 text-gray-400 mr-1" />
                        {record.total_hours ? `${record.total_hours}h` : 'N/A'}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="text-xs text-gray-500 max-w-20 truncate">
                        {record.remarks || '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-{Math.min(startIndex + recordsPerPage, filteredRecords.length)} of {filteredRecords.length} records
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 py-1 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {filteredRecords.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No attendance records found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No records match your current filter criteria.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Attendance;