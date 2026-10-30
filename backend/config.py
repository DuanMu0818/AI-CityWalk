from __future__ import annotations

import os
from typing import List

from dotenv import load_dotenv

BASE_DIR: str = os.path.dirname(__file__)
load_dotenv(os.path.join(BASE_DIR, ".env"))


class Config:
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-v4-flash"

    # 前端 JS API 和后端 Web 服务共用同一个 Key
    TENCENT_MAP_KEY: str = os.getenv("TENCENT_MAP_KEY", "")

    TENCENT_GEOCODE_URL: str = "https://apis.map.qq.com/ws/geocoder/v1/"
    TENCENT_POI_SEARCH_URL: str = "https://apis.map.qq.com/ws/place/v1/search"
    TENCENT_IP_LOCATION_URL: str = "https://apis.map.qq.com/ws/location/v1/ip"

    DATABASE_PATH: str = os.getenv("DATABASE_PATH", os.path.join(BASE_DIR, "citywalk.db"))

    DEBUG: bool = False

    @classmethod
    def validate(cls) -> List[str]:
        missing: List[str] = []
        if not cls.DEEPSEEK_API_KEY:
            missing.append("DEEPSEEK_API_KEY")
        if not cls.TENCENT_MAP_KEY:
            missing.append("TENCENT_MAP_KEY")
        return missing