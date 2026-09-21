import { LoginForm } from "@/components/AuthForms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ deleted?: string; error?: string }> }) {
  const sp = await searchParams;
  return <LoginForm notice={sp.deleted ? "deleted" : sp.error === "link" ? "link" : null} />;
}
