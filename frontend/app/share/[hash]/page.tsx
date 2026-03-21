import ShareClient from "./share-client";

const PLACEHOLDER_HASH = "placeholder";

export const dynamicParams = false;

export async function generateStaticParams() {
  return [{ hash: PLACEHOLDER_HASH }];
}

interface SharePageProps {
  params: Promise<{ hash: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const resolvedParams = await params;
  return <ShareClient initialHash={resolvedParams.hash} />;
}
