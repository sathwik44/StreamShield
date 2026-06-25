import os
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
import hashlib
import math
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

# --- 1. APP SETUP ---
app = FastAPI(title="SecureStream Enterprise")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, put your Vercel URL here
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # THIS LINE IS CRITICAL FOR VIDEO STREAMING:
    expose_headers=["Content-Range", "Accept-Ranges"] 
)

# --- 2. CITY COORDINATES ---
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

# --- 3. DATABASE SETUP (Neon PostgreSQL) ---
def get_db_connection():
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL environment variable is missing. Check Render settings.")
        
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    conn.autocommit = True 
    return conn

def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                suspicion_score INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cur.execute('''
            CREATE TABLE IF NOT EXISTS active_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                session_token TEXT NOT NULL,
                location TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # 🔴 NEW: Add the missing table for telemetry logging!
        cur.execute('''
            CREATE TABLE IF NOT EXISTS stream_logs (
                id SERIAL PRIMARY KEY,
                session_token TEXT NOT NULL,
                movie_title TEXT NOT NULL,
                access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                location TEXT
            )
        ''')
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Skipping DB Init locally. Ensure cloud deployment. Error: {e}")

init_db()

# --- 4. SCHEMAS & DEPENDENCIES ---
class UserAuthSchema(BaseModel):
    email: EmailStr
    password: str

def enforce_risk_threshold(email: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT suspicion_score FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if user and user["suspicion_score"] >= 80:
        raise HTTPException(status_code=403, detail="Account Locked: Suspicious sharing activity detected. Risk Score > 80%.")

# --- 5. ROUTES ---
@app.post("/api/auth/register")
def register(user_data: UserAuthSchema):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT email FROM users WHERE email = %s", (user_data.email,))
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = hashlib.sha256(user_data.password.encode('utf-8')).hexdigest()
    role = "admin" if user_data.email == "admin@securestream.com" else "user"
    
    cur.execute("INSERT INTO users (email, hashed_password, role) VALUES (%s, %s, %s)", (user_data.email, hashed_pw, role))
    cur.close()
    conn.close()
    return {"msg": "Registration successful"}

@app.post("/api/auth/login")
def login(user_data: UserAuthSchema, request: Request):
    enforce_risk_threshold(user_data.email)
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = %s", (user_data.email,))
    user = cur.fetchone()
    
    if not user or user["hashed_password"] != hashlib.sha256(user_data.password.encode('utf-8')).hexdigest():
        cur.close()
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    current_city = request.headers.get("X-Mock-City", "Vijayawada")
    
    cur.execute("SELECT location, created_at FROM active_sessions WHERE user_id = %s ORDER BY created_at DESC LIMIT 1", (user["id"],))
    last_session = cur.fetchone()

    if last_session and last_session["location"] != current_city:
        distance_km = calculate_distance(last_session["location"], current_city)
        
        # Postgres returns proper datetimes!
        last_time = last_session["created_at"]
        if isinstance(last_time, str):
            last_time = datetime.strptime(last_time.split(".")[0], "%Y-%m-%d %H:%M:%S")
            
        time_diff_hours = (datetime.utcnow() - last_time).total_seconds() / 3600
        time_diff_hours = max(time_diff_hours, 0.001) 
        speed_kmh = distance_km / time_diff_hours
        
        if speed_kmh > 1000:
            new_score = user["suspicion_score"] + 20
            cur.execute("UPDATE users SET suspicion_score = %s WHERE id = %s", (new_score, user["id"]))
            
            if new_score >= 80:
                cur.execute("DELETE FROM active_sessions WHERE user_id = %s", (user["id"],))
                cur.close()
                conn.close()
                raise HTTPException(status_code=403, detail="Account Locked: Risk Score hit 80%.")

    cur.execute("SELECT id FROM active_sessions WHERE user_id = %s ORDER BY created_at ASC", (user["id"],))
    sessions = cur.fetchall()
    if len(sessions) >= 2:
        cur.execute("DELETE FROM active_sessions WHERE id = %s", (sessions[0]["id"],))

    new_token = f"sess_{uuid.uuid4().hex[:12]}"
    cur.execute("INSERT INTO active_sessions (user_id, session_token, location) VALUES (%s, %s, %s)", (user["id"], new_token, current_city))
    
    cur.execute("SELECT suspicion_score FROM users WHERE id = %s", (user["id"],))
    final_score = cur.fetchone()["suspicion_score"]
    
    cur.close()
    conn.close()
        
    return {
        "access_token": f"token-{user['id']}", 
        "token_type": "bearer",
        "role": user["role"],
        "session_id": new_token,
        "risk_score": final_score
    }
@app.post("/api/logs/stream")
def log_stream(log_data: dict, request: Request):
    conn = get_db_connection()
    cur = conn.cursor()
    # Captures the user's activity for the Graph Engine
    cur.execute('''
        INSERT INTO stream_logs (session_token, movie_title, ip_address, location) 
        VALUES (%s, %s, %s, %s)
    ''', (
        log_data["session_token"], 
        log_data["movie_title"], 
        request.client.host, 
        request.headers.get("X-Mock-City", "Unknown")
    ))
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "logged"}

@app.get("/api/admin/users")
def get_all_users():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, email, role, suspicion_score, created_at FROM users")
    users = cur.fetchall()
    
    result = []
    for u in users:
        cur.execute("SELECT session_token FROM active_sessions WHERE user_id = %s ORDER BY created_at DESC LIMIT 1", (u["id"],))
        latest_session = cur.fetchone()
        
        join_date = u["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(u["created_at"], datetime) else u["created_at"]
        
        result.append({
            "id": u["id"],
            "email": u["email"],
            "is_active": "Suspended" if u["suspicion_score"] >= 80 else "Active",
            "joined": join_date,
            "session_id": latest_session["session_token"] if latest_session else "N/A",
            "risk_score": u["suspicion_score"]
        })
        
    cur.close()
    conn.close()
    return result

@app.get("/api/admin/threats")
def get_threat_heap():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        SELECT email, suspicion_score 
        FROM users 
        WHERE suspicion_score > 0 
        ORDER BY suspicion_score DESC
    ''')
    threats = cur.fetchall()
    cur.close()
    conn.close()
    
    result = []
    for t in threats:
        result.append({
            "user": t["email"],
            "score": t["suspicion_score"],
            "reason": "Geographic Anomaly / Impossible Travel"
        })
    return result

@app.get("/api/admin/trace/{session_id}")
def trace_by_session(session_id: str):
    conn = get_db_connection()
    cur = conn.cursor()
    query = '''
        SELECT u.email, u.suspicion_score, a.location, a.created_at
        FROM active_sessions a
        JOIN users u ON a.user_id = u.id
        WHERE a.session_token = %s
    '''
    cur.execute(query, (session_id,))
    culprit = cur.fetchone()
    cur.close()
    conn.close()
    
    if not culprit:
        raise HTTPException(status_code=404, detail="Trace Failed: Session ID not found or already deleted.")
        
    login_time = culprit["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(culprit["created_at"], datetime) else culprit["created_at"]
        
    return {
        "status": "TRACE SUCCESSFUL",
        "culprit_email": culprit["email"],
        "risk_score": culprit["suspicion_score"],
        "compromised_location": culprit["location"],
        "login_time": login_time
    }

@app.post("/api/admin/seed")
def seed_database():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # NO DELETE STATEMENTS HERE. THIS FUNCTION IS NOW PURELY ADDITIVE.
    
    targets = [
        ("hacker_delhi@test.com", "password123", 85),
        ("suspicious_bob@test.com", "password123", 40),
        ("normal_alice@test.com", "password123", 0)
    ]
    
    for email, pw, score in targets:
        hashed_pw = hashlib.sha256(pw.encode('utf-8')).hexdigest()
        
        # Insert only if not exists
        cur.execute('''
            INSERT INTO users (email, hashed_password, suspicion_score) 
            SELECT %s, %s, %s 
            WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = %s)
        ''', (email, hashed_pw, score, email))
    
    # Refresh user list to link sessions
    cur.execute("SELECT id, email FROM users WHERE email IN ('hacker_delhi@test.com', 'suspicious_bob@test.com')")
    users = cur.fetchall()
    
    for u in users:
        # Check if session already exists for this specific user
        cur.execute("SELECT 1 FROM active_sessions WHERE user_id = %s", (u["id"],))
        if not cur.fetchone():
            token = "sess_hacker999" if u["email"] == "hacker_delhi@test.com" else "sess_bob456"
            loc = "Delhi" if u["email"] == "hacker_delhi@test.com" else "Mumbai"
            cur.execute("INSERT INTO active_sessions (user_id, session_token, location) VALUES (%s, %s, %s)", 
                        (u["id"], token, loc))
            
    conn.commit()
    cur.close()
    conn.close()
    return {"msg": "System seeded safely without deleting existing users."}

import os
from fastapi import Request, Response, HTTPException

@app.get("/api/video/stream/{video_id}")
def stream_video(video_id: str, request: Request):
    # Update this path to where your video actually lives on Render!
    video_path = "assets/trailers/the_lighter.mp4" 
    
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video file not found on server")

    file_size = os.path.getsize(video_path)
    range_header = request.headers.get("Range")

    if not range_header:
        # If the browser doesn't ask for a chunk, send the whole file (Fallback)
        with open(video_path, "rb") as video:
            return Response(content=video.read(), media_type="video/mp4")

    # The browser requested a chunk (e.g., "bytes=0-1024")
    try:
        byte_range = range_header.strip().split("=")[1]
        start_str, end_str = byte_range.split("-")
        start = int(start_str)
        end = int(end_str) if end_str else min(start + 1024 * 1024, file_size - 1) # Send 1MB chunks
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid range header")

    length = end - start + 1

    with open(video_path, "rb") as video:
        video.seek(start)
        data = video.read(length)

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(length),
        "Content-Type": "video/mp4",
    }

    return Response(content=data, status_code=206, headers=headers, media_type="video/mp4")
@app.get("/api/admin/activity")
def get_recent_activity():
    conn = get_db_connection()
    cur = conn.cursor()
    # 🔴 FIXED JOIN: Links logs -> active_sessions -> users
    cur.execute('''
        SELECT u.email, l.movie_title, l.ip_address, l.location, l.access_time 
        FROM stream_logs l
        JOIN active_sessions a ON a.session_token = l.session_token
        JOIN users u ON u.id = a.user_id
        ORDER BY l.access_time DESC
        LIMIT 20
    ''')
    logs = cur.fetchall()
    cur.close()
    conn.close()
    return logs