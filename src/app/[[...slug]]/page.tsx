import { ChorifyApp } from "@/components/chorify-app";

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  return <ChorifyApp route={slug.join("/") || "dashboard"} />;
}
