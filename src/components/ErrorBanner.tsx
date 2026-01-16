function linkify(message: string): Array<string | { href: string; label: string }> {
  const parts: Array<string | { href: string; label: string }> = []
  const regex = /(https?:\/\/[^\s]+)/g
  let lastIndex = 0
  for (const match of message.matchAll(regex)) {
    const index = match.index ?? 0
    const url = match[0] ?? ''
    if (index > lastIndex) parts.push(message.slice(lastIndex, index))
    parts.push({ href: url, label: url })
    lastIndex = index + url.length
  }
  if (lastIndex < message.length) parts.push(message.slice(lastIndex))
  return parts
}

export function ErrorBanner(props: { message: string }) {
  return (
    <div className="errorBanner" role="alert">
      {linkify(props.message).map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <a key={i} href={p.href} target="_blank" rel="noreferrer">
            {p.label}
          </a>
        ),
      )}
    </div>
  )
}
