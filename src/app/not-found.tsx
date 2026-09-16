import Link from "next/link";
export default function NotFound() {
  return (
    <main className="placeholder-page">
      <h1>这条学习路线还不存在</h1>
      <p>回到首页，继续今天的一小步。</p>
      <Link className="primary-button" href="/">
        返回首页
      </Link>
    </main>
  );
}
