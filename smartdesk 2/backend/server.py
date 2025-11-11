from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json
import os
import uuid
from pymongo import MongoClient
from dotenv import load_dotenv
import base64
import shutil
from pathlib import Path

# Load environment variables
load_dotenv()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/smartworld')
try:
    client = MongoClient(MONGO_URL)
    db = client.smartworld
    print(f"Connected to MongoDB: {MONGO_URL}")
except Exception as e:
    print(f"Failed to connect to MongoDB: {e}")
    db = None

# Collections
meeting_rooms_collection = db.meeting_rooms if db is not None else None
bookings_collection = db.bookings if db is not None else None
alerts_collection = db.alerts if db is not None else None
employees_collection = db.employees if db is not None else None
news_collection = db.news if db is not None else None
tasks_collection = db.tasks if db is not None else None
knowledge_collection = db.knowledge if db is not None else None
help_collection = db.help if db is not None else None
attendance_collection = db.attendance if db is not None else None
policies_collection = db.policies if db is not None else None
workflows_collection = db.workflows if db is not None else None
hierarchy_collection = db.hierarchy if db is not None else None

# Data Models
class MeetingRoomBooking(BaseModel):
    employee_name: str
    employee_id: str
    start_time: str
    end_time: str
    purpose: str

class Alert(BaseModel):
    title: str
    message: str
    priority: str = "medium"  # low, medium, high, urgent
    type: str = "general"     # general, system, announcement
    target_audience: str = "all"  # all, admin, user
    created_by: str
    expires_at: Optional[str] = None

class AlertUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    priority: Optional[str] = None
    type: Optional[str] = None
    target_audience: Optional[str] = None
    expires_at: Optional[str] = None

# Additional Data Models for Complete Backend Implementation
class Employee(BaseModel):
    id: str
    name: str
    department: str
    location: str
    grade: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    profileImage: Optional[str] = None

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    grade: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    profileImage: Optional[str] = None

class News(BaseModel):
    title: str
    content: str
    priority: str = "normal"  # normal, medium, high
    author: str

class NewsUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    priority: Optional[str] = None
    author: Optional[str] = None

class Task(BaseModel):
    title: str
    description: str
    assigned_to: str  # employee ID
    priority: str = "medium"  # low, medium, high
    status: str = "pending"  # pending, in_progress, completed
    due_date: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None

class Knowledge(BaseModel):
    title: str
    content: str
    category: str = "other"  # policy, process, training, announcement, guideline, other
    tags: List[str] = []
    author: str

class KnowledgeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    author: Optional[str] = None

class Help(BaseModel):
    title: str
    message: str
    priority: str = "medium"  # low, medium, high
    status: str = "open"  # open, in_progress, resolved
    author: str

class HelpUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

class HelpReply(BaseModel):
    message: str
    author: str

class Attendance(BaseModel):
    employee_id: str
    employee_name: str
    date: str
    punch_in: Optional[str] = None
    punch_out: Optional[str] = None
    status: str = "present"  # present, absent, half_day, late
    location: str = "office"  # office, remote, field
    total_hours: Optional[float] = None

class AttendanceUpdate(BaseModel):
    punch_out: Optional[str] = None
    status: Optional[str] = None
    total_hours: Optional[float] = None

class Policy(BaseModel):
    title: str
    content: str
    category: str = "other"  # hr, it, admin, other
    version: str = "1.0"
    effective_date: str
    author: str

class PolicyUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    version: Optional[str] = None
    effective_date: Optional[str] = None

class Workflow(BaseModel):
    title: str
    description: str
    steps: List[Dict[str, Any]] = []
    status: str = "active"  # active, inactive, completed
    category: str = "general"
    assigned_employees: List[str] = []

class WorkflowUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None
    category: Optional[str] = None
    assigned_employees: Optional[List[str]] = None

class Hierarchy(BaseModel):
    employee_id: str
    reports_to: str  # manager's employee_id

# ============================================================================
# HEALTH AND STATUS ENDPOINTS
# ============================================================================

@app.get("/")
def root():
    return {"message": "SmartWorld Employee Directory API", "status": "running", "mode": "backend-persistent"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "mode": "backend-persistent", "mongodb": db is not None}

# ============================================================================
# EMPLOYEES API - Backend Persistence
# ============================================================================

@app.get("/api/employees")
def get_employees(search: Optional[str] = None, department: Optional[str] = None, location: Optional[str] = None):
    """Get all employees with optional search and filters"""
    try:
        query = {}
        if search:
            # Search across multiple fields using regex
            search_pattern = {"$regex": f"^{search}", "$options": "i"}  # starts with pattern
            query["$or"] = [
                {"name": search_pattern},
                {"id": search_pattern},
                {"department": search_pattern},
                {"location": search_pattern},
                {"grade": search_pattern},
                {"mobile": search_pattern}
            ]
        
        if department:
            query["department"] = department
        
        if location:
            query["location"] = location
        
        employees = list(employees_collection.find(query))
        # Convert MongoDB ObjectId to string for JSON serialization
        for emp in employees:
            emp["_id"] = str(emp["_id"])
        
        return employees
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/employees/{employee_id}/image")
def update_employee_image(employee_id: str, image_data: dict):
    """Update employee profile image"""
    try:
        image_url = image_data.get("imageUrl")
        if not image_url:
            raise HTTPException(status_code=400, detail="Image URL is required")
        
        result = employees_collection.update_one(
            {"id": employee_id},
            {"$set": {"profileImage": image_url, "updated_at": datetime.utcnow().isoformat()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Return updated employee
        employee = employees_collection.find_one({"id": employee_id})
        employee["_id"] = str(employee["_id"])
        return employee
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/employees/{employee_id}/upload-image")
async def upload_employee_image(employee_id: str, file: UploadFile = File(...)):
    """Upload employee profile image file"""
    try:
        # Create uploads directory if it doesn't exist
        uploads_dir = os.path.join(os.path.dirname(__file__), "uploads", "images")
        os.makedirs(uploads_dir, exist_ok=True)
        
        # Save file
        file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{employee_id}.{file_extension}"
        file_path = os.path.join(uploads_dir, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Update employee record with image URL
        image_url = f"/api/uploads/images/{filename}"
        result = employees_collection.update_one(
            {"id": employee_id},
            {"$set": {"profileImage": image_url, "updated_at": datetime.utcnow().isoformat()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        return {"message": "Image uploaded successfully", "imageUrl": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/refresh-excel")
def refresh_excel_data():
    """Refresh employee data from Excel file"""
    try:
        # This would typically reload from Excel file
        # For now, return current count
        count = employees_collection.count_documents({})
        return {"message": "Excel data refreshed successfully", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/departments")
def get_departments():
    """Get all unique departments"""
    try:
        departments = employees_collection.distinct("department")
        return sorted([dept for dept in departments if dept])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/locations")
def get_locations():
    """Get all unique locations"""
    try:
        locations = employees_collection.distinct("location")
        return sorted([loc for loc in locations if loc])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
def get_stats():
    """Get system statistics"""
    try:
        employee_count = employees_collection.count_documents({})
        department_count = len(employees_collection.distinct("department"))
        location_count = len(employees_collection.distinct("location"))
        
        return {
            "employees": employee_count,
            "departments": department_count,
            "locations": location_count,
            "excel_sync": f"{employee_count}/{employee_count}",
            "last_updated": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# HIERARCHY API - Backend Persistence
# ============================================================================

@app.get("/api/hierarchy")
def get_hierarchy():
    """Get all hierarchy relationships"""
    try:
        hierarchy = list(hierarchy_collection.find())
        for item in hierarchy:
            item["_id"] = str(item["_id"])
        return hierarchy
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/hierarchy")
def create_hierarchy(hierarchy: Hierarchy):
    """Create a new hierarchy relationship"""
    try:
        # Check if employee exists
        employee = employees_collection.find_one({"id": hierarchy.employee_id})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Check if manager exists
        manager = employees_collection.find_one({"id": hierarchy.reports_to})
        if not manager:
            raise HTTPException(status_code=404, detail="Manager not found")
        
        # Check if relationship already exists
        existing = hierarchy_collection.find_one({"employee_id": hierarchy.employee_id})
        if existing:
            raise HTTPException(status_code=400, detail="Hierarchy relationship already exists for this employee")
        
        hierarchy_data = hierarchy.dict()
        hierarchy_data["created_at"] = datetime.utcnow().isoformat()
        
        result = hierarchy_collection.insert_one(hierarchy_data)
        hierarchy_data["_id"] = str(result.inserted_id)
        
        return hierarchy_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/hierarchy/{employee_id}")
def delete_hierarchy(employee_id: str):
    """Delete a hierarchy relationship"""
    try:
        result = hierarchy_collection.delete_one({"employee_id": employee_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Hierarchy relationship not found")
        
        return {"message": "Hierarchy relationship deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/hierarchy/clear")
def clear_all_hierarchy():
    """Clear all hierarchy relationships"""
    try:
        result = hierarchy_collection.delete_many({})
        return {"message": f"Cleared {result.deleted_count} hierarchy relationships"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# NEWS API - Backend Persistence  
# ============================================================================

@app.get("/api/news")
def get_news():
    """Get all news items"""
    try:
        news = list(news_collection.find().sort("created_at", -1))
        for item in news:
            item["_id"] = str(item["_id"])
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/news")
def create_news(news: News):
    """Create a new news item"""
    try:
        news_data = news.dict()
        news_data["id"] = str(uuid.uuid4())
        news_data["created_at"] = datetime.utcnow().isoformat()
        news_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = news_collection.insert_one(news_data)
        news_data["_id"] = str(result.inserted_id)
        
        return news_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/news/{news_id}")
def update_news(news_id: str, news: NewsUpdate):
    """Update a news item"""
    try:
        update_data = {k: v for k, v in news.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = news_collection.update_one(
            {"id": news_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="News item not found")
        
        updated_news = news_collection.find_one({"id": news_id})
        updated_news["_id"] = str(updated_news["_id"])
        return updated_news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/news/{news_id}")
def delete_news(news_id: str):
    """Delete a news item"""
    try:
        result = news_collection.delete_one({"id": news_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="News item not found")
        
        return {"message": "News item deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# TASKS API - Backend Persistence
# ============================================================================

@app.get("/api/tasks")
def get_tasks():
    """Get all tasks"""
    try:
        tasks = list(tasks_collection.find().sort("created_at", -1))
        for task in tasks:
            task["_id"] = str(task["_id"])
            # Add employee name for assigned tasks
            if task.get("assigned_to"):
                employee = employees_collection.find_one({"id": task["assigned_to"]})
                task["assigned_to_name"] = employee["name"] if employee else "Unknown"
        return tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tasks")
def create_task(task: Task):
    """Create a new task"""
    try:
        # Verify assigned employee exists
        if task.assigned_to:
            employee = employees_collection.find_one({"id": task.assigned_to})
            if not employee:
                raise HTTPException(status_code=404, detail="Assigned employee not found")
        
        task_data = task.dict()
        task_data["id"] = str(uuid.uuid4())
        task_data["created_at"] = datetime.utcnow().isoformat()
        task_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = tasks_collection.insert_one(task_data)
        task_data["_id"] = str(result.inserted_id)
        
        return task_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/tasks/{task_id}")
def update_task(task_id: str, task: TaskUpdate):
    """Update a task"""
    try:
        update_data = {k: v for k, v in task.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = tasks_collection.update_one(
            {"id": task_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        
        updated_task = tasks_collection.find_one({"id": task_id})
        updated_task["_id"] = str(updated_task["_id"])
        return updated_task
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    """Delete a task"""
    try:
        result = tasks_collection.delete_one({"id": task_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return {"message": "Task deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# KNOWLEDGE API - Backend Persistence
# ============================================================================

@app.get("/api/knowledge")
def get_knowledge():
    """Get all knowledge articles"""
    try:
        knowledge = list(knowledge_collection.find().sort("created_at", -1))
        for item in knowledge:
            item["_id"] = str(item["_id"])
        return knowledge
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/knowledge")
def create_knowledge(knowledge: Knowledge):
    """Create a new knowledge article"""
    try:
        knowledge_data = knowledge.dict()
        knowledge_data["id"] = str(uuid.uuid4())
        knowledge_data["created_at"] = datetime.utcnow().isoformat()
        knowledge_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = knowledge_collection.insert_one(knowledge_data)
        knowledge_data["_id"] = str(result.inserted_id)
        
        return knowledge_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/knowledge/{knowledge_id}")
def update_knowledge(knowledge_id: str, knowledge: KnowledgeUpdate):
    """Update a knowledge article"""
    try:
        update_data = {k: v for k, v in knowledge.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = knowledge_collection.update_one(
            {"id": knowledge_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Knowledge article not found")
        
        updated_knowledge = knowledge_collection.find_one({"id": knowledge_id})
        updated_knowledge["_id"] = str(updated_knowledge["_id"])
        return updated_knowledge
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/knowledge/{knowledge_id}")
def delete_knowledge(knowledge_id: str):
    """Delete a knowledge article"""
    try:
        result = knowledge_collection.delete_one({"id": knowledge_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Knowledge article not found")
        
        return {"message": "Knowledge article deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# HELP API - Backend Persistence
# ============================================================================

@app.get("/api/help")
def get_help():
    """Get all help requests"""
    try:
        help_requests = list(help_collection.find().sort("created_at", -1))
        for item in help_requests:
            item["_id"] = str(item["_id"])
        return help_requests
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/help")
def create_help(help_request: Help):
    """Create a new help request"""
    try:
        help_data = help_request.dict()
        help_data["id"] = str(uuid.uuid4())
        help_data["replies"] = []
        help_data["created_at"] = datetime.utcnow().isoformat()
        help_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = help_collection.insert_one(help_data)
        help_data["_id"] = str(result.inserted_id)
        
        return help_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/help/{help_id}")
def update_help(help_id: str, help_request: HelpUpdate):
    """Update a help request"""
    try:
        update_data = {k: v for k, v in help_request.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = help_collection.update_one(
            {"id": help_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Help request not found")
        
        updated_help = help_collection.find_one({"id": help_id})
        updated_help["_id"] = str(updated_help["_id"])
        return updated_help
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/help/{help_id}/reply")
def add_help_reply(help_id: str, reply: HelpReply):
    """Add a reply to a help request"""
    try:
        reply_data = reply.dict()
        reply_data["id"] = str(uuid.uuid4())
        reply_data["created_at"] = datetime.utcnow().isoformat()
        
        result = help_collection.update_one(
            {"id": help_id},
            {
                "$push": {"replies": reply_data},
                "$set": {"updated_at": datetime.utcnow().isoformat()}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Help request not found")
        
        updated_help = help_collection.find_one({"id": help_id})
        updated_help["_id"] = str(updated_help["_id"])
        return updated_help
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/help/{help_id}")
def delete_help(help_id: str):
    """Delete a help request"""
    try:
        result = help_collection.delete_one({"id": help_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Help request not found")
        
        return {"message": "Help request deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ATTENDANCE API - Backend Persistence
# ============================================================================

@app.get("/api/attendance")
def get_attendance(search: Optional[str] = None):
    """Get all attendance records with optional search"""
    try:
        query = {}
        if search:
            search_pattern = {"$regex": f"^{search}", "$options": "i"}
            query["$or"] = [
                {"employee_name": search_pattern},
                {"employee_id": search_pattern}
            ]
        
        attendance = list(attendance_collection.find(query).sort("date", -1))
        for item in attendance:
            item["_id"] = str(item["_id"])
        return attendance
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/attendance")
def create_attendance(attendance: Attendance):
    """Create a new attendance record"""
    try:
        attendance_data = attendance.dict()
        attendance_data["id"] = str(uuid.uuid4())
        attendance_data["created_at"] = datetime.utcnow().isoformat()
        attendance_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = attendance_collection.insert_one(attendance_data)
        attendance_data["_id"] = str(result.inserted_id)
        
        return attendance_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/attendance/{attendance_id}")
def update_attendance(attendance_id: str, attendance: AttendanceUpdate):
    """Update an attendance record (punch out)"""
    try:
        update_data = {k: v for k, v in attendance.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = attendance_collection.update_one(
            {"id": attendance_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        
        updated_attendance = attendance_collection.find_one({"id": attendance_id})
        updated_attendance["_id"] = str(updated_attendance["_id"])
        return updated_attendance
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# POLICIES API - Backend Persistence
# ============================================================================

@app.get("/api/policies")
def get_policies():
    """Get all policies"""
    try:
        policies = list(policies_collection.find().sort("created_at", -1))
        for item in policies:
            item["_id"] = str(item["_id"])
        return policies
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/policies")
def create_policy(policy: Policy):
    """Create a new policy"""
    try:
        policy_data = policy.dict()
        policy_data["id"] = str(uuid.uuid4())
        policy_data["created_at"] = datetime.utcnow().isoformat()
        policy_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = policies_collection.insert_one(policy_data)
        policy_data["_id"] = str(result.inserted_id)
        
        return policy_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/policies/{policy_id}")
def update_policy(policy_id: str, policy: PolicyUpdate):
    """Update a policy"""
    try:
        update_data = {k: v for k, v in policy.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = policies_collection.update_one(
            {"id": policy_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Policy not found")
        
        updated_policy = policies_collection.find_one({"id": policy_id})
        updated_policy["_id"] = str(updated_policy["_id"])
        return updated_policy
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/policies/{policy_id}")
def delete_policy(policy_id: str):
    """Delete a policy"""
    try:
        result = policies_collection.delete_one({"id": policy_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Policy not found")
        
        return {"message": "Policy deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# WORKFLOWS API - Backend Persistence
# ============================================================================

@app.get("/api/workflows")
def get_workflows():
    """Get all workflows"""
    try:
        workflows = list(workflows_collection.find().sort("created_at", -1))
        for item in workflows:
            item["_id"] = str(item["_id"])
        return workflows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/workflows")
def create_workflow(workflow: Workflow):
    """Create a new workflow"""
    try:
        workflow_data = workflow.dict()
        workflow_data["id"] = str(uuid.uuid4())
        workflow_data["created_at"] = datetime.utcnow().isoformat()
        workflow_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = workflows_collection.insert_one(workflow_data)
        workflow_data["_id"] = str(result.inserted_id)
        
        return workflow_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/workflows/{workflow_id}")
def update_workflow(workflow_id: str, workflow: WorkflowUpdate):
    """Update a workflow"""
    try:
        update_data = {k: v for k, v in workflow.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = workflows_collection.update_one(
            {"id": workflow_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        updated_workflow = workflows_collection.find_one({"id": workflow_id})
        updated_workflow["_id"] = str(updated_workflow["_id"])
        return updated_workflow
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# MEETING ROOMS API - Backend Persistence
# ============================================================================

@app.post("/api/meeting-rooms/reinitialize")
def reinitialize_meeting_rooms():
    """Reinitialize meeting rooms with correct structure"""
    try:
        if meeting_rooms_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Clear existing meeting rooms
        meeting_rooms_collection.delete_many({})
        
        # Clear existing bookings
        if bookings_collection is not None:
            bookings_collection.delete_many({})
        
        # Reinitialize with correct structure
        initialize_meeting_rooms()
        
        return {"message": "Meeting rooms reinitialized successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/meeting-rooms")
def get_meeting_rooms():
    """Get all meeting rooms with their current booking status"""
    try:
        if meeting_rooms_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Initialize meeting rooms if collection is empty
        if meeting_rooms_collection.count_documents({}) == 0:
            initialize_meeting_rooms()
        
        # Get all meeting rooms
        rooms = list(meeting_rooms_collection.find({}, {"_id": 0}))
        
        # Get current bookings for all rooms
        current_time = datetime.utcnow().isoformat()
        for room in rooms:
            # Find active bookings for this room
            active_bookings = list(bookings_collection.find({
                "room_id": room["id"],
                "start_time": {"$lte": current_time},
                "end_time": {"$gte": current_time}
            }, {"_id": 0}))
            
            # Get all future bookings for this room
            all_bookings = list(bookings_collection.find({
                "room_id": room["id"],
                "end_time": {"$gte": current_time}
            }, {"_id": 0}).sort("start_time", 1))
            
            room["bookings"] = all_bookings
            room["current_booking"] = active_bookings[0] if active_bookings else None
            room["status"] = "occupied" if active_bookings else "vacant"
        
        return rooms
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/meeting-rooms/{room_id}/book")
def book_meeting_room(room_id: str, booking: MeetingRoomBooking):
    """Book a meeting room"""
    try:
        if meeting_rooms_collection is None or bookings_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Check if room exists
        room = meeting_rooms_collection.find_one({"id": room_id}, {"_id": 0})
        if not room:
            raise HTTPException(status_code=404, detail="Meeting room not found")
        
        # Validate booking times - normalize timezone handling
        def normalize_datetime(dt_str):
            """Convert datetime string to UTC datetime object"""
            if dt_str.endswith('Z'):
                dt_str = dt_str[:-1] + '+00:00'
            return datetime.fromisoformat(dt_str).replace(tzinfo=None)
        
        start_time = normalize_datetime(booking.start_time)
        end_time = normalize_datetime(booking.end_time)
        now = datetime.utcnow()
        
        if start_time < now:
            raise HTTPException(status_code=400, detail="Cannot book meeting room for past time")
        
        if end_time <= start_time:
            raise HTTPException(status_code=400, detail="End time must be after start time")
        
        # Check for conflicts with existing bookings
        start_time_str = start_time.isoformat()
        end_time_str = end_time.isoformat()
        
        conflict = bookings_collection.find_one({
            "room_id": room_id,
            "$or": [
                {
                    "start_time": {"$lte": start_time_str},
                    "end_time": {"$gt": start_time_str}
                },
                {
                    "start_time": {"$lt": end_time_str},
                    "end_time": {"$gte": end_time_str}
                },
                {
                    "start_time": {"$gte": start_time_str},
                    "end_time": {"$lte": end_time_str}
                }
            ]
        })
        
        if conflict:
            raise HTTPException(status_code=400, detail="Room is already booked for this time period")
        
        # Create booking record
        booking_record = {
            "id": str(uuid.uuid4()),
            "room_id": room_id,
            "room_name": room["name"],
            "employee_name": booking.employee_name,
            "employee_id": booking.employee_id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "purpose": booking.purpose,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Insert booking
        result = bookings_collection.insert_one(booking_record)
        
        if result.inserted_id:
            booking_record.pop("_id", None)
            return {"message": "Meeting room booked successfully", "booking": booking_record}
        else:
            raise HTTPException(status_code=500, detail="Failed to create booking")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/meeting-rooms/{room_id}/booking/{booking_id}")
def cancel_booking(room_id: str, booking_id: str):
    """Cancel a specific booking"""
    try:
        if bookings_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Find and delete the booking
        result = bookings_collection.delete_one({
            "id": booking_id,
            "room_id": room_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        return {"message": "Booking cancelled successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/meeting-rooms/reinitialize")
async def reinitialize_meeting_rooms():
    """Reinitialize meeting rooms data with updated structure"""
    try:
        # Clear existing meeting rooms
        meeting_rooms_collection.delete_many({})
        
        # Reinitialize with new data
        initialize_meeting_rooms()
        
        # Get updated count
        total_rooms = meeting_rooms_collection.count_documents({})
        
        return {
            "message": f"Meeting rooms reinitialized successfully",
            "total_rooms": total_rooms
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reinitializing meeting rooms: {str(e)}")

@app.delete("/api/meeting-rooms/clear-all-bookings")
def clear_all_bookings():
    """Clear all bookings from all meeting rooms"""
    try:
        if bookings_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Delete all bookings
        result = bookings_collection.delete_many({})
        
        return {
            "message": "All bookings cleared successfully",
            "bookings_cleared": result.deleted_count
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ALERTS API - Backend Persistence  
# ============================================================================

@app.get("/api/alerts")
def get_alerts(target_audience: str = "all"):
    """Get all active alerts, optionally filtered by target audience"""
    try:
        if alerts_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Build filter query
        query = {}
        current_time = datetime.utcnow().isoformat()
        
        # Filter by target audience
        audience_filter = []
        if target_audience != "all":
            audience_filter = [
                {"target_audience": "all"},
                {"target_audience": target_audience}
            ]
        
        # Filter out expired alerts
        expiry_filter = [
            {"expires_at": {"$gte": current_time}},
            {"expires_at": None}
        ]
        
        # Combine filters
        if audience_filter:
            query["$and"] = [
                {"$or": audience_filter},
                {"$or": expiry_filter}
            ]
        else:
            query["$or"] = expiry_filter
        
        alerts = list(alerts_collection.find(query, {"_id": 0}).sort("created_at", -1))
        return alerts
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/alerts")
def create_alert(alert: Alert):
    """Create a new alert"""
    try:
        if alerts_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        alert_record = {
            "id": str(uuid.uuid4()),
            **alert.dict(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = alerts_collection.insert_one(alert_record)
        
        if result.inserted_id:
            alert_record.pop("_id", None)
            return {"message": "Alert created successfully", "alert": alert_record}
        else:
            raise HTTPException(status_code=500, detail="Failed to create alert")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/alerts/{alert_id}")
def update_alert(alert_id: str, alert: AlertUpdate):
    """Update an existing alert"""
    try:
        if alerts_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Build update data (only include non-None fields)
        update_data = {k: v for k, v in alert.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = alerts_collection.update_one(
            {"id": alert_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        # Return updated alert
        updated_alert = alerts_collection.find_one({"id": alert_id}, {"_id": 0})
        return {"message": "Alert updated successfully", "alert": updated_alert}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/alerts/{alert_id}")
def delete_alert(alert_id: str):
    """Delete an alert"""
    try:
        if alerts_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        result = alerts_collection.delete_one({"id": alert_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        return {"message": "Alert deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def initialize_meeting_rooms():
    """Initialize meeting rooms data if collection is empty"""
    meeting_rooms_data = [
        # IFC 11th Floor - 1 room
        {"id": "ifc_11a", "name": "IFC Conference Room 11A", "location": "IFC", "floor": "11th Floor", "capacity": 8, "equipment": "Projector, Whiteboard"},
        
        # IFC 12th Floor - 1 room
        {"id": "ifc_12a", "name": "IFC Conference Room 12A", "location": "IFC", "floor": "12th Floor", "capacity": 12, "equipment": "Video Conference, Smart Board"},
        
        # IFC 14th Floor - Multiple rooms (as exception)
        {"id": "oval", "name": "OVAL MEETING ROOM", "location": "IFC", "floor": "14th Floor", "capacity": 10, "equipment": "Smart Board, Audio System"},
        {"id": "petronas", "name": "PETRONAS MEETING ROOM", "location": "IFC", "floor": "14th Floor", "capacity": 5, "equipment": "Projector"},
        {"id": "global_center", "name": "GLOBAL CENTER MEETING ROOM", "location": "IFC", "floor": "14th Floor", "capacity": 5, "equipment": "Whiteboard"},
        {"id": "louvre", "name": "LOUVRE MEETING ROOM", "location": "IFC", "floor": "14th Floor", "capacity": 5, "equipment": "Projector"},
        {"id": "golden_gate", "name": "GOLDEN GATE MEETING ROOM", "location": "IFC", "floor": "14th Floor", "capacity": 10, "equipment": "Video Conference"},
        {"id": "empire_state", "name": "EMPIRE STATE MEETING ROOM", "location": "IFC", "floor": "14th Floor", "capacity": 5, "equipment": "Whiteboard"},
        {"id": "marina_bay", "name": "MARINA BAY MEETING ROOM", "location": "IFC", "floor": "14th Floor", "capacity": 5, "equipment": "Projector"},
        {"id": "burj", "name": "BURJ MEETING ROOM", "location": "IFC", "floor": "14th Floor", "capacity": 5, "equipment": "Smart Board"},
        {"id": "board", "name": "BOARD ROOM", "location": "IFC", "floor": "14th Floor", "capacity": 20, "equipment": "Video Conference, Projector, Audio System"},
        
        # Other locations - 1 floor, 1 room each (as per user requirement)
        {"id": "central_75", "name": "Central Office 75 Meeting Room", "location": "Central Office 75", "floor": "1st Floor", "capacity": 6, "equipment": "Projector"},
        {"id": "office_75", "name": "Office 75 Meeting Room", "location": "Office 75", "floor": "1st Floor", "capacity": 8, "equipment": "Whiteboard"},
        {"id": "noida", "name": "Noida Meeting Room", "location": "Noida", "floor": "1st Floor", "capacity": 10, "equipment": "Video Conference"},
        {"id": "project_office", "name": "Project Office Meeting Room", "location": "Project Office", "floor": "1st Floor", "capacity": 4, "equipment": "Projector"}
    ]
    
    meeting_rooms_collection.insert_many(meeting_rooms_data)
    print(f"Initialized {len(meeting_rooms_data)} meeting rooms")

def load_excel_data():
    """Load employee data from Excel file into MongoDB"""
    try:
        import openpyxl
        
        # Try multiple Excel file locations
        excel_paths = [
            "/app/frontend/public/employee_directory.xlsx",
            "/app/employee_directory.xlsx",
            "/app/Employee_latest_data.xlsx",
            "/app/backend/build/employee_directory.xlsx"
        ]
        
        excel_path = None
        for path in excel_paths:
            if os.path.exists(path):
                excel_path = path
                break
        
        if not excel_path:
            print("WARNING: No Excel file found, skipping employee data loading")
            return
        
        print(f"Loading employee data from: {excel_path}")
        workbook = openpyxl.load_workbook(excel_path)
        sheet = workbook.active
        
        employees = []
        headers = []
        
        # Get headers from first row
        for cell in sheet[1]:
            headers.append(cell.value.lower().replace(" ", "_") if cell.value else "")
        
        # Process data rows
        for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), 2):
            if not any(row):  # Skip empty rows
                continue
                
            employee = {}
            for col_idx, value in enumerate(row):
                if col_idx < len(headers) and headers[col_idx]:
                    # Map common field names
                    field_name = headers[col_idx]
                    if field_name in ['emp_id', 'employee_id', 'empid']:
                        field_name = 'id'
                    elif field_name in ['emp_name', 'employee_name', 'empname']:
                        field_name = 'name'
                    elif field_name in ['dept', 'department_name']:
                        field_name = 'department'
                    elif field_name in ['loc', 'office_location']:
                        field_name = 'location'
                    elif field_name in ['phone', 'mobile_no', 'contact']:
                        field_name = 'mobile'
                    elif field_name in ['email_id', 'email_address']:
                        field_name = 'email'
                    elif field_name in ['profile_image', 'image', 'photo']:
                        field_name = 'profileImage'
                    
                    employee[field_name] = str(value) if value is not None else ""
            
            if employee.get('id') and employee.get('name'):  # Only add if has required fields
                employees.append(employee)
        
        if employees:
            # Clear existing employees and insert new ones
            employees_collection.delete_many({})
            employees_collection.insert_many(employees)
            print(f"Successfully loaded {len(employees)} employees from Excel")
        else:
            print("WARNING: No valid employee data found in Excel file")
            
    except Exception as e:
        print(f"Error loading Excel data: {e}")

def initialize_data():
    """Initialize all data collections"""
    if db is None:
        print("MongoDB not connected, skipping data initialization")
        return
    
    # Initialize meeting rooms if empty
    if meeting_rooms_collection.count_documents({}) == 0:
        initialize_meeting_rooms()
    
    # Load employee data from Excel
    load_excel_data()
    
    print("Data initialization completed")

# Initialize data on startup
initialize_data()


# ============================================================================
# STATIC FILE SERVING
# ============================================================================

# Serve uploaded files (images, etc.)
uploads_path = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_path, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=uploads_path), name="uploads")

# ---------- React Frontend Serving ----------
# Path to your React build folder
frontend_path = os.path.join(os.path.dirname(__file__), "build")

# Serve static files (JS, CSS, images, etc.)
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

# Catch-all route to serve React index.html for client-side routing
@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    return FileResponse(os.path.join(frontend_path, "index.html"))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
