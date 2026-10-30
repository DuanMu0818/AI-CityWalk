import sqlite3
import json
from config import Config


class DBService:
    def __init__(self):
        self.db_path = Config.DATABASE_PATH
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")  # WAL 模式提升并发安全性
        self._init_table()

    def _init_table(self):
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS routes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                city TEXT NOT NULL,
                theme TEXT,
                route_name TEXT,
                summary TEXT,
                waypoints_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.conn.commit()

    def save_route(self, route_data):
        cursor = self.conn.cursor()
        waypoints = route_data.get("waypoints", [])
        cursor.execute(
            "INSERT INTO routes (city, theme, route_name, summary, waypoints_json) VALUES (?, ?, ?, ?, ?)",
            (
                route_data.get("city", ""),
                route_data.get("theme", ""),
                route_data.get("route_name", ""),
                route_data.get("summary", ""),
                json.dumps(waypoints, ensure_ascii=False),
            ),
        )
        self.conn.commit()
        return cursor.lastrowid

    def get_routes(self, page=1, limit=20, search=""):
        cursor = self.conn.cursor()

        where = ""
        params = []
        if search:
            where = " WHERE city LIKE ? OR theme LIKE ? OR route_name LIKE ?"
            like = f"%{search}%"
            params = [like, like, like]

        cursor.execute(f"SELECT COUNT(*) FROM routes{where}", params)
        total = cursor.fetchone()[0]

        offset = (page - 1) * limit
        cursor.execute(
            f"SELECT id, city, theme, route_name, summary, waypoints_json, created_at FROM routes{where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset]
        )
        rows = cursor.fetchall()
        result = []
        for row in rows:
            waypoints = json.loads(row["waypoints_json"])
            result.append({
                "id": row["id"], "city": row["city"], "theme": row["theme"],
                "route_name": row["route_name"], "summary": row["summary"],
                "waypoint_count": len(waypoints), "created_at": row["created_at"],
            })
        return result, total

    def get_route(self, route_id):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM routes WHERE id = ?", (route_id,))
        row = cursor.fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "city": row["city"],
            "theme": row["theme"],
            "route_name": row["route_name"],
            "summary": row["summary"],
            "waypoints": json.loads(row["waypoints_json"]),
            "created_at": row["created_at"],
        }

    def delete_route(self, route_id):
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM routes WHERE id = ?", (route_id,))
        self.conn.commit()
        return cursor.rowcount > 0

    def close(self):
        self.conn.close()
