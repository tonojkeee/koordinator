from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.modules.auth.router import get_current_user
from app.modules.auth.models import User
from .schemas import ZsspdPackageCreate, ZsspdPackageRead, ZsspdPackageUpdate, ZsspdFileRead
from .service import ZsspdService
from .models import ZsspdDirection, ZsspdStatus

router = APIRouter(prefix="/zsspd", tags=["zsspd"])

@router.get("/outgoing", response_model=List[ZsspdPackageRead])
async def get_outgoing_packages(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ZsspdService(db)
    # Filter by user if not admin/operator
    user_id = None if current_user.role in ['admin', 'operator'] else current_user.id
    return await service.get_packages(direction=ZsspdDirection.OUTGOING, skip=skip, limit=limit, user_id=user_id)

@router.post("/outgoing", response_model=ZsspdPackageRead)
async def create_outgoing_package(
    package: ZsspdPackageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ZsspdService(db)
    if package.direction != ZsspdDirection.OUTGOING:
        raise HTTPException(status_code=400, detail="Invalid direction for this endpoint")
    return await service.create_package(package, current_user.id)

@router.post("/packages/{package_id}/files", response_model=ZsspdFileRead)
async def upload_package_file(
    package_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ZsspdService(db)
    package = await service.get_package(package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Check permissions
    if package.created_by != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized to edit this package")

    return await service.add_file(package_id, file)

@router.put("/packages/{package_id}", response_model=ZsspdPackageRead)
async def update_package_status(
    package_id: int,
    update_data: ZsspdPackageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only operators or owners (for certain statuses) can update
    # For now, let's keep it simple: Export/Process is for operators only
    if update_data.status in [ZsspdStatus.EXPORTED, ZsspdStatus.SENT, ZsspdStatus.RECEIVED, ZsspdStatus.DISTRIBUTED]:
        if current_user.role not in ['admin', 'operator']:
            raise HTTPException(status_code=403, detail="Only operators can change to this status")
            
    service = ZsspdService(db)
    package = await service.get_package(package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
        
    return await service.update_package(package_id, update_data)

@router.get("/packages/{package_id}", response_model=ZsspdPackageRead)
async def get_package_details(
    package_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ZsspdService(db)
    package = await service.get_package(package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    return package
