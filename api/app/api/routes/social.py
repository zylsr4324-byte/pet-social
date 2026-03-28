from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Pet, PetFriendship, PetSocialMessage
from app.schemas import (
    FriendshipActionResponse,
    FriendshipCreateRequest,
    FriendshipListResponse,
    SocialCandidateListResponse,
    SocialMessageListResponse,
    SocialRoundResponse,
    SocialSendRequest,
    SocialSendResponse,
    SocialTaskListResponse,
)
from app.services.auth import get_current_user
from app.services.pet_social import (
    build_social_round_result_message,
    build_friend_request_message,
    build_friendship_response,
    build_round_opening,
    build_social_candidate_response,
    build_social_message_response,
    build_social_task_history_item,
    build_pet_task_response,
    choose_social_round_target,
    complete_social_task,
    create_social_message,
    create_social_task,
    ensure_friendship_can_chat,
    ensure_friendship_request_allowed,
    generate_social_reply,
    get_conversation_between,
    get_friendship_between,
    get_or_create_conversation,
    get_social_tasks_for_pet,
    prepare_round_friendship,
    read_recent_social_messages,
)
from app.services.pets import build_pet_response, get_owned_pet_or_404, get_pet_or_404

router = APIRouter(tags=["social"])


@router.get(
    "/pets/{pet_id}/social/candidates",
    response_model=SocialCandidateListResponse,
)
def list_social_candidates(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> SocialCandidateListResponse:
    source_pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    candidates = (
        db.query(Pet)
        .filter(Pet.id != source_pet.id)
        .order_by(Pet.created_at.desc(), Pet.id.desc())
        .all()
    )

    return SocialCandidateListResponse(
        message="已读取当前可发起站内社交的宠物列表。",
        candidates=[
            build_social_candidate_response(db, source_pet.id, candidate)
            for candidate in candidates
        ],
    )


@router.get("/pets/{pet_id}/friends", response_model=FriendshipListResponse)
def list_pet_friendships(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> FriendshipListResponse:
    source_pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    friendships = (
        db.query(PetFriendship)
        .filter(
            (PetFriendship.pet_a_id == source_pet.id)
            | (PetFriendship.pet_b_id == source_pet.id)
        )
        .order_by(PetFriendship.created_at.desc(), PetFriendship.id.desc())
        .all()
    )

    return FriendshipListResponse(
        message="已读取当前宠物的好友关系。",
        friends=[
            build_friendship_response(db, friendship, source_pet.id)
            for friendship in friendships
        ],
    )


@router.post(
    "/pets/{pet_id}/friends/request",
    response_model=FriendshipActionResponse,
    status_code=status.HTTP_201_CREATED,
)
def request_friendship(
    pet_id: int,
    payload: FriendshipCreateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> FriendshipActionResponse:
    source_pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    target_pet = get_pet_or_404(db, payload.targetPetId)
    friendship = get_friendship_between(db, source_pet.id, target_pet.id)
    ensure_friendship_request_allowed(friendship, source_pet.id)

    request_message = (payload.message or "").strip()
    if not request_message:
        request_message = build_friend_request_message(source_pet, target_pet)

    try:
        if friendship is None:
            pair_a, pair_b = (
                (source_pet.id, target_pet.id)
                if source_pet.id < target_pet.id
                else (target_pet.id, source_pet.id)
            )
            friendship = PetFriendship(
                pet_a_id=pair_a,
                pet_b_id=pair_b,
                initiated_by=source_pet.id,
                status="pending",
            )
            db.add(friendship)
            db.flush()
        else:
            friendship.initiated_by = source_pet.id
            friendship.status = "pending"
            friendship.accepted_at = None

        conversation = get_or_create_conversation(db, source_pet.id, target_pet.id)
        create_social_message(db, conversation.id, source_pet.id, request_message)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="好友请求发送失败，请稍后再试。",
        ) from error

    return FriendshipActionResponse(
        message=f"已向{target_pet.pet_name}发送好友请求，等待对方处理。",
        friendship=build_friendship_response(db, friendship, source_pet.id),
    )


@router.post(
    "/pets/{pet_id}/friends/{friend_id}/accept",
    response_model=FriendshipActionResponse,
)
def accept_friendship(
    pet_id: int,
    friend_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> FriendshipActionResponse:
    source_pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    friend_pet = get_pet_or_404(db, friend_id)
    friendship = get_friendship_between(db, source_pet.id, friend_id)

    if friendship is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有找到这条好友请求。",
        )

    if friendship.status != "pending" or friendship.initiated_by == source_pet.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="当前好友请求状态不允许接受。",
        )

    try:
        friendship.status = "accepted"
        friendship.accepted_at = datetime.now(timezone.utc)
        get_or_create_conversation(db, source_pet.id, friend_id)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="接受好友请求失败，请稍后再试。",
        ) from error

    return FriendshipActionResponse(
        message=f"已接受{friend_pet.pet_name}的好友请求，现在可以直接聊天。",
        friendship=build_friendship_response(db, friendship, source_pet.id),
    )


@router.post(
    "/pets/{pet_id}/friends/{friend_id}/reject",
    response_model=FriendshipActionResponse,
)
def reject_friendship(
    pet_id: int,
    friend_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> FriendshipActionResponse:
    source_pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    friend_pet = get_pet_or_404(db, friend_id)
    friendship = get_friendship_between(db, source_pet.id, friend_id)

    if friendship is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有找到这条好友请求。",
        )

    if friendship.status != "pending" or friendship.initiated_by == source_pet.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="当前好友请求状态不允许拒绝。",
        )

    try:
        friendship.status = "rejected"
        friendship.accepted_at = None
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="拒绝好友请求失败，请稍后再试。",
        ) from error

    return FriendshipActionResponse(
        message=f"已拒绝{friend_pet.pet_name}的好友请求，当前不能直接聊天。",
        friendship=build_friendship_response(db, friendship, source_pet.id),
    )


@router.get("/pets/{pet_id}/social/tasks", response_model=SocialTaskListResponse)
def list_social_tasks(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> SocialTaskListResponse:
    source_pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    tasks = get_social_tasks_for_pet(db, source_pet.id)
    return SocialTaskListResponse(
        message="已读取站内社交记录。",
        tasks=[
            build_social_task_history_item(db, task, source_pet.id)
            for task in tasks
        ],
    )


@router.get(
    "/pets/{pet_id}/social/messages/{other_pet_id}",
    response_model=SocialMessageListResponse,
)
def read_social_messages(
    pet_id: int,
    other_pet_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> SocialMessageListResponse:
    source_pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    other_pet = get_pet_or_404(db, other_pet_id)
    conversation = get_conversation_between(db, source_pet.id, other_pet.id)

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="这两只宠物之间还没有社交记录。",
        )

    messages = (
        db.query(PetSocialMessage)
        .filter(PetSocialMessage.conversation_id == conversation.id)
        .order_by(PetSocialMessage.created_at.asc(), PetSocialMessage.id.asc())
        .all()
    )

    return SocialMessageListResponse(
        message="已读取宠物间社交消息。",
        conversation={
            "conversationId": conversation.id,
            "withPet": build_pet_response(other_pet),
            "messages": [
                build_social_message_response(message) for message in messages
            ],
        },
    )


@router.post("/pets/{pet_id}/social/send", response_model=SocialSendResponse)
def send_social_message(
    pet_id: int,
    payload: SocialSendRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> SocialSendResponse:
    source_pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    target_pet = get_pet_or_404(db, payload.targetPetId)
    friendship = get_friendship_between(db, source_pet.id, target_pet.id)
    ensure_friendship_can_chat(friendship)
    input_text = payload.message.strip()

    try:
        conversation = get_or_create_conversation(db, source_pet.id, target_pet.id)
        task = create_social_task(
            db,
            target_pet_id=target_pet.id,
            source_pet_id=source_pet.id,
            task_type="chat",
            input_text=input_text,
        )
        sent_message = create_social_message(
            db, conversation.id, source_pet.id, input_text
        )
        recent_messages = read_recent_social_messages(db, conversation.id)
        reply_text = generate_social_reply(
            target_pet=target_pet,
            source_pet=source_pet,
            recent_messages=recent_messages,
            latest_input=input_text,
            task_type="chat",
        )
        reply_message = create_social_message(
            db, conversation.id, target_pet.id, reply_text
        )
        complete_social_task(task, reply_text)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="站内社交消息发送失败，请稍后再试。",
        ) from error

    return SocialSendResponse(
        message=f"已向{target_pet.pet_name}发送消息，并收到对方回复。",
        task=build_pet_task_response(task),
        sentMessage=build_social_message_response(sent_message),
        replyMessage=build_social_message_response(reply_message),
        conversationId=conversation.id,
        targetPet=build_pet_response(target_pet),
    )


@router.post("/pets/{pet_id}/social/round", response_model=SocialRoundResponse)
def run_social_round(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> SocialRoundResponse:
    source_pet = get_owned_pet_or_404(db, pet_id, current_user.id)
    target_pet, task_type = choose_social_round_target(db, source_pet)
    input_text = build_round_opening(source_pet, target_pet, task_type)

    try:
        prepare_round_friendship(db, source_pet, target_pet, task_type)
        conversation = get_or_create_conversation(db, source_pet.id, target_pet.id)
        task = create_social_task(
            db,
            target_pet_id=target_pet.id,
            source_pet_id=source_pet.id,
            task_type=task_type,
            input_text=input_text,
        )
        sent_message = create_social_message(
            db, conversation.id, source_pet.id, input_text
        )
        recent_messages = read_recent_social_messages(db, conversation.id)
        reply_text = generate_social_reply(
            target_pet=target_pet,
            source_pet=source_pet,
            recent_messages=recent_messages,
            latest_input=input_text,
            task_type=task_type,
        )
        reply_message = create_social_message(
            db, conversation.id, target_pet.id, reply_text
        )
        complete_social_task(task, reply_text)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="站内社交回合执行失败，请稍后再试。",
        ) from error

    return SocialRoundResponse(
        message=build_social_round_result_message(target_pet, task_type),
        task=build_pet_task_response(task),
        sentMessage=build_social_message_response(sent_message),
        replyMessage=build_social_message_response(reply_message),
        conversationId=conversation.id,
        targetPet=build_pet_response(target_pet),
    )
