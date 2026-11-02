import { PageSkeleton } from "@/components/app/PageSkeleton";
import { getLanguage } from "@/lib/i18n/server";

export default async function Loading() {
  return <PageSkeleton language={await getLanguage()} />;
}
