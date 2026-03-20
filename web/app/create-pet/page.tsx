import Link from "next/link";
export default function CreatePetPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
  <Link
    href="/"
    className="text-sm text-gray-500 transition hover:text-gray-800"
  >
    ← 返回首页
  </Link>

  <h1 className="mt-4 text-3xl font-bold sm:text-4xl">创建宠物</h1>
  <p className="mt-3 text-base leading-7 text-gray-600">
    先为你的第一只宠物填写基础资料。后面我们会把这些信息真正保存到系统里。
  </p>
</div>

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
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
            >
              <option value="">请选择一个品种</option>
              <option value="cat">猫</option>
              <option value="dog">狗</option>
              <option value="rabbit">兔子</option>
              <option value="fox">狐狸</option>
              <option value="other">其他</option>
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
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
            >
              <option value="">请选择体型</option>
              <option value="small">小型</option>
              <option value="medium">中型</option>
              <option value="large">大型</option>
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
              placeholder="例如：左耳有一点卷，尾巴尖是白色，脖子上有一圈浅色毛。"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500"
            />
          </div>

          <div className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
            提示：现在这个页面先只做界面展示。下一步我们会让这些输入内容能够被读取和处理。
          </div>

          <div className="pt-2">
            <button
              type="button"
              className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
            >
              保存宠物信息
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}