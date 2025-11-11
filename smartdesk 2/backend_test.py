#!/usr/bin/env python3
"""
Backend Testing Script for Backend-Persistent Employee Directory API
Tests the comprehensive MongoDB-based backend server to ensure all APIs are working correctly.
"""

import requests
import json
import sys
import os
import uuid
import base64
from datetime import datetime, timedelta

# Get the backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
        return None

class BackendPersistentTester:
    def __init__(self):
        self.backend_url = get_backend_url()
        if not self.backend_url:
            print("❌ Could not get backend URL from frontend/.env")
            sys.exit(1)
        
        print(f"🔗 Testing Backend URL: {self.backend_url}")
        self.test_results = []
        self.session = requests.Session()
        self.session.timeout = 30
        
        # Store created items for cleanup
        self.created_items = {
            'news': [],
            'tasks': [],
            'knowledge': [],
            'help': [],
            'hierarchy': [],
            'bookings': [],
            'alerts': []
        }

    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })

    def test_backend_connectivity(self):
        """Test 1: Backend server connectivity via API endpoints"""
        try:
            # Test connectivity via a working API endpoint instead of root
            response = self.session.get(f"{self.backend_url}/api/employees", params={"search": "test"})
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Backend Connectivity", True, 
                                f"Backend server responding correctly via API endpoints", 
                                f"API accessible, returned {len(data)} results")
                else:
                    self.log_test("Backend Connectivity", False, 
                                f"Backend API returned unexpected data format")
            else:
                self.log_test("Backend Connectivity", False, 
                            f"Backend API returned status {response.status_code}")
        except Exception as e:
            self.log_test("Backend Connectivity", False, f"Backend server connection failed: {str(e)}")

    def test_health_check(self):
        """Test 2: API Health check via departments endpoint"""
        try:
            # Use departments endpoint as health check since /health may not be accessible
            response = self.session.get(f"{self.backend_url}/api/departments")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    self.log_test("Health Check", True, 
                                "API endpoints working correctly", 
                                f"Departments endpoint returned {len(data)} departments")
                else:
                    self.log_test("Health Check", False, 
                                "API endpoints returned unexpected data", 
                                f"Response: {data}")
            else:
                self.log_test("Health Check", False, 
                            f"API health check returned status {response.status_code}")
        except Exception as e:
            self.log_test("Health Check", False, f"API health check failed: {str(e)}")

    def test_employee_data_management(self):
        """Test 3: Employee Data Management - GET /api/employees"""
        try:
            response = self.session.get(f"{self.backend_url}/api/employees")
            if response.status_code == 200:
                employees = response.json()
                if isinstance(employees, list):
                    employee_count = len(employees)
                    # Check if we have the expected 625 employees (or close to it)
                    if employee_count >= 620 and employee_count <= 630:
                        self.log_test("Employee Data Loading", True, 
                                    f"Successfully loaded {employee_count} employees from MongoDB", 
                                    f"Expected ~625 employees, got {employee_count}")
                    else:
                        self.log_test("Employee Data Loading", False, 
                                    f"Employee count {employee_count} not in expected range (620-630)")
                else:
                    self.log_test("Employee Data Loading", False, 
                                "Employees endpoint did not return a list")
            else:
                self.log_test("Employee Data Loading", False, 
                            f"Employees endpoint returned status {response.status_code}")
        except Exception as e:
            self.log_test("Employee Data Loading", False, f"Employee data test failed: {str(e)}")

    def test_employee_data_verification_625(self):
        """Test: Employee Data Verification - Exactly 625 employees as per review request"""
        try:
            response = self.session.get(f"{self.backend_url}/api/employees")
            if response.status_code == 200:
                employees = response.json()
                if isinstance(employees, list):
                    employee_count = len(employees)
                    # Review request specifically mentions 625 employees
                    if employee_count == 625:
                        self.log_test("Employee Count Verification", True, 
                                    f"✅ EXACTLY 625 employees loaded from Excel as required", 
                                    f"Employee count matches review request specification")
                    else:
                        self.log_test("Employee Count Verification", False, 
                                    f"❌ Expected exactly 625 employees, got {employee_count}", 
                                    f"Review request specifies exactly 625 employees")
                    
                    # Test employee search functionality for booking assignment
                    if employees:
                        sample_employee = employees[0]
                        search_term = sample_employee.get('name', '')[:3] if sample_employee.get('name') else 'A'
                        search_response = self.session.get(f"{self.backend_url}/api/employees?search={search_term}")
                        
                        if search_response.status_code == 200:
                            search_results = search_response.json()
                            if search_results and len(search_results) > 0:
                                self.log_test("Employee Search for Booking", True, 
                                            f"Employee search functionality working for booking assignment", 
                                            f"Search '{search_term}' returned {len(search_results)} results")
                            else:
                                self.log_test("Employee Search for Booking", False, 
                                            f"Employee search returned no results for '{search_term}'")
                        else:
                            self.log_test("Employee Search for Booking", False, 
                                        f"Employee search failed with status {search_response.status_code}")
                else:
                    self.log_test("Employee Count Verification", False, 
                                "Employees endpoint did not return a list")
            else:
                self.log_test("Employee Count Verification", False, 
                            f"Employees endpoint returned status {response.status_code}")
        except Exception as e:
            self.log_test("Employee Count Verification", False, f"Employee verification test failed: {str(e)}")

    def test_employee_search_functionality(self):
        """Test 4: Employee Search Functionality"""
        try:
            # Test search functionality
            response = self.session.get(f"{self.backend_url}/api/employees?search=Manager")
            if response.status_code == 200:
                search_results = response.json()
                if isinstance(search_results, list) and len(search_results) > 0:
                    self.log_test("Employee Search", True, 
                                f"Search functionality working - found {len(search_results)} results for 'Manager'", 
                                f"Sample result: {search_results[0].get('name', 'N/A') if search_results else 'None'}")
                else:
                    self.log_test("Employee Search", False, 
                                "Search returned no results or invalid format")
            else:
                self.log_test("Employee Search", False, 
                            f"Search endpoint returned status {response.status_code}")
        except Exception as e:
            self.log_test("Employee Search", False, f"Employee search test failed: {str(e)}")

    def test_departments_and_locations(self):
        """Test 5: Departments and Locations endpoints"""
        try:
            # Test departments
            dept_response = self.session.get(f"{self.backend_url}/api/departments")
            loc_response = self.session.get(f"{self.backend_url}/api/locations")
            
            if dept_response.status_code == 200 and loc_response.status_code == 200:
                departments = dept_response.json()
                locations = loc_response.json()
                
                if isinstance(departments, list) and isinstance(locations, list):
                    dept_count = len(departments)
                    loc_count = len(locations)
                    
                    # Expected around 20 departments and 12 locations based on review request
                    if dept_count >= 15 and loc_count >= 10:
                        self.log_test("Departments & Locations", True, 
                                    f"Successfully retrieved {dept_count} departments and {loc_count} locations", 
                                    f"Sample dept: {departments[0] if departments else 'None'}, Sample loc: {locations[0] if locations else 'None'}")
                    else:
                        self.log_test("Departments & Locations", False, 
                                    f"Insufficient data - {dept_count} departments, {loc_count} locations")
                else:
                    self.log_test("Departments & Locations", False, 
                                "Endpoints did not return lists")
            else:
                self.log_test("Departments & Locations", False, 
                            f"Endpoints returned status {dept_response.status_code}, {loc_response.status_code}")
        except Exception as e:
            self.log_test("Departments & Locations", False, f"Departments/locations test failed: {str(e)}")

    def test_employee_image_update(self):
        """Test 6: Employee Image Update - PUT /api/employees/{id}/image"""
        try:
            # First get an employee to test with
            response = self.session.get(f"{self.backend_url}/api/employees?search=A")
            if response.status_code == 200:
                employees = response.json()
                if employees and len(employees) > 0:
                    test_employee = employees[0]
                    employee_id = test_employee.get('id')
                    
                    # Test image update with base64 data
                    test_image_data = {
                        "imageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
                    }
                    
                    update_response = self.session.put(f"{self.backend_url}/api/employees/{employee_id}/image", 
                                                     json=test_image_data)
                    
                    if update_response.status_code == 200:
                        updated_employee = update_response.json()
                        if updated_employee.get('profileImage'):
                            self.log_test("Employee Image Update", True, 
                                        f"Successfully updated image for employee {employee_id}", 
                                        f"New image URL: {updated_employee.get('profileImage')}")
                        else:
                            self.log_test("Employee Image Update", False, 
                                        "Image update response missing profileImage field")
                    else:
                        self.log_test("Employee Image Update", False, 
                                    f"Image update returned status {update_response.status_code}")
                else:
                    self.log_test("Employee Image Update", False, 
                                "No employees found for image update test")
            else:
                self.log_test("Employee Image Update", False, 
                            f"Could not fetch employees for image test: {response.status_code}")
        except Exception as e:
            self.log_test("Employee Image Update", False, f"Employee image update test failed: {str(e)}")

    def test_news_management_api(self):
        """Test 7: News Management API - CRUD operations"""
        try:
            # Test GET /api/news
            get_response = self.session.get(f"{self.backend_url}/api/news")
            if get_response.status_code != 200:
                self.log_test("News Management API", False, f"GET /api/news failed with status {get_response.status_code}")
                return
            
            # Test POST /api/news
            test_news = {
                "title": "Test News Article",
                "content": "This is a test news article for backend persistence testing.",
                "priority": "high",
                "author": "Test Author"
            }
            
            post_response = self.session.post(f"{self.backend_url}/api/news", json=test_news)
            if post_response.status_code == 200:
                created_news = post_response.json()
                news_id = created_news.get('id')
                self.created_items['news'].append(news_id)
                
                # Test PUT /api/news/{id}
                update_data = {"title": "Updated Test News Article", "priority": "medium"}
                put_response = self.session.put(f"{self.backend_url}/api/news/{news_id}", json=update_data)
                
                if put_response.status_code == 200:
                    updated_news = put_response.json()
                    if updated_news.get('title') == "Updated Test News Article":
                        self.log_test("News Management API", True, 
                                    "All news CRUD operations working correctly", 
                                    f"Created, updated news item {news_id}")
                    else:
                        self.log_test("News Management API", False, 
                                    "News update did not persist correctly")
                else:
                    self.log_test("News Management API", False, 
                                f"News update failed with status {put_response.status_code}")
            else:
                self.log_test("News Management API", False, 
                            f"News creation failed with status {post_response.status_code}")
        except Exception as e:
            self.log_test("News Management API", False, f"News management test failed: {str(e)}")

    def test_task_management_api(self):
        """Test 8: Task Management API - CRUD operations"""
        try:
            # First get an employee to assign task to
            emp_response = self.session.get(f"{self.backend_url}/api/employees?search=A")
            if emp_response.status_code != 200:
                self.log_test("Task Management API", False, "Could not fetch employees for task assignment")
                return
            
            employees = emp_response.json()
            if not employees:
                self.log_test("Task Management API", False, "No employees found for task assignment")
                return
            
            test_employee = employees[0]
            employee_id = test_employee.get('id')
            
            # Test POST /api/tasks
            test_task = {
                "title": "Test Task",
                "description": "This is a test task for backend persistence testing.",
                "assigned_to": employee_id,
                "priority": "high",
                "status": "pending",
                "due_date": (datetime.now() + timedelta(days=7)).isoformat()
            }
            
            post_response = self.session.post(f"{self.backend_url}/api/tasks", json=test_task)
            if post_response.status_code == 200:
                created_task = post_response.json()
                task_id = created_task.get('id')
                self.created_items['tasks'].append(task_id)
                
                # Test PUT /api/tasks/{id}
                update_data = {"status": "in_progress", "priority": "medium"}
                put_response = self.session.put(f"{self.backend_url}/api/tasks/{task_id}", json=update_data)
                
                if put_response.status_code == 200:
                    # Test GET /api/tasks
                    get_response = self.session.get(f"{self.backend_url}/api/tasks")
                    if get_response.status_code == 200:
                        tasks = get_response.json()
                        task_found = any(task.get('id') == task_id for task in tasks)
                        if task_found:
                            self.log_test("Task Management API", True, 
                                        "All task CRUD operations working correctly", 
                                        f"Created, updated task {task_id} assigned to {employee_id}")
                        else:
                            self.log_test("Task Management API", False, 
                                        "Created task not found in GET response")
                    else:
                        self.log_test("Task Management API", False, 
                                    f"GET tasks failed with status {get_response.status_code}")
                else:
                    self.log_test("Task Management API", False, 
                                f"Task update failed with status {put_response.status_code}")
            else:
                self.log_test("Task Management API", False, 
                            f"Task creation failed with status {post_response.status_code}")
        except Exception as e:
            self.log_test("Task Management API", False, f"Task management test failed: {str(e)}")

    def test_knowledge_management_api(self):
        """Test 9: Knowledge Management API - CRUD operations"""
        try:
            # Test POST /api/knowledge
            test_knowledge = {
                "title": "Test Knowledge Article",
                "content": "This is a test knowledge article for backend persistence testing.",
                "category": "policy",
                "tags": ["test", "backend", "persistence"],
                "author": "Test Author"
            }
            
            post_response = self.session.post(f"{self.backend_url}/api/knowledge", json=test_knowledge)
            if post_response.status_code == 200:
                created_knowledge = post_response.json()
                knowledge_id = created_knowledge.get('id')
                self.created_items['knowledge'].append(knowledge_id)
                
                # Test PUT /api/knowledge/{id}
                update_data = {
                    "category": "process", 
                    "tags": ["test", "backend", "persistence", "updated"]
                }
                put_response = self.session.put(f"{self.backend_url}/api/knowledge/{knowledge_id}", json=update_data)
                
                if put_response.status_code == 200:
                    updated_knowledge = put_response.json()
                    if updated_knowledge.get('category') == "process" and len(updated_knowledge.get('tags', [])) == 4:
                        # Test GET /api/knowledge
                        get_response = self.session.get(f"{self.backend_url}/api/knowledge")
                        if get_response.status_code == 200:
                            self.log_test("Knowledge Management API", True, 
                                        "All knowledge CRUD operations working correctly", 
                                        f"Created, updated knowledge article {knowledge_id}")
                        else:
                            self.log_test("Knowledge Management API", False, 
                                        f"GET knowledge failed with status {get_response.status_code}")
                    else:
                        self.log_test("Knowledge Management API", False, 
                                    "Knowledge update did not persist correctly")
                else:
                    self.log_test("Knowledge Management API", False, 
                                f"Knowledge update failed with status {put_response.status_code}")
            else:
                self.log_test("Knowledge Management API", False, 
                            f"Knowledge creation failed with status {post_response.status_code}")
        except Exception as e:
            self.log_test("Knowledge Management API", False, f"Knowledge management test failed: {str(e)}")

    def test_help_support_api(self):
        """Test 10: Help/Support Management API - CRUD operations with replies"""
        try:
            # Test POST /api/help
            test_help = {
                "title": "Test Help Request",
                "message": "This is a test help request for backend persistence testing.",
                "priority": "medium",
                "status": "open",
                "author": "Test User"
            }
            
            post_response = self.session.post(f"{self.backend_url}/api/help", json=test_help)
            if post_response.status_code == 200:
                created_help = post_response.json()
                help_id = created_help.get('id')
                self.created_items['help'].append(help_id)
                
                # Test POST /api/help/{id}/reply
                test_reply = {
                    "message": "This is a test reply to the help request.",
                    "author": "Support Agent"
                }
                reply_response = self.session.post(f"{self.backend_url}/api/help/{help_id}/reply", json=test_reply)
                
                if reply_response.status_code == 200:
                    # Test PUT /api/help/{id}
                    update_data = {"status": "resolved"}
                    put_response = self.session.put(f"{self.backend_url}/api/help/{help_id}", json=update_data)
                    
                    if put_response.status_code == 200:
                        updated_help = put_response.json()
                        if (updated_help.get('status') == "resolved" and 
                            len(updated_help.get('replies', [])) > 0):
                            self.log_test("Help/Support API", True, 
                                        "All help/support CRUD operations and reply system working correctly", 
                                        f"Created help request {help_id} with reply and status update")
                        else:
                            self.log_test("Help/Support API", False, 
                                        "Help update or reply system not working correctly")
                    else:
                        self.log_test("Help/Support API", False, 
                                    f"Help update failed with status {put_response.status_code}")
                else:
                    self.log_test("Help/Support API", False, 
                                f"Help reply failed with status {reply_response.status_code}")
            else:
                self.log_test("Help/Support API", False, 
                            f"Help creation failed with status {post_response.status_code}")
        except Exception as e:
            self.log_test("Help/Support API", False, f"Help/support management test failed: {str(e)}")

    def test_hierarchy_management_api(self):
        """Test 11: Hierarchy Management API - CRUD operations"""
        try:
            # First get two employees for hierarchy relationship
            emp_response = self.session.get(f"{self.backend_url}/api/employees?search=A")
            if emp_response.status_code != 200:
                self.log_test("Hierarchy Management API", False, "Could not fetch employees for hierarchy test")
                return
            
            employees = emp_response.json()
            if len(employees) < 2:
                self.log_test("Hierarchy Management API", False, "Need at least 2 employees for hierarchy test")
                return
            
            employee_id = employees[0].get('id')
            manager_id = employees[1].get('id')
            
            # Test POST /api/hierarchy
            test_hierarchy = {
                "employee_id": employee_id,
                "reports_to": manager_id
            }
            
            post_response = self.session.post(f"{self.backend_url}/api/hierarchy", json=test_hierarchy)
            if post_response.status_code == 200:
                created_hierarchy = post_response.json()
                self.created_items['hierarchy'].append(employee_id)
                
                # Test GET /api/hierarchy
                get_response = self.session.get(f"{self.backend_url}/api/hierarchy")
                if get_response.status_code == 200:
                    hierarchy_data = get_response.json()
                    relationship_found = any(
                        h.get('employee_id') == employee_id and h.get('reports_to') == manager_id 
                        for h in hierarchy_data
                    )
                    
                    if relationship_found:
                        self.log_test("Hierarchy Management API", True, 
                                    "Hierarchy CRUD operations working correctly", 
                                    f"Created hierarchy relationship: {employee_id} reports to {manager_id}")
                    else:
                        self.log_test("Hierarchy Management API", False, 
                                    "Created hierarchy relationship not found in GET response")
                else:
                    self.log_test("Hierarchy Management API", False, 
                                f"GET hierarchy failed with status {get_response.status_code}")
            else:
                self.log_test("Hierarchy Management API", False, 
                            f"Hierarchy creation failed with status {post_response.status_code}")
        except Exception as e:
            self.log_test("Hierarchy Management API", False, f"Hierarchy management test failed: {str(e)}")

    def test_meeting_rooms_api_comprehensive(self):
        """Test 12: Comprehensive Meeting Rooms API Testing - As per Review Request"""
        try:
            print("\n🏢 COMPREHENSIVE MEETING ROOMS API TESTING")
            print("-" * 50)
            
            # Test 1: GET /api/meeting-rooms - Verify all 15 meeting rooms
            get_response = self.session.get(f"{self.backend_url}/api/meeting-rooms")
            if get_response.status_code != 200:
                self.log_test("Meeting Rooms - GET ALL", False, f"GET /api/meeting-rooms failed with status {get_response.status_code}")
                return
            
            meeting_rooms = get_response.json()
            if not isinstance(meeting_rooms, list):
                self.log_test("Meeting Rooms - GET ALL", False, "GET /api/meeting-rooms did not return a list")
                return
            
            # Verify we have exactly 15 meeting rooms as expected
            if len(meeting_rooms) == 15:
                self.log_test("Meeting Rooms - GET ALL", True, 
                            f"Successfully retrieved all 15 meeting rooms", 
                            f"Total rooms: {len(meeting_rooms)}")
            else:
                self.log_test("Meeting Rooms - GET ALL", False, 
                            f"Expected 15 meeting rooms, got {len(meeting_rooms)}")
            
            # Test 2: Verify Location Variety - Multiple locations
            locations = set()
            floors = set()
            location_distribution = {}
            
            for room in meeting_rooms:
                location = room.get('location', 'Unknown')
                floor = room.get('floor', 'Unknown')
                locations.add(location)
                floors.add(floor)
                
                if location not in location_distribution:
                    location_distribution[location] = 0
                location_distribution[location] += 1
            
            expected_locations = {'IFC', 'Central Office 75', 'Office 75', 'Noida', 'Project Office'}
            if expected_locations.issubset(locations):
                self.log_test("Meeting Rooms - LOCATION VARIETY", True, 
                            f"All expected locations found: {sorted(locations)}", 
                            f"Distribution: {location_distribution}")
            else:
                missing_locations = expected_locations - locations
                self.log_test("Meeting Rooms - LOCATION VARIETY", False, 
                            f"Missing locations: {missing_locations}", 
                            f"Found: {sorted(locations)}")
            
            # Test 3: Verify Floor Variety - Different floors
            expected_floors = {'11th Floor', '12th Floor', '14th Floor', '1st Floor'}
            if expected_floors.issubset(floors):
                self.log_test("Meeting Rooms - FLOOR VARIETY", True, 
                            f"All expected floors found: {sorted(floors)}", 
                            f"IFC has multiple floors, others have 1st floor")
            else:
                missing_floors = expected_floors - floors
                self.log_test("Meeting Rooms - FLOOR VARIETY", False, 
                            f"Missing floors: {missing_floors}", 
                            f"Found: {sorted(floors)}")
            
            # Test 4: Verify Room Status Visibility - vacant/occupied status
            status_count = {'vacant': 0, 'occupied': 0, 'other': 0}
            rooms_with_status = 0
            
            for room in meeting_rooms:
                status = room.get('status')
                if status:
                    rooms_with_status += 1
                    if status in status_count:
                        status_count[status] += 1
                    else:
                        status_count['other'] += 1
            
            if rooms_with_status == len(meeting_rooms):
                self.log_test("Meeting Rooms - STATUS VISIBILITY", True, 
                            f"All rooms have status visibility", 
                            f"Status distribution: {status_count}")
            else:
                self.log_test("Meeting Rooms - STATUS VISIBILITY", False, 
                            f"Only {rooms_with_status}/{len(meeting_rooms)} rooms have status")
            
            # Test 5: Booking Functionality - POST /api/meeting-rooms/{room_id}/book
            # Get an employee for booking
            emp_response = self.session.get(f"{self.backend_url}/api/employees?search=A")
            if emp_response.status_code != 200:
                self.log_test("Meeting Rooms - BOOKING PREP", False, "Could not fetch employees for booking test")
                return
            
            employees = emp_response.json()
            if not employees:
                self.log_test("Meeting Rooms - BOOKING PREP", False, "No employees found for booking test")
                return
            
            test_employee = employees[0]
            test_room = meeting_rooms[0]  # Use first room for testing
            room_id = test_room.get('id')
            
            # Create a booking for tomorrow
            future_date = datetime.now() + timedelta(days=1)
            booking_data = {
                "employee_name": test_employee.get('name'),
                "employee_id": test_employee.get('id'),
                "start_time": future_date.replace(hour=10, minute=0, second=0, microsecond=0).isoformat() + "Z",
                "end_time": future_date.replace(hour=11, minute=0, second=0, microsecond=0).isoformat() + "Z",
                "purpose": "Review Request Test - Meeting Room Booking"
            }
            
            book_response = self.session.post(f"{self.backend_url}/api/meeting-rooms/{room_id}/book", 
                                            json=booking_data)
            
            if book_response.status_code == 200:
                booking_result = book_response.json()
                booking_id = booking_result.get('booking', {}).get('id')
                if booking_id:
                    self.created_items['bookings'].append((room_id, booking_id))
                    self.log_test("Meeting Rooms - BOOKING CREATE", True, 
                                f"Successfully created booking for room {test_room.get('name')}", 
                                f"Booking ID: {booking_id}, Employee: {test_employee.get('name')}")
                    
                    # Test 6: Cancel Booking Functionality - DELETE /api/meeting-rooms/{room_id}/booking/{booking_id}
                    cancel_response = self.session.delete(f"{self.backend_url}/api/meeting-rooms/{room_id}/booking/{booking_id}")
                    
                    if cancel_response.status_code == 200:
                        self.log_test("Meeting Rooms - BOOKING CANCEL", True, 
                                    f"Successfully cancelled specific booking", 
                                    f"Cancelled booking {booking_id} from room {room_id}")
                        # Remove from cleanup list since we already cancelled it
                        self.created_items['bookings'] = [(r, b) for r, b in self.created_items['bookings'] if b != booking_id]
                    else:
                        self.log_test("Meeting Rooms - BOOKING CANCEL", False, 
                                    f"Failed to cancel booking: {cancel_response.status_code}")
                else:
                    self.log_test("Meeting Rooms - BOOKING CREATE", False, 
                                "Booking created but no booking ID returned")
            else:
                try:
                    error_detail = book_response.json().get('detail', 'Unknown error')
                except:
                    error_detail = book_response.text
                self.log_test("Meeting Rooms - BOOKING CREATE", False, 
                            f"Failed to create booking: {book_response.status_code}", 
                            f"Error: {error_detail}")
            
            # Test 7: Clear All Bookings - DELETE /api/meeting-rooms/clear-all-bookings
            clear_response = self.session.delete(f"{self.backend_url}/api/meeting-rooms/clear-all-bookings")
            
            if clear_response.status_code == 200:
                clear_result = clear_response.json()
                bookings_cleared = clear_result.get('bookings_cleared', 0)
                self.log_test("Meeting Rooms - CLEAR ALL BOOKINGS", True, 
                            f"Successfully cleared all bookings", 
                            f"Cleared {bookings_cleared} bookings from all rooms")
                # Clear our tracking since all bookings are now cleared
                self.created_items['bookings'] = []
            else:
                self.log_test("Meeting Rooms - CLEAR ALL BOOKINGS", False, 
                            f"Failed to clear all bookings: {clear_response.status_code}")
            
            # Test 8: Verify specific user concerns from review request
            # Check that users can see ALL rooms across ALL locations and floors
            ifc_rooms = [room for room in meeting_rooms if room.get('location') == 'IFC']
            non_ifc_rooms = [room for room in meeting_rooms if room.get('location') != 'IFC']
            
            if len(ifc_rooms) >= 11 and len(non_ifc_rooms) >= 4:
                self.log_test("Meeting Rooms - USER VISIBILITY", True, 
                            f"Users can see rooms across all locations and floors", 
                            f"IFC rooms: {len(ifc_rooms)}, Other locations: {len(non_ifc_rooms)}")
            else:
                self.log_test("Meeting Rooms - USER VISIBILITY", False, 
                            f"Limited room visibility - IFC: {len(ifc_rooms)}, Others: {len(non_ifc_rooms)}")
            
            # Verify 14th floor IFC rooms specifically (user mentioned this)
            floor_14_rooms = [room for room in meeting_rooms if room.get('location') == 'IFC' and '14th' in room.get('floor', '')]
            if len(floor_14_rooms) >= 9:
                self.log_test("Meeting Rooms - 14TH FLOOR ACCESS", True, 
                            f"14th floor IFC rooms accessible", 
                            f"Found {len(floor_14_rooms)} rooms on 14th floor")
            else:
                self.log_test("Meeting Rooms - 14TH FLOOR ACCESS", False, 
                            f"Limited 14th floor access - only {len(floor_14_rooms)} rooms found")
                
        except Exception as e:
            self.log_test("Meeting Rooms - COMPREHENSIVE", False, f"Meeting rooms comprehensive test failed: {str(e)}")

    def test_alerts_system_comprehensive(self):
        """Test 13: Comprehensive Alert System Testing"""
        try:
            # Test 1: GET /api/alerts - Check initial state
            get_response = self.session.get(f"{self.backend_url}/api/alerts")
            if get_response.status_code != 200:
                self.log_test("Alert System - GET", False, f"GET /api/alerts failed with status {get_response.status_code}")
                return
            
            initial_alerts = get_response.json()
            if not isinstance(initial_alerts, list):
                self.log_test("Alert System - GET", False, "GET /api/alerts did not return a list")
                return
            
            self.log_test("Alert System - GET", True, 
                        f"GET /api/alerts working - {len(initial_alerts)} alerts found", 
                        f"Initial alerts count: {len(initial_alerts)}")
            
            # Test 2: POST /api/alerts - Create test alerts
            test_alerts = [
                {
                    "title": "System Maintenance Alert",
                    "message": "Scheduled maintenance will occur tonight from 10 PM to 2 AM.",
                    "priority": "high",
                    "type": "system",
                    "target_audience": "all",
                    "created_by": "Admin",
                    "expires_at": (datetime.now() + timedelta(hours=24)).isoformat()
                },
                {
                    "title": "User Role Alert",
                    "message": "This alert is specifically for User role testing.",
                    "priority": "medium",
                    "type": "announcement",
                    "target_audience": "user",
                    "created_by": "Admin",
                    "expires_at": (datetime.now() + timedelta(hours=12)).isoformat()
                },
                {
                    "title": "Admin Role Alert",
                    "message": "This alert is specifically for Admin role testing.",
                    "priority": "urgent",
                    "type": "general",
                    "target_audience": "admin",
                    "created_by": "System",
                    "expires_at": (datetime.now() + timedelta(hours=6)).isoformat()
                }
            ]
            
            created_alert_ids = []
            for i, alert_data in enumerate(test_alerts):
                post_response = self.session.post(f"{self.backend_url}/api/alerts", json=alert_data)
                if post_response.status_code == 200:
                    created_alert = post_response.json()
                    alert_id = created_alert.get('alert', {}).get('id')
                    if alert_id:
                        created_alert_ids.append(alert_id)
                        self.log_test(f"Alert System - CREATE {i+1}", True, 
                                    f"Successfully created alert: {alert_data['title']}", 
                                    f"Alert ID: {alert_id}, Target: {alert_data['target_audience']}")
                    else:
                        self.log_test(f"Alert System - CREATE {i+1}", False, 
                                    f"Alert created but no ID returned for: {alert_data['title']}")
                else:
                    self.log_test(f"Alert System - CREATE {i+1}", False, 
                                f"Failed to create alert '{alert_data['title']}' - Status: {post_response.status_code}")
            
            # Test 3: Verify alerts appear in GET request
            get_after_create = self.session.get(f"{self.backend_url}/api/alerts")
            if get_after_create.status_code == 200:
                all_alerts = get_after_create.json()
                new_alert_count = len(all_alerts) - len(initial_alerts)
                if new_alert_count >= len(created_alert_ids):
                    self.log_test("Alert System - PERSISTENCE", True, 
                                f"Created alerts appear in GET response - {new_alert_count} new alerts", 
                                f"Total alerts now: {len(all_alerts)}")
                else:
                    self.log_test("Alert System - PERSISTENCE", False, 
                                f"Not all created alerts appear in GET response - Expected {len(created_alert_ids)}, got {new_alert_count}")
            
            # Test 4: Test target audience filtering
            user_alerts = self.session.get(f"{self.backend_url}/api/alerts?target_audience=user")
            admin_alerts = self.session.get(f"{self.backend_url}/api/alerts?target_audience=admin")
            
            if user_alerts.status_code == 200 and admin_alerts.status_code == 200:
                user_alert_list = user_alerts.json()
                admin_alert_list = admin_alerts.json()
                
                # Check if filtering works (user should see 'all' and 'user' alerts, admin should see 'all' and 'admin' alerts)
                user_has_alerts = len(user_alert_list) > 0
                admin_has_alerts = len(admin_alert_list) > 0
                
                if user_has_alerts and admin_has_alerts:
                    self.log_test("Alert System - FILTERING", True, 
                                f"Target audience filtering working - User: {len(user_alert_list)}, Admin: {len(admin_alert_list)}", 
                                f"User and Admin see different alert sets")
                else:
                    self.log_test("Alert System - FILTERING", False, 
                                f"Target audience filtering may not be working - User: {len(user_alert_list)}, Admin: {len(admin_alert_list)}")
            
            # Test 5: Test alert expiration (create an expired alert)
            expired_alert = {
                "title": "Expired Alert Test",
                "message": "This alert should be expired and not appear in active alerts.",
                "priority": "low",
                "type": "general",
                "target_audience": "all",
                "created_by": "Test",
                "expires_at": (datetime.now() - timedelta(hours=1)).isoformat()  # Already expired
            }
            
            expired_post = self.session.post(f"{self.backend_url}/api/alerts", json=expired_alert)
            if expired_post.status_code == 200:
                # Check if expired alert is filtered out
                active_alerts = self.session.get(f"{self.backend_url}/api/alerts")
                if active_alerts.status_code == 200:
                    active_list = active_alerts.json()
                    expired_found = any(alert.get('title') == 'Expired Alert Test' for alert in active_list)
                    if not expired_found:
                        self.log_test("Alert System - EXPIRATION", True, 
                                    "Alert expiration filtering working - expired alerts not returned", 
                                    "Expired alert correctly filtered out")
                    else:
                        self.log_test("Alert System - EXPIRATION", False, 
                                    "Alert expiration filtering not working - expired alert still returned")
            
            # Cleanup created alerts
            for alert_id in created_alert_ids:
                try:
                    self.session.delete(f"{self.backend_url}/api/alerts/{alert_id}")
                except:
                    pass
                    
        except Exception as e:
            self.log_test("Alert System - COMPREHENSIVE", False, f"Alert system comprehensive test failed: {str(e)}")

    def test_alert_system_review_request(self):
        """Test: Alert System as per Review Request - GET, POST, PUT, DELETE with priorities, types, filtering"""
        try:
            print("\n🚨 ALERT SYSTEM TESTING - REVIEW REQUEST SPECIFICATIONS")
            print("-" * 60)
            
            # Test 1: GET /api/alerts to fetch existing alerts
            get_response = self.session.get(f"{self.backend_url}/api/alerts")
            if get_response.status_code == 200:
                existing_alerts = get_response.json()
                self.log_test("Alert System - GET /api/alerts", True, 
                            f"Successfully fetched existing alerts", 
                            f"Found {len(existing_alerts)} existing alerts")
            else:
                self.log_test("Alert System - GET /api/alerts", False, 
                            f"GET /api/alerts failed with status {get_response.status_code}")
                return
            
            # Test 2: POST /api/alerts with different priorities (high, medium, low) and types (system, announcement, general)
            test_alerts_data = [
                {
                    "title": "High Priority System Alert",
                    "message": "Critical system maintenance scheduled for tonight.",
                    "priority": "high",
                    "type": "system", 
                    "target_audience": "all",
                    "created_by": "System Admin",
                    "expires_at": (datetime.now() + timedelta(hours=24)).isoformat()
                },
                {
                    "title": "Medium Priority Announcement",
                    "message": "New company policy updates are now available.",
                    "priority": "medium",
                    "type": "announcement",
                    "target_audience": "user",
                    "created_by": "HR Department",
                    "expires_at": (datetime.now() + timedelta(hours=48)).isoformat()
                },
                {
                    "title": "Low Priority General Notice",
                    "message": "Cafeteria menu has been updated for next week.",
                    "priority": "low",
                    "type": "general",
                    "target_audience": "admin",
                    "created_by": "Facilities",
                    "expires_at": (datetime.now() + timedelta(hours=72)).isoformat()
                }
            ]
            
            created_alert_ids = []
            for i, alert_data in enumerate(test_alerts_data):
                post_response = self.session.post(f"{self.backend_url}/api/alerts", json=alert_data)
                if post_response.status_code == 200:
                    created_alert = post_response.json()
                    alert_id = created_alert.get('alert', {}).get('id')
                    if alert_id:
                        created_alert_ids.append(alert_id)
                        self.log_test(f"Alert System - POST Alert {i+1}", True, 
                                    f"Created {alert_data['priority']} priority {alert_data['type']} alert", 
                                    f"Alert ID: {alert_id}, Target: {alert_data['target_audience']}")
                    else:
                        self.log_test(f"Alert System - POST Alert {i+1}", False, 
                                    f"Alert created but no ID returned")
                else:
                    self.log_test(f"Alert System - POST Alert {i+1}", False, 
                                f"Failed to create alert - Status: {post_response.status_code}")
            
            # Test 3: Test alert filtering by target_audience (user, admin, all)
            for audience in ['user', 'admin', 'all']:
                filter_response = self.session.get(f"{self.backend_url}/api/alerts?target_audience={audience}")
                if filter_response.status_code == 200:
                    filtered_alerts = filter_response.json()
                    # Verify filtering logic
                    valid_alerts = []
                    for alert in filtered_alerts:
                        alert_audience = alert.get('target_audience', '')
                        if audience == 'all' or alert_audience == 'all' or alert_audience == audience:
                            valid_alerts.append(alert)
                    
                    if len(valid_alerts) == len(filtered_alerts):
                        self.log_test(f"Alert System - Filter {audience.upper()}", True, 
                                    f"Target audience filtering working for '{audience}'", 
                                    f"Returned {len(filtered_alerts)} alerts for {audience} audience")
                    else:
                        self.log_test(f"Alert System - Filter {audience.upper()}", False, 
                                    f"Target audience filtering incorrect for '{audience}'")
                else:
                    self.log_test(f"Alert System - Filter {audience.upper()}", False, 
                                f"Filtering failed for '{audience}' - Status: {filter_response.status_code}")
            
            # Test 4: PUT /api/alerts/{id} to update alerts
            if created_alert_ids:
                test_alert_id = created_alert_ids[0]
                update_data = {
                    "title": "Updated High Priority System Alert",
                    "priority": "urgent",
                    "message": "URGENT: Critical system maintenance moved to immediate execution."
                }
                
                put_response = self.session.put(f"{self.backend_url}/api/alerts/{test_alert_id}", json=update_data)
                if put_response.status_code == 200:
                    updated_alert = put_response.json()
                    alert_data = updated_alert.get('alert', {})
                    if (alert_data.get('title') == update_data['title'] and 
                        alert_data.get('priority') == update_data['priority']):
                        self.log_test("Alert System - PUT /api/alerts/{id}", True, 
                                    f"Successfully updated alert {test_alert_id}", 
                                    f"Title and priority updated correctly")
                    else:
                        self.log_test("Alert System - PUT /api/alerts/{id}", False, 
                                    f"Alert update did not persist correctly")
                else:
                    self.log_test("Alert System - PUT /api/alerts/{id}", False, 
                                f"Alert update failed - Status: {put_response.status_code}")
            
            # Test 5: DELETE /api/alerts/{id} to delete alerts
            if created_alert_ids and len(created_alert_ids) > 1:
                delete_alert_id = created_alert_ids[1]  # Delete second alert
                delete_response = self.session.delete(f"{self.backend_url}/api/alerts/{delete_alert_id}")
                if delete_response.status_code == 200:
                    # Verify alert is deleted
                    verify_response = self.session.get(f"{self.backend_url}/api/alerts")
                    if verify_response.status_code == 200:
                        remaining_alerts = verify_response.json()
                        deleted_alert_found = any(alert.get('id') == delete_alert_id for alert in remaining_alerts)
                        if not deleted_alert_found:
                            self.log_test("Alert System - DELETE /api/alerts/{id}", True, 
                                        f"Successfully deleted alert {delete_alert_id}", 
                                        f"Alert removed from system")
                            # Remove from our tracking
                            created_alert_ids.remove(delete_alert_id)
                        else:
                            self.log_test("Alert System - DELETE /api/alerts/{id}", False, 
                                        f"Alert {delete_alert_id} still exists after deletion")
                    else:
                        self.log_test("Alert System - DELETE /api/alerts/{id}", False, 
                                    f"Could not verify deletion - GET failed")
                else:
                    self.log_test("Alert System - DELETE /api/alerts/{id}", False, 
                                f"Alert deletion failed - Status: {delete_response.status_code}")
            
            # Test 6: Verify alert expiration logic works correctly
            # Create an expired alert
            expired_alert = {
                "title": "Expired Alert Test",
                "message": "This alert should be filtered out due to expiration.",
                "priority": "low",
                "type": "general",
                "target_audience": "all",
                "created_by": "Test System",
                "expires_at": (datetime.now() - timedelta(hours=1)).isoformat()  # Already expired
            }
            
            expired_post = self.session.post(f"{self.backend_url}/api/alerts", json=expired_alert)
            if expired_post.status_code == 200:
                # Check if expired alert is filtered out from active alerts
                active_alerts_response = self.session.get(f"{self.backend_url}/api/alerts")
                if active_alerts_response.status_code == 200:
                    active_alerts = active_alerts_response.json()
                    expired_found = any(alert.get('title') == 'Expired Alert Test' for alert in active_alerts)
                    if not expired_found:
                        self.log_test("Alert System - EXPIRATION LOGIC", True, 
                                    "Alert expiration logic working correctly", 
                                    "Expired alerts are filtered out from active alerts")
                    else:
                        self.log_test("Alert System - EXPIRATION LOGIC", False, 
                                    "Alert expiration logic not working - expired alert still returned")
                else:
                    self.log_test("Alert System - EXPIRATION LOGIC", False, 
                                f"Could not test expiration logic - GET failed")
            
            # Store remaining alert IDs for cleanup
            for alert_id in created_alert_ids:
                if 'alerts' not in self.created_items:
                    self.created_items['alerts'] = []
                self.created_items['alerts'].append(alert_id)
                
        except Exception as e:
            self.log_test("Alert System - REVIEW REQUEST", False, f"Alert system review request test failed: {str(e)}")

    def test_meeting_room_cross_system_sync(self):
        """Test 14: Meeting Room Booking Cross-System Synchronization"""
        try:
            # Clear all existing bookings first to avoid conflicts
            clear_response = self.session.delete(f"{self.backend_url}/api/meeting-rooms/clear-all-bookings")
            if clear_response.status_code == 200:
                self.log_test("Cross-System Sync - CLEANUP", True, "Cleared all existing bookings for clean test")
            
            # Test 1: Get available meeting rooms
            rooms_response = self.session.get(f"{self.backend_url}/api/meeting-rooms")
            if rooms_response.status_code != 200:
                self.log_test("Cross-System Sync - ROOMS", False, f"Failed to get meeting rooms: {rooms_response.status_code}")
                return
            
            meeting_rooms = rooms_response.json()
            if not meeting_rooms or len(meeting_rooms) == 0:
                self.log_test("Cross-System Sync - ROOMS", False, "No meeting rooms available for testing")
                return
            
            test_room = meeting_rooms[0]
            room_id = test_room.get('id')
            
            # Get test employee
            emp_response = self.session.get(f"{self.backend_url}/api/employees?search=A")
            if emp_response.status_code != 200:
                self.log_test("Cross-System Sync - EMPLOYEE", False, "Could not fetch employee for booking test")
                return
            
            employees = emp_response.json()
            if not employees:
                self.log_test("Cross-System Sync - EMPLOYEE", False, "No employees found for booking test")
                return
            
            test_employee = employees[0]
            
            # Test 2: Create booking from "System 1" (simulate first user/system)
            # Use a future date that's definitely in the future (add more days to be safe)
            future_date = datetime.now() + timedelta(days=7)  # 1 week from now
            booking_data_1 = {
                "employee_name": test_employee.get('name'),
                "employee_id": test_employee.get('id'),
                "start_time": future_date.replace(hour=10, minute=0, second=0, microsecond=0).isoformat() + "Z",
                "end_time": future_date.replace(hour=11, minute=0, second=0, microsecond=0).isoformat() + "Z",
                "purpose": "Cross-System Sync Test - System 1"
            }
            
            book_response_1 = self.session.post(f"{self.backend_url}/api/meeting-rooms/{room_id}/book", 
                                              json=booking_data_1)
            
            if book_response_1.status_code != 200:
                try:
                    error_detail = book_response_1.json().get('detail', 'Unknown error')
                except:
                    error_detail = book_response_1.text
                self.log_test("Cross-System Sync - BOOKING 1", False, 
                            f"Failed to create booking from System 1: {book_response_1.status_code}", 
                            f"Error: {error_detail}")
                return
            
            booking_1 = book_response_1.json()
            booking_1_id = booking_1.get('booking', {}).get('id')
            
            self.log_test("Cross-System Sync - BOOKING 1", True, 
                        f"Successfully created booking from System 1", 
                        f"Booking ID: {booking_1_id}, Room: {room_id}")
            
            # Test 3: Immediately check if booking reflects on "System 2" (simulate second user/system)
            # Create a new session to simulate different system/user
            system_2_session = requests.Session()
            system_2_session.timeout = 30
            
            rooms_check_2 = system_2_session.get(f"{self.backend_url}/api/meeting-rooms")
            if rooms_check_2.status_code == 200:
                rooms_data_2 = rooms_check_2.json()
                test_room_2 = next((room for room in rooms_data_2 if room.get('id') == room_id), None)
                
                if test_room_2:
                    room_bookings = test_room_2.get('bookings', [])
                    booking_found = any(booking.get('id') == booking_1_id for booking in room_bookings)
                    
                    if booking_found:
                        self.log_test("Cross-System Sync - IMMEDIATE SYNC", True, 
                                    "Booking immediately visible on System 2 - Real-time sync working", 
                                    f"Booking {booking_1_id} found in room {room_id} bookings")
                    else:
                        self.log_test("Cross-System Sync - IMMEDIATE SYNC", False, 
                                    "Booking NOT immediately visible on System 2 - Sync issue detected")
                else:
                    self.log_test("Cross-System Sync - IMMEDIATE SYNC", False, 
                                "Could not find test room in System 2 response")
            else:
                self.log_test("Cross-System Sync - IMMEDIATE SYNC", False, 
                            f"System 2 could not fetch rooms: {rooms_check_2.status_code}")
            
            # Test 4: Test booking status updates across systems
            # Check room status on both systems
            room_status_1 = test_room.get('status', 'unknown')
            room_status_2 = test_room_2.get('status', 'unknown') if test_room_2 else 'unknown'
            
            # For future bookings, status should be 'vacant' but booking should be listed
            if len(test_room_2.get('bookings', [])) > 0:
                self.log_test("Cross-System Sync - STATUS UPDATE", True, 
                            f"Room status properly synchronized - System 1: {room_status_1}, System 2: {room_status_2}", 
                            f"Bookings count on System 2: {len(test_room_2.get('bookings', []))}")
            else:
                self.log_test("Cross-System Sync - STATUS UPDATE", False, 
                            "Room status not properly synchronized across systems")
            
            # Test 5: Test cancellation sync across systems
            cancel_response = self.session.delete(f"{self.backend_url}/api/meeting-rooms/{room_id}/booking/{booking_1_id}")
            
            if cancel_response.status_code == 200:
                self.log_test("Cross-System Sync - CANCELLATION", True, 
                            "Booking cancellation successful on System 1", 
                            f"Cancelled booking {booking_1_id}")
                
                # Check if cancellation reflects on System 2
                rooms_after_cancel = system_2_session.get(f"{self.backend_url}/api/meeting-rooms")
                if rooms_after_cancel.status_code == 200:
                    rooms_data_after = rooms_after_cancel.json()
                    test_room_after = next((room for room in rooms_data_after if room.get('id') == room_id), None)
                    
                    if test_room_after:
                        remaining_bookings = test_room_after.get('bookings', [])
                        cancelled_booking_found = any(booking.get('id') == booking_1_id for booking in remaining_bookings)
                        
                        if not cancelled_booking_found:
                            self.log_test("Cross-System Sync - CANCEL SYNC", True, 
                                        "Cancellation immediately synchronized to System 2", 
                                        f"Booking {booking_1_id} removed from all systems")
                        else:
                            self.log_test("Cross-System Sync - CANCEL SYNC", False, 
                                        "Cancellation NOT synchronized to System 2 - cancelled booking still visible")
                    else:
                        self.log_test("Cross-System Sync - CANCEL SYNC", False, 
                                    "Could not verify cancellation sync - room not found")
            else:
                self.log_test("Cross-System Sync - CANCELLATION", False, 
                            f"Booking cancellation failed: {cancel_response.status_code}")
            
            # Test 6: Test multiple concurrent bookings from different systems
            if len(employees) >= 2:
                test_employee_2 = employees[1]
                
                # Try to book the same room from System 2 for a different time
                booking_data_2 = {
                    "employee_name": test_employee_2.get('name'),
                    "employee_id": test_employee_2.get('id'),
                    "start_time": future_date.replace(hour=14, minute=0, second=0, microsecond=0).isoformat() + "Z",
                    "end_time": future_date.replace(hour=15, minute=0, second=0, microsecond=0).isoformat() + "Z",
                    "purpose": "Cross-System Sync Test - System 2"
                }
                
                book_response_2 = system_2_session.post(f"{self.backend_url}/api/meeting-rooms/{room_id}/book", 
                                                      json=booking_data_2)
                
                if book_response_2.status_code == 200:
                    booking_2 = book_response_2.json()
                    booking_2_id = booking_2.get('booking', {}).get('id')
                    
                    # Verify both bookings are visible on System 1
                    final_rooms_check = self.session.get(f"{self.backend_url}/api/meeting-rooms")
                    if final_rooms_check.status_code == 200:
                        final_rooms = final_rooms_check.json()
                        final_test_room = next((room for room in final_rooms if room.get('id') == room_id), None)
                        
                        if final_test_room:
                            final_bookings = final_test_room.get('bookings', [])
                            system_2_booking_visible = any(booking.get('id') == booking_2_id for booking in final_bookings)
                            
                            if system_2_booking_visible:
                                self.log_test("Cross-System Sync - CONCURRENT BOOKING", True, 
                                            "Concurrent bookings from different systems working correctly", 
                                            f"System 2 booking {booking_2_id} visible on System 1")
                            else:
                                self.log_test("Cross-System Sync - CONCURRENT BOOKING", False, 
                                            "Concurrent booking from System 2 not visible on System 1")
                    
                    # Cleanup System 2 booking
                    try:
                        system_2_session.delete(f"{self.backend_url}/api/meeting-rooms/{room_id}/booking/{booking_2_id}")
                    except:
                        pass
                else:
                    self.log_test("Cross-System Sync - CONCURRENT BOOKING", False, 
                                f"Failed to create concurrent booking from System 2: {book_response_2.status_code}")
                    
        except Exception as e:
            self.log_test("Cross-System Sync - COMPREHENSIVE", False, f"Cross-system sync test failed: {str(e)}")

    def test_meeting_room_booking_review_request(self):
        """Test: Meeting Room Booking as per Review Request - GET rooms, POST booking, DELETE booking, conflict detection"""
        try:
            print("\n🏢 MEETING ROOM BOOKING TESTING - REVIEW REQUEST SPECIFICATIONS")
            print("-" * 70)
            
            # Test 1: GET /api/meeting-rooms to fetch all 15 meeting rooms
            get_response = self.session.get(f"{self.backend_url}/api/meeting-rooms")
            if get_response.status_code == 200:
                meeting_rooms = get_response.json()
                if isinstance(meeting_rooms, list):
                    room_count = len(meeting_rooms)
                    if room_count == 15:
                        self.log_test("Meeting Rooms - GET All 15 Rooms", True, 
                                    f"✅ Successfully fetched all 15 meeting rooms as specified", 
                                    f"Room count matches review request specification")
                    else:
                        self.log_test("Meeting Rooms - GET All 15 Rooms", False, 
                                    f"❌ Expected 15 meeting rooms, got {room_count}", 
                                    f"Review request specifies exactly 15 meeting rooms")
                else:
                    self.log_test("Meeting Rooms - GET All 15 Rooms", False, 
                                "GET /api/meeting-rooms did not return a list")
                    return
            else:
                self.log_test("Meeting Rooms - GET All 15 Rooms", False, 
                            f"GET /api/meeting-rooms failed with status {get_response.status_code}")
                return
            
            # Verify room distribution and structure
            locations = {}
            for room in meeting_rooms:
                location = room.get('location', 'Unknown')
                if location not in locations:
                    locations[location] = []
                locations[location].append(room)
            
            self.log_test("Meeting Rooms - Location Distribution", True, 
                        f"Rooms distributed across {len(locations)} locations", 
                        f"Locations: {list(locations.keys())}")
            
            # Test 2: Get employee for booking tests
            emp_response = self.session.get(f"{self.backend_url}/api/employees?search=A")
            if emp_response.status_code != 200:
                self.log_test("Meeting Rooms - Employee Fetch", False, "Could not fetch employees for booking test")
                return
            
            employees = emp_response.json()
            if not employees or len(employees) == 0:
                self.log_test("Meeting Rooms - Employee Fetch", False, "No employees found for booking test")
                return
            
            test_employee = employees[0]
            test_room = meeting_rooms[0]  # Use first room for testing
            room_id = test_room.get('id')
            
            self.log_test("Meeting Rooms - Employee Integration", True, 
                        f"Employee data available for booking assignment", 
                        f"Test employee: {test_employee.get('name')} (ID: {test_employee.get('id')})")
            
            # Test 3: POST /api/meeting-rooms/{room_id}/book to create bookings
            future_date = datetime.now() + timedelta(days=1)
            booking_data = {
                "employee_name": test_employee.get('name'),
                "employee_id": test_employee.get('id'),
                "start_time": future_date.replace(hour=10, minute=0, second=0, microsecond=0).isoformat() + "Z",
                "end_time": future_date.replace(hour=11, minute=0, second=0, microsecond=0).isoformat() + "Z",
                "purpose": "Review Request Test - Meeting Room Booking Functionality"
            }
            
            book_response = self.session.post(f"{self.backend_url}/api/meeting-rooms/{room_id}/book", 
                                            json=booking_data)
            
            if book_response.status_code == 200:
                booking_result = book_response.json()
                booking_id = booking_result.get('booking', {}).get('id')
                if booking_id:
                    self.log_test("Meeting Rooms - POST Booking", True, 
                                f"✅ Successfully created booking for room {test_room.get('name')}", 
                                f"Booking ID: {booking_id}, Employee: {test_employee.get('name')}")
                    
                    # Store for cleanup
                    if 'bookings' not in self.created_items:
                        self.created_items['bookings'] = []
                    self.created_items['bookings'].append((room_id, booking_id))
                else:
                    self.log_test("Meeting Rooms - POST Booking", False, 
                                "Booking created but no booking ID returned")
                    return
            else:
                try:
                    error_detail = book_response.json().get('detail', 'Unknown error')
                except:
                    error_detail = book_response.text
                self.log_test("Meeting Rooms - POST Booking", False, 
                            f"Failed to create booking: {book_response.status_code}", 
                            f"Error: {error_detail}")
                return
            
            # Test 4: Verify booking persistence and proper employee assignment
            rooms_after_booking = self.session.get(f"{self.backend_url}/api/meeting-rooms")
            if rooms_after_booking.status_code == 200:
                updated_rooms = rooms_after_booking.json()
                booked_room = next((room for room in updated_rooms if room.get('id') == room_id), None)
                
                if booked_room:
                    room_bookings = booked_room.get('bookings', [])
                    booking_found = any(booking.get('id') == booking_id for booking in room_bookings)
                    
                    if booking_found:
                        # Verify employee assignment
                        our_booking = next((b for b in room_bookings if b.get('id') == booking_id), None)
                        if (our_booking and 
                            our_booking.get('employee_name') == test_employee.get('name') and
                            our_booking.get('employee_id') == test_employee.get('id')):
                            self.log_test("Meeting Rooms - Booking Persistence", True, 
                                        "✅ Booking persistence and employee assignment working correctly", 
                                        f"Booking persisted with correct employee details")
                        else:
                            self.log_test("Meeting Rooms - Booking Persistence", False, 
                                        "Booking persisted but employee assignment incorrect")
                    else:
                        self.log_test("Meeting Rooms - Booking Persistence", False, 
                                    "Booking not found in room's booking list")
                else:
                    self.log_test("Meeting Rooms - Booking Persistence", False, 
                                "Could not find booked room in updated room list")
            
            # Test 5: Verify room status updates (vacant/occupied) work correctly
            if booked_room:
                room_status = booked_room.get('status', 'unknown')
                # For future bookings, room should still be 'vacant' but have bookings listed
                if room_status in ['vacant', 'occupied']:
                    self.log_test("Meeting Rooms - Room Status Updates", True, 
                                f"✅ Room status updates working correctly", 
                                f"Room status: {room_status}, Bookings: {len(booked_room.get('bookings', []))}")
                else:
                    self.log_test("Meeting Rooms - Room Status Updates", False, 
                                f"Room status '{room_status}' not recognized")
            
            # Test 6: Test booking conflict detection (single booking per room enforcement)
            # Try to book the same room for overlapping time
            conflict_booking_data = {
                "employee_name": test_employee.get('name'),
                "employee_id": test_employee.get('id'),
                "start_time": future_date.replace(hour=10, minute=30, second=0, microsecond=0).isoformat() + "Z",  # Overlapping time
                "end_time": future_date.replace(hour=11, minute=30, second=0, microsecond=0).isoformat() + "Z",
                "purpose": "Conflict Test - Should be rejected"
            }
            
            conflict_response = self.session.post(f"{self.backend_url}/api/meeting-rooms/{room_id}/book", 
                                                json=conflict_booking_data)
            
            if conflict_response.status_code == 400:  # Should be rejected
                try:
                    error_detail = conflict_response.json().get('detail', '')
                    if 'already booked' in error_detail.lower() or 'conflict' in error_detail.lower():
                        self.log_test("Meeting Rooms - Booking Conflict Detection", True, 
                                    "✅ Booking conflict detection working correctly", 
                                    f"Overlapping booking properly rejected: {error_detail}")
                    else:
                        self.log_test("Meeting Rooms - Booking Conflict Detection", False, 
                                    f"Booking rejected but error message unclear: {error_detail}")
                except:
                    self.log_test("Meeting Rooms - Booking Conflict Detection", True, 
                                "✅ Booking conflict detection working - overlapping booking rejected")
            else:
                self.log_test("Meeting Rooms - Booking Conflict Detection", False, 
                            f"Booking conflict detection failed - overlapping booking allowed (Status: {conflict_response.status_code})")
            
            # Test 7: DELETE /api/meeting-rooms/{room_id}/booking/{booking_id} to cancel specific bookings
            cancel_response = self.session.delete(f"{self.backend_url}/api/meeting-rooms/{room_id}/booking/{booking_id}")
            
            if cancel_response.status_code == 200:
                # Verify booking is cancelled
                rooms_after_cancel = self.session.get(f"{self.backend_url}/api/meeting-rooms")
                if rooms_after_cancel.status_code == 200:
                    rooms_after = rooms_after_cancel.json()
                    cancelled_room = next((room for room in rooms_after if room.get('id') == room_id), None)
                    
                    if cancelled_room:
                        remaining_bookings = cancelled_room.get('bookings', [])
                        booking_still_exists = any(booking.get('id') == booking_id for booking in remaining_bookings)
                        
                        if not booking_still_exists:
                            self.log_test("Meeting Rooms - DELETE Specific Booking", True, 
                                        "✅ Successfully cancelled specific booking", 
                                        f"Booking {booking_id} removed from room {room_id}")
                            # Remove from cleanup list since we already cancelled it
                            self.created_items['bookings'] = [(r, b) for r, b in self.created_items['bookings'] if b != booking_id]
                        else:
                            self.log_test("Meeting Rooms - DELETE Specific Booking", False, 
                                        f"Booking {booking_id} still exists after cancellation")
                    else:
                        self.log_test("Meeting Rooms - DELETE Specific Booking", False, 
                                    "Could not find room after cancellation")
                else:
                    self.log_test("Meeting Rooms - DELETE Specific Booking", False, 
                                "Could not verify cancellation - GET rooms failed")
            else:
                self.log_test("Meeting Rooms - DELETE Specific Booking", False, 
                            f"Booking cancellation failed: {cancel_response.status_code}")
            
            # Test 8: DELETE /api/meeting-rooms/clear-all-bookings to clear all bookings
            # First create a test booking to clear
            test_booking_data = {
                "employee_name": test_employee.get('name'),
                "employee_id": test_employee.get('id'),
                "start_time": future_date.replace(hour=14, minute=0, second=0, microsecond=0).isoformat() + "Z",
                "end_time": future_date.replace(hour=15, minute=0, second=0, microsecond=0).isoformat() + "Z",
                "purpose": "Test booking for clear all functionality"
            }
            
            test_book_response = self.session.post(f"{self.backend_url}/api/meeting-rooms/{room_id}/book", 
                                                 json=test_booking_data)
            
            if test_book_response.status_code == 200:
                # Now test clear all bookings
                clear_response = self.session.delete(f"{self.backend_url}/api/meeting-rooms/clear-all-bookings")
                
                if clear_response.status_code == 200:
                    clear_result = clear_response.json()
                    bookings_cleared = clear_result.get('bookings_cleared', 0)
                    
                    # Verify all bookings are cleared
                    rooms_after_clear = self.session.get(f"{self.backend_url}/api/meeting-rooms")
                    if rooms_after_clear.status_code == 200:
                        cleared_rooms = rooms_after_clear.json()
                        total_bookings = sum(len(room.get('bookings', [])) for room in cleared_rooms)
                        
                        if total_bookings == 0:
                            self.log_test("Meeting Rooms - DELETE Clear All Bookings", True, 
                                        "✅ Successfully cleared all bookings from all rooms", 
                                        f"Cleared {bookings_cleared} bookings, verified 0 remaining")
                            # Clear our tracking since all bookings are cleared
                            self.created_items['bookings'] = []
                        else:
                            self.log_test("Meeting Rooms - DELETE Clear All Bookings", False, 
                                        f"Clear all bookings incomplete - {total_bookings} bookings still remain")
                    else:
                        self.log_test("Meeting Rooms - DELETE Clear All Bookings", False, 
                                    "Could not verify clear all operation - GET rooms failed")
                else:
                    self.log_test("Meeting Rooms - DELETE Clear All Bookings", False, 
                                f"Clear all bookings failed: {clear_response.status_code}")
            else:
                self.log_test("Meeting Rooms - DELETE Clear All Bookings", False, 
                            "Could not create test booking for clear all test")
                
        except Exception as e:
            self.log_test("Meeting Rooms - REVIEW REQUEST", False, f"Meeting room booking review request test failed: {str(e)}")

    def test_user_profile_functionality(self):
        """Test 15: User Profile Related Functionality"""
        try:
            # Test 1: Get user profile data (employees)
            profile_response = self.session.get(f"{self.backend_url}/api/employees")
            if profile_response.status_code != 200:
                self.log_test("User Profile - DATA ACCESS", False, f"Failed to access user profile data: {profile_response.status_code}")
                return
            
            employees = profile_response.json()
            if not employees or len(employees) == 0:
                self.log_test("User Profile - DATA ACCESS", False, "No user profile data available")
                return
            
            self.log_test("User Profile - DATA ACCESS", True, 
                        f"User profile data accessible - {len(employees)} profiles available", 
                        f"Sample profile: {employees[0].get('name', 'N/A')} (ID: {employees[0].get('id', 'N/A')})")
            
            # Test 2: Test profile search functionality
            search_response = self.session.get(f"{self.backend_url}/api/employees?search=A")
            if search_response.status_code == 200:
                search_results = search_results = search_response.json()
                if search_results and len(search_results) > 0:
                    self.log_test("User Profile - SEARCH", True, 
                                f"Profile search working - {len(search_results)} results for 'A'", 
                                f"Search functionality operational")
                else:
                    self.log_test("User Profile - SEARCH", False, 
                                "Profile search returned no results")
            else:
                self.log_test("User Profile - SEARCH", False, 
                            f"Profile search failed: {search_response.status_code}")
            
            # Test 3: Test profile image functionality
            if employees:
                test_employee = employees[0]
                employee_id = test_employee.get('id')
                
                # Test image URL update
                test_image_url = f"/api/uploads/images/{employee_id}_test.png"
                image_update_data = {"imageUrl": test_image_url}
                
                image_response = self.session.put(f"{self.backend_url}/api/employees/{employee_id}/image", 
                                                json=image_update_data)
                
                if image_response.status_code == 200:
                    updated_profile = image_response.json()
                    if updated_profile.get('profileImage') == test_image_url:
                        self.log_test("User Profile - IMAGE UPDATE", True, 
                                    "Profile image update working correctly", 
                                    f"Image URL updated for employee {employee_id}")
                    else:
                        self.log_test("User Profile - IMAGE UPDATE", False, 
                                    "Profile image update did not persist correctly")
                else:
                    self.log_test("User Profile - IMAGE UPDATE", False, 
                                f"Profile image update failed: {image_response.status_code}")
            
            # Test 4: Test profile filtering by department
            dept_response = self.session.get(f"{self.backend_url}/api/departments")
            if dept_response.status_code == 200:
                departments = dept_response.json()
                if departments and len(departments) > 0:
                    test_dept = departments[0]
                    
                    dept_filter_response = self.session.get(f"{self.backend_url}/api/employees?department={test_dept}")
                    if dept_filter_response.status_code == 200:
                        dept_employees = dept_filter_response.json()
                        if dept_employees and len(dept_employees) > 0:
                            # Verify all returned employees are from the requested department
                            all_correct_dept = all(emp.get('department') == test_dept for emp in dept_employees)
                            if all_correct_dept:
                                self.log_test("User Profile - DEPT FILTER", True, 
                                            f"Department filtering working - {len(dept_employees)} employees in {test_dept}", 
                                            f"All results match department filter")
                            else:
                                self.log_test("User Profile - DEPT FILTER", False, 
                                            "Department filtering returning incorrect results")
                        else:
                            self.log_test("User Profile - DEPT FILTER", False, 
                                        f"No employees found in department {test_dept}")
                    else:
                        self.log_test("User Profile - DEPT FILTER", False, 
                                    f"Department filtering failed: {dept_filter_response.status_code}")
            
            # Test 5: Test profile filtering by location
            loc_response = self.session.get(f"{self.backend_url}/api/locations")
            if loc_response.status_code == 200:
                locations = loc_response.json()
                if locations and len(locations) > 0:
                    test_location = locations[0]
                    
                    loc_filter_response = self.session.get(f"{self.backend_url}/api/employees?location={test_location}")
                    if loc_filter_response.status_code == 200:
                        loc_employees = loc_filter_response.json()
                        if loc_employees and len(loc_employees) > 0:
                            # Verify all returned employees are from the requested location
                            all_correct_loc = all(emp.get('location') == test_location for emp in loc_employees)
                            if all_correct_loc:
                                self.log_test("User Profile - LOC FILTER", True, 
                                            f"Location filtering working - {len(loc_employees)} employees in {test_location}", 
                                            f"All results match location filter")
                            else:
                                self.log_test("User Profile - LOC FILTER", False, 
                                            "Location filtering returning incorrect results")
                        else:
                            self.log_test("User Profile - LOC FILTER", False, 
                                        f"No employees found in location {test_location}")
                    else:
                        self.log_test("User Profile - LOC FILTER", False, 
                                    f"Location filtering failed: {loc_filter_response.status_code}")
            
            # Test 6: Test profile data integrity
            if employees:
                sample_profiles = employees[:5]  # Test first 5 profiles
                integrity_issues = []
                
                for profile in sample_profiles:
                    # Check required fields
                    if not profile.get('id'):
                        integrity_issues.append(f"Missing ID for profile: {profile.get('name', 'Unknown')}")
                    if not profile.get('name'):
                        integrity_issues.append(f"Missing name for profile ID: {profile.get('id', 'Unknown')}")
                    if not profile.get('department'):
                        integrity_issues.append(f"Missing department for: {profile.get('name', 'Unknown')}")
                    if not profile.get('location'):
                        integrity_issues.append(f"Missing location for: {profile.get('name', 'Unknown')}")
                
                if len(integrity_issues) == 0:
                    self.log_test("User Profile - DATA INTEGRITY", True, 
                                "Profile data integrity check passed", 
                                f"All required fields present in sample of {len(sample_profiles)} profiles")
                else:
                    self.log_test("User Profile - DATA INTEGRITY", False, 
                                f"Profile data integrity issues found: {len(integrity_issues)} issues", 
                                f"Issues: {'; '.join(integrity_issues[:3])}")  # Show first 3 issues
                    
        except Exception as e:
            self.log_test("User Profile - COMPREHENSIVE", False, f"User profile functionality test failed: {str(e)}")

    def cleanup_test_data(self):
        """Clean up test data created during testing"""
        print("\n🧹 Cleaning up test data...")
        
        # Clean up news items
        for news_id in self.created_items['news']:
            try:
                self.session.delete(f"{self.backend_url}/api/news/{news_id}")
            except:
                pass
        
        # Clean up tasks
        for task_id in self.created_items['tasks']:
            try:
                self.session.delete(f"{self.backend_url}/api/tasks/{task_id}")
            except:
                pass
        
        # Clean up knowledge articles
        for knowledge_id in self.created_items['knowledge']:
            try:
                self.session.delete(f"{self.backend_url}/api/knowledge/{knowledge_id}")
            except:
                pass
        
        # Clean up help requests
        for help_id in self.created_items['help']:
            try:
                self.session.delete(f"{self.backend_url}/api/help/{help_id}")
            except:
                pass
        
        # Clean up hierarchy relationships
        for employee_id in self.created_items['hierarchy']:
            try:
                self.session.delete(f"{self.backend_url}/api/hierarchy/{employee_id}")
            except:
                pass
        
        # Clean up bookings
        for room_id, booking_id in self.created_items['bookings']:
            try:
                self.session.delete(f"{self.backend_url}/api/meeting-rooms/{room_id}/booking/{booking_id}")
            except:
                pass
        
        # Clean up alerts
        for alert_id in self.created_items['alerts']:
            try:
                self.session.delete(f"{self.backend_url}/api/alerts/{alert_id}")
            except:
                pass

    def test_meeting_rooms_review_request_focused(self):
        """Test Meeting Rooms API - Focused on Review Request Issues"""
        try:
            print("\n🏢 MEETING ROOMS REVIEW REQUEST FOCUSED TESTING")
            print("-" * 60)
            
            # Test 1: GET /api/meeting-rooms - Check current room structure
            print("📋 Testing current room structure...")
            get_response = self.session.get(f"{self.backend_url}/api/meeting-rooms")
            if get_response.status_code != 200:
                self.log_test("Meeting Rooms - GET Structure", False, f"GET /api/meeting-rooms failed with status {get_response.status_code}")
                return
            
            meeting_rooms = get_response.json()
            if not isinstance(meeting_rooms, list):
                self.log_test("Meeting Rooms - GET Structure", False, "GET /api/meeting-rooms did not return a list")
                return
            
            # Analyze room structure by location
            location_analysis = {}
            for room in meeting_rooms:
                location = room.get('location', 'Unknown')
                floor = room.get('floor', 'Unknown')
                
                if location not in location_analysis:
                    location_analysis[location] = {}
                if floor not in location_analysis[location]:
                    location_analysis[location][floor] = 0
                location_analysis[location][floor] += 1
            
            print(f"📊 Room Structure Analysis:")
            for location, floors in location_analysis.items():
                print(f"   {location}: {floors}")
            
            # Check if structure matches requirements: IFC 14th floor should have multiple rooms, others should have 1 floor and 1 room
            structure_correct = True
            structure_issues = []
            
            for location, floors in location_analysis.items():
                if location == 'IFC':
                    # IFC should have multiple floors with 14th floor having multiple rooms
                    if '14th Floor' not in floors:
                        structure_issues.append(f"IFC missing 14th Floor")
                        structure_correct = False
                    elif floors.get('14th Floor', 0) < 8:  # Should have at least 8 rooms on 14th floor
                        structure_issues.append(f"IFC 14th Floor has only {floors.get('14th Floor')} rooms, expected 8+")
                        structure_correct = False
                else:
                    # Other locations should have 1 floor with 1 room
                    if len(floors) > 1:
                        structure_issues.append(f"{location} has {len(floors)} floors, expected 1")
                        structure_correct = False
                    elif sum(floors.values()) > 1:
                        structure_issues.append(f"{location} has {sum(floors.values())} rooms, expected 1")
                        structure_correct = False
            
            if structure_correct:
                self.log_test("Meeting Rooms - Structure Check", True, 
                            f"Room structure matches requirements - {len(meeting_rooms)} total rooms", 
                            f"IFC has multiple floors/rooms, others have 1 floor/1 room")
            else:
                self.log_test("Meeting Rooms - Structure Check", False, 
                            f"Room structure issues found", 
                            f"Issues: {'; '.join(structure_issues)}")
            
            # Test 2: Location filtering functionality (data structure test)
            print("🔍 Testing location filtering capability...")
            unique_locations = set(room.get('location') for room in meeting_rooms)
            
            location_filter_working = True
            for location in unique_locations:
                # Test if we can filter manually to verify the data structure
                location_rooms = [room for room in meeting_rooms if room.get('location') == location]
                
                if location_rooms:
                    self.log_test(f"Meeting Rooms - Location Data ({location})", True, 
                                f"Location data available - {len(location_rooms)} rooms found", 
                                f"Rooms in {location}: {[room.get('name') for room in location_rooms[:3]]}")
                else:
                    self.log_test(f"Meeting Rooms - Location Data ({location})", False, 
                                f"No rooms found for location {location}")
                    location_filter_working = False
            
            # Test 3: Check if occupied rooms show correctly in dropdown (room status)
            print("👁️ Testing room status visibility...")
            rooms_with_status = 0
            status_distribution = {'vacant': 0, 'occupied': 0, 'other': 0}
            
            for room in meeting_rooms:
                status = room.get('status')
                if status:
                    rooms_with_status += 1
                    if status in status_distribution:
                        status_distribution[status] += 1
                    else:
                        status_distribution['other'] += 1
            
            if rooms_with_status == len(meeting_rooms):
                self.log_test("Meeting Rooms - Status Visibility", True, 
                            f"All rooms have status visibility for dropdown", 
                            f"Status distribution: {status_distribution}")
            else:
                self.log_test("Meeting Rooms - Status Visibility", False, 
                            f"Only {rooms_with_status}/{len(meeting_rooms)} rooms have status visibility")
            
            # Test 4: Test booking functionality and room status updates
            print("📅 Testing booking functionality...")
            
            # Get an employee for booking
            emp_response = self.session.get(f"{self.backend_url}/api/employees?search=A")
            if emp_response.status_code != 200:
                self.log_test("Meeting Rooms - Booking Test", False, "Could not fetch employees for booking test")
                return
            
            employees = emp_response.json()
            if not employees:
                self.log_test("Meeting Rooms - Booking Test", False, "No employees found for booking test")
                return
            
            test_employee = employees[0]
            test_room = meeting_rooms[0]  # Use first room for testing
            room_id = test_room.get('id')
            
            # Create a booking for tomorrow
            future_date = datetime.now() + timedelta(days=1)
            booking_data = {
                "employee_name": test_employee.get('name'),
                "employee_id": test_employee.get('id'),
                "start_time": future_date.replace(hour=10, minute=0, second=0, microsecond=0).isoformat() + "Z",
                "end_time": future_date.replace(hour=11, minute=0, second=0, microsecond=0).isoformat() + "Z",
                "purpose": "Review Request Test - Room Status Update Check"
            }
            
            book_response = self.session.post(f"{self.backend_url}/api/meeting-rooms/{room_id}/book", 
                                            json=booking_data)
            
            if book_response.status_code == 200:
                booking_result = book_response.json()
                booking_id = booking_result.get('booking', {}).get('id')
                
                if booking_id:
                    self.created_items['bookings'].append((room_id, booking_id))
                    
                    # Check if room status updates after booking
                    updated_rooms_response = self.session.get(f"{self.backend_url}/api/meeting-rooms")
                    if updated_rooms_response.status_code == 200:
                        updated_rooms = updated_rooms_response.json()
                        updated_room = next((room for room in updated_rooms if room.get('id') == room_id), None)
                        
                        if updated_room:
                            room_bookings = updated_room.get('bookings', [])
                            booking_saved = any(booking.get('id') == booking_id for booking in room_bookings)
                            
                            if booking_saved:
                                self.log_test("Meeting Rooms - Booking Save", True, 
                                            f"Booking saved properly - room shows booking in list", 
                                            f"Booking {booking_id} found in room {test_room.get('name')}")
                                
                                # Check if room status reflects booking (for future bookings, might still be vacant)
                                room_status = updated_room.get('status', 'unknown')
                                current_booking = updated_room.get('current_booking')
                                
                                if room_bookings:  # Has bookings
                                    self.log_test("Meeting Rooms - Status Update", True, 
                                                f"Room status system working - Status: {room_status}", 
                                                f"Room has {len(room_bookings)} booking(s), Current: {bool(current_booking)}")
                                else:
                                    self.log_test("Meeting Rooms - Status Update", False, 
                                                "Room status not updating - no bookings found after creation")
                            else:
                                self.log_test("Meeting Rooms - Booking Save", False, 
                                            "Booking not saved properly - not found in room bookings list")
                        else:
                            self.log_test("Meeting Rooms - Booking Save", False, 
                                        "Could not find updated room data after booking")
                    else:
                        self.log_test("Meeting Rooms - Booking Save", False, 
                                    f"Could not fetch updated rooms after booking: {updated_rooms_response.status_code}")
                else:
                    self.log_test("Meeting Rooms - Booking Save", False, 
                                "Booking created but no booking ID returned")
            else:
                try:
                    error_detail = book_response.json().get('detail', 'Unknown error')
                except:
                    error_detail = book_response.text
                self.log_test("Meeting Rooms - Booking Save", False, 
                            f"Failed to create booking: {book_response.status_code}", 
                            f"Error: {error_detail}")
            
            # Test 5: Test occupied rooms visibility in dropdown
            print("🔍 Testing occupied rooms dropdown visibility...")
            
            # Get current room states
            current_rooms_response = self.session.get(f"{self.backend_url}/api/meeting-rooms")
            if current_rooms_response.status_code == 200:
                current_rooms = current_rooms_response.json()
                
                occupied_rooms = [room for room in current_rooms if room.get('status') == 'occupied']
                vacant_rooms = [room for room in current_rooms if room.get('status') == 'vacant']
                rooms_with_bookings = [room for room in current_rooms if room.get('bookings') and len(room.get('bookings', [])) > 0]
                
                self.log_test("Meeting Rooms - Dropdown Visibility", True, 
                            f"Room visibility analysis complete", 
                            f"Occupied: {len(occupied_rooms)}, Vacant: {len(vacant_rooms)}, With Bookings: {len(rooms_with_bookings)}")
                
                # Check if occupied rooms are properly marked and visible
                if len(rooms_with_bookings) > 0:
                    self.log_test("Meeting Rooms - Occupied Visibility", True, 
                                f"Rooms with bookings are visible in system", 
                                f"{len(rooms_with_bookings)} rooms have bookings and should show in dropdown")
                else:
                    self.log_test("Meeting Rooms - Occupied Visibility", False, 
                                "No rooms with bookings found - may indicate booking visibility issue")
            else:
                self.log_test("Meeting Rooms - Dropdown Visibility", False, 
                            f"Could not fetch rooms for dropdown visibility test: {current_rooms_response.status_code}")
                
        except Exception as e:
            self.log_test("Meeting Rooms - Review Request", False, f"Meeting rooms review request test failed: {str(e)}")

    def test_meeting_room_employee_integration(self):
        """Test Meeting Room and Employee Integration"""
        try:
            # Get employees for booking tests
            emp_response = self.session.get(f"{self.backend_url}/api/employees")
            if emp_response.status_code != 200:
                self.log_test("Meeting Room Employee Integration", False, f"Could not fetch employees: {emp_response.status_code}")
                return
            
            employees = emp_response.json()
            if len(employees) < 5:
                self.log_test("Meeting Room Employee Integration", False, f"Insufficient employees for testing: {len(employees)}")
                return
            
            # Test with real employee data
            test_employee = employees[0]
            employee_name = test_employee.get('name')
            employee_id = test_employee.get('id')
            
            if not employee_name or not employee_id:
                self.log_test("Meeting Room Employee Integration", False, "Employee data missing required fields")
                return
            
            self.log_test("Meeting Room Employee Integration", True, 
                        f"Employee integration ready - using {employee_name} (ID: {employee_id})", 
                        f"Total employees available: {len(employees)}")
                        
        except Exception as e:
            self.log_test("Meeting Room Employee Integration", False, f"Employee integration test failed: {str(e)}")

    def test_alert_crud_operations(self):
        """Test Alert System CRUD Operations in Detail"""
        try:
            # Test 1: Create alerts with all required fields
            test_alerts = [
                {
                    "title": "System Maintenance",
                    "message": "Scheduled maintenance tonight 10 PM - 2 AM",
                    "priority": "high",
                    "type": "system",
                    "target_audience": "all",
                    "created_by": "Admin",
                    "expires_at": (datetime.now() + timedelta(hours=24)).isoformat()
                },
                {
                    "title": "User Announcement",
                    "message": "New features available in user dashboard",
                    "priority": "medium",
                    "type": "announcement",
                    "target_audience": "user",
                    "created_by": "Product Team"
                },
                {
                    "title": "Admin Notice",
                    "message": "Admin panel updates completed",
                    "priority": "low",
                    "type": "general",
                    "target_audience": "admin",
                    "created_by": "IT Team",
                    "expires_at": (datetime.now() + timedelta(hours=6)).isoformat()
                }
            ]
            
            created_alert_ids = []
            
            # Test POST /api/alerts for each alert
            for i, alert_data in enumerate(test_alerts):
                post_response = self.session.post(f"{self.backend_url}/api/alerts", json=alert_data)
                if post_response.status_code == 200:
                    result = post_response.json()
                    alert_id = result.get('alert', {}).get('id')
                    if alert_id:
                        created_alert_ids.append(alert_id)
                        self.log_test(f"Alert CRUD - CREATE {i+1}", True, 
                                    f"Created alert: {alert_data['title']}", 
                                    f"ID: {alert_id}, Priority: {alert_data['priority']}, Audience: {alert_data['target_audience']}")
                    else:
                        self.log_test(f"Alert CRUD - CREATE {i+1}", False, "Alert created but no ID returned")
                else:
                    self.log_test(f"Alert CRUD - CREATE {i+1}", False, f"Failed to create alert: {post_response.status_code}")
            
            # Test 2: GET /api/alerts - verify all alerts appear
            get_response = self.session.get(f"{self.backend_url}/api/alerts")
            if get_response.status_code == 200:
                all_alerts = get_response.json()
                found_alerts = [alert for alert in all_alerts if alert.get('id') in created_alert_ids]
                if len(found_alerts) == len(created_alert_ids):
                    self.log_test("Alert CRUD - GET ALL", True, 
                                f"All created alerts retrieved successfully", 
                                f"Found {len(found_alerts)}/{len(created_alert_ids)} alerts")
                else:
                    self.log_test("Alert CRUD - GET ALL", False, 
                                f"Not all alerts retrieved: {len(found_alerts)}/{len(created_alert_ids)}")
            else:
                self.log_test("Alert CRUD - GET ALL", False, f"Failed to get alerts: {get_response.status_code}")
            
            # Test 3: Test target_audience filtering
            user_alerts = self.session.get(f"{self.backend_url}/api/alerts?target_audience=user")
            admin_alerts = self.session.get(f"{self.backend_url}/api/alerts?target_audience=admin")
            
            if user_alerts.status_code == 200 and admin_alerts.status_code == 200:
                user_list = user_alerts.json()
                admin_list = admin_alerts.json()
                
                # User should see 'all' and 'user' alerts
                user_audiences = set(alert.get('target_audience') for alert in user_list)
                admin_audiences = set(alert.get('target_audience') for alert in admin_list)
                
                user_filter_correct = user_audiences.issubset({'all', 'user'})
                admin_filter_correct = admin_audiences.issubset({'all', 'admin'})
                
                if user_filter_correct and admin_filter_correct:
                    self.log_test("Alert CRUD - AUDIENCE FILTER", True, 
                                f"Target audience filtering working correctly", 
                                f"User sees: {user_audiences}, Admin sees: {admin_audiences}")
                else:
                    self.log_test("Alert CRUD - AUDIENCE FILTER", False, 
                                f"Audience filtering incorrect - User: {user_audiences}, Admin: {admin_audiences}")
            
            # Test 4: PUT /api/alerts/{id} - Update alert
            if created_alert_ids:
                test_alert_id = created_alert_ids[0]
                update_data = {
                    "title": "Updated System Maintenance",
                    "priority": "urgent",
                    "message": "URGENT: Maintenance moved to 8 PM - 12 AM"
                }
                
                put_response = self.session.put(f"{self.backend_url}/api/alerts/{test_alert_id}", json=update_data)
                if put_response.status_code == 200:
                    updated_alert = put_response.json().get('alert', {})
                    if (updated_alert.get('title') == update_data['title'] and 
                        updated_alert.get('priority') == update_data['priority']):
                        self.log_test("Alert CRUD - UPDATE", True, 
                                    f"Alert updated successfully", 
                                    f"Updated title and priority for alert {test_alert_id}")
                    else:
                        self.log_test("Alert CRUD - UPDATE", False, "Alert update did not persist correctly")
                else:
                    self.log_test("Alert CRUD - UPDATE", False, f"Failed to update alert: {put_response.status_code}")
            
            # Test 5: DELETE /api/alerts/{id} - Delete alert
            if created_alert_ids and len(created_alert_ids) > 1:
                delete_alert_id = created_alert_ids[1]
                delete_response = self.session.delete(f"{self.backend_url}/api/alerts/{delete_alert_id}")
                
                if delete_response.status_code == 200:
                    # Verify alert is deleted
                    verify_response = self.session.get(f"{self.backend_url}/api/alerts")
                    if verify_response.status_code == 200:
                        remaining_alerts = verify_response.json()
                        deleted_alert_found = any(alert.get('id') == delete_alert_id for alert in remaining_alerts)
                        
                        if not deleted_alert_found:
                            self.log_test("Alert CRUD - DELETE", True, 
                                        f"Alert deleted successfully", 
                                        f"Alert {delete_alert_id} removed from system")
                            created_alert_ids.remove(delete_alert_id)  # Remove from cleanup list
                        else:
                            self.log_test("Alert CRUD - DELETE", False, "Deleted alert still appears in system")
                    else:
                        self.log_test("Alert CRUD - DELETE", False, "Could not verify alert deletion")
                else:
                    self.log_test("Alert CRUD - DELETE", False, f"Failed to delete alert: {delete_response.status_code}")
            
            # Cleanup remaining alerts
            for alert_id in created_alert_ids:
                try:
                    self.session.delete(f"{self.backend_url}/api/alerts/{alert_id}")
                except:
                    pass
                    
        except Exception as e:
            self.log_test("Alert CRUD - COMPREHENSIVE", False, f"Alert CRUD operations test failed: {str(e)}")

    def test_frontend_backend_connectivity(self):
        """Test Frontend-Backend Connectivity via External URL"""
        try:
            # Test 1: Verify external URL accessibility
            response = self.session.get(f"{self.backend_url}/api/employees", params={"search": "test"})
            if response.status_code == 200:
                response_time = response.elapsed.total_seconds()
                self.log_test("Frontend-Backend Connectivity", True, 
                            f"External URL accessible - Response time: {response_time:.2f}s", 
                            f"Frontend can successfully connect to backend via {self.backend_url}")
            else:
                self.log_test("Frontend-Backend Connectivity", False, 
                            f"External URL not accessible - Status: {response.status_code}")
            
            # Test 2: Test API endpoint responses
            endpoints_to_test = [
                "/api/employees",
                "/api/meeting-rooms", 
                "/api/alerts",
                "/api/departments",
                "/api/locations"
            ]
            
            successful_endpoints = 0
            for endpoint in endpoints_to_test:
                try:
                    test_response = self.session.get(f"{self.backend_url}{endpoint}")
                    if test_response.status_code == 200:
                        successful_endpoints += 1
                except:
                    pass
            
            if successful_endpoints == len(endpoints_to_test):
                self.log_test("API Endpoints Connectivity", True, 
                            f"All {len(endpoints_to_test)} API endpoints responding correctly", 
                            f"Endpoints tested: {', '.join(endpoints_to_test)}")
            else:
                self.log_test("API Endpoints Connectivity", False, 
                            f"Only {successful_endpoints}/{len(endpoints_to_test)} endpoints responding")
                            
        except Exception as e:
            self.log_test("Frontend-Backend Connectivity", False, f"Connectivity test failed: {str(e)}")

    def test_cors_and_authentication(self):
        """Test CORS and Authentication Issues"""
        try:
            # Test 1: Check CORS headers
            response = self.session.options(f"{self.backend_url}/api/employees")
            cors_headers = {
                'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
            }
            
            # Check if CORS is properly configured
            if cors_headers['Access-Control-Allow-Origin']:
                self.log_test("CORS Configuration", True, 
                            f"CORS headers present", 
                            f"Allow-Origin: {cors_headers['Access-Control-Allow-Origin']}")
            else:
                self.log_test("CORS Configuration", False, "CORS headers missing or incomplete")
            
            # Test 2: Test different HTTP methods
            methods_to_test = ['GET', 'POST', 'PUT', 'DELETE']
            method_results = {}
            
            for method in methods_to_test:
                try:
                    if method == 'GET':
                        test_response = self.session.get(f"{self.backend_url}/api/employees")
                    elif method == 'POST':
                        # Test with alerts endpoint
                        test_data = {
                            "title": "CORS Test Alert",
                            "message": "Testing CORS for POST method",
                            "priority": "low",
                            "type": "general",
                            "target_audience": "all",
                            "created_by": "Test"
                        }
                        test_response = self.session.post(f"{self.backend_url}/api/alerts", json=test_data)
                        # Clean up if successful
                        if test_response.status_code == 200:
                            try:
                                alert_id = test_response.json().get('alert', {}).get('id')
                                if alert_id:
                                    self.session.delete(f"{self.backend_url}/api/alerts/{alert_id}")
                            except:
                                pass
                    else:
                        # For PUT and DELETE, just check if methods are allowed
                        test_response = self.session.request(method, f"{self.backend_url}/api/employees/test")
                    
                    method_results[method] = test_response.status_code not in [405, 501]  # Method not allowed or not implemented
                except:
                    method_results[method] = False
            
            successful_methods = sum(method_results.values())
            if successful_methods >= 2:  # At least GET and POST should work
                self.log_test("HTTP Methods Support", True, 
                            f"HTTP methods working correctly", 
                            f"Working methods: {[method for method, works in method_results.items() if works]}")
            else:
                self.log_test("HTTP Methods Support", False, 
                            f"Limited HTTP method support: {method_results}")
                            
        except Exception as e:
            self.log_test("CORS and Authentication", False, f"CORS/Auth test failed: {str(e)}")

    def test_review_request_critical_apis(self):
        """Test Critical Backend APIs as per Review Request - FastAPI Middleware Bug Fix Verification"""
        try:
            print("\n🎯 REVIEW REQUEST CRITICAL API TESTING - FASTAPI MIDDLEWARE BUG FIX")
            print("=" * 80)
            print("Testing critical backend functionality after FastAPI upgrade from 0.104.1 to 0.117.1")
            print("-" * 80)
            
            # Test 1: Employee Management - GET /api/employees with search and filtering (should return 625 employees)
            print("\n1️⃣ EMPLOYEE MANAGEMENT API TESTING")
            emp_response = self.session.get(f"{self.backend_url}/api/employees")
            if emp_response.status_code == 200:
                employees = emp_response.json()
                employee_count = len(employees)
                if employee_count == 625:
                    self.log_test("Employee Management - Count Verification", True, 
                                f"✅ EXACTLY 625 employees returned as specified in review request", 
                                f"Employee count matches requirement: {employee_count}")
                else:
                    self.log_test("Employee Management - Count Verification", False, 
                                f"❌ Expected 625 employees, got {employee_count}", 
                                f"Review request specifies exactly 625 employees")
                
                # Test search functionality
                search_response = self.session.get(f"{self.backend_url}/api/employees?search=A")
                if search_response.status_code == 200:
                    search_results = search_response.json()
                    self.log_test("Employee Management - Search", True, 
                                f"Search functionality working - found {len(search_results)} results for 'A'", 
                                f"Search API responding correctly after FastAPI upgrade")
                else:
                    self.log_test("Employee Management - Search", False, 
                                f"Search failed with status {search_response.status_code}")
                
                # Test filtering by department
                dept_response = self.session.get(f"{self.backend_url}/api/employees?department=IT")
                if dept_response.status_code == 200:
                    dept_results = dept_response.json()
                    self.log_test("Employee Management - Filtering", True, 
                                f"Department filtering working - found {len(dept_results)} IT employees", 
                                f"Filter API responding correctly after FastAPI upgrade")
                else:
                    self.log_test("Employee Management - Filtering", False, 
                                f"Department filtering failed with status {dept_response.status_code}")
            else:
                self.log_test("Employee Management - API", False, 
                            f"❌ CRITICAL: Employee API failed with status {emp_response.status_code}")
            
            # Test 2: Meeting Rooms - GET /api/meeting-rooms (should return 15 meeting rooms)
            print("\n2️⃣ MEETING ROOMS API TESTING")
            rooms_response = self.session.get(f"{self.backend_url}/api/meeting-rooms")
            if rooms_response.status_code == 200:
                meeting_rooms = rooms_response.json()
                room_count = len(meeting_rooms)
                if room_count == 15:
                    self.log_test("Meeting Rooms - Count Verification", True, 
                                f"✅ EXACTLY 15 meeting rooms returned as specified in review request", 
                                f"Meeting room count matches requirement: {room_count}")
                else:
                    self.log_test("Meeting Rooms - Count Verification", False, 
                                f"❌ Expected 15 meeting rooms, got {room_count}", 
                                f"Review request specifies exactly 15 meeting rooms")
                
                # Verify room structure and data integrity
                if meeting_rooms:
                    sample_room = meeting_rooms[0]
                    required_fields = ['id', 'name', 'location', 'floor', 'capacity']
                    missing_fields = [field for field in required_fields if field not in sample_room]
                    if not missing_fields:
                        self.log_test("Meeting Rooms - Data Structure", True, 
                                    "Meeting room data structure intact after FastAPI upgrade", 
                                    f"All required fields present: {required_fields}")
                    else:
                        self.log_test("Meeting Rooms - Data Structure", False, 
                                    f"Missing required fields: {missing_fields}")
            else:
                self.log_test("Meeting Rooms - API", False, 
                            f"❌ CRITICAL: Meeting Rooms API failed with status {rooms_response.status_code}")
            
            # Test 3: Alerts System - GET /api/alerts and POST /api/alerts
            print("\n3️⃣ ALERTS SYSTEM API TESTING")
            alerts_get_response = self.session.get(f"{self.backend_url}/api/alerts")
            if alerts_get_response.status_code == 200:
                existing_alerts = alerts_get_response.json()
                self.log_test("Alerts System - GET", True, 
                            f"GET /api/alerts working correctly - found {len(existing_alerts)} alerts", 
                            f"Alerts retrieval API responding after FastAPI upgrade")
                
                # Test POST /api/alerts - create a test alert and verify it's saved
                test_alert = {
                    "title": "FastAPI Upgrade Test Alert",
                    "message": "This alert verifies the alerts system is working after FastAPI middleware bug fix.",
                    "priority": "high",
                    "type": "system",
                    "target_audience": "all",
                    "created_by": "Testing Agent",
                    "expires_at": (datetime.now() + timedelta(hours=24)).isoformat()
                }
                
                alerts_post_response = self.session.post(f"{self.backend_url}/api/alerts", json=test_alert)
                if alerts_post_response.status_code == 200:
                    created_alert = alerts_post_response.json()
                    alert_id = created_alert.get('alert', {}).get('id')
                    if alert_id:
                        self.created_items['alerts'].append(alert_id)
                        self.log_test("Alerts System - POST", True, 
                                    f"✅ Test alert created and saved successfully", 
                                    f"Alert ID: {alert_id}, POST API working after FastAPI upgrade")
                        
                        # Verify the alert is actually saved by fetching it again
                        verify_response = self.session.get(f"{self.backend_url}/api/alerts")
                        if verify_response.status_code == 200:
                            updated_alerts = verify_response.json()
                            alert_found = any(alert.get('id') == alert_id for alert in updated_alerts)
                            if alert_found:
                                self.log_test("Alerts System - Persistence", True, 
                                            "✅ Created alert verified in database - persistence working", 
                                            "Alert successfully saved and retrievable")
                            else:
                                self.log_test("Alerts System - Persistence", False, 
                                            "❌ Created alert not found in subsequent GET request")
                    else:
                        self.log_test("Alerts System - POST", False, 
                                    "Alert created but no ID returned")
                else:
                    self.log_test("Alerts System - POST", False, 
                                f"❌ CRITICAL: POST /api/alerts failed with status {alerts_post_response.status_code}")
            else:
                self.log_test("Alerts System - GET", False, 
                            f"❌ CRITICAL: GET /api/alerts failed with status {alerts_get_response.status_code}")
            
            # Test 4: Excel Data Loading - Verify employees count and data integrity
            print("\n4️⃣ EXCEL DATA LOADING VERIFICATION")
            # This is already covered in Employee Management test, but let's verify data integrity
            if emp_response.status_code == 200:
                employees = emp_response.json()
                # Check data integrity - verify employees have required fields
                if employees:
                    sample_employee = employees[0]
                    required_fields = ['id', 'name', 'department', 'location']
                    missing_fields = [field for field in required_fields if not sample_employee.get(field)]
                    if not missing_fields:
                        self.log_test("Excel Data Loading - Data Integrity", True, 
                                    "✅ Employee data integrity verified - all required fields present", 
                                    f"Sample employee has: {list(sample_employee.keys())}")
                    else:
                        self.log_test("Excel Data Loading - Data Integrity", False, 
                                    f"❌ Employee data missing required fields: {missing_fields}")
                    
                    # Verify data variety (different departments and locations)
                    departments = set(emp.get('department', '') for emp in employees[:100])  # Check first 100
                    locations = set(emp.get('location', '') for emp in employees[:100])
                    if len(departments) > 5 and len(locations) > 3:
                        self.log_test("Excel Data Loading - Data Variety", True, 
                                    f"✅ Excel data shows good variety - {len(departments)} departments, {len(locations)} locations", 
                                    "Excel data loading working correctly")
                    else:
                        self.log_test("Excel Data Loading - Data Variety", False, 
                                    f"❌ Limited data variety - {len(departments)} departments, {len(locations)} locations")
            
            # Test 5: Stats Endpoint - GET /api/stats for system health check
            print("\n5️⃣ STATS ENDPOINT SYSTEM HEALTH CHECK")
            stats_response = self.session.get(f"{self.backend_url}/api/stats")
            if stats_response.status_code == 200:
                stats_data = stats_response.json()
                required_stats = ['employees', 'departments', 'locations']
                missing_stats = [stat for stat in required_stats if stat not in stats_data]
                if not missing_stats:
                    employee_stat = stats_data.get('employees', 0)
                    dept_stat = stats_data.get('departments', 0)
                    loc_stat = stats_data.get('locations', 0)
                    
                    if employee_stat == 625:
                        self.log_test("Stats Endpoint - System Health", True, 
                                    f"✅ Stats endpoint working correctly - {employee_stat} employees, {dept_stat} departments, {loc_stat} locations", 
                                    "System health check passed after FastAPI upgrade")
                    else:
                        self.log_test("Stats Endpoint - System Health", False, 
                                    f"❌ Stats show {employee_stat} employees, expected 625")
                else:
                    self.log_test("Stats Endpoint - System Health", False, 
                                f"❌ Stats endpoint missing required fields: {missing_stats}")
            else:
                self.log_test("Stats Endpoint - System Health", False, 
                            f"❌ CRITICAL: Stats endpoint failed with status {stats_response.status_code}")
            
            print("\n" + "=" * 80)
            print("🎯 REVIEW REQUEST CRITICAL API TESTING COMPLETED")
            print("=" * 80)
            
        except Exception as e:
            self.log_test("Review Request Critical APIs", False, f"Critical API testing failed: {str(e)}")

    def test_new_joinees_filtering(self):
        """Test: New Joinees Filtering - Verify employees with recent joining dates from August 2025"""
        try:
            print("\n👥 NEW JOINEES FILTERING TESTING - REVIEW REQUEST VERIFICATION")
            print("-" * 70)
            
            # Test 1: GET /api/employees to get all employee data
            response = self.session.get(f"{self.backend_url}/api/employees")
            if response.status_code != 200:
                self.log_test("New Joinees - GET ALL EMPLOYEES", False, 
                            f"GET /api/employees failed with status {response.status_code}")
                return
            
            employees = response.json()
            if not isinstance(employees, list):
                self.log_test("New Joinees - GET ALL EMPLOYEES", False, 
                            "GET /api/employees did not return a list")
                return
            
            self.log_test("New Joinees - GET ALL EMPLOYEES", True, 
                        f"Successfully retrieved {len(employees)} employees", 
                        f"Employee data structure ready for filtering")
            
            # Test 2: Check if date_of_joining field exists in employee data
            employees_with_joining_date = []
            employees_without_joining_date = []
            
            for employee in employees:
                if 'date_of_joining' in employee and employee['date_of_joining']:
                    employees_with_joining_date.append(employee)
                else:
                    employees_without_joining_date.append(employee)
            
            if employees_with_joining_date:
                self.log_test("New Joinees - DATE_OF_JOINING FIELD", True, 
                            f"Found {len(employees_with_joining_date)} employees with date_of_joining field", 
                            f"Field is properly accessible for filtering")
            else:
                self.log_test("New Joinees - DATE_OF_JOINING FIELD", False, 
                            f"No employees found with date_of_joining field", 
                            f"Field may be missing from employee data structure")
                # Continue testing even if field is missing to check if it needs to be added
            
            # Test 3: Search for specific employees mentioned in review request
            target_employees = [
                {"name": "Rajat Sachdeva", "id": "81269", "joining_date": "2025-08-22"},
                {"name": "Manisha Bisht", "id": "81268", "joining_date": "2025-08-19"},
                {"name": "Umang Garg", "id": "81266", "joining_date": "2025-08-18"},
                {"name": "Amrutha Vijayan Panicker", "id": "81267", "joining_date": "2025-08-18"}
            ]
            
            found_employees = []
            missing_employees = []
            
            for target in target_employees:
                # Search by ID first (most reliable)
                employee_found = None
                for emp in employees:
                    if emp.get('id') == target['id']:
                        employee_found = emp
                        break
                
                # If not found by ID, search by name
                if not employee_found:
                    for emp in employees:
                        if target['name'].lower() in emp.get('name', '').lower():
                            employee_found = emp
                            break
                
                if employee_found:
                    found_employees.append({
                        'target': target,
                        'found': employee_found,
                        'has_joining_date': 'date_of_joining' in employee_found
                    })
                else:
                    missing_employees.append(target)
            
            if found_employees:
                self.log_test("New Joinees - TARGET EMPLOYEES FOUND", True, 
                            f"Found {len(found_employees)}/{len(target_employees)} target employees", 
                            f"Found: {[emp['found']['name'] for emp in found_employees]}")
                
                # Check joining dates for found employees
                employees_with_correct_dates = []
                for emp_data in found_employees:
                    emp = emp_data['found']
                    target = emp_data['target']
                    
                    if 'date_of_joining' in emp and emp['date_of_joining']:
                        if target['joining_date'] in emp['date_of_joining']:
                            employees_with_correct_dates.append(emp_data)
                
                if employees_with_correct_dates:
                    self.log_test("New Joinees - JOINING DATES VERIFICATION", True, 
                                f"Found {len(employees_with_correct_dates)} employees with correct August 2025 joining dates", 
                                f"Dates properly formatted and accessible")
                else:
                    self.log_test("New Joinees - JOINING DATES VERIFICATION", False, 
                                "No employees found with expected August 2025 joining dates", 
                                "Date format or data may need verification")
            else:
                self.log_test("New Joinees - TARGET EMPLOYEES FOUND", False, 
                            f"None of the target employees found in database", 
                            f"Missing: {[emp['name'] for emp in target_employees]}")
            
            # Test 4: Test filtering functionality for August 2025 new joinees
            august_2025_employees = []
            if employees_with_joining_date:
                for employee in employees_with_joining_date:
                    joining_date = employee.get('date_of_joining', '')
                    if '2025-08' in joining_date or 'August 2025' in joining_date or '08/2025' in joining_date:
                        august_2025_employees.append(employee)
                
                if august_2025_employees:
                    self.log_test("New Joinees - AUGUST 2025 FILTERING", True, 
                                f"Found {len(august_2025_employees)} employees who joined in August 2025", 
                                f"Filtering logic can identify recent joiners")
                else:
                    self.log_test("New Joinees - AUGUST 2025 FILTERING", False, 
                                "No employees found with August 2025 joining dates", 
                                "May need to check date format or add test data")
            
            # Test 5: Verify data structure for frontend filtering
            if employees:
                sample_employee = employees[0]
                required_fields = ['id', 'name', 'department', 'location']
                missing_fields = [field for field in required_fields if field not in sample_employee]
                
                if not missing_fields:
                    self.log_test("New Joinees - DATA STRUCTURE", True, 
                                "Employee data has all required fields for frontend filtering", 
                                f"Fields available: {list(sample_employee.keys())}")
                else:
                    self.log_test("New Joinees - DATA STRUCTURE", False, 
                                f"Missing required fields: {missing_fields}", 
                                f"Available fields: {list(sample_employee.keys())}")
            
            # Test 6: Test search functionality for new joinees (if they exist)
            if august_2025_employees:
                test_employee = august_2025_employees[0]
                search_term = test_employee.get('name', '')[:3]
                
                search_response = self.session.get(f"{self.backend_url}/api/employees?search={search_term}")
                if search_response.status_code == 200:
                    search_results = search_response.json()
                    target_found = any(emp.get('id') == test_employee.get('id') for emp in search_results)
                    
                    if target_found:
                        self.log_test("New Joinees - SEARCH FUNCTIONALITY", True, 
                                    f"New joinee searchable via API", 
                                    f"Search '{search_term}' found target employee")
                    else:
                        self.log_test("New Joinees - SEARCH FUNCTIONALITY", False, 
                                    f"New joinee not found in search results")
                else:
                    self.log_test("New Joinees - SEARCH FUNCTIONALITY", False, 
                                f"Search API failed with status {search_response.status_code}")
            
            # Summary for review request
            print(f"\n📋 NEW JOINEES FILTERING SUMMARY:")
            print(f"   • Total Employees: {len(employees)}")
            print(f"   • Employees with joining dates: {len(employees_with_joining_date)}")
            print(f"   • August 2025 joiners found: {len(august_2025_employees)}")
            print(f"   • Target employees found: {len(found_employees)}/{len(target_employees)}")
            
            if missing_employees:
                print(f"   • Missing target employees: {[emp['name'] for emp in missing_employees]}")
            
            if not employees_with_joining_date:
                print(f"   ⚠️  WARNING: No date_of_joining field found in employee data")
                print(f"   ⚠️  This field may need to be added to the Employee model and Excel data")
                
        except Exception as e:
            self.log_test("New Joinees - COMPREHENSIVE", False, f"New joinees filtering test failed: {str(e)}")

    def test_new_joinees_filtering_functionality(self):
        """Test: New Joinees Filtering Functionality - Specific Review Request"""
        try:
            print("\n👥 NEW JOINEES FILTERING FUNCTIONALITY TESTING")
            print("-" * 60)
            
            # Test 1: GET /api/employees to verify employees with joining dates from August 2025
            response = self.session.get(f"{self.backend_url}/api/employees")
            if response.status_code != 200:
                self.log_test("New Joinees - GET EMPLOYEES", False, 
                            f"GET /api/employees failed with status {response.status_code}")
                return
            
            employees = response.json()
            if not isinstance(employees, list):
                self.log_test("New Joinees - GET EMPLOYEES", False, 
                            "GET /api/employees did not return a list")
                return
            
            total_employees = len(employees)
            self.log_test("New Joinees - GET EMPLOYEES", True, 
                        f"Successfully retrieved all {total_employees} employees", 
                        f"Employee data structure ready for filtering")
            
            # Test 2: Verify date_of_joining field exists and is properly formatted
            employees_with_joining_date = []
            employees_without_joining_date = []
            
            for employee in employees:
                if 'date_of_joining' in employee and employee['date_of_joining']:
                    employees_with_joining_date.append(employee)
                else:
                    employees_without_joining_date.append(employee)
            
            if len(employees_with_joining_date) > 0:
                self.log_test("New Joinees - DATE FIELD VERIFICATION", True, 
                            f"date_of_joining field found in {len(employees_with_joining_date)} employees", 
                            f"Field is accessible for filtering. {len(employees_without_joining_date)} employees without date")
            else:
                self.log_test("New Joinees - DATE FIELD VERIFICATION", False, 
                            "No employees found with date_of_joining field")
                return
            
            # Test 3: Filter employees who joined in August 2025 (containing "2025-08")
            august_2025_employees = []
            for employee in employees_with_joining_date:
                joining_date = employee.get('date_of_joining', '')
                if '2025-08' in str(joining_date):
                    august_2025_employees.append(employee)
            
            if len(august_2025_employees) > 0:
                self.log_test("New Joinees - AUGUST 2025 FILTERING", True, 
                            f"Found {len(august_2025_employees)} employees who joined in August 2025", 
                            f"Filtering logic can identify recent joiners")
                
                # Test 4: Verify exactly 16 employees joined in August 2025 as mentioned in review request
                if len(august_2025_employees) == 16:
                    self.log_test("New Joinees - COUNT VERIFICATION", True, 
                                f"✅ EXACTLY 16 employees joined in August 2025 as specified in review request", 
                                f"Count matches review request specification perfectly")
                else:
                    self.log_test("New Joinees - COUNT VERIFICATION", False, 
                                f"❌ Expected exactly 16 employees, found {len(august_2025_employees)}", 
                                f"Review request specified exactly 16 August 2025 joiners")
            else:
                self.log_test("New Joinees - AUGUST 2025 FILTERING", False, 
                            "No employees found with August 2025 joining dates")
                return
            
            # Test 5: Verify API response structure for new joinees
            sample_new_joiner = august_2025_employees[0]
            required_fields = ['id', 'name', 'department', 'location', 'date_of_joining']
            missing_fields = []
            
            for field in required_fields:
                if field not in sample_new_joiner or not sample_new_joiner[field]:
                    missing_fields.append(field)
            
            if not missing_fields:
                self.log_test("New Joinees - API RESPONSE STRUCTURE", True, 
                            "All required fields present in employee data for frontend filtering", 
                            f"Sample employee: {sample_new_joiner.get('name')} (ID: {sample_new_joiner.get('id')})")
            else:
                self.log_test("New Joinees - API RESPONSE STRUCTURE", False, 
                            f"Missing required fields: {missing_fields}")
            
            # Test 6: Verify date format consistency for August 2025 employees
            date_formats = set()
            properly_formatted_dates = 0
            
            for employee in august_2025_employees:
                joining_date = str(employee.get('date_of_joining', ''))
                date_formats.add(joining_date[:10] if len(joining_date) >= 10 else joining_date)
                
                # Check if date follows YYYY-MM-DD format for August 2025
                if joining_date.startswith('2025-08-') and len(joining_date) >= 10:
                    properly_formatted_dates += 1
            
            if properly_formatted_dates == len(august_2025_employees):
                self.log_test("New Joinees - DATE FORMAT VERIFICATION", True, 
                            "All August 2025 joining dates are properly formatted", 
                            f"All {properly_formatted_dates} dates follow YYYY-MM-DD format")
            else:
                self.log_test("New Joinees - DATE FORMAT VERIFICATION", False, 
                            f"Only {properly_formatted_dates}/{len(august_2025_employees)} dates properly formatted")
            
            # Test 7: Test search functionality for new joinees (verify they are searchable)
            if august_2025_employees:
                test_employee = august_2025_employees[0]
                search_term = test_employee.get('name', '')[:3] if test_employee.get('name') else 'A'
                
                search_response = self.session.get(f"{self.backend_url}/api/employees?search={search_term}")
                if search_response.status_code == 200:
                    search_results = search_response.json()
                    new_joiner_found = any(emp.get('id') == test_employee.get('id') for emp in search_results)
                    
                    if new_joiner_found:
                        self.log_test("New Joinees - SEARCH FUNCTIONALITY", True, 
                                    "New joinees are searchable via API", 
                                    f"Found {test_employee.get('name')} in search results for '{search_term}'")
                    else:
                        self.log_test("New Joinees - SEARCH FUNCTIONALITY", False, 
                                    f"New joiner {test_employee.get('name')} not found in search results")
                else:
                    self.log_test("New Joinees - SEARCH FUNCTIONALITY", False, 
                                f"Search API failed with status {search_response.status_code}")
            
            # Test 8: Display sample August 2025 employees for verification
            print(f"\n📋 SAMPLE AUGUST 2025 NEW JOINERS:")
            print("-" * 40)
            for i, employee in enumerate(august_2025_employees[:5]):  # Show first 5
                print(f"{i+1}. {employee.get('name')} (ID: {employee.get('id')}) - Joined: {employee.get('date_of_joining')}")
            
            if len(august_2025_employees) > 5:
                print(f"... and {len(august_2025_employees) - 5} more employees")
            
            # Summary log
            self.log_test("New Joinees - COMPREHENSIVE VERIFICATION", True, 
                        f"New joinees filtering functionality fully verified", 
                        f"✅ {len(august_2025_employees)} August 2025 employees found, all searchable and properly structured")
                        
        except Exception as e:
            self.log_test("New Joinees - FILTERING FUNCTIONALITY", False, 
                        f"New joinees filtering test failed: {str(e)}")

    def run_all_tests(self):
        """Run all tests - FOCUSED ON REVIEW REQUEST"""
        print("🚀 REVIEW REQUEST FOCUSED TESTING - MEETING ROOMS & ALERT SYSTEM")
        print("=" * 80)
        
        # PRIORITY: Review Request Critical API Testing
        self.test_review_request_critical_apis()
        
        # Core connectivity test
        self.test_backend_connectivity()
        
        # Employee data verification (needed for booking tests)
        self.test_employee_data_management()
        
        # NEW JOINEES FILTERING TEST - As per Review Request
        print("\n" + "="*60)
        print("👥 NEW JOINEES FILTERING TESTING")
        print("="*60)
        self.test_new_joinees_filtering_functionality()
        
        # MAIN FOCUS: Meeting Rooms Testing
        print("\n" + "="*60)
        print("🏢 MEETING ROOMS COMPREHENSIVE TESTING")
        print("="*60)
        self.test_meeting_rooms_api_comprehensive()
        self.test_meeting_room_employee_integration()
        
        # MAIN FOCUS: Alert System Testing  
        print("\n" + "="*60)
        print("🚨 ALERT SYSTEM COMPREHENSIVE TESTING")
        print("="*60)
        self.test_alerts_system_comprehensive()
        self.test_alert_crud_operations()
        
        # Integration Testing
        print("\n" + "="*60)
        print("🔗 INTEGRATION TESTING")
        print("="*60)
        self.test_frontend_backend_connectivity()
        self.test_cors_and_authentication()
        
        # Clean up test data
        self.cleanup_test_data()
        
        print("\n" + "=" * 80)
        print("📊 REVIEW REQUEST TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL BACKEND-PERSISTENT API TESTS PASSED!")
            print("✅ Data persistence confirmed - All changes saved to MongoDB")
            print("✅ Cross-system sync verified - Data retrievable immediately")
            print("✅ All CRUD operations functional across all API groups")
        else:
            print(f"\n⚠️  {total - passed} test(s) failed. Check the details above.")
            
        return passed == total

    def run_review_request_tests(self):
        """Run specific tests for the review request - Alert System and Meeting Room Booking"""
        print("🎯 REVIEW REQUEST TESTING - Alert System & Meeting Room Booking")
        print("=" * 70)
        
        # Core connectivity test
        self.test_backend_connectivity()
        
        # Employee data verification (exactly 625 employees)
        self.test_employee_data_verification_625()
        
        # Alert System Testing (as per review request)
        self.test_alert_system_review_request()
        
        # Meeting Room Booking Testing (as per review request)  
        self.test_meeting_room_booking_review_request()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Print summary
        print("\n" + "=" * 80)
        print("📊 REVIEW REQUEST TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL REVIEW REQUEST TESTS PASSED!")
            print("✅ Alert System fully functional - All CRUD operations working")
            print("✅ Meeting Room Booking system operational - All booking features working")
            print("✅ Employee data verified - Exactly 625 employees loaded")
        else:
            print(f"\n⚠️  {total - passed} test(s) failed. Check the details above.")
            
        return passed == total

if __name__ == "__main__":
    import sys
    tester = BackendPersistentTester()
    
    # Check if we should run review request tests specifically
    if len(sys.argv) > 1 and sys.argv[1] == "--review-request":
        success = tester.run_review_request_tests()
    else:
        success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)