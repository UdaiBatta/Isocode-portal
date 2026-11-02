export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <section className="flex flex-col gap-3 py-12 text-center" role="status">
      <h2 className="text-title-2-medium">{title}</h2>
      {description ? <p className="text-headline-regular text-text-secondary">{description}</p> : null}
    </section>
  );
}
