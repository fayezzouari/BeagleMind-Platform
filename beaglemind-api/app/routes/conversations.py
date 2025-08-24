from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from app.services.conversation_service import ConversationService


router = APIRouter()
svc = ConversationService()


class FirstMessageRequest(BaseModel):
    message: str
    user_email: Optional[str] = None
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@router.post("/conversations/first-message")
def post_first_message(payload: FirstMessageRequest):
    _id = svc.save_first_message(
        message=payload.message,
        user_email=payload.user_email,
        user_id=payload.user_id,
        conversation_id=payload.conversation_id,
        metadata=payload.metadata,
    )
    return {"id": _id}


class CreateConversationRequest(BaseModel):
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    title: str
    first_message: Optional[str] = None


@router.post("/conversations")
def create_conversation(payload: CreateConversationRequest):
    cid = svc.create_conversation(user_id=payload.user_id, user_email=payload.user_email, title=payload.title, first_message=payload.first_message)
    return {"id": cid}


class AppendMessagesRequest(BaseModel):
    conversation_id: str
    messages: List[Dict[str, Any]]  # [{role, content}]
    last_preview: Optional[str] = None


@router.post("/conversations/append")
def append_messages(payload: AppendMessagesRequest):
    svc.append_messages(conversation_id=payload.conversation_id, messages=payload.messages, last_preview=payload.last_preview)
    return {"status": "ok"}


class ListConversationsQuery(BaseModel):
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    limit: Optional[int] = 50


@router.post("/conversations/list")
def list_conversations(payload: ListConversationsQuery):
    items = svc.list_conversations(user_id=payload.user_id, user_email=payload.user_email, limit=payload.limit or 50)
    return {"items": items}


class GetMessagesRequest(BaseModel):
    conversation_id: str


@router.post("/conversations/messages")
def get_messages(payload: GetMessagesRequest):
    items = svc.get_messages(conversation_id=payload.conversation_id)
    return {"items": items}


class UpdateTitleRequest(BaseModel):
    conversation_id: str
    title: str


@router.post("/conversations/title")
def update_title(payload: UpdateTitleRequest):
    svc.update_title(conversation_id=payload.conversation_id, title=payload.title)
    return {"status": "ok"}


class DeleteConversationRequest(BaseModel):
    conversation_id: str


@router.post("/conversations/delete")
def delete_conversation(payload: DeleteConversationRequest):
    result = svc.delete_conversation(conversation_id=payload.conversation_id)
    return {"status": "ok", "result": result}
