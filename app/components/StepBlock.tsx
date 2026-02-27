export default function StepBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
