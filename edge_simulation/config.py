import os
from typing import List, Optional
from pydantic import Field      
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DB_PATH: str = os.getenv("EDGE_DB_PATH", "edge_buffer.db")
    BACKEND_URL: str = "http://localhost:8000"
    
    # Devices to simulate
    DEVICE_IDS: List[str] = Field(default_factory=lambda: ["cold-unit-01", "cold-unit-02", "cold-unit-03"])
    POLL_INTERVAL_SEC: float = 2.0
    HEARTBEAT_INTERVAL_CYCLES: int = 5
    FAULT_EVERY_CYCLES: int = 20
    FAULT_DURATION_CYCLES: int = 5
    
    SYNC_BATCH_SIZE: int = 50
    SYNC_INTERVAL_SEC: float = 2.0
    
    # Thermal & Kinetics baseline
    AMBIENT_TEMP_C: float = 24.0
    COOLING_SETPOINT_C: float = 4.0
    CRITICAL_TEMP_C: float = 8.0
    SHELF_LIFE_NOMINAL_DAYS: float = 14.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
        )

config = Settings()