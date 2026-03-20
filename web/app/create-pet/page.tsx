"use client";

import Link from "next/link";
import { useState } from "react";

export default function CreatePetPage() {
  const [pet, setPet] = useState({
    petName: "",
    species: "",
    color: "",
    size: "",
    personality: "",
    specialTraits: "",
  });

  const handlePetChange = (field: keyof typeof pet, value: string) => {
    setPet((currentPet) => ({
      ...currentPet,
      [field]: value,
    }));
  };

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-gray-500 transition hover:text-gray-800"
          >
            ← 返回首页
          </Link>

          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">创建宠物</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            先为你的第一只宠物填写基础资料。现在这一版会实时读取你的输入，并在右侧显示预览。
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <form className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <label
                htmlFor="petName"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                宠物名字
              </label>
              <input
                id="petName"
                name="petName"
                type="text"
                value={pet.petName}
                onChange={(e) => handlePetChange("petName", e.target.value)}
                placeholder="例如：小泡芙"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="species"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                宠物品种
              </label>
              <select
                id="species"
                name="species"
                value={pet.species}
                onChange={(e) => handlePetChange("species", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              >
                <option value="">请选择一个品种</option>
                <option value="猫">猫</option>
                <option value="狗">狗</option>
                <option value="兔子">兔子</option>
                <option value="狐狸">狐狸</option>
                <option value="其他">其他</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="color"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                主颜色
              </label>
              <input
                id="color"
                name="color"
                type="text"
                value={pet.color}
                onChange={(e) => handlePetChange("color", e.target.value)}
                placeholder="例如：橘白、纯黑、奶油色"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="size"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                体型大小
              </label>
              <select
                id="size"
                name="size"
                value={pet.size}
                onChange={(e) => handlePetChange("size", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              >
                <option value="">请选择体型</option>
                <option value="小型">小型</option>
                <option value="中型">中型</option>
                <option value="大型">大型</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="personality"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                性格设定
              </label>
              <textarea
                id="personality"
                name="personality"
                rows={4}
                value={pet.personality}
                onChange={(e) => handlePetChange("personality", e.target.value)}
                placeholder="例如：很黏人，喜欢撒娇，看到新朋友会先观察一下。"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="specialTraits"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                特殊特征
              </label>
              <textarea
                id="specialTraits"
                name="specialTraits"
                rows={4}
                value={pet.specialTraits}
                onChange={(e) => handlePetChange("specialTraits", e.target.value)}
                placeholder="例如：左耳有一点卷，尾巴尖是白色，脖子上有一圈浅色毛。"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
              />
            </div>

            <div className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
              现在这个页面已经能读取你的输入了。下一步我们会让“保存宠物信息”按钮真正处理这些数据。
            </div>

            <div className="pt-2">
              <button
               type="button"
               onClick={() => {
                    alert(`宠物信息已读取：${pet.petName || "未命名宠物"}`);
                }}
                className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
              >
                保存宠物信息
              </button>
            </div>
          </form>

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">宠物资料预览</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              这里会实时显示你当前填写的内容。
            </p>

            <div className="mt-6 space-y-4 text-sm text-gray-700">
              <div>
                <span className="font-medium text-gray-900">名字：</span>
                {pet.petName || "暂未填写"}
              </div>

              <div>
                <span className="font-medium text-gray-900">品种：</span>
                {pet.species || "暂未选择"}
              </div>

              <div>
                <span className="font-medium text-gray-900">主颜色：</span>
                {pet.color || "暂未填写"}
              </div>

              <div>
                <span className="font-medium text-gray-900">体型：</span>
                {pet.size || "暂未选择"}
              </div>

              <div>
                <span className="font-medium text-gray-900">性格：</span>
                {pet.personality || "暂未填写"}
              </div>

              <div>
                <span className="font-medium text-gray-900">特殊特征：</span>
                {pet.specialTraits || "暂未填写"}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
