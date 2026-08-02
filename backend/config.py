"""
项目配置管理模块
从 .env 文件读取敏感配置（API Key 等），提供统一的配置入口
"""

import os
from dotenv import load_dotenv

# 加载 .env 文件（使用脚本所在目录的绝对路径，避免 CWD 变化时找不到）
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))


class Config:
    """应用配置类，集中管理所有配置项"""

    # DeepSeek AI 配置
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL = "https://api.deepseek.com"
    DEEPSEEK_MODEL = "deepseek-chat"  # DeepSeek 对话模型

    # 腾讯地图配置（同一个 Key 同时用于前端 JS API 和后端 Web 服务 API）
    TENCENT_MAP_KEY = os.getenv("TENCENT_MAP_KEY", "")

    # 腾讯地图 API 端点
    TENCENT_GEOCODE_URL = "https://apis.map.qq.com/ws/geocoder/v1/"
    TENCENT_POI_SEARCH_URL = "https://apis.map.qq.com/ws/place/v1/search"
    TENCENT_IP_LOCATION_URL = "https://apis.map.qq.com/ws/location/v1/ip"

    # 数据库配置
    DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "citywalk.db"))

    # Flask 配置
    DEBUG = False  # 关闭 debug 模式

    @classmethod
    def validate(cls):
        """验证必要的配置是否完整，返回缺失的 Key 列表"""
        missing = []
        if not cls.DEEPSEEK_API_KEY:
            missing.append("DEEPSEEK_API_KEY")
        if not cls.TENCENT_MAP_KEY:
            missing.append("TENCENT_MAP_KEY")
        return missing
