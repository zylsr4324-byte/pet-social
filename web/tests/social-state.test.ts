import assert from "node:assert/strict";

import type { ApiPet } from "../lib/pet";
import {
  buildSocialCandidateSections,
  getSocialCandidateState,
  getSocialConversationHint,
  getSocialRequestButtonLabel,
  getSocialRoundActionDescription,
  sortSocialCandidates,
  type SocialCandidate,
} from "../lib/social";

type CandidateOptions = {
  id: number;
  petName: string;
  friendshipStatus?: SocialCandidate["friendshipStatus"];
  direction?: SocialCandidate["direction"];
  canRequest?: boolean;
  canChat?: boolean;
};

function createPet(id: number, petName: string): ApiPet {
  return {
    id,
    petName,
    species: "猫咪",
    color: "白色",
    size: "小型",
    personality: "高冷系",
    specialTraits: "喜欢观察",
    createdAt: "2026-03-28T00:00:00Z",
    updatedAt: "2026-03-28T00:00:00Z",
  };
}

function createCandidate({
  id,
  petName,
  friendshipStatus = null,
  direction = "none",
  canRequest = friendshipStatus === null || friendshipStatus === "rejected",
  canChat = friendshipStatus === "accepted",
}: CandidateOptions): SocialCandidate {
  return {
    pet: createPet(id, petName),
    friendshipStatus,
    direction,
    conversationId: canChat ? id * 100 : null,
    canRequest,
    canChat,
  };
}

function runTest(name: string, assertion: () => void) {
  assertion();
  console.log(`PASS ${name}`);
}

runTest("getSocialCandidateState returns the expected relationship bucket", () => {
  assert.equal(
    getSocialCandidateState(
      createCandidate({
        id: 1,
        petName: "待处理对象",
        friendshipStatus: "pending",
        direction: "incoming",
        canRequest: false,
      })
    ),
    "incoming_request"
  );

  assert.equal(
    getSocialCandidateState(
      createCandidate({
        id: 2,
        petName: "好友对象",
        friendshipStatus: "accepted",
        direction: "accepted",
        canRequest: false,
        canChat: true,
      })
    ),
    "ready_to_chat"
  );

  assert.equal(
    getSocialCandidateState(
      createCandidate({
        id: 3,
        petName: "已发请求对象",
        friendshipStatus: "pending",
        direction: "outgoing",
        canRequest: false,
      })
    ),
    "outgoing_request"
  );

  assert.equal(
    getSocialCandidateState(
      createCandidate({
        id: 4,
        petName: "被拒对象",
        friendshipStatus: "rejected",
      })
    ),
    "rejected"
  );

  assert.equal(
    getSocialCandidateState(createCandidate({ id: 5, petName: "陌生对象" })),
    "discoverable"
  );
});

runTest("sortSocialCandidates and buildSocialCandidateSections keep the intended state order", () => {
  const sortedCandidates = sortSocialCandidates([
    createCandidate({
      id: 5,
      petName: "等待回应",
      friendshipStatus: "pending",
      direction: "outgoing",
      canRequest: false,
    }),
    createCandidate({ id: 4, petName: "可认识" }),
    createCandidate({
      id: 3,
      petName: "已是好友",
      friendshipStatus: "accepted",
      direction: "accepted",
      canRequest: false,
      canChat: true,
    }),
    createCandidate({
      id: 2,
      petName: "先处理我",
      friendshipStatus: "pending",
      direction: "incoming",
      canRequest: false,
    }),
    createCandidate({
      id: 1,
      petName: "重新尝试",
      friendshipStatus: "rejected",
    }),
  ]);

  assert.deepEqual(
    sortedCandidates.map((candidate) => candidate.pet.petName),
    ["先处理我", "已是好友", "可认识", "重新尝试", "等待回应"]
  );

  const sections = buildSocialCandidateSections(sortedCandidates);

  assert.deepEqual(
    sections.map((section) => section.id),
    [
      "incoming_request",
      "ready_to_chat",
      "discoverable",
      "rejected",
      "outgoing_request",
    ]
  );
});

runTest("getSocialRoundActionDescription follows the clarified round priority", () => {
  assert.equal(
    getSocialRoundActionDescription([
      createCandidate({ id: 1, petName: "可认识" }),
      createCandidate({
        id: 2,
        petName: "老朋友",
        friendshipStatus: "accepted",
        direction: "accepted",
        canRequest: false,
        canChat: true,
      }),
    ]),
    "当前已有好友时，社交回合会优先和好友继续互动。"
  );

  assert.equal(
    getSocialRoundActionDescription([
      createCandidate({
        id: 3,
        petName: "待处理",
        friendshipStatus: "pending",
        direction: "incoming",
        canRequest: false,
      }),
    ]),
    "当前存在待处理的好友请求。社交回合不会替你自动接受，需要你手动处理。"
  );

  assert.equal(
    getSocialRoundActionDescription([
      createCandidate({
        id: 4,
        petName: "等待中",
        friendshipStatus: "pending",
        direction: "outgoing",
        canRequest: false,
      }),
    ]),
    "当前多数关系都在等待对方处理，社交回合可能暂时无法继续推进。"
  );
});

runTest("conversation hints and request button labels match the current relationship gate", () => {
  assert.equal(getSocialConversationHint(null), "先从左侧选择一个目标。");

  assert.equal(
    getSocialConversationHint(
      createCandidate({
        id: 1,
        petName: "先处理",
        friendshipStatus: "pending",
        direction: "incoming",
        canRequest: false,
      })
    ),
    "对方已经先发来好友请求。先接受或拒绝，接受之后才允许直接聊天。"
  );

  assert.equal(
    getSocialConversationHint(
      createCandidate({
        id: 2,
        petName: "好友",
        friendshipStatus: "accepted",
        direction: "accepted",
        canRequest: false,
        canChat: true,
      })
    ),
    "你们已经是好友，可以直接发送站内消息。"
  );

  assert.equal(
    getSocialRequestButtonLabel(
      createCandidate({
        id: 3,
        petName: "再试一次",
        friendshipStatus: "rejected",
      })
    ),
    "重新发好友请求"
  );
});

console.log("Social state regression checks passed.");
