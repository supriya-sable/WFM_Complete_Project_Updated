from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# CRITICAL FIX: Changed import to absolute file name to fix 'ImportError: attempted relative import'
from Database_Setup import Base 

# ====================================================================
# 1. SQLALCHEMY ORM MODELS (Database Schema Mapping)
# ====================================================================

# --- USERS Table ---
class DBUser(Base):
    __tablename__ = "users"

    ID = Column(Integer, primary_key=True, index=True)
    Name = Column(String(255), nullable=False)
    User_Type = Column(String(50), nullable=False)
    Password = Column(String(255), nullable=False)
    Email = Column(String(255), unique=True, index=True, nullable=False)
    Phone_No = Column(String(20))
    Adress = Column(String(255))
    
    # Relationships
    food_posts = relationship("DBFoodPost", back_populates="donor")
    pickup_requests_made = relationship("DBPickupRequest", back_populates="ngo_user")

# --- FOOD_POST Table ---
class DBFoodPost(Base):
    __tablename__ = "food_post"
    
    ID = Column(Integer, primary_key=True, index=True)
    Food_Name = Column(String(255))
    Food_Description = Column(String(255))
    Food_Quantity = Column(String(50))
    Food_Quality = Column(String(50))
    User_ID = Column(Integer, ForeignKey("users.ID")) 
    Food_Status = Column(String(50), nullable=False, default='Available')
    Expiry_Time = Column(DateTime)
    Food_Image_URL = Column(String(255))
    
    # Relationships
    donor = relationship("DBUser", back_populates="food_posts")
    requests = relationship("DBPickupRequest", back_populates="food_item") 

# --- PICKUP_REQUESTS Table ---
class DBPickupRequest(Base):
    __tablename__ = "pickup_requests"
    
    ID = Column(Integer, primary_key=True, index=True)
    Food_Post_ID = Column(Integer, ForeignKey("food_post.ID"), nullable=False)
    NGO_User_ID = Column(Integer, ForeignKey("users.ID"), nullable=False)
    Request_Time = Column(DateTime, nullable=False)
    Request_Status = Column(String(50), nullable=False, default='Pending')
    
    # Relationships
    food_item = relationship("DBFoodPost", back_populates="requests") 
    ngo_user = relationship("DBUser", back_populates="pickup_requests_made")


# ====================================================================
# 2. PYDANTIC SCHEMAS (Request/Response Validation)
# ====================================================================

# --- User Schemas ---
class UserBase(BaseModel):
    Email: EmailStr
    User_Type: str
    
class UserRegister(UserBase):
    Name: str
    Password: str
    Phone_No: Optional[str] = None
    Adress: Optional[str] = None

class UserLogin(UserBase):
    Password: str

class UserResponse(BaseModel):
    ID: int
    Name: str
    Email: EmailStr
    Phone_No: Optional[str]
    Adress: Optional[str]
    User_Type: str

    class Config:
        from_attributes = True 


# --- Food Post Schemas ---
class FoodPostBase(BaseModel):
    Food_Name: str
    Food_Description: str
    Food_Quantity: str
    Food_Quality: str
    User_ID: int 
    Food_Status: Optional[str] = 'Available'
    Expiry_Time: Optional[datetime] = None
    Food_Image_URL: Optional[str] = None

class FoodPostCreate(BaseModel):
    Food_Name: str
    Food_Description: str
    Food_Quantity: str
    Food_Quality: str
    Expiry_Time_Hours: Optional[int] = None
    Food_Image_URL: Optional[str] = None

class FoodPostResponse(FoodPostBase):
    ID: int
    class Config:
        from_attributes = True

class FoodPostUpdate(BaseModel):
    Food_Name: Optional[str] = None
    Food_Description: Optional[str] = None
    Food_Quantity: Optional[str] = None
    Food_Quality: Optional[str] = None
    Food_Status: Optional[str] = None 
    Expiry_Time: Optional[datetime] = None
    Food_Image_URL: Optional[str] = None
    
    class Config:
        from_attributes = True


# --- Pickup Request Schemas ---

class PickupRequestCreate(BaseModel):
    Food_Post_ID: int
    NGO_User_ID: int
    
class PickupRequestUpdate(BaseModel): 
    Food_Post_ID: int 
    Request_Status: str 
    
    class Config:
        from_attributes = True

class PickupRequestResponse(BaseModel): 
    ID: int
    Food_Post_ID: int
    NGO_User_ID: int
    Request_Time: datetime
    Request_Status: str
    
    # Nested schemas for joined data (used for Hotel Dashboard)
    ngo_user: UserResponse 
    food_item: FoodPostResponse 
    
    class Config:
        from_attributes = True