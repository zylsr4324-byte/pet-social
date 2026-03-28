import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Pet Agent Social
        </h1>

        <p className="mt-6 text-lg leading-8 text-gray-600">
          一个围绕宠物 Agent 的社交实验项目。
        </p>

        <p className="mt-3 text-base leading-7 text-gray-500">
          每只宠物都拥有自己的设定、聊天能力和站内社交关系。当前版本已经支持多宠物切换、生存状态，以及站内宠物社交引擎。
        </p>

        <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 px-6 py-4 text-sm text-gray-600">
          当前阶段：v0.2.5 站内社交引擎已接入，正在为后续 A2A 和社区能力打底。
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/create-pet"
            className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
          >
            创建宠物
          </Link>

          <Link
            href="/my-pet"
            className="inline-flex rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
          >
            我的宠物
          </Link>

          <Link
            href="/social"
            className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
          >
            站内社交
          </Link>
        </div>
      </div>
    </main>
  );
}
