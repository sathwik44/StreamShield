import os
import sqlite3
import uuid
import hashlib
import math
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

# --- 1. APP SETUP ---
app = FastAPI(title="SecureStream Enterprise")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. CITY COORDINATES (For Impossible Travel Math) ---
CITIES = {
    "Vijayawada": (16.5062, 80.6480),
    "Delhi": (28.7041, 77.1025),
    "Mumbai": (19.0760, 72.8777)
}

def calculate_distance(city1: str, city2: str):
    if city1 not in CITIES or city2 not in CITIES: return 0
    lat1, lon1 = CITIES[city1]
    lat2, lon2 = CITIES[city2]
    
    R = 6371 
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# --- 3. DATABASE SETUP ---
DB_FILE = "securestream_live.db"

def get_db_connection():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row 
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            suspicion_score INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS active_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT NOT NULL,
            location TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# --- 4. SCHEMAS & DEPENDENCIES ---
class UserAuthSchema(BaseModel):
    email: EmailStr
    password: str

def enforce_risk_threshold(email: str):
    conn = get_db_connection()
    user = conn.execute("SELECT suspicion_score FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    
    if user and user["suspicion_score"] >= 80:
        raise HTTPException(status_code=403, detail="Account Locked: Suspicious sharing activity detected. Risk Score > 80%.")

# --- 5. ROUTES ---
@app.post("/api/auth/register")
def register(user_data: UserAuthSchema):
    conn = get_db_connection()
    if conn.execute("SELECT email FROM users WHERE email = ?", (user_data.email,)).fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = hashlib.sha256(user_data.password.encode('utf-8')).hexdigest()
    role = "admin" if user_data.email == "admin@securestream.com" else "user"
    
    conn.execute("INSERT INTO users (email, hashed_password, role) VALUES (?, ?, ?)", (user_data.email, hashed_pw, role))
    conn.commit()
    conn.close()
    return {"msg": "Registration successful"}

@app.post("/api/auth/login")
def login(user_data: UserAuthSchema, request: Request):
    conn = get_db_connection()
    enforce_risk_threshold(user_data.email)
    
    user = conn.execute("SELECT * FROM users WHERE email = ?", (user_data.email,)).fetchone()
    if not user or user["hashed_password"] != hashlib.sha256(user_data.password.encode('utf-8')).hexdigest():
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    current_city = request.headers.get("X-Mock-City", "Vijayawada")
    
    last_session = conn.execute(
        "SELECT location, created_at FROM active_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", (user["id"],)
    ).fetchone()

    if last_session and last_session["location"] != current_city:
        distance_km = calculate_distance(last_session["location"], current_city)
        last_time = datetime.strptime(last_session["created_at"], "%Y-%m-%d %H:%M:%S")
        time_diff_hours = (datetime.utcnow() - last_time).total_seconds() / 3600
        time_diff_hours = max(time_diff_hours, 0.001) 
        
        speed_kmh = distance_km / time_diff_hours
        
        if speed_kmh > 1000:
            new_score = user["suspicion_score"] + 20
            conn.execute("UPDATE users SET suspicion_score = ? WHERE id = ?", (new_score, user["id"]))
            conn.commit()
            
            if new_score >= 80:
                conn.execute("DELETE FROM active_sessions WHERE user_id = ?", (user["id"],))
                conn.commit()
                conn.close()
                raise HTTPException(status_code=403, detail="Account Locked: Risk Score hit 80%.")

    sessions = conn.execute("SELECT id FROM active_sessions WHERE user_id = ? ORDER BY created_at ASC", (user["id"],)).fetchall()
    if len(sessions) >= 2:
        conn.execute("DELETE FROM active_sessions WHERE id = ?", (sessions[0]["id"],))

    new_token = f"sess_{uuid.uuid4().hex[:12]}"
    conn.execute("INSERT INTO active_sessions (user_id, session_token, location) VALUES (?, ?, ?)", (user["id"], new_token, current_city))
    
    final_score = conn.execute("SELECT suspicion_score FROM users WHERE id = ?", (user["id"],)).fetchone()["suspicion_score"]
    conn.commit()
    conn.close()
        
    return {
        "access_token": f"token-{user['id']}", 
        "token_type": "bearer",
        "role": user["role"],
        "session_id": new_token,
        "risk_score": final_score
    }

@app.get("/api/admin/users")
def get_all_users():
    conn = get_db_connection()
    users = conn.execute("SELECT id, email, role, suspicion_score, created_at FROM users").fetchall()
    
    result = []
    for u in users:
        latest_session = conn.execute("SELECT session_token FROM active_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", (u["id"],)).fetchone()
        result.append({
            "id": u["id"],
            "email": u["email"],
            "is_active": "Suspended" if u["suspicion_score"] >= 80 else "Active",
            "joined": u["created_at"],
            "session_id": latest_session["session_token"] if latest_session else "N/A",
            "risk_score": u["suspicion_score"]
        })
        
    conn.close()
    return result

@app.get("/api/admin/threats")
def get_threat_heap():
    conn = get_db_connection()
    threats = conn.execute('''
        SELECT email, suspicion_score 
        FROM users 
        WHERE suspicion_score > 0 
        ORDER BY suspicion_score DESC
    ''').fetchall()
    conn.close()
    
    result = []
    for t in threats:
        result.append({
            "user": t["email"],
            "score": t["suspicion_score"],
            "reason": "Geographic Anomaly / Impossible Travel"
        })
        
    return result
@app.get("/api/video/stream/{video_id}")
def stream_video(video_id: int, request: Request):
    # 1. Locate the secure file
    # (In a real app, you would look up the video_id in the DB. We will hardcode it for this demo)
    VIDEO_PATH = "assets/trailers/the_lighter.mp4"
    
    if not os.path.exists(VIDEO_PATH):
        raise HTTPException(status_code=404, detail="Secure asset not found on server.")

    file_size = os.path.getsize(VIDEO_PATH)

    # 2. Read the "Range" header sent by the React video player
    # It looks like this: "bytes=1048576-"
    range_header = request.headers.get("Range")
    
    # 3. Calculate the Exact Math
    if not range_header:
        # If no range is requested, start at byte 0 and serve the first 1MB chunk
        start = 0
        end = min(file_size - 1, 1024 * 1024) 
    else:
        # Parse the requested byte range
        start = int(range_header.replace("bytes=", "").split("-")[0])
        # Serve exactly 1MB from the requested start point
        end = min(start + (1024 * 1024), file_size - 1) 

    # 4. Read ONLY that specific 1MB chunk from the hard drive in binary mode ("rb")
    with open(VIDEO_PATH, "rb") as video:
        video.seek(start)
        data = video.read(end - start + 1)

    # 5. Build the strict HTTP 206 Partial Content headers
    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(len(data)),
        "Content-Type": "video/mp4",
    }

    # Return the encrypted chunk!
    return Response(content=data, status_code=206, headers=headers)