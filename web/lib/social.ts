import { type ApiPet, isPetProfile } from "./pet";

export type SocialCandidate = {
  pet: ApiPet;
  friendshipStatus: string | null;
  direction: string;
  conversationId: number | null;
  canRequest: boolean;
  canChat: boolean;
  relationshipScore: number;
  relationshipSummary: string;
  memorySummary: string;
  recentTopics: string[];
};

export type SocialCandidateListResponse = {
  message: string;
  candidates: SocialCandidate[];
};

export type Friendship = {
  friend: ApiPet;
  status: string;
  initiatedBy: number;
  direction: string;
  conversationId: number | null;
  lastMessagePreview: string | null;
  relationshipScore: number;
  relationshipSummary: string;
  memorySummary: string;
  recentTopics: string[];
  createdAt: string;
  acceptedAt: string | null;
};

export type FriendshipListResponse = {
  message: string;
  friends: Friendship[];
};

export type FriendshipActionResponse = {
  message: string;
  friendship: Friendship;
};

export type SocialTask = {
  id: number;
  targetPetId: number;
  sourcePetId: number | null;
  taskType: string;
  state: string;
  inputText: string;
  outputText: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type SocialTaskHistoryItem = {
  task: SocialTask;
  counterpartPet: ApiPet | null;
};

export type SocialTaskListResponse = {
  message: string;
  tasks: SocialTaskHistoryItem[];
};

export type SocialMessage = {
  id: number;
  conversationId: number;
  senderPetId: number;
  content: string;
  emotion: string | null;
  action: string | null;
  createdAt: string;
};

export type SocialConversation = {
  conversationId: number;
  withPet: ApiPet;
  messages: SocialMessage[];
};

export type SocialReplyPayload = {
  emotion: string;
  action: string;
  text: string;
};

export type SocialMessageListResponse = {
  message: string;
  conversation: SocialConversation;
};

export type SocialSendResponse = {
  message: string;
  task: SocialTask;
  sentMessage: SocialMessage;
  replyMessage: SocialMessage;
  reply: SocialReplyPayload;
  conversationId: number;
  targetPet: ApiPet;
};

export type SocialRoundResponse = SocialSendResponse;

export type SocialCandidateState =
  | "incoming_request"
  | "ready_to_chat"
  | "discoverable"
  | "rejected"
  | "outgoing_request";

export type SocialCandidateSection = {
  id: SocialCandidateState;
  title: string;
  description: string;
  candidates: SocialCandidate[];
};

export type SocialEmotionVisual = {
  key: string;
  label: string;
  description: string;
  bubbleClassName: string;
  badgeClassName: string;
  dotClassName: string;
  panelClassName: string;
  motionClassName: string;
};

const SOCIAL_EMOTION_VISUALS: Record<string, SocialEmotionVisual> = {
  calm: {
    key: "calm",
    label: "平静",
    description: "语气放慢，保持舒服距离。",
    bubbleClassName: "border border-slate-200 bg-slate-50 text-slate-700",
    badgeClassName: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    dotClassName: "bg-slate-400",
    panelClassName: "border-slate-200 bg-slate-50 text-slate-800",
    motionClassName: "social-motion-calm",
  },
  curious: {
    key: "curious",
    label: "好奇",
    description: "先观察，再试探着靠近。",
    bubbleClassName: "border border-sky-200 bg-sky-50 text-sky-900",
    badgeClassName: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
    dotClassName: "bg-sky-400",
    panelClassName: "border-sky-200 bg-sky-50 text-sky-900",
    motionClassName: "social-motion-curious",
  },
  guarded: {
    key: "guarded",
    label: "戒备",
    description: "距离感更强，回应更短。",
    bubbleClassName: "border border-stone-300 bg-stone-100 text-stone-800",
    badgeClassName: "bg-stone-200 text-stone-800 ring-1 ring-stone-300",
    dotClassName: "bg-stone-500",
    panelClassName: "border-stone-300 bg-stone-100 text-stone-900",
    motionClassName: "social-motion-guarded",
  },
  excited: {
    key: "excited",
    label: "兴奋",
    description: "反应更快，动作更外放。",
    bubbleClassName: "border border-orange-200 bg-orange-50 text-orange-950",
    badgeClassName: "bg-orange-100 text-orange-900 ring-1 ring-orange-200",
    dotClassName: "bg-orange-500",
    panelClassName: "border-orange-200 bg-orange-50 text-orange-950",
    motionClassName: "social-motion-excited",
  },
  warm: {
    key: "warm",
    label: "亲近",
    description: "愿意靠近，回应更柔和。",
    bubbleClassName: "border border-amber-200 bg-amber-50 text-amber-950",
    badgeClassName: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
    dotClassName: "bg-amber-500",
    panelClassName: "border-amber-200 bg-amber-50 text-amber-950",
    motionClassName: "social-motion-warm",
  },
};

export function getSocialEmotionVisual(
  emotion: string | null | undefined
): SocialEmotionVisual | null {
  const normalizedEmotion = emotion?.trim().toLowerCase();
  if (!normalizedEmotion) {
    return null;
  }
  return SOCIAL_EMOTION_VISUALS[normalizedEmotion] ?? null;
}

export function getSocialMessageEventLine(
  event: Pick<SocialMessage, "emotion" | "action">
) {
  const emotionVisual = getSocialEmotionVisual(event.emotion);
  const action = event.action?.trim();

  if (emotionVisual && action) {
    return `${emotionVisual.label} · ${action}`;
  }
  if (emotionVisual) {
    return emotionVisual.label;
  }
  return action || null;
}

export type SocialPresenceTone = {
  label: string;
  description: string;
  className: string;
};

export function getSocialCandidatePresenceTone(
  candidate: SocialCandidate
): SocialPresenceTone {
  const state = getSocialCandidateState(candidate);

  if (state === "incoming_request") {
    return {
      label: "对方先靠近",
      description: "这次最好给明确回应，别让对方的试探悬着。",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (state === "ready_to_chat" && candidate.relationshipScore >= 70) {
    return {
      label: "熟络互动",
      description: "已经不只是试探，适合沿着共同记忆继续聊。",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (state === "ready_to_chat") {
    return {
      label: "关系升温",
      description: "已经能直接聊天，继续保持稳定来回会更自然。",
      className: "border-sky-200 bg-sky-50 text-sky-800",
    };
  }

  if (state === "outgoing_request") {
    return {
      label: "等待接球",
      description: "你已经先伸出爪子，先别连续追发，留一点节奏。",
      className: "border-orange-200 bg-orange-50 text-orange-800",
    };
  }

  if (state === "rejected") {
    return {
      label: "谨慎再试",
      description: "可以重新靠近，但开场要更轻，别一下子贴太近。",
      className: "border-stone-300 bg-stone-100 text-stone-800",
    };
  }

  if (candidate.relationshipScore >= 35) {
    return {
      label: "正在观察",
      description: "还没有真正熟起来，但已经不是完全陌生。",
      className: "border-violet-200 bg-violet-50 text-violet-800",
    };
  }

  return {
    label: "初次打量",
    description: "更像远远看着你，适合先用轻一点的话题接近。",
    className: "border-gray-200 bg-gray-50 text-gray-700",
  };
}

export function getCurrentSocialEmotionVisual(
  petId: number,
  conversation: SocialConversation | null,
  latestReply: SocialReplyPayload | null
): SocialEmotionVisual | null {
  if (latestReply) {
    return getSocialEmotionVisual(latestReply.emotion);
  }

  if (!conversation) {
    return null;
  }

  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    const message = conversation.messages[index];
    if (message.senderPetId !== petId) {
      return getSocialEmotionVisual(message.emotion);
    }
  }

  return null;
}

export function getSocialPresenceSummary(
  candidate: SocialCandidate | null,
  emotionVisual: SocialEmotionVisual | null
) {
  if (emotionVisual?.key === "warm") {
    return {
      title: "现在明显愿意靠近",
      description: "适合顺着它刚刚给出的动作继续接话，不用把话题拉得太远。",
    };
  }

  if (emotionVisual?.key === "excited") {
    return {
      title: "现在进入兴奋状态",
      description: "对方已经被带动起来了，继续接住它的节奏会显得更像真实互动。",
    };
  }

  if (emotionVisual?.key === "curious") {
    return {
      title: "现在更像在观察你",
      description: "适合继续给一点具体线索，让它有东西可闻、可看、可试探。",
    };
  }

  if (emotionVisual?.key === "guarded") {
    return {
      title: "现在还保留距离感",
      description: "别连续追问，给它一点缓冲，下一句用更轻的语气会更自然。",
    };
  }

  if (emotionVisual?.key === "calm") {
    return {
      title: "现在节奏比较平稳",
      description: "不用急着制造高潮，慢慢聊日常，反而更像真实宠物相处。",
    };
  }

  if (!candidate) {
    return {
      title: "先选择一个对象",
      description: "选中目标后，这里会根据最近互动判断对方现在更像靠近、观察还是戒备。",
    };
  }

  const presenceTone = getSocialCandidatePresenceTone(candidate);
  return {
    title: presenceTone.label,
    description: presenceTone.description,
  };
}

function getSocialCandidatePriority(candidate: SocialCandidate) {
  const state = getSocialCandidateState(candidate);

  if (state === "incoming_request") return 0;
  if (state === "ready_to_chat") return 1;
  if (state === "discoverable") return 2;
  if (state === "rejected") return 3;
  return 4;
}

export function getSocialCandidateState(
  candidate: SocialCandidate
): SocialCandidateState {
  if (
    candidate.friendshipStatus === "pending" &&
    candidate.direction === "incoming"
  ) {
    return "incoming_request";
  }
  if (candidate.canChat || candidate.friendshipStatus === "accepted") {
    return "ready_to_chat";
  }
  if (
    candidate.friendshipStatus === "pending" &&
    candidate.direction === "outgoing"
  ) {
    return "outgoing_request";
  }
  if (candidate.friendshipStatus === "rejected") {
    return "rejected";
  }
  return "discoverable";
}

export function sortSocialCandidates(candidates: SocialCandidate[]) {
  return [...candidates].sort((left, right) => {
    const priorityDiff =
      getSocialCandidatePriority(left) - getSocialCandidatePriority(right);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return left.pet.petName.localeCompare(right.pet.petName, "zh-CN");
  });
}

export function buildSocialCandidateSections(
  candidates: SocialCandidate[]
): SocialCandidateSection[] {
  const sectionMeta: Record<
    SocialCandidateState,
    Pick<SocialCandidateSection, "title" | "description">
  > = {
    incoming_request: {
      title: "待处理请求",
      description: "这些宠物已经先向你发来好友请求，先接受或拒绝，再决定是否继续互动。",
    },
    ready_to_chat: {
      title: "可直接聊天",
      description: "这些宠物已经和你建立好友关系，可以直接进入会话。",
    },
    discoverable: {
      title: "可发起关系",
      description: "这些宠物还没有建立关系，可以发好友请求，或让系统先跑一轮破冰。",
    },
    rejected: {
      title: "可重新发起",
      description: "这些关系曾被拒绝过，但现在允许重新发起请求。",
    },
    outgoing_request: {
      title: "等待对方处理",
      description: "这些请求已经发出，当前只能等待对方接受或拒绝。",
    },
  };

  const grouped = new Map<SocialCandidateState, SocialCandidate[]>();

  for (const candidate of sortSocialCandidates(candidates)) {
    const state = getSocialCandidateState(candidate);
    const currentGroup = grouped.get(state) ?? [];
    currentGroup.push(candidate);
    grouped.set(state, currentGroup);
  }

  const orderedStates: SocialCandidateState[] = [
    "incoming_request",
    "ready_to_chat",
    "discoverable",
    "rejected",
    "outgoing_request",
  ];

  return orderedStates
    .map((state) => {
      const sectionCandidates = grouped.get(state) ?? [];
      if (sectionCandidates.length === 0) {
        return null;
      }

      return {
        id: state,
        title: sectionMeta[state].title,
        description: sectionMeta[state].description,
        candidates: sectionCandidates,
      };
    })
    .filter((section): section is SocialCandidateSection => section !== null);
}

export function getSocialCandidateStatusLabel(candidate: SocialCandidate) {
  const state = getSocialCandidateState(candidate);

  if (state === "incoming_request") return "待你处理";
  if (state === "ready_to_chat") return "可直接聊天";
  if (state === "discoverable") return "未建立关系";
  if (state === "rejected") return "可重新发起";
  return "等待对方处理";
}

export function getSocialCandidateActionHint(candidate: SocialCandidate) {
  const state = getSocialCandidateState(candidate);

  if (state === "incoming_request") {
    return "对方已经先发来好友请求。先接受或拒绝，再决定是否进入长期关系。";
  }
  if (state === "ready_to_chat") {
    return "你们已经是好友。可以直接聊天，系统社交回合也会优先和好友继续互动。";
  }
  if (state === "discoverable") {
    return "当前还没有建立关系。你可以手动发起好友请求，或让系统先跑一轮破冰。";
  }
  if (state === "rejected") {
    return "这段关系此前被拒绝过。现在可以重新发起请求，但仍需对方再次确认。";
  }
  return "好友请求已经发出，当前只能等待对方处理，不能直接聊天。";
}

export function getSocialRequestButtonLabel(candidate: SocialCandidate) {
  return getSocialCandidateState(candidate) === "rejected"
    ? "重新发好友请求"
    : "发好友请求";
}

export function getSocialConversationHint(candidate: SocialCandidate | null) {
  if (candidate === null) {
    return "先从左侧选择一个目标。";
  }

  const state = getSocialCandidateState(candidate);

  if (state === "incoming_request") {
    return "对方已经先发来好友请求。先接受或拒绝，接受之后才允许直接聊天。";
  }
  if (state === "ready_to_chat") {
    return "你们已经是好友，可以直接发送站内消息。";
  }
  if (state === "discoverable") {
    return "你们还没有建立关系。先发好友请求，或让系统跑一轮社交破冰。";
  }
  if (state === "rejected") {
    return "这段关系曾被拒绝。你可以重新发好友请求，再决定是否继续推进。";
  }
  return "好友请求仍在等待对方处理。当前还不能直接聊天。";
}

export function getSocialRoundActionDescription(candidates: SocialCandidate[]) {
  if (candidates.some((candidate) => getSocialCandidateState(candidate) === "ready_to_chat")) {
    return "当前已有好友时，社交回合会优先和好友继续互动。";
  }
  if (
    candidates.some((candidate) =>
      ["discoverable", "rejected"].includes(getSocialCandidateState(candidate))
    )
  ) {
    return "当前没有可直接聊天的好友时，社交回合会自动选择一个新对象打招呼。";
  }
  if (
    candidates.some(
      (candidate) => getSocialCandidateState(candidate) === "incoming_request"
    )
  ) {
    return "当前存在待处理的好友请求。社交回合不会替你自动接受，需要你手动处理。";
  }
  return "当前多数关系都在等待对方处理，社交回合可能暂时无法继续推进。";
}

export function getTaskTypeLabel(taskType: string) {
  if (taskType === "chat") return "好友聊天";
  if (taskType === "greet") return "破冰招呼";
  if (taskType === "befriend") return "好友请求";
  return taskType;
}

export function getFriendshipStatusLabel(friendship: Friendship) {
  if (friendship.status === "accepted") return "已成为好友";
  if (friendship.direction === "incoming") return "等待你处理";
  if (friendship.status === "pending") return "等待对方处理";
  if (friendship.status === "rejected") return "已拒绝";
  return friendship.status;
}

const isApiPet = (value: unknown): value is ApiPet => {
  if (!isPetProfile(value)) {
    return false;
  }

  const pet = value as Record<string, unknown>;
  return (
    typeof pet.id === "number" &&
    typeof pet.createdAt === "string" &&
    typeof pet.updatedAt === "string"
  );
};

const isSocialCandidate = (value: unknown): value is SocialCandidate => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isApiPet(candidate.pet) &&
    (typeof candidate.friendshipStatus === "string" ||
      candidate.friendshipStatus === null) &&
    typeof candidate.direction === "string" &&
    (typeof candidate.conversationId === "number" ||
      candidate.conversationId === null) &&
    typeof candidate.canRequest === "boolean" &&
    typeof candidate.canChat === "boolean" &&
    typeof candidate.relationshipScore === "number" &&
    typeof candidate.relationshipSummary === "string" &&
    typeof candidate.memorySummary === "string" &&
    Array.isArray(candidate.recentTopics) &&
    candidate.recentTopics.every((topic) => typeof topic === "string")
  );
};

const isFriendship = (value: unknown): value is Friendship => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const friendship = value as Record<string, unknown>;
  return (
    isApiPet(friendship.friend) &&
    typeof friendship.status === "string" &&
    typeof friendship.initiatedBy === "number" &&
    typeof friendship.direction === "string" &&
    (typeof friendship.conversationId === "number" ||
      friendship.conversationId === null) &&
    (typeof friendship.lastMessagePreview === "string" ||
      friendship.lastMessagePreview === null) &&
    typeof friendship.relationshipScore === "number" &&
    typeof friendship.relationshipSummary === "string" &&
    typeof friendship.memorySummary === "string" &&
    Array.isArray(friendship.recentTopics) &&
    friendship.recentTopics.every((topic) => typeof topic === "string") &&
    typeof friendship.createdAt === "string" &&
    (typeof friendship.acceptedAt === "string" ||
      friendship.acceptedAt === null)
  );
};

const isSocialTask = (value: unknown): value is SocialTask => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Record<string, unknown>;
  return (
    typeof task.id === "number" &&
    typeof task.targetPetId === "number" &&
    (typeof task.sourcePetId === "number" || task.sourcePetId === null) &&
    typeof task.taskType === "string" &&
    typeof task.state === "string" &&
    typeof task.inputText === "string" &&
    (typeof task.outputText === "string" || task.outputText === null) &&
    typeof task.createdAt === "string" &&
    (typeof task.completedAt === "string" || task.completedAt === null)
  );
};

const isSocialTaskHistoryItem = (
  value: unknown
): value is SocialTaskHistoryItem => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    isSocialTask(item.task) &&
    (isApiPet(item.counterpartPet) || item.counterpartPet === null)
  );
};

const isSocialMessage = (value: unknown): value is SocialMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "number" &&
    typeof message.conversationId === "number" &&
    typeof message.senderPetId === "number" &&
    typeof message.content === "string" &&
    (typeof message.emotion === "string" || message.emotion === null) &&
    (typeof message.action === "string" || message.action === null) &&
    typeof message.createdAt === "string"
  );
};

const isSocialConversation = (value: unknown): value is SocialConversation => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const conversation = value as Record<string, unknown>;
  return (
    typeof conversation.conversationId === "number" &&
    isApiPet(conversation.withPet) &&
    Array.isArray(conversation.messages) &&
    conversation.messages.every(isSocialMessage)
  );
};

const isSocialReplyPayload = (value: unknown): value is SocialReplyPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const reply = value as Record<string, unknown>;
  return (
    typeof reply.emotion === "string" &&
    typeof reply.action === "string" &&
    typeof reply.text === "string"
  );
};

export const isSocialCandidateListResponse = (
  value: unknown
): value is SocialCandidateListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    Array.isArray(response.candidates) &&
    response.candidates.every(isSocialCandidate)
  );
};

export const isFriendshipListResponse = (
  value: unknown
): value is FriendshipListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    Array.isArray(response.friends) &&
    response.friends.every(isFriendship)
  );
};

export const isFriendshipActionResponse = (
  value: unknown
): value is FriendshipActionResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" && isFriendship(response.friendship)
  );
};

export const isSocialTaskListResponse = (
  value: unknown
): value is SocialTaskListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    Array.isArray(response.tasks) &&
    response.tasks.every(isSocialTaskHistoryItem)
  );
};

export const isSocialMessageListResponse = (
  value: unknown
): value is SocialMessageListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    isSocialConversation(response.conversation)
  );
};

export const isSocialSendResponse = (
  value: unknown
): value is SocialSendResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    isSocialTask(response.task) &&
    isSocialMessage(response.sentMessage) &&
    isSocialMessage(response.replyMessage) &&
    isSocialReplyPayload(response.reply) &&
    typeof response.conversationId === "number" &&
    isApiPet(response.targetPet)
  );
};

export const isSocialRoundResponse = (
  value: unknown
): value is SocialRoundResponse => isSocialSendResponse(value);
