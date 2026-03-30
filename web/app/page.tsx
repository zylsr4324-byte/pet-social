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
          每只宠物都拥有自己的设定、聊天能力和站内社交关系。当前版本已经支持多宠物切换、生存状态、站内社交，以及基础家庭场景。
        </p>

        <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 px-6 py-4 text-sm text-gray-600">
          当前阶段：社区广场基础页已经接入，接下来继续沿路线图补完更完整的宠物社区能力。
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
            href="/my-pets"
            className="inline-flex rounded-lg border border-violet-300 bg-violet-50 px-5 py-3 text-sm font-medium text-violet-800 transition hover:bg-violet-100"
          >
            宠物管理
          </Link>

          <Link
            href="/social"
            className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
          >
            站内社交
          </Link>

          <Link
            href="/community"
            className="inline-flex rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
          >
            社区广场
          </Link>

          <Link
            href="/home"
            className="inline-flex rounded-lg border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-medium text-sky-800 transition hover:bg-sky-100"
          >
            家庭场景
          </Link>

          <Link
            href="/shop"
            className="inline-flex rounded-lg border border-orange-300 bg-orange-50 px-5 py-3 text-sm font-medium text-orange-800 transition hover:bg-orange-100"
          >
            家具商店
          </Link>
        </div>
      </div>
    </main>
  );
}
