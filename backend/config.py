from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    POSTGRES_USER: str = Field(default="postgres")
    POSTGRES_PASSWORD: str = Field(default="postgres")
    POSTGRES_HOST: str = Field(default="localhost")
    POSTGRES_PORT: int = Field(default=5432)
    POSTGRES_DB: str = Field(default="cold_storage")

    TEMP_THRESHOLD_CRITICAL: float = 8.0
    TEMP_THRESHOLD_NORMAL: float = 4.0
    HEARTBEAT_TIMEOUT_SEC: int = 15

    GEMINI_API_KEY: str = Field(default="")
    GEMINI_MODEL: str = Field(default="gemini-2.5-flash")
    
    model_config = SettingsConfigDict(env_file= ".env", extra="ignore")

settings = Settings()