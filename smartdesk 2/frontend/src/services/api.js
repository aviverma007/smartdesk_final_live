// Frontend-only API using dataService
import dataService from './dataService';
import imageStorage from './imageStorage';

// Employee API endpoints - Frontend-only using dataService
export const employeeAPI = {
  // Get all employees with optional search and filters
  getAll: async (searchParams = {}) => {
    try {
      return await dataService.getEmployees(searchParams);
    } catch (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }
  },

  // Update employee profile image
  updateImage: async (employeeId, imageData) => {
    try {
      // Store image locally using imageStorage service
      const processedImage = await imageStorage.processAndStore(imageData, employeeId);
      return await dataService.updateEmployeeImage(employeeId, processedImage);
    } catch (error) {
      console.error('Error updating employee image:', error);
      throw error;
    }
  },

  // Upload employee profile image file
  uploadImage: async (employeeId, imageFile) => {
    try {
      // Convert file to base64 and store locally
      const imageData = await imageStorage.fileToDataURL(imageFile);
      return await this.updateImage(employeeId, imageData);
    } catch (error) {
      console.error('Error uploading employee image:', error);
      throw error;
    }
  }
};

// Hierarchy API endpoints - Frontend-only using dataService
export const hierarchyAPI = {
  // Get all hierarchy relationships
  getAll: async () => {
    try {
      return await dataService.getHierarchy();
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
      throw error;
    }
  },

  // Add new hierarchy relationship
  create: async (relationshipData) => {
    try {
      return await dataService.createHierarchy(relationshipData);
    } catch (error) {
      console.error('Error creating hierarchy:', error);
      throw error;
    }
  },

  // Remove hierarchy relationship
  remove: async (employeeId) => {
    try {
      return await dataService.deleteHierarchy(employeeId);
    } catch (error) {
      console.error('Error deleting hierarchy:', error);
      throw error;
    }
  },

  // Clear all hierarchy relationships
  clearAll: async () => {
    try {
      return await dataService.clearAllHierarchy();
    } catch (error) {
      console.error('Error clearing hierarchy:', error);
      throw error;
    }
  }
};

// Utility API endpoints - Frontend-only using dataService
export const utilityAPI = {
  // Refresh Excel data
  refreshExcel: async () => {
    try {
      // Reload all data from Excel files
      const result = await dataService.loadAllData();
      return { message: 'Excel data refreshed successfully', ...result };
    } catch (error) {
      console.error('Error refreshing Excel data:', error);
      throw error;
    }
  },

  // Get departments
  getDepartments: async () => {
    try {
      return await dataService.getDepartments();
    } catch (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }
  },

  // Get locations  
  getLocations: async () => {
    try {
      return await dataService.getLocations();
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  },

  // Get system statistics
  getStats: async () => {
    try {
      return await dataService.getStats();
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }
};

// News API endpoints - Frontend-only using dataService
export const newsAPI = {
  getAll: async () => {
    try {
      return await dataService.getNews();
    } catch (error) {
      console.error('Error fetching news:', error);
      throw error;
    }
  },

  create: async (newsData) => {
    try {
      return await dataService.createNews(newsData);
    } catch (error) {
      console.error('Error creating news:', error);
      throw error;
    }
  },

  update: async (id, newsData) => {
    try {
      return await dataService.updateNews(id, newsData);
    } catch (error) {
      console.error('Error updating news:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      return await dataService.deleteNews(id);
    } catch (error) {
      console.error('Error deleting news:', error);
      throw error;
    }
  }
};

// Task API endpoints - Frontend-only using dataService
export const taskAPI = {
  getAll: async () => {
    try {
      return await dataService.getTasks();
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  },

  create: async (taskData) => {
    try {
      return await dataService.createTask(taskData);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  update: async (id, taskData) => {
    try {
      return await dataService.updateTask(id, taskData);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      return await dataService.deleteTask(id);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }
};

// Knowledge API endpoints - Frontend-only using dataService
export const knowledgeAPI = {
  getAll: async () => {
    try {
      return await dataService.getKnowledge();
    } catch (error) {
      console.error('Error fetching knowledge:', error);
      throw error;
    }
  },

  create: async (knowledgeData) => {
    try {
      return await dataService.createKnowledge(knowledgeData);
    } catch (error) {
      console.error('Error creating knowledge:', error);
      throw error;
    }
  },

  update: async (id, knowledgeData) => {
    try {
      return await dataService.updateKnowledge(id, knowledgeData);
    } catch (error) {
      console.error('Error updating knowledge:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      return await dataService.deleteKnowledge(id);
    } catch (error) {
      console.error('Error deleting knowledge:', error);
      throw error;
    }
  }
};

// Help API endpoints - Frontend-only using dataService
export const helpAPI = {
  getAll: async () => {
    try {
      return await dataService.getHelp();
    } catch (error) {
      console.error('Error fetching help requests:', error);
      throw error;
    }
  },

  create: async (helpData) => {
    try {
      return await dataService.createHelp(helpData);
    } catch (error) {
      console.error('Error creating help request:', error);
      throw error;
    }
  },

  update: async (id, helpData) => {
    try {
      return await dataService.updateHelp(id, helpData);
    } catch (error) {
      console.error('Error updating help request:', error);
      throw error;
    }
  },

  addReply: async (id, replyData) => {
    try {
      return await dataService.addHelpReply(id, replyData);
    } catch (error) {
      console.error('Error adding reply:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      return await dataService.deleteHelp(id);
    } catch (error) {
      console.error('Error deleting help request:', error);
      throw error;
    }
  }
};

// Meeting Rooms API endpoints - Frontend-only using dataService
export const meetingRoomAPI = {
  getAll: async (filters = {}) => {
    try {
      return await dataService.getMeetingRooms(filters);
    } catch (error) {
      console.error('Error fetching meeting rooms:', error);
      throw error;
    }
  },

  getLocations: async () => {
    try {
      const rooms = await dataService.getMeetingRooms();
      const locations = [...new Set(rooms.map(room => room.location))];
      return locations;
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  },

  getFloors: async () => {
    try {
      const rooms = await dataService.getMeetingRooms();
      const floors = [...new Set(rooms.map(room => room.floor))];
      return floors;
    } catch (error) {
      console.error('Error fetching floors:', error);
      throw error;
    }
  },

  book: async (roomId, bookingData) => {
    try {
      return await dataService.bookMeetingRoom(roomId, bookingData);
    } catch (error) {
      console.error('Error booking meeting room:', error);
      throw error;
    }
  },

  cancelBooking: async (roomId, bookingId = null) => {
    try {
      return await dataService.cancelMeetingRoomBooking(roomId, bookingId);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      throw error;
    }
  },

  cancelSpecificBooking: async (roomId, bookingId) => {
    try {
      return await dataService.cancelMeetingRoomBooking(roomId, bookingId);
    } catch (error) {
      console.error('Error cancelling specific booking:', error);
      throw error;
    }
  },

  clearAllBookings: async () => {
    try {
      return await dataService.clearAllMeetingRoomBookings();
    } catch (error) {
      console.error('Error clearing all bookings:', error);
      throw error;
    }
  }
};

// Alerts API endpoints - Frontend-only using dataService
export const alertAPI = {
  getAll: async (targetAudience = 'all') => {
    try {
      const allAlerts = dataService.getAlerts();
      // Filter by target audience if specified
      if (targetAudience && targetAudience !== 'all') {
        return allAlerts.filter(alert => 
          alert.target_audience === 'all' || alert.target_audience === targetAudience
        );
      }
      return allAlerts;
    } catch (error) {
      console.error('Error fetching alerts:', error);
      throw error;
    }
  },

  create: async (alertData) => {
    try {
      return dataService.createAlert(alertData);
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  },

  update: async (alertId, alertData) => {
    try {
      return dataService.updateAlert(alertId, alertData);
    } catch (error) {
      console.error('Error updating alert:', error);
      throw error;
    }
  },

  delete: async (alertId) => {
    try {
      return dataService.deleteAlert(alertId);
    } catch (error) {
      console.error('Error deleting alert:', error);
      throw error;
    }
  }
};

// Attendance API endpoints - Frontend-only using dataService
export const attendanceAPI = {
  getAll: async (searchParams = {}) => {
    try {
      return await dataService.getAttendance(searchParams);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      throw error;
    }
  },

  create: async (attendanceData) => {
    try {
      return await dataService.createAttendance(attendanceData);
    } catch (error) {
      console.error('Error creating attendance:', error);
      throw error;
    }
  },

  update: async (id, attendanceData) => {
    try {
      // Note: dataService doesn't have updateAttendance method, 
      // so we'll find and update manually
      const attendance = dataService.attendance.find(a => a.id === id);
      if (!attendance) {
        throw new Error('Attendance record not found');
      }
      
      Object.assign(attendance, attendanceData, {
        updated_at: new Date().toISOString()
      });
      
      return attendance;
    } catch (error) {
      console.error('Error updating attendance:', error);
      throw error;
    }
  }
};

// Policies API endpoints - Frontend-only using dataService
export const policyAPI = {
  getAll: async () => {
    try {
      return await dataService.getPolicies();
    } catch (error) {
      console.error('Error fetching policies:', error);
      throw error;
    }
  },

  create: async (policyData) => {
    try {
      return await dataService.createPolicy(policyData);
    } catch (error) {
      console.error('Error creating policy:', error);
      throw error;
    }
  },

  update: async (id, policyData) => {
    try {
      // Find and update manually since dataService doesn't have updatePolicy
      const policy = dataService.policies.find(p => p.id === id);
      if (!policy) {
        throw new Error('Policy not found');
      }
      
      Object.assign(policy, policyData, {
        updated_at: new Date().toISOString()
      });
      
      return policy;
    } catch (error) {
      console.error('Error updating policy:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const index = dataService.policies.findIndex(p => p.id === id);
      if (index === -1) {
        throw new Error('Policy not found');
      }
      
      dataService.policies.splice(index, 1);
      return { message: 'Policy deleted successfully' };
    } catch (error) {
      console.error('Error deleting policy:', error);
      throw error;
    }
  }
};

// Workflows API endpoints - Frontend-only using dataService
export const workflowAPI = {
  getAll: async () => {
    try {
      return await dataService.getWorkflows();
    } catch (error) {
      console.error('Error fetching workflows:', error);
      throw error;
    }
  },

  create: async (workflowData) => {
    try {
      return await dataService.createWorkflow(workflowData);
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  },

  update: async (id, workflowData) => {
    try {
      // Find and update manually since dataService doesn't have updateWorkflow
      const workflow = dataService.workflows.find(w => w.id === id);
      if (!workflow) {
        throw new Error('Workflow not found');
      }
      
      Object.assign(workflow, workflowData, {
        updated_at: new Date().toISOString()
      });
      
      return workflow;
    } catch (error) {
      console.error('Error updating workflow:', error);
      throw error;
    }
  }
};

// Chat API endpoints (simplified for frontend-only mode)
export const chatAPI = {
  getHistory: async (sessionId) => {
    // Return empty history for frontend-only mode
    return [];
  },

  send: async (message, sessionId) => {
    // Return a mock response for frontend-only mode
    return {
      response: "I'm sorry, the AI chat feature is currently unavailable in frontend-only mode. Please use other features of the application.",
      sessionId: sessionId
    };
  },

  clearHistory: async (sessionId) => {
    // No-op for frontend-only mode
    return { message: 'Chat history cleared' };
  }
};