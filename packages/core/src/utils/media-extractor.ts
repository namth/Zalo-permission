/**
 * Trích xuất tất cả URL hình ảnh từ chuỗi văn bản (link VietQR, file ảnh .png/.jpg, markdown image)
 */
export function extractImageUrls(input: string): string[] {
  if (!input) return [];
  const urls = new Set<string>();

  // 1. Markdown images: ![alt](url)
  const mdRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = mdRegex.exec(input)) !== null) {
    if (match[1]) urls.add(match[1]);
  }

  // 2. VietQR specific pattern (img.vietqr.io)
  const vietQrRegex = /https:\/\/img\.vietqr\.io\/image\/[^\s"'<>]+/gi;
  while ((match = vietQrRegex.exec(input)) !== null) {
    urls.add(match[0]);
  }

  // 3. Direct image URLs ending with common image extensions
  const directImgRegex = /https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s"'<>]*)?/gi;
  while ((match = directImgRegex.exec(input)) !== null) {
    urls.add(match[0]);
  }

  return Array.from(urls);
}
