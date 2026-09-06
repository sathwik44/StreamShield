import os
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
import hashlib
import math
from datetime import datetime
import jwt
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from collections import defaultdict

# --- 1. APP SETUP & ML INITIALIZATION ---
app = FastAPI(title="SecureStream Enterprise")
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "super_secret_key_123")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges"] 
)

# Train ML Models on server start (Synthetic Data: [distance_km, time_diff_hours, login_attempts])
X_train = np.array([[10, 5, 1], [1500, 1, 5], [50, 2, 1], [3000, 0.5, 10]])
y_train = np.array([0, 1, 0, 1]) # 0 = Safe, 1 = Piracy Risk

rf_model = RandomForestClassifier(n_estimators=10, random_state=42)
rf_model.fit(X_train, y_train)
xgb_model = xgb.XGBClassifier(use_label_encoder=False, eval_metric='logloss')
xgb_model.fit(X_train, y_train)

def get_ml_risk_score(distance_km, time_diff_hours, login_attempts=1):
    features = np.array([[distance_km, time_diff_hours, login_attempts]])
    rf_prob = rf_model.predict_proba(features)[0][1]
    xgb_prob = xgb_model.predict_proba(features)[0][1]
    hybrid_risk = (rf_prob * 0.5) + (xgb_prob * 0.5)
    return int(hybrid_risk * 100)

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

# --- 3. DATABASE SETUP ---
def get_db_connection():
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL environment variable is missing.")
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
        cur.execute('''
            CREATE TABLE IF NOT EXISTS stream_logs (
                id SERIAL PRIMARY KEY,
                session_token TEXT NOT NULL,
                movie_title TEXT NOT NULL,
                access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                location TEXT,
                user_id INTEGER
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

def get_current_admin(request: Request):
    """Dependency to enforce JWT validation and admin role on protected routes."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authentication token")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Insufficient permissions. Admin access required.")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

# --- 5. ROUTES ---
@app.get("/api/video/stream/{video_id}")
def stream_video(video_id: str, request: Request):
    VIDEO_PATH = f"assets/trailers/{video_id}" 
    
    if not os.path.exists(VIDEO_PATH):
        raise HTTPException(status_code=404, detail="Secure asset not found on server.")

    file_size = os.path.getsize(VIDEO_PATH)
    range_header = request.headers.get("Range")
    
    if not range_header:
        start = 0
        end = min(file_size - 1, 1024 * 1024) 
    else:
        start = int(range_header.replace("bytes=", "").split("-")[0])
        end = min(start + (1024 * 1024), file_size - 1) 

    with open(VIDEO_PATH, "rb") as video:
        video.seek(start)
        data = video.read(end - start + 1)

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(len(data)),
        "Content-Type": "video/mp4",
    }
    return Response(content=data, status_code=206, headers=headers)

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

    # Rule-Based + ML Threat Detection
    if last_session and last_session["location"] != current_city:
        distance_km = calculate_distance(last_session["location"], current_city)
        last_time = last_session["created_at"]
        if isinstance(last_time, str):
            last_time = datetime.strptime(last_time.split(".")[0], "%Y-%m-%d %H:%M:%S")
            
        time_diff_hours = max((datetime.utcnow() - last_time).total_seconds() / 3600, 0.001) 
        
        # Calculate Risk with Random Forest / XGBoost
        ml_risk_score = get_ml_risk_score(distance_km, time_diff_hours)
        
        if ml_risk_score > 50:
            new_score = user["suspicion_score"] + int(ml_risk_score / 2)
            cur.execute("UPDATE users SET suspicion_score = %s WHERE id = %s", (new_score, user["id"]))
            if new_score >= 80:
                cur.execute("DELETE FROM active_sessions WHERE user_id = %s", (user["id"],))
                cur.close()
                conn.close()
                raise HTTPException(status_code=403, detail="Account Locked: ML Risk Score hit 80%.")

    # Clear old sessions
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

    # TRUE JWT GENERATION
    jwt_payload = {"user_id": user["id"], "role": user["role"], "exp": datetime.utcnow().timestamp() + 3600}
    signed_jwt = jwt.encode(jwt_payload, JWT_SECRET, algorithm="HS256")
        
    return {
        "access_token": signed_jwt, 
        "token_type": "bearer",
        "role": user["role"],
        "session_id": new_token,
        "risk_score": final_score
    }

@app.post("/api/logs/stream")
def log_stream(log_data: dict, request: Request):
    conn = get_db_connection()
    cur = conn.cursor()
    # Decode JWT to get user_id for graph logic
    auth_header = request.headers.get("Authorization", "")
    user_id = None
    if auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_id = payload.get("user_id")
        except:
            pass

    cur.execute('''
        INSERT INTO stream_logs (session_token, movie_title, ip_address, location, user_id) 
        VALUES (%s, %s, %s, %s, %s)
    ''', (
        log_data.get("session_token", "Unknown"), 
        log_data.get("movie_title", "Unknown"), 
        request.client.host if request.client else "Unknown", 
        request.headers.get("X-Mock-City", "Unknown"),
        user_id
    ))
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "logged"}

@app.get("/api/admin/users", dependencies=[Depends(get_current_admin)])
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

@app.get("/api/admin/threats", dependencies=[Depends(get_current_admin)])
def get_threat_heap():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''SELECT email, suspicion_score FROM users WHERE suspicion_score > 0 ORDER BY suspicion_score DESC''')
    threats = cur.fetchall()
    cur.close()
    conn.close()
    return [{"user": t["email"], "score": t["suspicion_score"], "reason": "ML Predicted Geographic Anomaly"} for t in threats]

@app.get("/api/admin/trace/{session_id}", dependencies=[Depends(get_current_admin)])
def trace_by_session(session_id: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        SELECT u.email, u.suspicion_score, a.location, a.created_at
        FROM active_sessions a
        JOIN users u ON a.user_id = u.id
        WHERE a.session_token = %s
    ''', (session_id,))
    culprit = cur.fetchone()
    cur.close()
    conn.close()
    
    if not culprit: raise HTTPException(status_code=404, detail="Trace Failed: Session ID not found.")
    login_time = culprit["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(culprit["created_at"], datetime) else culprit["created_at"]
        
    return {
        "status": "TRACE SUCCESSFUL",
        "culprit_email": culprit["email"],
        "risk_score": culprit["suspicion_score"],
        "compromised_location": culprit["location"],
        "login_time": login_time
    }

@app.post("/api/admin/seed", dependencies=[Depends(get_current_admin)])
def seed_database():
    conn = get_db_connection()
    cur = conn.cursor()
    targets = [
        ("hacker_delhi@test.com", "password123", 85),
        ("suspicious_bob@test.com", "password123", 40),
        ("normal_alice@test.com", "password123", 0)
    ]
    for email, pw, score in targets:
        hashed_pw = hashlib.sha256(pw.encode('utf-8')).hexdigest()
        cur.execute('''
            INSERT INTO users (email, hashed_password, suspicion_score) 
            SELECT %s, %s, %s 
            WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = %s)
        ''', (email, hashed_pw, score, email))
    conn.commit()
    cur.close()
    conn.close()
    return {"msg": "System seeded safely."}

@app.get("/api/admin/activity", dependencies=[Depends(get_current_admin)])
def get_recent_activity():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        SELECT u.email, l.movie_title, l.ip_address, l.location, l.access_time 
        FROM stream_logs l
        JOIN active_sessions a ON a.session_token = l.session_token
        JOIN users u ON u.id = a.user_id
        ORDER BY l.access_time DESC LIMIT 20
    ''')
    logs = cur.fetchall()
    cur.close()
    conn.close()
    return logs

@app.get("/api/admin/clusters", dependencies=[Depends(get_current_admin)])
def detect_sharing_clusters():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id, ip_address FROM stream_logs WHERE ip_address IS NOT NULL AND user_id IS NOT NULL")
    logs = cur.fetchall()
    cur.close()
    conn.close()

    # --- UNION-FIND ---
    parent = {}
    def find(i):
        if parent[i] == i: return i
        parent[i] = find(parent[i])
        return parent[i]
    
    def union(i, j):
        root_i = find(i)
        root_j = find(j)
        if root_i != root_j: parent[root_i] = root_j

    for log in logs:
        user_node = f"User_{log['user_id']}"
        ip_node = f"IP_{log['ip_address']}"
        if user_node not in parent: parent[user_node] = user_node
        if ip_node not in parent: parent[ip_node] = ip_node
        union(user_node, ip_node)

    # --- BFS (Adjacency List) ---
    graph = defaultdict(list)
    for log in logs:
        user_node = f"User_{log['user_id']}"
        ip_node = f"IP_{log['ip_address']}"
        if ip_node not in graph[user_node]:
            graph[user_node].append(ip_node)
            graph[ip_node].append(user_node)

    # Explicit BFS Traversal to map out the clusters structurally
    visited = set()
    bfs_paths = []
    
    for node in graph:
        if node not in visited:
            queue = [node]
            cluster_path = []
            while queue:
                current = queue.pop(0)
                if current not in visited:
                    visited.add(current)
                    cluster_path.append(current)
                    queue.extend([neighbor for neighbor in graph[current] if neighbor not in visited])
            bfs_paths.append(cluster_path)

    return {"adjacency_list": graph, "clusters": parent, "bfs_traversal": bfs_paths}