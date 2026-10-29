from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload 
from sqlalchemy import func
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
from datetime import datetime, timedelta
from pathlib import Path
import os
import shutil 

# --- CRITICAL FIX: Direct File Imports ---
import Model as models  
from Database_Setup import get_db, engine 
# --- END CRITICAL FIX ---


# --- PATH CONFIGURATION ---
BASE_DIR = Path(__file__).resolve().parent 
IMAGE_DIR = BASE_DIR / "uploaded_images"

if not IMAGE_DIR.exists():
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
# --- END PATH CONFIGURATION ---


# Initialize FastAPI application
app = FastAPI(title="Waste Food Management Auth & Food API")

@app.on_event("startup")
def initialize_database_tables():
    """Create missing tables after the database connection is configured."""
    models.Base.metadata.create_all(bind=engine)


# --- CORS Configuration ---
origins = [
    "http://localhost", "http://localhost:8000", "http://127.0.0.1:8000", 
    "http://localhost:5500", "file://", "*" 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- STATIC FILES CONFIGURATION ---
app.mount(
    "/images", 
    StaticFiles(directory=IMAGE_DIR), 
    name="images"
)

# --- Helper Function for Local Storage (UNCHANGED) ---
def upload_image_to_local_storage(file: Optional[UploadFile]) -> Optional[str]:
    """Saves the uploaded file to the local filesystem using absolute path."""
    if file and file.filename:
        filename = f"food_post_{int(datetime.now().timestamp())}_{file.filename.replace(' ', '_')}"
        file_path_abs = IMAGE_DIR / filename
        
        print(f"\n--- DEBUG FILE UPLOAD ---")
        print(f"Original Filename: {file.filename}")
        
        try:
            contents = file.file.read()
            print(f"File Size (Bytes): {len(contents)}")
            if not contents:
                print("DEBUG FAILURE: File contents are empty (0 bytes).")
                return None
                
            with open(file_path_abs, "wb") as buffer:
                buffer.write(contents)
            
            print(f"DEBUG SUCCESS: File saved successfully to {file_path_abs}")
            return f"images/{filename}" 
            
        except Exception as e:
            print(f"DEBUG CRITICAL FAILURE: Error saving file: {e}")
            return None
    return None

# --- Food Post Endpoint (POST) ---
@app.post("/food/post", response_model=models.FoodPostResponse, status_code=status.HTTP_201_CREATED)
def post_food_availability(
    Food_Name: str = Form(...),
    Food_Description: str = Form(...),
    Food_Quantity: str = Form(...),
    Food_Quality: str = Form(...),
    User_ID: int = Form(...),
    Expiry_Time_Hours: Optional[int] = Form(None), 
    food_image_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Allows a Hotel/Restaurant to post surplus food availability, handling image upload."""
    
    print("\n================= DEBUG POST START =================")
    print(f"Received User_ID: {User_ID}")

    image_url = upload_image_to_local_storage(food_image_file)
    
    expiry_time = None
    if Expiry_Time_Hours is not None and Expiry_Time_Hours > 0:
        expiry_time = datetime.now() + timedelta(hours=Expiry_Time_Hours)

    new_food_post = models.DBFoodPost(
        Food_Name=Food_Name, Food_Description=Food_Description, Food_Quantity=Food_Quantity,
        Food_Quality=Food_Quality, User_ID=User_ID, Expiry_Time=expiry_time,
        Food_Image_URL=image_url
    )

    db.add(new_food_post)
    db.commit()
    db.refresh(new_food_post)
    
    print("--- DEBUG DB SAVE: Post successful. ---")
    return new_food_post

# --- Food Update Endpoint (PUT/EDIT/CANCEL) ---
@app.put("/food/update/{food_id}", response_model=models.FoodPostResponse)
def update_food_post(
    food_id: int, 
    post_update: models.FoodPostUpdate, 
    db: Session = Depends(get_db)
):
    """Updates details (quantity, status, etc.) of an existing food post."""
    db_post = db.query(models.DBFoodPost).filter(models.DBFoodPost.ID == food_id).first()

    if not db_post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food post not found.")

    update_data = post_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_post, key, value)

    db.commit()
    db.refresh(db_post)
    
    print(f"--- DEBUG DB UPDATE: Post {food_id} updated successfully. ---")
    return db_post

# --- Food Listings Endpoint (GET) ---
@app.get("/food/mylisting/{user_id}", response_model=List[models.FoodPostResponse])
def get_my_food_listings(user_id: int, db: Session = Depends(get_db)):
    """Retrieves all food posts made by a specific user (Hotel/Restaurant)."""
    listings = db.query(models.DBFoodPost).filter(models.DBFoodPost.User_ID == user_id).all()
    return listings

# --- NEW: Food Available for NGO Listing (GET) ---
@app.get("/food/available", response_model=List[models.FoodPostResponse])
def get_available_food_for_ngo(db: Session = Depends(get_db)):
    """
    Retrieves all food posts where the status is 'Available'.
    """
    available_listings = db.query(models.DBFoodPost).filter(
        models.DBFoodPost.Food_Status == 'Available'
    ).all()
    return available_listings

# --- Hotel Pickup Requests (GET) ---
@app.get("/pickup/requests/hotel/{user_id}", response_model=List[models.PickupRequestResponse])
def get_hotel_pickup_requests(user_id: int, db: Session = Depends(get_db)):
    """Retrieves all pending pickup requests for the given hotel."""
    requests = db.query(models.DBPickupRequest).join(models.DBFoodPost).filter(
        models.DBFoodPost.User_ID == user_id,
        models.DBPickupRequest.Request_Status == 'Pending' 
    ).options(
        joinedload(models.DBPickupRequest.ngo_user),
        joinedload(models.DBPickupRequest.food_item)
    ).all()
    return requests

# --- NGO Pickup Requests (GET) ---
# --- NGO Pickup Requests (GET) - FINAL FIX APPLIED ---
# --- NGO Pickup Requests (GET) - FINAL FIX APPLIED ---
@app.get("/pickup/myrequests/{ngo_id}", response_model=List[models.PickupRequestResponse])
def get_ngo_pickup_requests(ngo_id: int, db: Session = Depends(get_db)):
    """
    Retrieves all pickup requests made by a specific NGO, joining to get food post and donor details.
    """
    # CRITICAL FIX: Ensure the Donor profile is loaded by chaining joinedload.
    # Request -> food_item (DBFoodPost) -> donor (DBUser/Hotel)
    requests = db.query(models.DBPickupRequest).filter(
        models.DBPickupRequest.NGO_User_ID == ngo_id
    ).options(
        # 1. Load food_item
        joinedload(models.DBPickupRequest.food_item).
        # 2. NESTED inside food_item, load the donor profile
        joinedload(models.DBFoodPost.donor)
    ).all()
    
    return requests

# --- CRITICAL: Pickup Request Status Update (PUT/ACCEPT/REJECT) ---
@app.put("/pickup/request/update/{request_id}", response_model=models.PickupRequestResponse)
def update_pickup_request(
    request_id: int, 
    request_update: models.PickupRequestUpdate, 
    db: Session = Depends(get_db)
):
    """
    Updates the request status and changes the corresponding food item status.
    """
    db_request = db.query(models.DBPickupRequest).filter(models.DBPickupRequest.ID == request_id).first()
    if not db_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pickup request not found.")

    new_status = request_update.Request_Status
    db_request.Request_Status = new_status
    
    db_food_post = db.query(models.DBFoodPost).filter(
        models.DBFoodPost.ID == request_update.Food_Post_ID 
    ).first()
    
    if db_food_post:
        if new_status == 'Accepted':
            db_food_post.Food_Status = 'Ready for Delivery' 
        elif new_status == 'Rejected':
            db_food_post.Food_Status = 'Available'
        elif new_status == 'Collected':
            # NEW: Set Food Post status to Collected when NGO marks it as such
            db_food_post.Food_Status = 'Collected'
    
    db.commit()
    db.refresh(db_request)
    return db_request


# --- NEW: NGO Stats Endpoint (Analytics) ---
@app.get("/ngo/stats/{ngo_id}")
def get_ngo_dashboard_stats(ngo_id: int, db: Session = Depends(get_db)):
    """
    Calculates summary statistics for the NGO Dashboard Overview cards based on pickup requests made.
    """
    # Base query filtered by the logged-in NGO
    base_query = db.query(models.DBPickupRequest).filter(models.DBPickupRequest.NGO_User_ID == ngo_id)

    # 1. Completed Pickups (Request_Status = 'Collected')
    completed_pickups = base_query.filter(
        models.DBPickupRequest.Request_Status == 'Collected'
    ).with_entities(func.count(models.DBPickupRequest.ID)).scalar()

    # 2. Ongoing Pickups (Request_Status = 'Accepted' or 'Ready for Delivery')
    ongoing_pickups = base_query.filter(
        models.DBPickupRequest.Request_Status.in_(['Accepted', 'Ready for Delivery'])
    ).with_entities(func.count(models.DBPickupRequest.ID)).scalar()

    # 3. Pending Requests (Request_Status = 'Pending')
    pending_requests = base_query.filter(
        models.DBPickupRequest.Request_Status == 'Pending'
    ).with_entities(func.count(models.DBPickupRequest.ID)).scalar()

    # 4. New Donations (Total available food posts, simplified for display)
    new_donations = db.query(models.DBFoodPost).filter(
        models.DBFoodPost.Food_Status == 'Available'
    ).with_entities(func.count(models.DBFoodPost.ID)).scalar()


    return {
        "completed_pickups": completed_pickups or 0,
        "ongoing_pickups": ongoing_pickups or 0,
        "pending_requests": pending_requests or 0,
        "new_donations": new_donations or 0,
    }


# --- Hotel Stats Endpoint (Analytics) ---
@app.get("/hotel/stats/{user_id}")
def get_hotel_dashboard_stats(user_id: int, db: Session = Depends(get_db)):
    """Calculates summary statistics for the Hotel Dashboard Overview cards."""
    base_query = db.query(models.DBFoodPost).filter(models.DBFoodPost.User_ID == user_id)

    total_donations = base_query.with_entities(func.count(models.DBFoodPost.ID)).scalar()
    completed_donations = base_query.filter(models.DBFoodPost.Food_Status == 'Collected').with_entities(func.count(models.DBFoodPost.ID)).scalar()
    pending_requests = base_query.filter(models.DBFoodPost.Food_Status.in_(['Available', 'Claimed'])).with_entities(func.count(models.DBFoodPost.ID)).scalar()

    return {
        "total_donations": total_donations or 0,
        "completed_donations": completed_donations or 0,
        "pending_requests": pending_requests or 0,
    }


# --- Pickup Request API (POST) ---
@app.post("/pickup/request", status_code=status.HTTP_201_CREATED)
def submit_pickup_request(
    request: models.PickupRequestCreate, 
    db: Session = Depends(get_db)
):
    """Creates a new pickup request record by an NGO and sets the Food_Status to 'Claimed'."""
    new_request = models.DBPickupRequest(
        Food_Post_ID=request.Food_Post_ID,
        NGO_User_ID=request.NGO_User_ID,
        Request_Time=datetime.now(),
        Request_Status='Pending'
    )
    
    db_food_post = db.query(models.DBFoodPost).filter(
        models.DBFoodPost.ID == request.Food_Post_ID,
        models.DBFoodPost.Food_Status == 'Available' 
    ).first()

    if not db_food_post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food post not found or already claimed."
        )

    db_food_post.Food_Status = 'Claimed'
    
    db.add(new_request)
    db.commit()
    
    return {"message": f"Pickup request for Food ID {request.Food_Post_ID} submitted. Status updated to Claimed."}


# --- Existing Endpoints (Profile, Register, Users, Login) ---
@app.get("/user/profile/{user_id}", response_model=models.UserResponse)
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(models.DBUser).filter(models.DBUser.ID == user_id).first()
    if not db_user: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return db_user

@app.post("/register", response_model=models.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: models.UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(models.DBUser).filter(models.DBUser.Email == user.Email).first()
    if db_user: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered.")
    new_user = models.DBUser(
        Name=user.Name, User_Type=user.User_Type, Email=user.Email,
        Password=user.Password, Phone_No=user.Phone_No, Adress=user.Adress
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.get("/users", response_model=List[models.UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(models.DBUser).all()
    return users

@app.post("/login")
def login_user(user_credentials: models.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.DBUser).filter(models.DBUser.Email == user_credentials.Email).first()

    if not db_user: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials (email not found).")
    
    # if db_user.User_Type != user_credentials.User_Type: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid credentials (User Type mismatch: Expected {user_credentials.User_Type}).")

    if db_user.Password != user_credentials.Password: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials (password incorrect).")

    return {"message": "Login successful!", "user_id": db_user.ID, "user_type": db_user.User_Type}