import FilesClient from "./files-client";

export function generateStaticParams() {
  return [{ path: [] }];
}

interface FilesPageProps {
  params: Promise<{ path?: string[] }>;
}

export default function FilesPage({ params }: FilesPageProps) {
  return <FilesClient params={params} />;
}
