export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-serif text-3xl text-paper">{title}</h1>
      </div>
      {action}
    </div>
  );
}
