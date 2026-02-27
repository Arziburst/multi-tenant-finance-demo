export default function ResponsePreview({
  content,
}: {
  content: string;
}) {
  if (!content) return null;
  return <pre className="response">{content}</pre>;
}
