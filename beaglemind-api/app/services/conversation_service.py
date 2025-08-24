import os
import datetime as dt
from typing import Optional, Dict, Any, List
from pymongo import MongoClient, ASCENDING, DESCENDING
from bson import ObjectId


class ConversationService:
    def __init__(self):
        uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        dbname = os.getenv("MONGO_DB", "beaglemind")
        self.client = MongoClient(uri)
        self.db = self.client[dbname]
        self.col = self.db["conversations"]
        self.msgs = self.db["messages"]
        # indexes
        self.col.create_index([("user_email", ASCENDING)])
        self.col.create_index([("conversation_id", ASCENDING)])
        self.col.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
        self.msgs.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])

    def save_first_message(self, *, message: str, user_email: Optional[str] = None, user_id: Optional[str] = None, conversation_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> str:
        doc = {
            "user_email": user_email,
            "user_id": user_id,
            "conversation_id": conversation_id,
            "first_message": message,
            "created_at": dt.datetime.utcnow(),
            "meta": metadata or {},
        }
        res = self.col.insert_one(doc)
        return str(res.inserted_id)

    # New structured APIs
    def create_conversation(self, *, user_id: Optional[str], user_email: Optional[str], title: str, first_message: Optional[str] = None) -> str:
        now = dt.datetime.utcnow()
        doc = {
            "user_id": user_id,
            "user_email": user_email,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "last_message_preview": "",
        }
        if first_message:
            doc["first_message"] = first_message
            doc["first_message_created_at"] = now
        res = self.col.insert_one(doc)
        return str(res.inserted_id)

    def append_messages(self, *, conversation_id: str, messages: List[Dict[str, Any]], last_preview: Optional[str] = None) -> None:
        now = dt.datetime.utcnow()
        # normalize and insert
        for m in messages:
            m_doc = {
                "conversation_id": conversation_id,
                "role": m.get("role"),
                "content": m.get("content", ""),
                "created_at": m.get("created_at") or now,
            }
            self.msgs.insert_one(m_doc)
        self.col.update_one({"_id": ObjectId(conversation_id)}, {"$set": {"updated_at": now, "last_message_preview": last_preview or messages[-1].get("content", "")[:200]}})

    def list_conversations(self, *, user_id: Optional[str] = None, user_email: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        q: Dict[str, Any] = {}
        if user_id:
            q["user_id"] = user_id
        elif user_email:
            q["user_email"] = user_email
        cur = self.col.find(q).sort("updated_at", DESCENDING).limit(limit)
        out = []
        for d in cur:
            out.append({
                "id": str(d.get("_id")),
                "title": d.get("title", "Untitled"),
                "lastMessage": d.get("last_message_preview", ""),
                "updated_at": d.get("updated_at"),
                "created_at": d.get("created_at"),
            })
        return out

    def get_messages(self, *, conversation_id: str) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        # If this conversation doc contains a first_message field, include it first
        try:
            conv = self.col.find_one({"_id": ObjectId(conversation_id)})
        except Exception:
            conv = None
        if conv and conv.get("first_message"):
            out.append({
                "id": f"first-{str(conv.get('_id'))}",
                "role": 'user',
                "content": conv.get("first_message", ""),
                "created_at": conv.get("created_at"),
            })

        cur = self.msgs.find({"conversation_id": conversation_id}).sort("created_at", ASCENDING)
        for d in cur:
            raw_role = d.get("role")
            # Normalize role values: treat anything not explicitly 'user' as assistant
            role_norm = 'user' if isinstance(raw_role, str) and raw_role.lower() == 'user' else 'assistant'
            out.append({
                "id": str(d.get("_id")),
                "role": role_norm,
                "content": d.get("content", ""),
                "created_at": d.get("created_at"),
            })
        return out

    def update_title(self, *, conversation_id: str, title: str) -> None:
        self.col.update_one({"_id": ObjectId(conversation_id)}, {"$set": {"title": title, "updated_at": dt.datetime.utcnow()}})

    def delete_conversation(self, *, conversation_id: str) -> None:
        # Remove conversation document and all associated messages
        deleted_conv_count = 0
        deleted_msgs_count = 0
        try:
            res = self.col.delete_one({"_id": ObjectId(conversation_id)})
            deleted_conv_count = int(getattr(res, 'deleted_count', 0) or 0)
        except Exception:
            deleted_conv_count = 0
        try:
            res2 = self.msgs.delete_many({"conversation_id": conversation_id})
            deleted_msgs_count = int(getattr(res2, 'deleted_count', 0) or 0)
        except Exception:
            deleted_msgs_count = 0
        return {"deleted_conversation": deleted_conv_count, "deleted_messages": deleted_msgs_count}
