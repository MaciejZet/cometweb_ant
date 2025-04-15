from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from loguru import logger

# In a real app, you would store this in a more secure manner
# For demonstration purposes, we'll use a simple dict
fake_users_db = {
    "admin": {
        "username": "admin",
        "email": "admin@example.com",
        "hashed_password": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # "password"
        "disabled": False,
    }
}

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


class Token(BaseModel):
    access_token: str
    token_type: str


class User(BaseModel):
    username: str
    email: Optional[str] = None
    disabled: Optional[bool] = None


class UserInDB(User):
    hashed_password: str


@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Get an access token for authentication.
    
    This endpoint handles user authentication and returns a JWT token that can be
    used for subsequent authenticated requests.
    """
    # In a real application, you would validate the user against a database
    # and use proper password hashing
    user = fake_users_db.get(form_data.username)
    if not user or form_data.password != "password":  # For demonstration only
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate token (in a real app, use proper JWT with secret key)
    access_token_expires = timedelta(minutes=30)
    access_token = f"fake-token-{form_data.username}-{datetime.now().timestamp()}"
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/me", response_model=User)
async def read_users_me(token: str = Depends(oauth2_scheme)):
    """
    Get the current authenticated user's information.
    
    This endpoint requires authentication and returns information about the
    currently authenticated user.
    """
    # In a real application, you would validate the token and extract user info
    # This is just a simplified example
    if not token.startswith("fake-token-"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username = token.split("-")[2]
    if username not in fake_users_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = fake_users_db[username]
    return User(**user)
