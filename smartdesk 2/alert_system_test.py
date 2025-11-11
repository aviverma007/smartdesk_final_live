#!/usr/bin/env python3
"""
Alert System Comprehensive Testing Script
Specifically tests the Alert System to verify that "alerts are being created but not saved in the system" is resolved.
"""

import requests
import json
import sys
import os
import uuid
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

class AlertSystemTester:
    def __init__(self):
        self.backend_url = get_backend_url()
        if not self.backend_url:
            print("❌ Could not get backend URL from frontend/.env")
            sys.exit(1)
        
        print(f"🔗 Testing Alert System at: {self.backend_url}")
        self.test_results = []
        self.session = requests.Session()
        self.session.timeout = 30
        self.created_alert_ids = []

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

    def test_1_alert_creation_basic(self):
        """Test 1: Basic Alert Creation - POST /api/alerts"""
        try:
            print("\n📝 TEST 1: ALERT CREATION")
            print("-" * 40)
            
            # Test creating a basic alert
            test_alert = {
                "title": "Test Alert - Basic Creation",
                "message": "This is a test alert to verify basic creation functionality.",
                "priority": "medium",
                "type": "general",
                "target_audience": "all",
                "created_by": "Test System"
            }
            
            response = self.session.post(f"{self.backend_url}/api/alerts", json=test_alert)
            
            if response.status_code == 200:
                result = response.json()
                alert_data = result.get('alert', {})
                alert_id = alert_data.get('id')
                
                if alert_id:
                    self.created_alert_ids.append(alert_id)
                    self.log_test("Alert Creation - Basic", True, 
                                f"Successfully created alert with ID: {alert_id}", 
                                f"Title: {alert_data.get('title')}, Priority: {alert_data.get('priority')}")
                    return alert_id
                else:
                    self.log_test("Alert Creation - Basic", False, 
                                "Alert created but no ID returned")
                    return None
            else:
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                except:
                    error_detail = response.text
                self.log_test("Alert Creation - Basic", False, 
                            f"Failed to create alert - Status: {response.status_code}", 
                            f"Error: {error_detail}")
                return None
                
        except Exception as e:
            self.log_test("Alert Creation - Basic", False, f"Exception during alert creation: {str(e)}")
            return None

    def test_2_alert_persistence_verification(self):
        """Test 2: Alert Persistence - Verify alerts are saved and retrievable"""
        try:
            print("\n💾 TEST 2: ALERT PERSISTENCE VERIFICATION")
            print("-" * 40)
            
            # First, get current alerts count
            initial_response = self.session.get(f"{self.backend_url}/api/alerts")
            if initial_response.status_code != 200:
                self.log_test("Alert Persistence - Initial Check", False, 
                            f"Failed to get initial alerts: {initial_response.status_code}")
                return
            
            initial_alerts = initial_response.json()
            initial_count = len(initial_alerts)
            
            # Create multiple test alerts with different properties
            test_alerts = [
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
                    "title": "User Announcement",
                    "message": "New features have been added to the user dashboard.",
                    "priority": "medium",
                    "type": "announcement",
                    "target_audience": "user",
                    "created_by": "Product Team",
                    "expires_at": (datetime.now() + timedelta(hours=48)).isoformat()
                },
                {
                    "title": "Admin Only Alert",
                    "message": "Admin-specific configuration changes required.",
                    "priority": "urgent",
                    "type": "general",
                    "target_audience": "admin",
                    "created_by": "IT Department"
                    # No expiry date for this one
                }
            ]
            
            created_ids = []
            for i, alert_data in enumerate(test_alerts):
                response = self.session.post(f"{self.backend_url}/api/alerts", json=alert_data)
                if response.status_code == 200:
                    result = response.json()
                    alert_id = result.get('alert', {}).get('id')
                    if alert_id:
                        created_ids.append(alert_id)
                        self.created_alert_ids.append(alert_id)
                        self.log_test(f"Alert Creation - Test {i+1}", True, 
                                    f"Created alert: {alert_data['title']}", 
                                    f"ID: {alert_id}, Target: {alert_data['target_audience']}")
                    else:
                        self.log_test(f"Alert Creation - Test {i+1}", False, 
                                    f"Alert created but no ID returned for: {alert_data['title']}")
                else:
                    self.log_test(f"Alert Creation - Test {i+1}", False, 
                                f"Failed to create alert: {alert_data['title']} - Status: {response.status_code}")
            
            # Now verify all alerts are persisted and retrievable
            verification_response = self.session.get(f"{self.backend_url}/api/alerts")
            if verification_response.status_code == 200:
                all_alerts = verification_response.json()
                final_count = len(all_alerts)
                new_alerts_count = final_count - initial_count
                
                if new_alerts_count >= len(created_ids):
                    self.log_test("Alert Persistence - Database Save", True, 
                                f"All created alerts are persisted in database", 
                                f"Initial: {initial_count}, Final: {final_count}, New: {new_alerts_count}")
                    
                    # Verify specific alerts exist
                    found_alerts = 0
                    for alert_id in created_ids:
                        alert_found = any(alert.get('id') == alert_id for alert in all_alerts)
                        if alert_found:
                            found_alerts += 1
                    
                    if found_alerts == len(created_ids):
                        self.log_test("Alert Persistence - Specific Verification", True, 
                                    f"All {len(created_ids)} created alerts found in database", 
                                    f"Verified by ID lookup - no alerts lost")
                    else:
                        self.log_test("Alert Persistence - Specific Verification", False, 
                                    f"Only {found_alerts}/{len(created_ids)} alerts found by ID")
                else:
                    self.log_test("Alert Persistence - Database Save", False, 
                                f"Not all alerts persisted - Expected {len(created_ids)}, got {new_alerts_count}")
            else:
                self.log_test("Alert Persistence - Database Save", False, 
                            f"Failed to verify persistence: {verification_response.status_code}")
                
        except Exception as e:
            self.log_test("Alert Persistence - Verification", False, f"Exception during persistence test: {str(e)}")

    def test_3_alert_listing_retrieval(self):
        """Test 3: Alert Listing - GET /api/alerts returns all saved alerts"""
        try:
            print("\n📋 TEST 3: ALERT LISTING & RETRIEVAL")
            print("-" * 40)
            
            # Test basic GET /api/alerts
            response = self.session.get(f"{self.backend_url}/api/alerts")
            
            if response.status_code == 200:
                alerts = response.json()
                
                if isinstance(alerts, list):
                    self.log_test("Alert Listing - Basic GET", True, 
                                f"Successfully retrieved alerts list with {len(alerts)} alerts", 
                                f"Response is valid JSON array")
                    
                    # Verify alert structure
                    if alerts:
                        sample_alert = alerts[0]
                        required_fields = ['id', 'title', 'message', 'priority', 'type', 'target_audience', 'created_by', 'created_at']
                        missing_fields = [field for field in required_fields if field not in sample_alert]
                        
                        if not missing_fields:
                            self.log_test("Alert Listing - Data Structure", True, 
                                        "Alert data structure is complete", 
                                        f"All required fields present: {required_fields}")
                        else:
                            self.log_test("Alert Listing - Data Structure", False, 
                                        f"Missing required fields: {missing_fields}")
                    else:
                        self.log_test("Alert Listing - Data Structure", True, 
                                    "No alerts to verify structure (empty list is valid)")
                else:
                    self.log_test("Alert Listing - Basic GET", False, 
                                "GET /api/alerts did not return a list")
            else:
                self.log_test("Alert Listing - Basic GET", False, 
                            f"GET /api/alerts failed with status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Alert Listing - Retrieval", False, f"Exception during listing test: {str(e)}")

    def test_4_alert_filtering_by_audience(self):
        """Test 4: Alert Filtering - GET /api/alerts with target_audience filtering"""
        try:
            print("\n🎯 TEST 4: ALERT FILTERING BY TARGET AUDIENCE")
            print("-" * 40)
            
            # Test filtering for different audiences
            audiences = ['all', 'user', 'admin']
            
            for audience in audiences:
                response = self.session.get(f"{self.backend_url}/api/alerts?target_audience={audience}")
                
                if response.status_code == 200:
                    filtered_alerts = response.json()
                    
                    if isinstance(filtered_alerts, list):
                        # Verify filtering logic
                        valid_alerts = []
                        invalid_alerts = []
                        
                        for alert in filtered_alerts:
                            alert_audience = alert.get('target_audience')
                            # For a specific audience, should see 'all' and that specific audience
                            if audience == 'all' or alert_audience in ['all', audience]:
                                valid_alerts.append(alert)
                            else:
                                invalid_alerts.append(alert)
                        
                        if len(invalid_alerts) == 0:
                            self.log_test(f"Alert Filtering - {audience.upper()}", True, 
                                        f"Filtering for '{audience}' working correctly - {len(filtered_alerts)} alerts", 
                                        f"All alerts have appropriate target_audience")
                        else:
                            self.log_test(f"Alert Filtering - {audience.upper()}", False, 
                                        f"Filtering for '{audience}' returning incorrect alerts", 
                                        f"Found {len(invalid_alerts)} alerts with wrong audience")
                    else:
                        self.log_test(f"Alert Filtering - {audience.upper()}", False, 
                                    f"Filtering for '{audience}' did not return a list")
                else:
                    self.log_test(f"Alert Filtering - {audience.upper()}", False, 
                                f"Filtering for '{audience}' failed with status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Alert Filtering - Audience", False, f"Exception during filtering test: {str(e)}")

    def test_5_alert_updates(self):
        """Test 5: Alert Updates - PUT /api/alerts/{alert_id}"""
        try:
            print("\n✏️ TEST 5: ALERT UPDATES")
            print("-" * 40)
            
            # Create a test alert to update
            test_alert = {
                "title": "Update Test Alert",
                "message": "This alert will be updated during testing.",
                "priority": "low",
                "type": "general",
                "target_audience": "all",
                "created_by": "Test System"
            }
            
            create_response = self.session.post(f"{self.backend_url}/api/alerts", json=test_alert)
            
            if create_response.status_code == 200:
                created_alert = create_response.json()
                alert_id = created_alert.get('alert', {}).get('id')
                
                if alert_id:
                    self.created_alert_ids.append(alert_id)
                    
                    # Test updating the alert
                    update_data = {
                        "title": "UPDATED - Update Test Alert",
                        "message": "This alert has been successfully updated during testing.",
                        "priority": "high",
                        "target_audience": "admin"
                    }
                    
                    update_response = self.session.put(f"{self.backend_url}/api/alerts/{alert_id}", json=update_data)
                    
                    if update_response.status_code == 200:
                        updated_alert = update_response.json()
                        alert_data = updated_alert.get('alert', {})
                        
                        # Verify updates were applied
                        title_updated = alert_data.get('title') == update_data['title']
                        message_updated = alert_data.get('message') == update_data['message']
                        priority_updated = alert_data.get('priority') == update_data['priority']
                        audience_updated = alert_data.get('target_audience') == update_data['target_audience']
                        
                        if all([title_updated, message_updated, priority_updated, audience_updated]):
                            self.log_test("Alert Updates - PUT Operation", True, 
                                        f"Successfully updated alert {alert_id}", 
                                        f"All fields updated correctly")
                            
                            # Verify update persisted by fetching the alert again
                            verify_response = self.session.get(f"{self.backend_url}/api/alerts")
                            if verify_response.status_code == 200:
                                all_alerts = verify_response.json()
                                updated_alert_found = next((alert for alert in all_alerts if alert.get('id') == alert_id), None)
                                
                                if updated_alert_found and updated_alert_found.get('title') == update_data['title']:
                                    self.log_test("Alert Updates - Persistence", True, 
                                                "Alert updates persisted in database", 
                                                f"Updated alert found with new title")
                                else:
                                    self.log_test("Alert Updates - Persistence", False, 
                                                "Alert updates not persisted in database")
                        else:
                            failed_updates = []
                            if not title_updated: failed_updates.append('title')
                            if not message_updated: failed_updates.append('message')
                            if not priority_updated: failed_updates.append('priority')
                            if not audience_updated: failed_updates.append('target_audience')
                            
                            self.log_test("Alert Updates - PUT Operation", False, 
                                        f"Alert update failed for fields: {failed_updates}")
                    else:
                        self.log_test("Alert Updates - PUT Operation", False, 
                                    f"PUT request failed with status: {update_response.status_code}")
                else:
                    self.log_test("Alert Updates - Setup", False, 
                                "Could not create test alert for update testing")
            else:
                self.log_test("Alert Updates - Setup", False, 
                            f"Failed to create test alert: {create_response.status_code}")
                
        except Exception as e:
            self.log_test("Alert Updates - Operation", False, f"Exception during update test: {str(e)}")

    def test_6_alert_deletion(self):
        """Test 6: Alert Deletion - DELETE /api/alerts/{alert_id}"""
        try:
            print("\n🗑️ TEST 6: ALERT DELETION")
            print("-" * 40)
            
            # Create a test alert to delete
            test_alert = {
                "title": "Delete Test Alert",
                "message": "This alert will be deleted during testing.",
                "priority": "medium",
                "type": "general",
                "target_audience": "all",
                "created_by": "Test System"
            }
            
            create_response = self.session.post(f"{self.backend_url}/api/alerts", json=test_alert)
            
            if create_response.status_code == 200:
                created_alert = create_response.json()
                alert_id = created_alert.get('alert', {}).get('id')
                
                if alert_id:
                    # Verify alert exists before deletion
                    pre_delete_response = self.session.get(f"{self.backend_url}/api/alerts")
                    if pre_delete_response.status_code == 200:
                        pre_delete_alerts = pre_delete_response.json()
                        alert_exists = any(alert.get('id') == alert_id for alert in pre_delete_alerts)
                        
                        if alert_exists:
                            # Delete the alert
                            delete_response = self.session.delete(f"{self.backend_url}/api/alerts/{alert_id}")
                            
                            if delete_response.status_code == 200:
                                self.log_test("Alert Deletion - DELETE Operation", True, 
                                            f"Successfully deleted alert {alert_id}", 
                                            f"DELETE request returned success")
                                
                                # Verify alert is actually removed from database
                                post_delete_response = self.session.get(f"{self.backend_url}/api/alerts")
                                if post_delete_response.status_code == 200:
                                    post_delete_alerts = post_delete_response.json()
                                    alert_still_exists = any(alert.get('id') == alert_id for alert in post_delete_alerts)
                                    
                                    if not alert_still_exists:
                                        self.log_test("Alert Deletion - Database Removal", True, 
                                                    "Alert successfully removed from database", 
                                                    f"Alert {alert_id} no longer appears in GET response")
                                        # Remove from our cleanup list since it's already deleted
                                        if alert_id in self.created_alert_ids:
                                            self.created_alert_ids.remove(alert_id)
                                    else:
                                        self.log_test("Alert Deletion - Database Removal", False, 
                                                    "Alert still exists in database after deletion")
                                else:
                                    self.log_test("Alert Deletion - Database Removal", False, 
                                                f"Could not verify deletion: {post_delete_response.status_code}")
                            else:
                                self.log_test("Alert Deletion - DELETE Operation", False, 
                                            f"DELETE request failed with status: {delete_response.status_code}")
                        else:
                            self.log_test("Alert Deletion - Setup", False, 
                                        "Test alert not found before deletion attempt")
                else:
                    self.log_test("Alert Deletion - Setup", False, 
                                "Could not create test alert for deletion testing")
            else:
                self.log_test("Alert Deletion - Setup", False, 
                            f"Failed to create test alert: {create_response.status_code}")
                
        except Exception as e:
            self.log_test("Alert Deletion - Operation", False, f"Exception during deletion test: {str(e)}")

    def test_7_database_persistence_across_requests(self):
        """Test 7: Database Persistence - Verify alerts persist across multiple requests"""
        try:
            print("\n🔄 TEST 7: DATABASE PERSISTENCE ACROSS REQUESTS")
            print("-" * 40)
            
            # Create a test alert
            test_alert = {
                "title": "Persistence Test Alert",
                "message": "This alert tests persistence across multiple requests.",
                "priority": "medium",
                "type": "system",
                "target_audience": "all",
                "created_by": "Persistence Tester"
            }
            
            create_response = self.session.post(f"{self.backend_url}/api/alerts", json=test_alert)
            
            if create_response.status_code == 200:
                created_alert = create_response.json()
                alert_id = created_alert.get('alert', {}).get('id')
                
                if alert_id:
                    self.created_alert_ids.append(alert_id)
                    
                    # Make multiple requests to verify persistence
                    persistence_checks = []
                    
                    for i in range(5):  # Test 5 separate requests
                        # Create a new session for each request to simulate different connections
                        test_session = requests.Session()
                        test_session.timeout = 30
                        
                        check_response = test_session.get(f"{self.backend_url}/api/alerts")
                        if check_response.status_code == 200:
                            alerts = check_response.json()
                            alert_found = any(alert.get('id') == alert_id for alert in alerts)
                            persistence_checks.append(alert_found)
                        else:
                            persistence_checks.append(False)
                        
                        test_session.close()
                    
                    successful_checks = sum(persistence_checks)
                    
                    if successful_checks == 5:
                        self.log_test("Database Persistence - Multiple Requests", True, 
                                    f"Alert persisted across all {len(persistence_checks)} requests", 
                                    f"Alert {alert_id} found in all requests")
                    else:
                        self.log_test("Database Persistence - Multiple Requests", False, 
                                    f"Alert persistence inconsistent - found in {successful_checks}/5 requests")
                    
                    # Test persistence with different query parameters
                    param_tests = [
                        {},  # No parameters
                        {"target_audience": "all"},  # With audience filter
                        {"target_audience": "user"},  # Different audience filter
                    ]
                    
                    param_results = []
                    for params in param_tests:
                        param_response = self.session.get(f"{self.backend_url}/api/alerts", params=params)
                        if param_response.status_code == 200:
                            param_alerts = param_response.json()
                            # For 'all' and 'user' audience, our alert should appear (target_audience='all')
                            # For 'admin' audience, it should not appear
                            expected_to_appear = params.get('target_audience') != 'admin'
                            alert_found = any(alert.get('id') == alert_id for alert in param_alerts)
                            param_results.append(alert_found == expected_to_appear)
                        else:
                            param_results.append(False)
                    
                    if all(param_results):
                        self.log_test("Database Persistence - Query Parameters", True, 
                                    "Alert persistence works correctly with different query parameters", 
                                    f"All {len(param_results)} parameter tests passed")
                    else:
                        self.log_test("Database Persistence - Query Parameters", False, 
                                    f"Alert persistence issues with query parameters - {sum(param_results)}/{len(param_results)} passed")
                else:
                    self.log_test("Database Persistence - Setup", False, 
                                "Could not create test alert for persistence testing")
            else:
                self.log_test("Database Persistence - Setup", False, 
                            f"Failed to create test alert: {create_response.status_code}")
                
        except Exception as e:
            self.log_test("Database Persistence - Across Requests", False, f"Exception during persistence test: {str(e)}")

    def test_8_edge_cases_and_expiry(self):
        """Test 8: Edge Cases - Alerts with and without expiry dates, different audiences"""
        try:
            print("\n🎭 TEST 8: EDGE CASES & EXPIRY HANDLING")
            print("-" * 40)
            
            # Test Case 1: Alert without expiry date
            no_expiry_alert = {
                "title": "No Expiry Alert",
                "message": "This alert has no expiry date and should always appear.",
                "priority": "low",
                "type": "general",
                "target_audience": "all",
                "created_by": "Edge Case Tester"
                # No expires_at field
            }
            
            no_expiry_response = self.session.post(f"{self.backend_url}/api/alerts", json=no_expiry_alert)
            no_expiry_id = None
            
            if no_expiry_response.status_code == 200:
                no_expiry_result = no_expiry_response.json()
                no_expiry_id = no_expiry_result.get('alert', {}).get('id')
                if no_expiry_id:
                    self.created_alert_ids.append(no_expiry_id)
                    self.log_test("Edge Cases - No Expiry Alert", True, 
                                f"Successfully created alert without expiry date", 
                                f"Alert ID: {no_expiry_id}")
                else:
                    self.log_test("Edge Cases - No Expiry Alert", False, 
                                "Alert created but no ID returned")
            else:
                self.log_test("Edge Cases - No Expiry Alert", False, 
                            f"Failed to create no-expiry alert: {no_expiry_response.status_code}")
            
            # Test Case 2: Alert with future expiry date
            future_expiry_alert = {
                "title": "Future Expiry Alert",
                "message": "This alert expires in the future and should appear.",
                "priority": "medium",
                "type": "announcement",
                "target_audience": "user",
                "created_by": "Edge Case Tester",
                "expires_at": (datetime.now() + timedelta(hours=48)).isoformat()
            }
            
            future_expiry_response = self.session.post(f"{self.backend_url}/api/alerts", json=future_expiry_alert)
            future_expiry_id = None
            
            if future_expiry_response.status_code == 200:
                future_expiry_result = future_expiry_response.json()
                future_expiry_id = future_expiry_result.get('alert', {}).get('id')
                if future_expiry_id:
                    self.created_alert_ids.append(future_expiry_id)
                    self.log_test("Edge Cases - Future Expiry Alert", True, 
                                f"Successfully created alert with future expiry", 
                                f"Alert ID: {future_expiry_id}")
                else:
                    self.log_test("Edge Cases - Future Expiry Alert", False, 
                                "Alert created but no ID returned")
            else:
                self.log_test("Edge Cases - Future Expiry Alert", False, 
                            f"Failed to create future-expiry alert: {future_expiry_response.status_code}")
            
            # Test Case 3: Alert with past expiry date (should be filtered out)
            past_expiry_alert = {
                "title": "Expired Alert",
                "message": "This alert is already expired and should not appear in active alerts.",
                "priority": "high",
                "type": "system",
                "target_audience": "admin",
                "created_by": "Edge Case Tester",
                "expires_at": (datetime.now() - timedelta(hours=2)).isoformat()  # 2 hours ago
            }
            
            past_expiry_response = self.session.post(f"{self.backend_url}/api/alerts", json=past_expiry_alert)
            past_expiry_id = None
            
            if past_expiry_response.status_code == 200:
                past_expiry_result = past_expiry_response.json()
                past_expiry_id = past_expiry_result.get('alert', {}).get('id')
                if past_expiry_id:
                    # Don't add to cleanup list since it should be filtered out anyway
                    self.log_test("Edge Cases - Expired Alert Creation", True, 
                                f"Successfully created expired alert", 
                                f"Alert ID: {past_expiry_id}")
                else:
                    self.log_test("Edge Cases - Expired Alert Creation", False, 
                                "Expired alert created but no ID returned")
            else:
                self.log_test("Edge Cases - Expired Alert Creation", False, 
                            f"Failed to create expired alert: {past_expiry_response.status_code}")
            
            # Test Case 4: Verify expiry filtering works
            all_alerts_response = self.session.get(f"{self.backend_url}/api/alerts")
            if all_alerts_response.status_code == 200:
                active_alerts = all_alerts_response.json()
                
                # Check if non-expired alerts appear
                no_expiry_found = no_expiry_id and any(alert.get('id') == no_expiry_id for alert in active_alerts)
                future_expiry_found = future_expiry_id and any(alert.get('id') == future_expiry_id for alert in active_alerts)
                
                # Check if expired alert is filtered out
                past_expiry_found = past_expiry_id and any(alert.get('id') == past_expiry_id for alert in active_alerts)
                
                if no_expiry_found and future_expiry_found and not past_expiry_found:
                    self.log_test("Edge Cases - Expiry Filtering", True, 
                                "Expiry filtering working correctly", 
                                "Non-expired alerts appear, expired alerts filtered out")
                else:
                    issues = []
                    if not no_expiry_found: issues.append("no-expiry alert missing")
                    if not future_expiry_found: issues.append("future-expiry alert missing")
                    if past_expiry_found: issues.append("expired alert not filtered")
                    
                    self.log_test("Edge Cases - Expiry Filtering", False, 
                                f"Expiry filtering issues: {', '.join(issues)}")
            
            # Test Case 5: Different audience combinations
            audience_tests = [
                ("all", ["all", "user", "admin"]),  # 'all' should appear for everyone
                ("user", ["all", "user"]),          # 'user' should appear for 'all' and 'user'
                ("admin", ["all", "admin"])         # 'admin' should appear for 'all' and 'admin'
            ]
            
            audience_results = []
            for target_audience, should_appear_for in audience_tests:
                for query_audience in ["all", "user", "admin"]:
                    audience_response = self.session.get(f"{self.backend_url}/api/alerts?target_audience={query_audience}")
                    if audience_response.status_code == 200:
                        audience_alerts = audience_response.json()
                        
                        # Find alerts with the target audience
                        matching_alerts = [alert for alert in audience_alerts if alert.get('target_audience') == target_audience]
                        
                        should_appear = query_audience in should_appear_for
                        actually_appears = len(matching_alerts) > 0
                        
                        audience_results.append(should_appear == actually_appears)
            
            if all(audience_results):
                self.log_test("Edge Cases - Audience Combinations", True, 
                            f"All audience filtering combinations working correctly", 
                            f"Tested {len(audience_results)} combinations")
            else:
                failed_tests = len(audience_results) - sum(audience_results)
                self.log_test("Edge Cases - Audience Combinations", False, 
                            f"Audience filtering issues - {failed_tests}/{len(audience_results)} tests failed")
                
        except Exception as e:
            self.log_test("Edge Cases - Comprehensive", False, f"Exception during edge cases test: {str(e)}")

    def cleanup_test_alerts(self):
        """Clean up all test alerts created during testing"""
        print("\n🧹 Cleaning up test alerts...")
        
        cleanup_count = 0
        for alert_id in self.created_alert_ids:
            try:
                response = self.session.delete(f"{self.backend_url}/api/alerts/{alert_id}")
                if response.status_code == 200:
                    cleanup_count += 1
                    print(f"   ✅ Cleaned up alert: {alert_id}")
                else:
                    print(f"   ⚠️ Failed to cleanup alert: {alert_id} (Status: {response.status_code})")
            except Exception as e:
                print(f"   ❌ Error cleaning up alert {alert_id}: {str(e)}")
        
        print(f"🧹 Cleanup completed: {cleanup_count}/{len(self.created_alert_ids)} alerts cleaned up")

    def run_comprehensive_alert_tests(self):
        """Run all alert system tests"""
        print("🚀 STARTING COMPREHENSIVE ALERT SYSTEM TESTING")
        print("=" * 60)
        print("Testing to verify: 'alerts are being created but not saved in the system' is RESOLVED")
        print("=" * 60)
        
        # Run all tests
        self.test_1_alert_creation_basic()
        self.test_2_alert_persistence_verification()
        self.test_3_alert_listing_retrieval()
        self.test_4_alert_filtering_by_audience()
        self.test_5_alert_updates()
        self.test_6_alert_deletion()
        self.test_7_database_persistence_across_requests()
        self.test_8_edge_cases_and_expiry()
        
        # Cleanup
        self.cleanup_test_alerts()
        
        # Summary
        print("\n" + "=" * 60)
        print("🏁 ALERT SYSTEM TESTING SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['message']}")
        
        # Final verdict on the reported issue
        print("\n" + "=" * 60)
        print("🎯 VERDICT ON REPORTED ISSUE")
        print("=" * 60)
        
        # Key tests that directly address the reported issue
        key_tests = [
            "Alert Creation - Basic",
            "Alert Persistence - Database Save", 
            "Alert Persistence - Specific Verification",
            "Database Persistence - Multiple Requests"
        ]
        
        key_test_results = [result for result in self.test_results if any(key in result['test'] for key in key_tests)]
        key_passed = sum(1 for result in key_test_results if result['success'])
        
        if key_passed == len(key_test_results) and len(key_test_results) > 0:
            print("✅ ISSUE RESOLVED: Alerts are being created AND saved in the system correctly")
            print("   • Alert creation works properly")
            print("   • Alerts are persisted in MongoDB database")
            print("   • Alerts can be retrieved after creation")
            print("   • Database persistence works across multiple requests")
        else:
            print("❌ ISSUE PERSISTS: Problems detected with alert creation/saving")
            print("   • Some alert system functionality is not working correctly")
            print("   • Review failed tests above for specific issues")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = AlertSystemTester()
    success = tester.run_comprehensive_alert_tests()
    sys.exit(0 if success else 1)