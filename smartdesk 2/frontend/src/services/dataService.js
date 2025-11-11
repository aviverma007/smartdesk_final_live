import * as XLSX from 'xlsx';

class DataService {
  constructor() {
    this.employees = [];
    this.attendance = [];
    this.hierarchy = [];
    this.departments = [];
    this.locations = [];
    this.news = [];
    this.tasks = [];
    this.knowledge = [];
    this.help = [];
    this.policies = [];
    this.workflows = [];
    this.meetingRooms = [];
    this.alerts = []; // Add alerts array
    this.isLoaded = false;
  }

  // Load Excel files and parse data
  async loadAllData() {
    try {
      console.log('Loading data from Excel files...');
      
      // Load employee data
      await this.loadEmployeeData();
      
      // Load attendance data
      await this.loadAttendanceData();
      
      // Initialize other data structures
      this.initializeOtherData();
      
      // Initialize demo alerts for testing
      this.initializeDemoAlerts();
      
      this.isLoaded = true;
      console.log('All data loaded successfully');
      
      return {
        employees: this.employees.length,
        attendance: this.attendance.length,
        departments: this.departments.length,
        locations: this.locations.length
      };
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }

  // Load employee data from Excel
  async loadEmployeeData() {
    try {
      const response = await fetch('/employee_directory.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      this.employees = jsonData.map(row => {
        // Convert mobile number safely
        const mobile = row['MOBILE'] ? String(row['MOBILE']) : '';
        
        // Convert extension safely
        const extension = row['EXTENSION NUMBER'] ? String(row['EXTENSION NUMBER']) : '0';
        
        // Handle reporting ID
        let reportingId = null;
        if (row['REPORTING ID'] && String(row['REPORTING ID']).trim() !== '') {
          reportingId = String(row['REPORTING ID']);
        }
        
        // Handle date of joining - Convert Excel serial number to date
        let dateJoining = '';
        if (row['DATE OF JOINING']) {
          try {
            const rawDate = row['DATE OF JOINING'];
            
            // If it's a number (Excel serial date), convert it
            if (typeof rawDate === 'number') {
              // Excel serial date: days since January 1, 1900
              // JavaScript Date: milliseconds since January 1, 1970
              // Excel epoch: January 1, 1900 (but Excel incorrectly treats 1900 as leap year)
              const excelEpoch = new Date(1900, 0, 1); // January 1, 1900
              const msPerDay = 24 * 60 * 60 * 1000;
              // Subtract 2 days to account for Excel's leap year bug and 0-indexing
              const jsDate = new Date(excelEpoch.getTime() + (rawDate - 2) * msPerDay);
              dateJoining = jsDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
            } 
            // If it's already a string, try to parse it
            else if (typeof rawDate === 'string') {
              const parsedDate = new Date(rawDate);
              if (!isNaN(parsedDate.getTime())) {
                dateJoining = parsedDate.toISOString().split('T')[0];
              } else {
                dateJoining = String(rawDate).split(' ')[0];
              }
            }
            // If it's a Date object
            else if (rawDate instanceof Date) {
              dateJoining = rawDate.toISOString().split('T')[0];
            }
            // Fallback
            else {
              dateJoining = String(rawDate);
            }
          } catch (error) {
            console.warn('Error parsing date for employee:', row['EMP NAME'], 'Raw date:', row['DATE OF JOINING']);
            dateJoining = String(row['DATE OF JOINING']);
          }
        }

        return {
          id: String(row['EMP ID']),
          name: String(row['EMP NAME'] || '').trim(),
          department: String(row['DEPARTMENT'] || '').trim(),
          grade: String(row['GRADE'] || '').trim(),
          reportingManager: row['REPORTING MANAGER'] ? String(row['REPORTING MANAGER']).trim() : '*',
          reportingId: reportingId,
          location: String(row['LOCATION'] || '').trim(),
          mobile: mobile,
          extension: extension,
          email: String(row['EMAIL ID'] || '').trim(),
          dateOfJoining: dateJoining,
          profileImage: '/api/placeholder/150/150'
        };
      });

      // Extract unique departments and locations
      this.departments = ['All Departments', ...new Set(this.employees.map(emp => emp.department).filter(dept => dept))];
      this.locations = ['All Locations', ...new Set(this.employees.map(emp => emp.location).filter(loc => loc))];

      console.log(`Loaded ${this.employees.length} employees`);
    } catch (error) {
      console.error('Error loading employee data:', error);
      throw error;
    }
  }

  // Load attendance data from Excel
  async loadAttendanceData() {
    try {
      const response = await fetch('/attendance_data.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      this.attendance = jsonData.map((row, index) => {
        // Parse dates and times
        const dateStr = String(row['date']);
        let dateFormatted = '';
        if (dateStr.includes('T')) {
          const dateObj = new Date(dateStr);
          dateFormatted = dateObj.toISOString().split('T')[0];
        } else {
          dateFormatted = dateStr.substring(0, 10);
        }

        // Parse punch in/out times
        let punchIn = null, punchOut = null;
        if (row['punch_in'] && String(row['punch_in']) !== 'nan') {
          punchIn = new Date(String(row['punch_in'])).toISOString();
        }
        if (row['punch_out'] && String(row['punch_out']) !== 'nan') {
          punchOut = new Date(String(row['punch_out'])).toISOString();
        }

        return {
          id: `att_${(index + 1).toString().padStart(4, '0')}`,
          employee_id: String(row['employee_id']),
          employee_name: String(row['employee_name']),
          date: dateFormatted,
          punch_in: punchIn,
          punch_out: punchOut,
          punch_in_location: row['punch_in_location'] ? String(row['punch_in_location']) : null,
          punch_out_location: row['punch_out_location'] ? String(row['punch_out_location']) : null,
          status: String(row['status']).toLowerCase(),
          total_hours: row['total_hours'] ? parseFloat(row['total_hours']) : 0.0,
          remarks: row['remarks'] && String(row['remarks']) !== 'nan' ? String(row['remarks']) : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      console.log(`Loaded ${this.attendance.length} attendance records`);
    } catch (error) {
      console.error('Error loading attendance data:', error);
      // If attendance file doesn't exist, create sample data
      this.attendance = this.generateSampleAttendance();
    }
  }

  // Initialize other data structures with sample data
  initializeOtherData() {
    // Initialize meeting rooms with persistence
    this.meetingRooms = this.generateMeetingRooms();
    
    // Initialize sample data for other modules
    this.news = [];
    this.tasks = [];
    this.knowledge = [];
    this.help = [];
    this.policies = this.generateSamplePolicies();
    this.workflows = [];
    
    // Update locations to include all meeting room locations
    const meetingRoomLocations = [...new Set(this.meetingRooms.map(room => room.location))];
    this.locations = [...new Set([...this.locations, ...meetingRoomLocations])];
  }

  // Generate sample attendance data if Excel file is not available
  generateSampleAttendance() {
    const sampleEmployees = this.employees.slice(0, 5);
    const attendance = [];
    const statuses = ['present', 'late', 'half_day'];
    const locations = ['IFC Office', 'Remote', 'Client Site'];

    // Generate last 7 days of data
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      if (date.getDay() !== 0 && date.getDay() !== 6) { // Skip weekends
        sampleEmployees.forEach((emp, j) => {
          const punchIn = new Date(date);
          punchIn.setHours(9, Math.floor(Math.random() * 30));
          
          const punchOut = new Date(date);
          punchOut.setHours(17, 30 + Math.floor(Math.random() * 30));

          attendance.push({
            id: `att_${(attendance.length + 1).toString().padStart(4, '0')}`,
            employee_id: emp.id,
            employee_name: emp.name,
            date: date.toISOString().split('T')[0],
            punch_in: punchIn.toISOString(),
            punch_out: punchOut.toISOString(),
            punch_in_location: locations[Math.floor(Math.random() * locations.length)],
            punch_out_location: locations[Math.floor(Math.random() * locations.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            total_hours: Math.round((punchOut - punchIn) / (1000 * 60 * 60) * 100) / 100,
            remarks: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        });
      }
    }

    return attendance;
  }

  // Generate meeting rooms data with persistence
  generateMeetingRooms() {
    // Try to load from localStorage first
    const savedRooms = this.loadMeetingRoomsFromStorage();
    if (savedRooms && savedRooms.length > 0) {
      console.log(`Loaded ${savedRooms.length} meeting rooms from storage`);
      return savedRooms;
    }
    
    // Create initial room structure
    const rooms = [
      // IFC 11th Floor - 1 room
      {
        id: "ifc-11-001",
        name: "IFC Conference Room 11A",
        location: "IFC",
        floor: "11th Floor",
        capacity: 10,
        amenities: "Projector, Whiteboard, Video Conference",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      
      // IFC 12th Floor - 1 room
      {
        id: "ifc-12-001", 
        name: "IFC Conference Room 12B",
        location: "IFC",
        floor: "12th Floor",
        capacity: 6,
        amenities: "Projector, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      
      // IFC 14th Floor - Multiple rooms (9 rooms as per test results)
      {
        id: "ifc-14-001",
        name: "OVAL MEETING ROOM",
        location: "IFC", 
        floor: "14th Floor",
        capacity: 10,
        amenities: "Projector, Video Conference, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "ifc-14-002",
        name: "PETRONAS MEETING ROOM",
        location: "IFC",
        floor: "14th Floor", 
        capacity: 5,
        amenities: "Projector, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "ifc-14-003",
        name: "GLOBAL CENTER MEETING ROOM",
        location: "IFC",
        floor: "14th Floor",
        capacity: 5,
        amenities: "Projector, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "ifc-14-004",
        name: "LOUVRE MEETING ROOM",
        location: "IFC",
        floor: "14th Floor",
        capacity: 5,
        amenities: "Projector, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "ifc-14-005",
        name: "GOLDEN GATE MEETING ROOM",
        location: "IFC",
        floor: "14th Floor",
        capacity: 10,
        amenities: "Projector, Video Conference, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "ifc-14-006",
        name: "EMPIRE STATE MEETING ROOM",
        location: "IFC",
        floor: "14th Floor",
        capacity: 5,
        amenities: "Projector, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "ifc-14-007",
        name: "MARINA BAY MEETING ROOM",
        location: "IFC",
        floor: "14th Floor",
        capacity: 5,
        amenities: "Projector, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "ifc-14-008",
        name: "BURJ MEETING ROOM",
        location: "IFC",
        floor: "14th Floor",
        capacity: 5,
        amenities: "Projector, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "ifc-14-009",
        name: "BOARD ROOM",
        location: "IFC",
        floor: "14th Floor",
        capacity: 20,
        amenities: "Projector, Video Conference, Whiteboard, Audio System",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      
      // Other locations - 1 room each on floor 1
      {
        id: "central-1-001",
        name: "Central Office Conference Room",
        location: "Central Office 75",
        floor: "1st Floor",
        capacity: 8,
        amenities: "Projector, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "office75-1-001",
        name: "Office 75 Meeting Room",
        location: "Office 75",
        floor: "1st Floor",
        capacity: 6,
        amenities: "Projector, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "noida-1-001",
        name: "Noida Conference Room",
        location: "Noida",
        floor: "1st Floor",
        capacity: 12,
        amenities: "Projector, Video Conference, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      },
      {
        id: "project-1-001",
        name: "Project Office Meeting Room",
        location: "Project Office",
        floor: "1st Floor",
        capacity: 8,
        amenities: "Projector, Whiteboard",
        status: "vacant",
        bookings: [],
        current_booking: null
      }
    ];
    
    // Save initial structure to storage
    this.saveMeetingRoomsToStorage(rooms);
    console.log(`Generated and saved ${rooms.length} meeting rooms`);
    return rooms;
  }

  // Load meeting rooms from localStorage
  loadMeetingRoomsFromStorage() {
    try {
      const saved = localStorage.getItem('meetingRooms_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clean up expired bookings on load
        this.cleanupExpiredBookings(parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading meeting rooms from storage:', error);
    }
    return null;
  }

  // Save meeting rooms to localStorage
  saveMeetingRoomsToStorage(rooms = null) {
    try {
      const roomsToSave = rooms || this.meetingRooms;
      localStorage.setItem('meetingRooms_data', JSON.stringify(roomsToSave));
      localStorage.setItem('meetingRooms_lastSaved', new Date().toISOString());
    } catch (error) {
      console.error('Error saving meeting rooms to storage:', error);
    }
  }

  // Clean up expired bookings
  cleanupExpiredBookings(rooms) {
    const now = new Date();
    rooms.forEach(room => {
      if (room.current_booking) {
        const endTime = new Date(room.current_booking.end_time);
        if (endTime < now) {
          room.status = 'vacant';
          room.current_booking = null;
          room.bookings = [];
        }
      }
    });
  }

  // Generate sample policies
  generateSamplePolicies() {
    return [
      {
        id: "policy_001",
        title: "Employee Code of Conduct",
        category: "hr",
        content: "Guidelines for professional behavior and conduct",
        effective_date: "2024-01-01",
        version: "1.0"
      },
      {
        id: "policy_002", 
        title: "IT Security Policy",
        category: "it",
        content: "Information technology security guidelines and procedures",
        effective_date: "2024-01-01",
        version: "1.0"
      }
    ];
  }

  // Employee API methods
  async getEmployees(searchParams = {}) {
    if (!this.isLoaded) await this.loadAllData();
    
    let filtered = [...this.employees];
    
    if (searchParams.search) {
      const search = searchParams.search.toLowerCase();
      filtered = filtered.filter(emp => 
        emp.name.toLowerCase().startsWith(search) ||
        emp.id.toLowerCase().startsWith(search) ||
        emp.department.toLowerCase().startsWith(search) ||
        emp.location.toLowerCase().startsWith(search) ||
        emp.grade.toLowerCase().startsWith(search) ||
        emp.mobile.startsWith(search)
      );
    }
    
    if (searchParams.department && searchParams.department !== 'All Departments') {
      filtered = filtered.filter(emp => emp.department === searchParams.department);
    }
    
    if (searchParams.location && searchParams.location !== 'All Locations') {
      filtered = filtered.filter(emp => emp.location === searchParams.location);
    }
    
    return filtered;
  }

  async updateEmployeeImage(employeeId, imageData) {
    if (!this.isLoaded) await this.loadAllData();
    
    const employee = this.employees.find(emp => emp.id === employeeId);
    if (employee) {
      employee.profileImage = imageData.profileImage || imageData;
      return employee;
    }
    throw new Error('Employee not found');
  }

  // Utility methods
  async getDepartments() {
    if (!this.isLoaded) await this.loadAllData();
    return this.departments;
  }

  async getLocations() {
    if (!this.isLoaded) await this.loadAllData();
    return this.locations;
  }

  async getStats() {
    if (!this.isLoaded) await this.loadAllData();
    
    return {
      database: {
        employees: this.employees.length,
        departments: this.departments.length - 1, // Exclude "All Departments"
        locations: this.locations.length - 1, // Exclude "All Locations"
        attendance_records: this.attendance.length,
        hierarchy_relations: this.hierarchy.length
      },
      excel: {
        total_employees: this.employees.length,
        departments_count: this.departments.length - 1,
        locations_count: this.locations.length - 1
      }
    };
  }

  // Hierarchy methods
  async getHierarchy() {
    return this.hierarchy;
  }

  async createHierarchy(relationshipData) {
    const newRelation = {
      id: `hier_${Date.now()}`,
      ...relationshipData,
      created_at: new Date().toISOString()
    };
    this.hierarchy.push(newRelation);
    return newRelation;
  }

  async deleteHierarchy(relationId) {
    const index = this.hierarchy.findIndex(h => h.id === relationId);
    if (index > -1) {
      this.hierarchy.splice(index, 1);
      return { message: 'Hierarchy relationship deleted' };
    }
    throw new Error('Hierarchy relationship not found');
  }

  async clearAllHierarchy() {
    this.hierarchy = [];
    return { message: 'All hierarchy relationships cleared' };
  }

  // News methods
  async getNews() {
    return this.news;
  }

  async createNews(newsData) {
    const newNews = {
      id: `news_${Date.now()}`,
      ...newsData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.news.unshift(newNews);
    return newNews;
  }

  async updateNews(id, newsData) {
    const index = this.news.findIndex(n => n.id === id);
    if (index > -1) {
      this.news[index] = {
        ...this.news[index],
        ...newsData,
        updated_at: new Date().toISOString()
      };
      return this.news[index];
    }
    throw new Error('News not found');
  }

  async deleteNews(id) {
    const index = this.news.findIndex(n => n.id === id);
    if (index > -1) {
      this.news.splice(index, 1);
      return { message: 'News deleted' };
    }
    throw new Error('News not found');
  }

  // Task methods
  async getTasks() {
    return this.tasks;
  }

  async createTask(taskData) {
    const newTask = {
      id: `task_${Date.now()}`,
      ...taskData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.tasks.unshift(newTask);
    return newTask;
  }

  async updateTask(id, taskData) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index > -1) {
      this.tasks[index] = {
        ...this.tasks[index],
        ...taskData,
        updated_at: new Date().toISOString()
      };
      return this.tasks[index];
    }
    throw new Error('Task not found');
  }

  async deleteTask(id) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index > -1) {
      this.tasks.splice(index, 1);
      return { message: 'Task deleted' };
    }
    throw new Error('Task not found');
  }

  // Knowledge methods
  async getKnowledge() {
    return this.knowledge;
  }

  async createKnowledge(knowledgeData) {
    const newKnowledge = {
      id: `knowledge_${Date.now()}`,
      ...knowledgeData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.knowledge.unshift(newKnowledge);
    return newKnowledge;
  }

  async updateKnowledge(id, knowledgeData) {
    const index = this.knowledge.findIndex(k => k.id === id);
    if (index > -1) {
      this.knowledge[index] = {
        ...this.knowledge[index],
        ...knowledgeData,
        updated_at: new Date().toISOString()
      };
      return this.knowledge[index];
    }
    throw new Error('Knowledge not found');
  }

  async deleteKnowledge(id) {
    const index = this.knowledge.findIndex(k => k.id === id);
    if (index > -1) {
      this.knowledge.splice(index, 1);
      return { message: 'Knowledge deleted' };
    }
    throw new Error('Knowledge not found');
  }

  // Help methods
  async getHelp() {
    return this.help;
  }

  async createHelp(helpData) {
    const newHelp = {
      id: `help_${Date.now()}`,
      ...helpData,
      replies: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.help.unshift(newHelp);
    return newHelp;
  }

  async updateHelp(id, helpData) {
    const index = this.help.findIndex(h => h.id === id);
    if (index > -1) {
      this.help[index] = {
        ...this.help[index],
        ...helpData,
        updated_at: new Date().toISOString()
      };
      return this.help[index];
    }
    throw new Error('Help request not found');
  }

  async addHelpReply(id, replyData) {
    const index = this.help.findIndex(h => h.id === id);
    if (index > -1) {
      const reply = {
        id: `reply_${Date.now()}`,
        ...replyData,
        created_at: new Date().toISOString()
      };
      this.help[index].replies.push(reply);
      this.help[index].updated_at = new Date().toISOString();
      return reply;
    }
    throw new Error('Help request not found');
  }

  async deleteHelp(id) {
    const index = this.help.findIndex(h => h.id === id);
    if (index > -1) {
      this.help.splice(index, 1);
      return { message: 'Help request deleted' };
    }
    throw new Error('Help request not found');
  }

  // Meeting Rooms methods
  async getMeetingRooms(filters = {}) {
    // Clean up expired bookings first
    this.cleanupExpiredBookings(this.meetingRooms);
    
    let filtered = [...this.meetingRooms];
    
    if (filters.location) {
      filtered = filtered.filter(room => room.location === filters.location);
    }
    
    if (filters.floor) {
      filtered = filtered.filter(room => room.floor === filters.floor);
    }
    
    if (filters.status) {
      filtered = filtered.filter(room => room.status === filters.status);
    }
    
    // Save any changes made by cleanup
    this.saveMeetingRoomsToStorage();
    
    return filtered;
  }

  async bookMeetingRoom(roomId, bookingData) {
    const room = this.meetingRooms.find(r => r.id === roomId);
    if (!room) {
      throw new Error('Meeting room not found');
    }

    // Check if room is already booked
    if (room.status === 'occupied') {
      throw new Error('Room is already booked. Multiple bookings are not allowed.');
    }

    // Validate booking times
    const startTime = new Date(bookingData.start_time);
    const endTime = new Date(bookingData.end_time);
    const now = new Date();

    if (startTime < now) {
      throw new Error('Cannot book a room for past time');
    }

    if (endTime <= startTime) {
      throw new Error('End time must be after start time');
    }

    const booking = {
      id: `booking_${Date.now()}`,
      ...bookingData,
      room_id: roomId,
      room_name: room.name,
      created_at: new Date().toISOString()
    };

    room.bookings = [booking];
    room.current_booking = booking;
    room.status = 'occupied';

    // Save to localStorage
    this.saveMeetingRoomsToStorage();

    console.log(`Room ${room.name} booked successfully for ${booking.employee_name}`);
    return booking;
  }

  async cancelMeetingRoomBooking(roomId, bookingId = null) {
    const room = this.meetingRooms.find(r => r.id === roomId);
    if (!room) {
      throw new Error('Meeting room not found');
    }

    if (room.status === 'vacant') {
      throw new Error('No booking found to cancel');
    }

    const roomName = room.name;
    const employeeName = room.current_booking ? room.current_booking.employee_name : 'Unknown';

    room.bookings = [];
    room.current_booking = null;
    room.status = 'vacant';

    // Save to localStorage
    this.saveMeetingRoomsToStorage();

    console.log(`Booking cancelled for ${roomName} (previously booked by ${employeeName})`);
    return { message: 'Booking cancelled successfully', room_name: roomName };
  }

  async clearAllMeetingRoomBookings() {
    let cancelledCount = 0;
    
    this.meetingRooms.forEach(room => {
      if (room.status === 'occupied') {
        cancelledCount++;
      }
      room.bookings = [];
      room.current_booking = null;
      room.status = 'vacant';
    });

    // Save to localStorage
    this.saveMeetingRoomsToStorage();

    console.log(`Cleared all bookings: ${cancelledCount} rooms were occupied, now all ${this.meetingRooms.length} rooms are vacant`);
    return { 
      message: 'All bookings cleared successfully',
      rooms_updated: this.meetingRooms.length,
      previously_occupied: cancelledCount
    };
  }

  // Attendance methods
  async getAttendance(searchParams = {}) {
    let filtered = [...this.attendance];
    
    if (searchParams.search) {
      const search = searchParams.search.toLowerCase();
      filtered = filtered.filter(att => 
        att.employee_name.toLowerCase().startsWith(search) ||
        att.employee_id.toLowerCase().startsWith(search)
      );
    }
    
    return filtered;
  }

  async createAttendance(attendanceData) {
    const newAttendance = {
      id: `att_${Date.now()}`,
      ...attendanceData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.attendance.unshift(newAttendance);
    return newAttendance;
  }

  // Policies methods
  async getPolicies() {
    return this.policies;
  }

  async createPolicy(policyData) {
    const newPolicy = {
      id: `policy_${Date.now()}`,
      ...policyData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.policies.unshift(newPolicy);
    return newPolicy;
  }

  // Workflows methods
  async getWorkflows() {
    return this.workflows;
  }

  async createWorkflow(workflowData) {
    const newWorkflow = {
      id: `workflow_${Date.now()}`,
      ...workflowData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.workflows.unshift(newWorkflow);
    return newWorkflow;
  }

  // ===== ALERTS MANAGEMENT =====
  
  // Get all alerts with backend-compatible format
  async getAlerts() {
    const now = new Date();
    return this.alerts.filter(alert => {
      // Filter out expired alerts
      if (alert.expires_at && new Date(alert.expires_at) < now) {
        return false;
      }
      return true;
    });
  }

  // Get active alerts (for user display)
  getActiveAlerts() {
    const now = new Date();
    return this.alerts.filter(alert => 
      alert.isActive && 
      (!alert.expires_at || new Date(alert.expires_at) > now)
    );
  }

  // Create a new alert (Admin only) - Backend-compatible format
  async createAlert(alertData) {
    const newAlert = {
      id: `alert_${Date.now()}`,
      title: alertData.title || 'Alert',
      message: alertData.message || '',
      type: alertData.type || 'general', // general, system, announcement
      priority: alertData.priority || 'medium', // low, medium, high, urgent
      target_audience: alertData.target_audience || 'all', // all, admin, user
      created_by: alertData.created_by || 'admin',
      expires_at: alertData.expires_at || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.alerts.unshift(newAlert);
    return newAlert;
  }

  // Update alert (Admin only)
  async updateAlert(alertId, alertData) {
    const alertIndex = this.alerts.findIndex(alert => alert.id === alertId);
    if (alertIndex === -1) {
      throw new Error('Alert not found');
    }

    this.alerts[alertIndex] = {
      ...this.alerts[alertIndex],
      ...alertData,
      updated_at: new Date().toISOString()
    };
    
    return this.alerts[alertIndex];
  }

  // Delete alert (Admin only)
  async deleteAlert(alertId) {
    const alertIndex = this.alerts.findIndex(alert => alert.id === alertId);
    if (alertIndex === -1) {
      throw new Error('Alert not found');
    }

    const deletedAlert = this.alerts.splice(alertIndex, 1)[0];
    return { message: 'Alert deleted successfully' };
  }

  // Toggle alert status (Admin only)
  toggleAlertStatus(alertId) {
    const alert = this.alerts.find(alert => alert.id === alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.isActive = !alert.isActive;
    alert.updated_at = new Date().toISOString();
    return alert;
  }

  // Initialize demo alerts for testing
  initializeDemoAlerts() {
    // Only add demo alerts if alerts array is empty
    if (this.alerts.length === 0) {
      const demoAlerts = [
        {
          id: 'alert_demo_1',
          title: 'Welcome to SmartWorld!',
          message: 'Welcome to the SmartWorld Employee Management System. We are excited to have you on board!',
          type: 'announcement',
          priority: 'high',
          target_audience: 'all',
          created_by: 'system',
          expires_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'alert_demo_2',
          title: 'System Updates',
          message: 'New features have been added to the system. Check out the enhanced employee directory and meeting room booking system.',
          type: 'system',
          priority: 'medium',
          target_audience: 'all',
          created_by: 'system',
          expires_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      this.alerts = demoAlerts;
      console.log('Demo alerts initialized:', this.alerts.length);
    }
  }
}

// Create singleton instance
const dataService = new DataService();

export default dataService;