"use client";

import { getSpeciesVisual, getTemperamentTag } from "./pet-display";
import type {
  Friendship,
  SocialCandidate,
  SocialConversation,
  SocialReplyPayload,
  SocialTaskHistoryItem,
} from "./social";
import {
  buildSocialCandidateSections,
  getFriendshipStatusLabel,
  getSocialCandidateActionHint,
  getSocialCandidatePresenceTone,
  getSocialCandidateStatusLabel,
  getCurrentSocialEmotionVisual,
  getSocialConversationHint,
  getSocialEmotionVisual,
  getSocialMessageEventLine,
  getSocialPresenceSummary,
  getSocialRequestButtonLabel,
  getSocialRoundActionDescription,
  getTaskTypeLabel,
} from "./social";
import { cx, ui } from "./ui";

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
  latestReply: SocialReplyPayload | null;
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
    <div className={`${ui.cardGhost} px-4 py-8 text-sm text-stone-500`}>
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
    <section className={`${ui.cardWarm} p-6`}>
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
          className={`${ui.buttonPrimary} px-4 py-2`}
        >
          {isActing ? "执行中..." : "来一轮社交"}
        </button>
      </div>

      {statusMessage ? (
        <div className={`mt-4 ${ui.noticeInfo}`}>
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
              (() => {
                const speciesVisual = getSpeciesVisual(candidate.pet.species);
                const temperamentTag = getTemperamentTag(candidate.pet.personality);
                const presenceTone = getSocialCandidatePresenceTone(candidate);

                return (
                  <div
                    key={candidate.pet.id}
                    className={cx(
                      "rounded-[24px] border p-4 transition",
                      selectedTargetId === candidate.pet.id
                        ? "border-[#d9a96d] bg-white shadow-[0_18px_40px_-28px_rgba(180,83,9,0.4)]"
                        : "border-[#eadfce] bg-[#fffdf9]"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTarget(candidate.pet.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 via-white to-orange-100 text-2xl shadow-sm">
                            {speciesVisual.icon}
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-gray-900">
                              {candidate.pet.petName}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                              {candidate.pet.species} · {candidate.pet.personality}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              {speciesVisual.note}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                          {getSocialCandidateStatusLabel(candidate)}
                        </span>
                      </div>
                    </button>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${temperamentTag.className}`}
                      >
                        {temperamentTag.label}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${presenceTone.className}`}
                      >
                        {presenceTone.label}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-gray-600">
                      {candidate.pet.specialTraits || temperamentTag.note}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      关系温度：{candidate.relationshipScore}/100
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      {candidate.relationshipSummary}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      当前氛围：{presenceTone.description}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      共同记忆：{candidate.memorySummary}
                    </p>
                    {candidate.recentTopics.length > 0 ? (
                      <p className="mt-2 text-sm text-gray-500">
                        最近话题：{candidate.recentTopics.join(" · ")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-gray-500">
                      {getSocialCandidateActionHint(candidate)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {candidate.canRequest ? (
                        <button
                          type="button"
                          onClick={() => onRequestFriendship(candidate.pet.id)}
                          disabled={isActing}
                          className={`${ui.buttonSecondary} px-4 py-2`}
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
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            接受请求
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectFriendship(candidate.pet.id)}
                            disabled={isActing}
                            className="inline-flex items-center justify-center rounded-xl bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            拒绝请求
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })()
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
  latestReply,
  draftMessage,
  isActing,
  onDraftMessageChange,
  onSendMessage,
}: SocialConversationPanelProps) {
  const latestReplyVisual = getSocialEmotionVisual(latestReply?.emotion);
  const currentSocialVisual = getCurrentSocialEmotionVisual(
    petId,
    conversation,
    latestReply
  );
  const presenceSummary = getSocialPresenceSummary(
    selectedCandidate,
    currentSocialVisual
  );
  const speciesVisual = selectedCandidate
    ? getSpeciesVisual(selectedCandidate.pet.species)
    : null;
  const temperamentTag = selectedCandidate
    ? getTemperamentTag(selectedCandidate.pet.personality)
    : null;

  return (
    <section className={`${ui.card} p-6`}>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">当前会话</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          这里只展示当前选中对象的消息记录。只有成为好友后，才允许直接发送站内消息。
        </p>
      </div>

      <div className={`${ui.cardSoft} mt-4`}>
        {selectedCandidate ? (
          <div className={`${ui.cardInset} mb-4 px-4 py-4`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 via-white to-orange-100 text-3xl shadow-sm ${
                    currentSocialVisual?.motionClassName ?? ""
                  }`}
                >
                  {speciesVisual?.icon ?? "🐾"}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedCandidate.pet.petName}
                    </p>
                    {currentSocialVisual ? (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${currentSocialVisual.badgeClassName}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${currentSocialVisual.dotClassName}`}
                        />
                        {currentSocialVisual.label}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedCandidate.pet.species} · {selectedCandidate.pet.personality}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {presenceSummary.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {presenceSummary.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {temperamentTag ? (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${temperamentTag.className}`}
                  >
                    {temperamentTag.label}
                  </span>
                ) : null}
                <span className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-800">
                  关系温度 {selectedCandidate.relationshipScore}/100
                </span>
              </div>
            </div>
          </div>
        ) : null}
        {latestReply ? (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
              latestReplyVisual?.panelClassName ??
              "border-amber-200 bg-amber-50 text-amber-900"
            } ${latestReplyVisual?.motionClassName ?? ""}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">本轮回应</p>
              {latestReplyVisual ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${latestReplyVisual.badgeClassName}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${latestReplyVisual.dotClassName}`}
                  />
                  {latestReplyVisual.label}
                </span>
              ) : null}
            </div>
            {latestReplyVisual ? (
              <p className="mt-2 text-xs opacity-75">
                {latestReplyVisual.description}
              </p>
            ) : null}
            <p className="mt-2 text-xs opacity-80">动作：{latestReply.action}</p>
            <p className="mt-1 leading-6">台词：{latestReply.text}</p>
          </div>
        ) : null}
        {conversation ? (
          <>
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {conversation.messages.map((message) => {
                const isOwnMessage = message.senderPetId === petId;
                const emotionVisual = getSocialEmotionVisual(message.emotion);
                const eventLine = getSocialMessageEventLine(message);

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isOwnMessage ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                        isOwnMessage
                          ? "bg-gray-900 text-white"
                          : (emotionVisual?.bubbleClassName ??
                            "border border-gray-100 bg-white text-gray-700")
                      } ${!isOwnMessage ? (emotionVisual?.motionClassName ?? "") : ""}`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs opacity-70">
                          {isOwnMessage ? petName : conversation.withPet.petName}
                        </p>
                        {!isOwnMessage && emotionVisual ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${emotionVisual.badgeClassName}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${emotionVisual.dotClassName}`}
                            />
                            {emotionVisual.label}
                          </span>
                        ) : null}
                      </div>
                      {eventLine ? (
                        <p className="mb-1 text-xs opacity-80">{eventLine}</p>
                      ) : null}
                      <p>{message.content}</p>
                    </div>
                  </div>
                );
              })}
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
                  className={ui.input}
                />
                <button
                  type="submit"
                  disabled={isActing || !draftMessage.trim()}
                  className={ui.buttonPrimary}
                >
                  发送站内消息
                </button>
              </form>
            ) : (
              <div className={`mt-4 ${ui.cardGhost} bg-white px-4 py-3 text-sm text-gray-500`}>
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
    <section className={`${ui.card} p-6`}>
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
          <div key={item.task.id} className={`${ui.cardSoft} px-4 py-4`}>
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
    <section className={`${ui.card} p-6`}>
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
            className={`${ui.cardSoft} px-4 py-4`}
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
            <p className="mt-2 text-sm text-gray-700">
              关系温度：{friendship.relationshipScore}/100
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {friendship.relationshipSummary}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              共同记忆：{friendship.memorySummary}
            </p>
            {friendship.recentTopics.length > 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                最近话题：{friendship.recentTopics.join(" · ")}
              </p>
            ) : null}

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
