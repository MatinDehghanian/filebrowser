import { useParams } from "react-router-dom";
import ShareClient from "./share-client";

export default function SharePage() {
  const { hash } = useParams();

  if (!hash) {
    return null;
  }

  return <ShareClient initialHash={hash} />;
}
