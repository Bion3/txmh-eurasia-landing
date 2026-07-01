export const publicSalesEmail = "Benjamin@eurasiago.com";

export function buildFallbackInquiry({ subject, lines }) {
  const body = lines
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
  const text = [`To: ${publicSalesEmail}`, `Subject: ${subject}`, "", body].join("\n");
  const mailto = `mailto:${encodeURIComponent(publicSalesEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    subject,
    body,
    text,
    mailto,
  };
}
