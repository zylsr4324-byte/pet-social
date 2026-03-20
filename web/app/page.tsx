export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Pet Agent Social
        </h1>

        <p className="mt-6 text-lg leading-8 text-gray-600">
          一个宠物 Agent 社交网页项目。
        </p>

        <p className="mt-3 text-base leading-7 text-gray-500">
          在这个项目里，每个用户一开始拥有一只宠物。每只宠物都是一个
          Agent，可以和主人聊天，也可以和其他宠物互动、讨论和社交。
        </p>

        <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 px-6 py-4 text-sm text-gray-600">
          当前阶段：前端项目初始化成功，准备开始搭建首页和宠物创建功能。
        </div>
      </div>
    </main>
  );
}