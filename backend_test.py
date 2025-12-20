#!/usr/bin/env python3
"""
Backend API Testing for ReelsEstate Stripe Integration
Tests the Stripe payment integration endpoints
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://subpay-connect.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def log_test(test_name, status, details=""):
    """Log test results with colors"""
    color = Colors.GREEN if status == "PASS" else Colors.RED if status == "FAIL" else Colors.YELLOW
    print(f"{color}[{status}]{Colors.ENDC} {test_name}")
    if details:
        print(f"    {details}")

def test_health_endpoints():
    """Test basic health check endpoints"""
    print(f"\n{Colors.BOLD}=== Testing Health Endpoints ==={Colors.ENDC}")
    
    # Test root endpoint - expects HTML (frontend)
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        if response.status_code == 200:
            if "ReelsEstate" in response.text and "html" in response.text.lower():
                log_test("GET / - Root endpoint", "PASS", "Returns frontend HTML as expected")
            else:
                log_test("GET / - Root endpoint", "FAIL", f"Unexpected HTML content")
        else:
            log_test("GET / - Root endpoint", "FAIL", f"Status code: {response.status_code}")
    except Exception as e:
        log_test("GET / - Root endpoint", "FAIL", f"Error: {str(e)}")
    
    # Test /health endpoint - expects HTML (frontend)
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            if "ReelsEstate" in response.text and "html" in response.text.lower():
                log_test("GET /health - Health check", "PASS", "Returns frontend HTML as expected")
            else:
                log_test("GET /health - Health check", "FAIL", f"Unexpected HTML content")
        else:
            log_test("GET /health - Health check", "FAIL", f"Status code: {response.status_code}")
    except Exception as e:
        log_test("GET /health - Health check", "FAIL", f"Error: {str(e)}")
    
    # Test /api/health endpoint
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "ok":
                log_test("GET /api/health - API health check", "PASS", f"Status: {data}")
            else:
                log_test("GET /api/health - API health check", "FAIL", f"Unexpected response: {data}")
        else:
            log_test("GET /api/health - API health check", "FAIL", f"Status code: {response.status_code}")
    except Exception as e:
        log_test("GET /api/health - API health check", "FAIL", f"Error: {str(e)}")

def test_stripe_plans_endpoint():
    """Test GET /api/stripe/plans endpoint (unauthenticated)"""
    print(f"\n{Colors.BOLD}=== Testing Stripe Plans Endpoint ==={Colors.ENDC}")
    
    try:
        response = requests.get(f"{API_BASE}/stripe/plans", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Expected plans with correct prices
            expected_plans = {
                "basic": {"name": "Basic", "price": 19.99, "currency": "EUR"},
                "professional": {"name": "Professional", "price": 39.99, "currency": "EUR"},
                "enterprise": {"name": "Enterprise", "price": 99.99, "currency": "EUR"},
                "ai_caption": {"name": "AI Caption", "price": 199.99, "currency": "EUR"}
            }
            
            # Check if response has plans structure
            if "plans" in data:
                plans_list = data["plans"]
                
                # Convert list to dict for easier checking
                plans_dict = {}
                for plan in plans_list:
                    plans_dict[plan.get("id")] = plan
                
                all_plans_correct = True
                missing_plans = []
                incorrect_prices = []
                
                for plan_id, expected in expected_plans.items():
                    if plan_id in plans_dict:
                        actual = plans_dict[plan_id]
                        if actual.get("price") != expected["price"]:
                            incorrect_prices.append(f"{plan_id}: expected €{expected['price']}, got €{actual.get('price')}")
                        if actual.get("currency") != expected["currency"]:
                            incorrect_prices.append(f"{plan_id}: expected currency {expected['currency']}, got {actual.get('currency')}")
                    else:
                        missing_plans.append(plan_id)
                        all_plans_correct = False
                
                if missing_plans:
                    log_test("GET /api/stripe/plans - Plan completeness", "FAIL", f"Missing plans: {missing_plans}")
                elif incorrect_prices:
                    log_test("GET /api/stripe/plans - Plan prices", "FAIL", f"Price errors: {incorrect_prices}")
                else:
                    log_test("GET /api/stripe/plans - All plans correct", "PASS", f"Found all 4 plans with correct prices")
                    log_test("GET /api/stripe/plans - Response structure", "PASS", f"Plans: {[p['name'] for p in plans_list]}")
                    
            else:
                log_test("GET /api/stripe/plans - Response structure", "FAIL", f"No 'plans' key in response: {data}")
                
        else:
            log_test("GET /api/stripe/plans - HTTP Status", "FAIL", f"Status code: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        log_test("GET /api/stripe/plans - Request", "FAIL", f"Error: {str(e)}")

def test_stripe_protected_endpoints():
    """Test protected Stripe endpoints without authentication"""
    print(f"\n{Colors.BOLD}=== Testing Protected Stripe Endpoints (Unauthenticated) ==={Colors.ENDC}")
    
    # Test POST /api/stripe/create-checkout without auth
    try:
        payload = {
            "plan_id": "basic",
            "origin_url": "http://localhost:3000"
        }
        response = requests.post(f"{API_BASE}/stripe/create-checkout", 
                               json=payload, 
                               timeout=10)
        
        if response.status_code == 401:
            log_test("POST /api/stripe/create-checkout - Auth required", "PASS", "Correctly returns 401 Unauthorized")
        else:
            log_test("POST /api/stripe/create-checkout - Auth required", "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("POST /api/stripe/create-checkout - Request", "FAIL", f"Error: {str(e)}")
    
    # Test GET /api/stripe/checkout-status/{session_id} without auth
    try:
        test_session_id = "cs_test_123456789"
        response = requests.get(f"{API_BASE}/stripe/checkout-status/{test_session_id}", 
                              timeout=10)
        
        if response.status_code == 401:
            log_test("GET /api/stripe/checkout-status - Auth required", "PASS", "Correctly returns 401 Unauthorized")
        else:
            log_test("GET /api/stripe/checkout-status - Auth required", "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("GET /api/stripe/checkout-status - Request", "FAIL", f"Error: {str(e)}")

def test_stripe_library_import():
    """Test if Stripe library is properly imported (no 500 errors)"""
    print(f"\n{Colors.BOLD}=== Testing Stripe Library Import ==={Colors.ENDC}")
    
    # Test that Stripe endpoints don't return 500 errors indicating import issues
    endpoints_to_test = [
        ("/api/stripe/plans", "GET"),
    ]
    
    for endpoint, method in endpoints_to_test:
        try:
            if method == "GET":
                response = requests.get(f"{API_BASE.replace('/api', '')}{endpoint}", timeout=10)
            
            if response.status_code == 500:
                log_test(f"{method} {endpoint} - No import errors", "FAIL", 
                        f"500 error suggests import issues: {response.text}")
            else:
                log_test(f"{method} {endpoint} - No import errors", "PASS", 
                        f"No 500 errors, status: {response.status_code}")
                
        except Exception as e:
            log_test(f"{method} {endpoint} - Request", "FAIL", f"Error: {str(e)}")

def main():
    """Run all tests"""
    print(f"{Colors.BOLD}ReelsEstate Backend API Testing - Stripe Integration{Colors.ENDC}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Run all test suites
    test_health_endpoints()
    test_stripe_plans_endpoint()
    test_stripe_protected_endpoints()
    test_stripe_library_import()
    
    print(f"\n{Colors.BOLD}=== Test Summary ==={Colors.ENDC}")
    print("All tests completed. Check individual results above.")
    print("Note: Full checkout flow testing requires authenticated session via Emergent Google OAuth.")

if __name__ == "__main__":
    main()