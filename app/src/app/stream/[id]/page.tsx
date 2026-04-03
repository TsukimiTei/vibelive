import { use } from "react";
import { notFound } from "next/navigation";
import { MOCK_STREAMS } from "@/lib/mock-data";
import {
  CATEGORY_LABELS,
  PLATFORM_LABELS,
  TOOL_LABELS,
} from "@/lib/types";
import { StreamDetailClient } from "./StreamDetailClient";

export default function StreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const stream = MOCK_STREAMS.find((s) => s.id === id);

  if (!stream) {
    notFound();
  }

  return <StreamDetailClient stream={stream} />;
}
