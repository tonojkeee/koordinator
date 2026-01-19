from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Request, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta
import os
import uuid
import logging
from app.core.file_security import validate_avatar_upload
from app.core.csrf import CSRFProtection, require_csrf_token
from app.core.rate_limit import rate_limit_auth, rate_limit_file_upload

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.security import create_access_token, decode_access_token, create_refresh_token
from app.core.config import get_settings
from app.modules.auth.schemas import UserCreate, UserResponse, Token, UserLogin, UnitCreate, UnitUpdate, UnitResponse, UserUpdate, UserChangePassword, AdminUserUpdate, AdminResetPassword, RoleUpdate, RefreshTokenRequest
from typing import List, Optional, Dict, Any


from app.modules.auth.service import UserService, UnitService
from app.core.config_service import ConfigService
from app.modules.admin.service import SystemSettingService
from app.modules.auth.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/config")
async def get_public_config(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Get public system configuration"""
    return await SystemSettingService.get_public_settings(db)


@router.get("/csrf-token")
async def get_csrf_token(response: Response) -> Dict[str, str]:
    """
    Get a new CSRF token.
    This endpoint can be called to obtain a CSRF token without authentication.
    """
    csrf_token = CSRFProtection.generate_token()
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=settings.use_https,
        samesite="strict",
        max_age=settings.access_token_expire_minutes * 60,
        path="/"
    )
    return {"csrf_token": csrf_token}


settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
    
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise credentials_exception
    
    user = await UserService.get_user_by_id(db, user_id=user_id)
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваша учетная запись заблокирована. Пожалуйста, обратитесь к администратору.",
            headers={"X-Account-Blocked": "true"}
        )
    
    return user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to check for admin role"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав доступа"
        )
    return current_user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _csrf: None = Depends(require_csrf_token),
    _rate_limit: None = Depends(rate_limit_auth)
):
    """Register a new user"""
    # Check registration setting
    allow_reg = await ConfigService.get_value(db, "allow_registration", "true")
    if allow_reg.lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Регистрация новых пользователей отключена администратором"
        )

    # Check if username exists
    existing_user = await UserService.get_user_by_username(db, user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Логин уже зарегистрирован"
        )

    user = await UserService.create_user(db, user_data)
    return user


@router.post("/login", response_model=Token)
async def login(
    response: Response,
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit_auth)
):
    """Login and get access token"""
    user = await UserService.authenticate_user(db, form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваша учетная запись заблокирована. Пожалуйста, обратитесь к администратору.",
            headers={"X-Account-Blocked": "true"}
        )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    # Generate and set CSRF token cookie
    csrf_token = CSRFProtection.generate_token()
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,  # Must be readable by JavaScript to send in headers
        secure=settings.use_https,  # Only send over HTTPS in production
        samesite="strict",  # Prevent CSRF attacks
        max_age=settings.access_token_expire_minutes * 60,  # Match access token lifetime
        path="/"
    )
    
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token, 
        "token_type": "bearer",
        "csrf_token": csrf_token  # Also return in response for client to use
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(
    response: Response,
    token_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Get new access token using refresh token"""
    payload = decode_access_token(token_data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен обновления",
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен обновления",
        )
    
    user = await UserService.get_user_by_id(db, user_id=int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваша учетная запись заблокирована. Пожалуйста, обратитесь к администратору.",
            headers={"X-Account-Blocked": "true"}
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    # We also return a new refresh token (refresh token rotation)
    new_refresh_token = create_refresh_token(data={"sub": user.id})
    
    # Regenerate CSRF token on refresh
    csrf_token = CSRFProtection.generate_token()
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=settings.use_https,
        samesite="strict",
        max_age=settings.access_token_expire_minutes * 60,
        path="/"
    )
    
    return {
        "access_token": access_token, 
        "refresh_token": new_refresh_token, 
        "token_type": "bearer",
        "csrf_token": csrf_token
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    update_data: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _csrf: None = Depends(require_csrf_token)
):
    """Update current user profile"""
    updated_user = await UserService.update_user_profile(db, current_user.id, update_data)
    return updated_user


@router.get("/users", response_model=List[UserResponse])
async def get_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get list of all users"""
    users = await UserService.get_all_users(db)
    return users


@router.get("/users/online")
async def get_online_users(current_user: User = Depends(get_current_user)):
    """Get list of online user IDs"""
    from app.modules.chat.websocket import manager
    online_ids = manager.get_online_user_ids()
    return {"online_user_ids": online_ids}


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: UserChangePassword,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _csrf: None = Depends(require_csrf_token),
    _rate_limit: None = Depends(rate_limit_auth)
):
    """Change user password"""
    success = await UserService.change_password(db, current_user.id, password_data)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль"
        )
    return {"message": "Пароль успешно изменен"}


@router.post("/users/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _csrf: None = Depends(require_csrf_token),
    _rate_limit: None = Depends(rate_limit_file_upload)
):
    """Upload user avatar"""
    # Check Content-Length header first (early rejection)
    MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2MB
    if request and request.headers.get("content-length"):
        content_length = int(request.headers.get("content-length"))
        if content_length > MAX_AVATAR_SIZE:
            raise HTTPException(status_code=413, detail="Изображение слишком большое (макс 2МБ)")
    
    # Comprehensive file validation
    is_valid, error_msg = validate_avatar_upload(file, MAX_AVATAR_SIZE)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Generate unique filename
    extension = os.path.splitext(file.filename)[1].lower()
    if not extension or extension not in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}:
        extension = ".png"  # Fallback
    
    filename = f"{uuid.uuid4()}{extension}"
    file_path = f"static/avatars/{filename}"
    
    # Ensure directory exists
    os.makedirs("static/avatars", exist_ok=True)
    
    # Save file with size validation
    size = 0
    try:
        with open(file_path, "wb") as buffer:
            for chunk in iter(lambda: file.file.read(8192), b""):
                size += len(chunk)
                if size > MAX_AVATAR_SIZE:
                    buffer.close()
                    os.remove(file_path)
                    raise HTTPException(status_code=413, detail="Изображение слишком большое (макс 2МБ)")
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving avatar: {e}")
        # Clean up file if it exists
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except (OSError, PermissionError) as cleanup_error:
                logger.error(f"Failed to cleanup avatar file {file_path}: {cleanup_error}")
                pass
        raise HTTPException(status_code=500, detail="Ошибка при сохранении файла")
    
    # Update user avatar_url
    avatar_url = f"/static/avatars/{filename}"
    user = await UserService.update_user_avatar(db, current_user.id, avatar_url)
    
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db), 
    admin: User = Depends(get_admin_user),
    _csrf: None = Depends(require_csrf_token)
):
    """Delete a user (Admin only)"""
    success = await UserService.delete_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    from app.modules.admin.service import AdminService
    await AdminService.create_audit_log(
        db, admin.id, "delete_user", "user", user_id, 
        f"Deleted user with ID {user_id}"
    )
    return None


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int, 
    role_data: RoleUpdate,
    db: AsyncSession = Depends(get_db), 
    admin: User = Depends(get_admin_user)
):
    """Update user role (Admin only)"""
    user = await UserService.update_user_role(db, user_id, role_data.role.value)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    from app.modules.admin.service import AdminService
    await AdminService.create_audit_log(
        db, admin.id, "update_role", "user", user_id, 
        f"Changed role to {role_data.role.value}"
    )
    return user


@router.get("/units", response_model=List[UnitResponse])
async def get_units(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all units"""
    return await UnitService.get_all_units(db)


@router.post("/units", response_model=UnitResponse, status_code=status.HTTP_201_CREATED)
async def create_unit(
    unit_data: UnitCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """Create a new unit (Admin only)"""
    unit = await UnitService.create_unit(db, unit_data)
    
    from app.modules.admin.service import AdminService
    await AdminService.create_audit_log(
        db, admin.id, "create_unit", "unit", unit.id, 
        f"Created unit: {unit.name}"
    )
    return unit


@router.delete("/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unit(
    unit_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """Delete a unit (Admin only)"""
    success = await UnitService.delete_unit(db, unit_id)
    if not success:
        raise HTTPException(status_code=404, detail="Подразделение не найдено")
    
    from app.modules.admin.service import AdminService
    await AdminService.create_audit_log(
        db, admin.id, "delete_unit", "unit", unit_id, 
        f"Deleted unit with ID {unit_id}"
    )
    return None


@router.patch("/units/{unit_id}", response_model=UnitResponse)
async def update_unit(
    unit_id: int,
    unit_data: UnitUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """Update a unit (Admin only)"""
    unit = await UnitService.update_unit(db, unit_id, unit_data)
    if not unit:
        raise HTTPException(status_code=404, detail="Подразделение не найдено")
    
    from app.modules.admin.service import AdminService
    await AdminService.create_audit_log(
        db, admin.id, "update_unit", "unit", unit_id, 
        f"Updated unit properties: {unit_data.dict(exclude_unset=True)}"
    )
    return unit


@router.patch("/users/{user_id}/unit", response_model=UserResponse)
async def update_user_unit(
    user_id: int,
    unit_name: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """Update user unit (Admin only)"""
    user, error = await UserService.update_user_unit(db, user_id, unit_name)
    if error == "user_not_found":
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if error == "unit_not_found":
        raise HTTPException(status_code=404, detail="Подразделение не найдено")
    
    from app.modules.admin.service import AdminService
    await AdminService.create_audit_log(
        db, admin.id, "update_user_unit", "user", user_id, 
        f"Moved user to unit: {unit_name}"
    )
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user_admin(
    user_id: int,
    update_data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """Update any user profile (Admin only)"""
    # Use existing update_user_profile method which handles generic setattr
    updated_user = await UserService.update_user_profile(db, user_id, update_data)
    if not updated_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # If account was deactivated, kick from all active WebSockets
    if update_data.is_active is False:
        from app.modules.chat.websocket import manager
        await manager.kick_user(user_id)
    
    from app.modules.admin.service import AdminService
    await AdminService.create_audit_log(
        db, admin.id, "update_user_admin", "user", user_id, 
        f"Updated user profile data: {update_data.dict(exclude_unset=True)}"
    )
    return updated_user


@router.post("/users/{user_id}/password", status_code=status.HTTP_200_OK)
async def reset_user_password(
    user_id: int,
    password_data: AdminResetPassword,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """Reset user password (Admin only)"""
    success = await UserService.reset_password(db, user_id, password_data.new_password)
    if not success:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    from app.modules.admin.service import AdminService
    await AdminService.create_audit_log(
        db, admin.id, "reset_password", "user", user_id, 
        "Reset user password"
    )
    return {"message": "Пароль успешно сброшен"}
