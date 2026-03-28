"use client";

import type {
  Friendship,
  SocialCandidate,
  SocialConversation,
  SocialTaskHistoryItem,
} from "./social";
import {
  buildSocialCandidateSections,
  getFriendshipStatusLabel,
  getSocialCandidateActionHint,
  getSocialCandidateStatusLabel,
  getSocialConversationHint,
  getSocialRequestButtonLabel,
  getSocialRoundActionDescription,
  getTaskTypeLabel,
} from "./social";

type SocialTargetsPanelProps = {
  candidates: SocialCandidate[];
  selectedTargetId: number | null;
  statusMessage: string | null;
  isActing: boolean;
  onRunSocialRound: () => void;
  onSelectTarget: (targetId: number) => void;
  onRequestFriendship: (targetId: number) => void;
  onAcceptFriendship: (friendId: number) => void;
  onRejectFriendship: (friendId: number) => void;
};

type SocialConversationPanelProps = {
  petId: number;
  petName: string;
  selectedCandidate: SocialCandidate | null;
  conversation: SocialConversation | null;
  draftMessage: string;
  isActing: boolean;
  onDraftMessageChange: (value: string) => void;
  onSendMessage: () => void;
};

type SocialTaskHistoryPanelProps = {
  tasks: SocialTaskHistoryItem[];
};

type SocialFriendshipsPanelProps = {
  friendships: Friendship[];
};

function SectionEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-sm text-gray-500">
      {message}
    </div>
  );
}

export function SocialTargetsPanel({
  candidates,
  selectedTargetId,
  statusMessage,
  isActing,
  onRunSocialRound,
  onSelectTarget,
  onRequestFriendship,
  onAcceptFriendship,
  onRejectFriendship,
}: SocialTargetsPanelProps) {
  const candidateSections = buildSocialCandidateSections(candidates);

  return (
    <section className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">候选对象</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            这里只负责选择社交对象、发起好友请求，以及执行一轮站内社交。
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            {getSocialRoundActionDescription(candidates)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRunSocialRound}
          disabled={isActing}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isActing ? "执行中..." : "来一轮社交"}
        </button>
      </div>

      {statusMessage ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {candidateSections.length === 0 ? (
          <SectionEmptyState message="当前还没有可互动的其他宠物。" />
        ) : null}

        {candidateSections.map((section) => (
          <div key={section.id} className="space-y-3">
            <div className="px-1">
              <h3 className="text-sm font-semibold text-gray-900">
                {section.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {section.description}
              </p>
            </div>

            {section.candidates.map((candidate) => (
              <div
                key={candidate.pet.id}
                className={`rounded-2xl border p-4 ${
                  selectedTargetId === candidate.pet.id
                    ? "border-amber-300 bg-white"
                    : "border-orange-100 bg-white/80"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectTarget(candidate.pet.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {candidate.pet.petName}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {candidate.pet.species} · {candidate.pet.personality}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                      {getSocialCandidateStatusLabel(candidate)}
                    </span>
                  </div>
                </button>

                <p className="mt-3 text-sm text-gray-600">
                  {candidate.pet.specialTraits}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  {getSocialCandidateActionHint(candidate)}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {candidate.canRequest ? (
                    <button
                      type="button"
                      onClick={() => onRequestFriendship(candidate.pet.id)}
                      disabled={isActing}
                      className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-60"
                    >
                      {getSocialRequestButtonLabel(candidate)}
                    </button>
                  ) : null}

                  {candidate.friendshipStatus === "pending" &&
                  candidate.direction === "incoming" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onAcceptFriendship(candidate.pet.id)}
                        disabled={isActing}
                        className="rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-60"
                      >
                        接受请求
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectFriendship(candidate.pet.id)}
                        disabled={isActing}
                        className="rounded-lg bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800 disabled:opacity-60"
                      >
                        拒绝请求
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SocialConversationPanel({
  petId,
  petName,
  selectedCandidate,
  conversation,
  draftMessage,
  isActing,
  onDraftMessageChange,
  onSendMessage,
}: SocialConversationPanelProps) {
  return (
    <section className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">当前会话</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          这里只展示当前选中对象的消息记录。只有成为好友后，才允许直接发送站内消息。
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-gray-50 p-4">
        {conversation ? (
          <>
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {conversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.senderPetId === petId ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.senderPetId === petId
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-700"
                    }`}
                  >
                    <p className="mb-1 text-xs opacity-70">
                      {message.senderPetId === petId
                        ? petName
                        : conversation.withPet.petName}
                    </p>
                    <p>{message.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedCandidate?.canChat ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  onSendMessage();
                }}
                className="mt-4 space-y-3"
              >
                <input
                  type="text"
                  value={draftMessage}
                  onChange={(event) => onDraftMessageChange(event.target.value)}
                  placeholder={`对 ${conversation.withPet.petName} 说点什么`}
                  disabled={isActing}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-500 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isActing || !draftMessage.trim()}
                  className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  发送站内消息
                </button>
              </form>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                {getSocialConversationHint(selectedCandidate)}
              </div>
            )}
          </>
        ) : (
          <SectionEmptyState message={getSocialConversationHint(selectedCandidate)} />
        )}
      </div>
    </section>
  );
}

export function SocialTaskHistoryPanel({ tasks }: SocialTaskHistoryPanelProps) {
  return (
    <section className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">最近社交任务</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          这里只保留每次社交回合的输入、输出和任务类型，用来回看流程，不负责发起操作。
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {tasks.length === 0 ? (
          <SectionEmptyState message="当前还没有社交任务记录。" />
        ) : null}

        {tasks.slice(0, 8).map((item) => (
          <div key={item.task.id} className="rounded-2xl bg-gray-50 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <p className="font-medium text-gray-900">
                {item.counterpartPet?.petName || "未知对象"}
              </p>
              <span className="rounded-full bg-white px-2 py-1 text-xs text-gray-500">
                {getTaskTypeLabel(item.task.taskType)}
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-xs text-gray-500">
                {item.task.state}
              </span>
            </div>

            <p className="mt-2 text-sm text-gray-700">
              发起内容：{item.task.inputText}
            </p>
            {item.task.outputText ? (
              <p className="mt-2 text-sm text-gray-500">
                回复内容：{item.task.outputText}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SocialFriendshipsPanel({
  friendships,
}: SocialFriendshipsPanelProps) {
  return (
    <section className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">好友关系</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          这里只查看关系状态和最近一条记录，不在这里触发新的社交动作。
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {friendships.length === 0 ? (
          <SectionEmptyState message="当前还没有建立任何好友关系。" />
        ) : null}

        {friendships.map((friendship) => (
          <div
            key={`${friendship.friend.id}-${friendship.createdAt}`}
            className="rounded-2xl bg-gray-50 px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <p className="font-medium text-gray-900">
                {friendship.friend.petName}
              </p>
              <span className="rounded-full bg-white px-2 py-1 text-xs text-gray-500">
                {getFriendshipStatusLabel(friendship)}
              </span>
            </div>

            <p className="mt-2 text-sm text-gray-600">
              {friendship.friend.species} · {friendship.friend.personality}
            </p>

            {friendship.lastMessagePreview ? (
              <p className="mt-2 text-sm text-gray-500">
                最近一条：{friendship.lastMessagePreview}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
