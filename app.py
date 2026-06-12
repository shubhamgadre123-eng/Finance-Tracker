import os
import datetime
import uuid
import qrcode
import io
import base64

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt


load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/finance_tracker")
JWT_SECRET = os.getenv("JWT_SECRET", "dev_secret")
PORT = int(os.getenv("PORT", "5000"))


client = MongoClient(MONGO_URI)
try:
    db = client.get_default_database()
except ValueError:
    db = client["finance_tracker"]
users_col = db["users"]
user_data_col = db["user_data"]
payments_col = db["payments"]
qr_payments_col = db["qr_payments"]


app = Flask(__name__)
CORS(app)


def build_client_user(doc):
    """Shape user document for frontend."""
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name"),
        "email": doc.get("email"),
        "username": doc.get("username"),
        "phone": doc.get("phone"),
        "country": doc.get("country"),
        "dateOfBirth": doc.get("dateOfBirth"),
        "currency": doc.get("currency", "INR"),
        "createdAt": doc.get("createdAt"),
    }


def token_required(fn):
    """Simple auth decorator using JWT in Authorization header."""
    from functools import wraps

    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header[7:] if auth_header.startswith("Bearer ") else None

        if not token:
            return jsonify({"error": "No token provided"}), 401

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.PyJWTError:
            return jsonify({"error": "Invalid token"}), 401

        request.user_id = payload.get("id")
        if not request.user_id:
            return jsonify({"error": "Invalid token payload"}), 401

        return fn(*args, **kwargs)

    return wrapper


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/api/auth/register")
def register():
    try:
        data = request.get_json(force=True, silent=True) or {}
        name = data.get("name")
        email = data.get("email")
        phone = data.get("phone")
        country = data.get("country")
        dateOfBirth = data.get("dateOfBirth")
        username = data.get("username")
        password = data.get("password")
        confirm_password = data.get("confirmPassword")

        if not all([name, email, username, password, confirm_password]):
            return jsonify({"error": "Missing required fields"}), 400

        if password != confirm_password:
            return jsonify({"error": "Passwords do not match"}), 400

        if users_col.find_one({"email": email}):
            return jsonify({"error": "Email already in use"}), 400
        if users_col.find_one({"username": username}):
            return jsonify({"error": "Username already in use"}), 400

        password_hash = generate_password_hash(password)
        now = datetime.datetime.utcnow().isoformat()

        user_doc = {
            "name": name,
            "email": email,
            "phone": phone,
            "country": country,
            "dateOfBirth": dateOfBirth,
            "username": username,
            "passwordHash": password_hash,
            "currency": "INR",
            "createdAt": now,
        }

        result = users_col.insert_one(user_doc)
        user_id = result.inserted_id

        # Initialise empty snapshot
        user_data_col.update_one(
            {"userId": user_id},
            {
                "$setOnInsert": {
                    "userId": user_id,
                    "db": {
                        "users": [],
                        "transactions": [],
                        "budgets": [],
                        "goals": [],
                        "bankAccounts": [],
                        "upiDetails": [],
                    },
                    "createdAt": now,
                    "updatedAt": now,
                }
            },
            upsert=True,
        )

        return jsonify({"message": "User registered successfully"}), 201
    
    except ValueError as e:
        print(f"[REGISTER] Validation error: {e}")
        return jsonify({"error": "Invalid input format"}), 400
    except Exception as e:
        print(f"[REGISTER] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Registration failed. Please try again."}), 500


@app.post("/api/auth/login")
def login():
    try:
        data = request.get_json(force=True, silent=True) or {}
        identifier = data.get("identifier")
        password = data.get("password")

        if not identifier or not password:
            return jsonify({"error": "Missing credentials"}), 400

        user_doc = (
            users_col.find_one({"email": identifier})
            or users_col.find_one({"username": identifier})
            or users_col.find_one({"phone": identifier})
        )

        if not user_doc:
            return jsonify({"error": "Invalid credentials"}), 401

        if not check_password_hash(user_doc.get("passwordHash", ""), password):
            return jsonify({"error": "Invalid credentials"}), 401

        payload = {
            "id": str(user_doc["_id"]),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

        return jsonify({"token": token, "user": build_client_user(user_doc)})
    
    except jwt.PyJWTError as e:
        print(f"[LOGIN] JWT error: {e}")
        return jsonify({"error": "Token generation failed"}), 500
    except Exception as e:
        print(f"[LOGIN] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Login failed. Please try again."}), 500


@app.get("/api/data")
@token_required
def get_data():
    try:
        user_id = request.user_id
        try:
            user_obj_id = ObjectId(user_id)
        except Exception:
            return jsonify({"error": "Invalid user id"}), 400

        doc = user_data_col.find_one({"userId": user_obj_id}) or {}
        db_snapshot = doc.get(
            "db",
            {
                "users": [],
                "transactions": [],
                "budgets": [],
                "goals": [],
                "bankAccounts": [],
                "upiDetails": [],
            },
        )
        return jsonify({"db": db_snapshot})
    
    except Exception as e:
        print(f"[GET_DATA] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to retrieve data"}), 500


@app.post("/api/data")
@token_required
def save_data():
    try:
        user_id = request.user_id
        data = request.get_json(force=True, silent=True) or {}
        db_payload = data.get("db")

        if not isinstance(db_payload, dict):
            return jsonify({"error": "Invalid db payload"}), 400

        now = datetime.datetime.utcnow().isoformat()

        try:
            user_obj_id = ObjectId(user_id)
        except Exception:
            return jsonify({"error": "Invalid user id"}), 400

        result = user_data_col.update_one(
            {"userId": user_obj_id},
            {"$set": {"db": db_payload, "updatedAt": now}, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        )

        return jsonify({"message": "Data synced successfully", "modifiedCount": result.modified_count})
    
    except Exception as e:
        print(f"[SAVE_DATA] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to save data"}), 500


# ==================== BANK ACCOUNT ENDPOINTS ====================

@app.post("/api/banks/account")
@token_required
def add_bank_account():
    """Add bank account with initial balance"""
    user_id = request.user_id
    data = request.get_json(force=True, silent=True) or {}
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    bank_name = data.get("bankName")
    account_holder = data.get("accountHolder")
    account_number = data.get("accountNumber")
    account_type = data.get("accountType")
    balance = data.get("balance", 0)
    
    if not all([bank_name, account_holder, account_number]):
        return jsonify({"error": "Missing required fields"}), 400
    
    now = datetime.datetime.utcnow().isoformat()
    account_id = str(uuid.uuid4())
    
    account_doc = {
        "id": account_id,
        "bankName": bank_name,
        "accountHolder": account_holder,
        "accountNumber": account_number,
        "accountType": account_type,
        "balance": float(balance),
        "createdAt": now,
        "updatedAt": now,
    }
    
    user_data_col.update_one(
        {"userId": user_obj_id},
        {"$push": {"db.bankAccounts": account_doc}},
        upsert=True,
    )
    
    return jsonify({"message": "Bank account added", "account": account_doc}), 201


@app.put("/api/banks/account/<account_id>/balance")
@token_required
def update_bank_balance(account_id):
    """Update bank account balance"""
    user_id = request.user_id
    data = request.get_json(force=True, silent=True) or {}
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    new_balance = data.get("balance")
    
    if new_balance is None:
        return jsonify({"error": "Balance is required"}), 400
    
    now = datetime.datetime.utcnow().isoformat()
    
    user_data_col.update_one(
        {"userId": user_obj_id, "db.bankAccounts.id": account_id},
        {
            "$set": {
                "db.bankAccounts.$.balance": float(new_balance),
                "db.bankAccounts.$.updatedAt": now,
            }
        },
    )
    
    return jsonify({"message": "Balance updated successfully"})


@app.get("/api/banks/accounts")
@token_required
def get_bank_accounts():
    """Get all bank accounts for user"""
    user_id = request.user_id
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    doc = user_data_col.find_one({"userId": user_obj_id}) or {}
    accounts = doc.get("db", {}).get("bankAccounts", [])
    
    return jsonify({"accounts": accounts})


# ==================== GOAL PAYMENT ENDPOINTS ====================

@app.post("/api/goals/payment")
@token_required
def make_goal_payment():
    """Make a payment towards a goal"""
    user_id = request.user_id
    data = request.get_json(force=True, silent=True) or {}
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    goal_id = data.get("goalId")
    amount = data.get("amount")
    payment_method = data.get("paymentMethod", "direct")
    
    if not goal_id or not amount:
        return jsonify({"error": "Missing required fields"}), 400
    
    if float(amount) <= 0:
        return jsonify({"error": "Amount must be greater than 0"}), 400
    
    now = datetime.datetime.utcnow().isoformat()
    payment_id = str(uuid.uuid4())
    
    # Record payment
    payment_doc = {
        "id": payment_id,
        "userId": user_obj_id,
        "goalId": goal_id,
        "amount": float(amount),
        "paymentMethod": payment_method,
        "status": "pending",
        "createdAt": now,
    }
    
    payments_col.insert_one(payment_doc)
    
    # Update goal progress
    user_data_col.update_one(
        {"userId": user_obj_id, "db.goals.id": goal_id},
        {
            "$inc": {"db.goals.$.currentAmount": float(amount)},
            "$set": {"db.goals.$.updatedAt": now},
        },
    )
    
    return jsonify({
        "message": "Payment recorded",
        "paymentId": payment_id,
        "amount": amount,
        "goalId": goal_id
    }), 201


@app.post("/api/goals/qr-payment")
@token_required
def qr_goal_payment():
    """Record QR code payment for goal"""
    user_id = request.user_id
    data = request.get_json(force=True, silent=True) or {}
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    goal_id = data.get("goalId")
    amount = data.get("amount")
    transaction_ref = data.get("transactionRef")  # UPI transaction reference
    
    if not all([goal_id, amount, transaction_ref]):
        return jsonify({"error": "Missing required fields"}), 400
    
    now = datetime.datetime.utcnow().isoformat()
    qr_payment_id = str(uuid.uuid4())
    
    qr_doc = {
        "id": qr_payment_id,
        "userId": user_obj_id,
        "goalId": goal_id,
        "amount": float(amount),
        "transactionRef": transaction_ref,
        "status": "completed",
        "createdAt": now,
    }
    
    qr_payments_col.insert_one(qr_doc)
    
    # Update goal
    user_data_col.update_one(
        {"userId": user_obj_id, "db.goals.id": goal_id},
        {
            "$inc": {"db.goals.$.currentAmount": float(amount)},
            "$set": {"db.goals.$.updatedAt": now},
        },
    )
    
    return jsonify({
        "message": "QR payment recorded",
        "qrPaymentId": qr_payment_id,
        "status": "completed"
    }), 201


@app.get("/api/goals/<goal_id>/payments")
@token_required
def get_goal_payments(goal_id):
    """Get all payments for a goal"""
    user_id = request.user_id
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    payments = list(payments_col.find(
        {"userId": user_obj_id, "goalId": goal_id},
        {"_id": 0}
    ))
    
    qr_payments = list(qr_payments_col.find(
        {"userId": user_obj_id, "goalId": goal_id},
        {"_id": 0}
    ))
    
    return jsonify({
        "regularPayments": payments,
        "qrPayments": qr_payments
    })


# ==================== QR CODE GENERATION ====================

@app.post("/api/qr/generate")
@token_required
def generate_qr_code():
    """Generate QR code for UPI payment"""
    user_id = request.user_id
    data = request.get_json(force=True, silent=True) or {}
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    goal_id = data.get("goalId")
    amount = data.get("amount")
    upi_id = data.get("upiId")  # Receiver UPI ID
    
    if not all([goal_id, amount, upi_id]):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Create UPI string for payment
    upi_string = f"upi://pay?pa={upi_id}&pn=Finance%20Tracker&tr={goal_id}&am={amount}"
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(upi_string)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    qr_code_id = str(uuid.uuid4())
    
    return jsonify({
        "qrCodeId": qr_code_id,
        "qrCode": f"data:image/png;base64,{img_str}",
        "upiString": upi_string,
        "amount": amount,
        "goalId": goal_id
    }), 201


# ==================== USER PROFILE UPDATE ====================

@app.put("/api/user/profile")
@token_required
def update_user_profile():
    """Update user profile including DOB"""
    user_id = request.user_id
    data = request.get_json(force=True, silent=True) or {}
    
    name = data.get("name")
    phone = data.get("phone")
    country = data.get("country")
    dateOfBirth = data.get("dateOfBirth")
    
    now = datetime.datetime.utcnow().isoformat()
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    update_doc = {"updatedAt": now}
    if name:
        update_doc["name"] = name
    if phone:
        update_doc["phone"] = phone
    if country:
        update_doc["country"] = country
    if dateOfBirth:
        update_doc["dateOfBirth"] = dateOfBirth
    
    users_col.update_one(
        {"_id": user_obj_id},
        {"$set": update_doc}
    )
    
    user_doc = users_col.find_one({"_id": user_obj_id})
    
    return jsonify({"message": "Profile updated", "user": build_client_user(user_doc)})


@app.get("/api/user/profile")
@token_required
def get_user_profile():
    """Get user profile"""
    user_id = request.user_id
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    user_doc = users_col.find_one({"_id": user_obj_id})
    
    if not user_doc:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify({"user": build_client_user(user_doc)})


# ==================== IFSC CODE LOOKUP & BANK DETAILS ====================

# Indian Bank IFSC Database (common banks)
IFSC_DATABASE = {
    "HDFC": {
        "name": "HDFC Bank",
        "branches": {
            "HDFC0000001": {"city": "New Delhi", "state": "Delhi", "branch": "Head Office"},
            "HDFC0001234": {"city": "Mumbai", "state": "Maharashtra", "branch": "Fort Branch"},
            "HDFC0005678": {"city": "Bangalore", "state": "Karnataka", "branch": "Indiranagar"},
        }
    },
    "ICIC": {
        "name": "ICICI Bank",
        "branches": {
            "ICIC0000001": {"city": "Mumbai", "state": "Maharashtra", "branch": "Head Office"},
            "ICIC0001234": {"city": "Delhi", "state": "Delhi", "branch": "Connaught Place"},
        }
    },
    "SBIN": {
        "name": "State Bank of India",
        "branches": {
            "SBIN0000001": {"city": "New Delhi", "state": "Delhi", "branch": "Main Branch"},
            "SBIN0001234": {"city": "Kolkata", "state": "West Bengal", "branch": "BBD Bag"},
        }
    },
    "AXIS": {
        "name": "Axis Bank",
        "branches": {
            "AXIS0000001": {"city": "Mumbai", "state": "Maharashtra", "branch": "Corporate Office"},
            "AXIS0001234": {"city": "Pune", "state": "Maharashtra", "branch": "Camp Branch"},
        }
    },
    "INDB": {
        "name": "IndusInd Bank",
        "branches": {
            "INDB0000001": {"city": "Mumbai", "state": "Maharashtra", "branch": "Head Office"},
        }
    },
    "KOTAK": {
        "name": "Kotak Mahindra Bank",
        "branches": {
            "KKBK0000001": {"city": "Mumbai", "state": "Maharashtra", "branch": "Head Office"},
        }
    },
}

@app.post("/api/banks/ifsc-lookup")
@token_required
def ifsc_lookup():
    """Lookup IFSC code and get bank details"""
    try:
        data = request.get_json(force=True, silent=True) or {}
        ifsc_code = data.get("ifscCode", "").upper()
        
        if not ifsc_code or len(ifsc_code) < 4:
            return jsonify({"error": "Invalid IFSC code"}), 400
        
        # Extract bank code (first 4 characters)
        bank_code = ifsc_code[:4]
        
        # Check in local database first
        if bank_code in IFSC_DATABASE:
            bank_info = IFSC_DATABASE[bank_code]
            
            # Try to find matching branch
            branch_info = None
            if ifsc_code in bank_info.get("branches", {}):
                branch_info = bank_info["branches"][ifsc_code]
            
            return jsonify({
                "success": True,
                "bank": {
                    "code": bank_code,
                    "name": bank_info["name"],
                    "ifscCode": ifsc_code,
                    "branch": branch_info or {"city": "Unknown", "state": "Unknown", "branch": "Branch"},
                    "address": f"{branch_info.get('branch', 'Branch')}, {branch_info.get('city', 'City')}, {branch_info.get('state', 'State')}" if branch_info else "Details not available"
                }
            })
        
        # If not found, use Razorpay IFSC API (public, no authentication needed)
        try:
            import requests
            response = requests.get(f"https://ifsc.razorpay.com/{ifsc_code}", timeout=5)
            
            if response.status_code == 200:
                api_data = response.json()
                return jsonify({
                    "success": True,
                    "bank": {
                        "code": bank_code,
                        "name": api_data.get("BANK", "Unknown Bank"),
                        "ifscCode": ifsc_code,
                        "branch": api_data.get("BRANCH", "Branch"),
                        "address": f"{api_data.get('BRANCH', 'Branch')}, {api_data.get('CITY', 'City')}, {api_data.get('STATE', 'State')}"
                    }
                })
        except requests.exceptions.Timeout:
            print(f"[IFSC_LOOKUP] API timeout for {ifsc_code}")
            return jsonify({"error": "IFSC lookup service timeout"}), 504
        except requests.exceptions.RequestException as e:
            print(f"[IFSC_LOOKUP] API error: {e}")
            return jsonify({"error": "IFSC lookup service error"}), 503
        except Exception as e:
            print(f"[IFSC_LOOKUP] Processing error: {e}")
        
        return jsonify({"error": "IFSC code not found"}), 404
    
    except Exception as e:
        print(f"[IFSC_LOOKUP] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "IFSC lookup failed"}), 500


@app.post("/api/banks/account/with-balance")
@token_required
def add_bank_account_with_balance():
    """Add bank account with balance tracking"""
    user_id = request.user_id
    data = request.get_json(force=True, silent=True) or {}
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    bank_name = data.get("bankName")
    account_holder = data.get("accountHolder")
    account_number = data.get("accountNumber")
    account_type = data.get("accountType")
    ifsc_code = data.get("ifscCode", "")
    branch_name = data.get("branchName", "")
    balance = data.get("balance", 0)
    
    if not all([bank_name, account_holder, account_number]):
        return jsonify({"error": "Missing required fields"}), 400
    
    now = datetime.datetime.utcnow().isoformat()
    account_id = str(uuid.uuid4())
    
    account_doc = {
        "id": account_id,
        "bankName": bank_name,
        "accountHolder": account_holder,
        "accountNumber": account_number,
        "accountType": account_type,
        "ifscCode": ifsc_code,
        "branchName": branch_name,
        "balance": float(balance),
        "transactions": [],
        "createdAt": now,
        "updatedAt": now,
    }
    
    user_data_col.update_one(
        {"userId": user_obj_id},
        {"$push": {"db.bankAccounts": account_doc}},
        upsert=True,
    )
    
    return jsonify({"message": "Bank account added", "account": account_doc}), 201


@app.post("/api/banks/account/<account_id>/transaction")
@token_required
def record_bank_transaction(account_id):
    """Record a transaction in bank account"""
    user_id = request.user_id
    data = request.get_json(force=True, silent=True) or {}
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    amount = data.get("amount")
    transaction_type = data.get("type")  # 'credit' or 'debit'
    description = data.get("description", "")
    
    if not amount or not transaction_type:
        return jsonify({"error": "Missing required fields"}), 400
    
    if transaction_type not in ["credit", "debit"]:
        return jsonify({"error": "Invalid transaction type"}), 400
    
    now = datetime.datetime.utcnow().isoformat()
    
    # Calculate new balance
    amount_change = float(amount) if transaction_type == "credit" else -float(amount)
    
    user_data_col.update_one(
        {"userId": user_obj_id, "db.bankAccounts.id": account_id},
        {
            "$inc": {"db.bankAccounts.$.balance": amount_change},
            "$push": {
                "db.bankAccounts.$.transactions": {
                    "amount": float(amount),
                    "type": transaction_type,
                    "description": description,
                    "timestamp": now,
                }
            },
            "$set": {"db.bankAccounts.$.updatedAt": now},
        },
    )
    
    return jsonify({"message": "Transaction recorded", "amount_change": amount_change})


@app.get("/api/banks/list")
def get_supported_banks():
    """Get list of supported Indian banks"""
    return jsonify({
        "banks": [
            {"code": "HDFC", "name": "HDFC Bank"},
            {"code": "ICIC", "name": "ICICI Bank"},
            {"code": "SBIN", "name": "State Bank of India"},
            {"code": "AXIS", "name": "Axis Bank"},
            {"code": "INDB", "name": "IndusInd Bank"},
            {"code": "KOTAK", "name": "Kotak Mahindra Bank"},
            {"code": "YESB", "name": "YES Bank"},
            {"code": "FDRL", "name": "Federal Bank"},
            {"code": "IDBI", "name": "IDBI Bank"},
            {"code": "AIRB", "name": "Airtel Payments Bank"},
            {"code": "AUBL", "name": "AU Small Finance Bank"},
            {"code": "BOIB", "name": "Bank of India"},
            {"code": "BKID", "name": "Bank of Baroda"},
            {"code": "CANB", "name": "Canara Bank"},
            {"code": "UTIB", "name": "Axis Bank"},
            {"code": "PNAB", "name": "PNB"},
        ]
    })


@app.post("/api/banks/account/<account_id>/link-upi")
@token_required
def link_upi_to_bank(account_id):
    """Link UPI to bank account"""
    user_id = request.user_id
    data = request.get_json(force=True, silent=True) or {}
    
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400
    
    upi_id = data.get("upiId")
    upi_provider = data.get("upiProvider")
    
    if not upi_id:
        return jsonify({"error": "UPI ID is required"}), 400
    
    now = datetime.datetime.utcnow().isoformat()
    
    user_data_col.update_one(
        {"userId": user_obj_id, "db.bankAccounts.id": account_id},
        {
            "$set": {
                "db.bankAccounts.$.linkedUPI": upi_id,
                "db.bankAccounts.$.upiProvider": upi_provider,
                "db.bankAccounts.$.updatedAt": now,
            }
        },
    )
    
    return jsonify({"message": "UPI linked to bank account"})


# ==================== APPLICATION START ====================

if __name__ == "__main__":
    # Get host and port from environment variables
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("DEBUG", "False").lower() == "true"
    
    print(f"\n{'='*50}")
    print(f"Finance Tracker API Server")
    print(f"{'='*50}")
    print(f"🚀 Starting server...")
    print(f"📍 Host: {HOST}")
    print(f"🔌 Port: {PORT}")
    print(f"🐛 Debug Mode: {DEBUG}")
    print(f"📊 Database: {MONGO_URI}")
    print(f"{'='*50}\n")
    
    try:
        app.run(host=HOST, port=PORT, debug=DEBUG)
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()


