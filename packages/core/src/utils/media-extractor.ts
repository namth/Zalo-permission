/**
 * Làm sạch URL, loại bỏ dấu ngoặc đơn hoặc dấu câu bị dính ở cuối URL do cú pháp markdown hoặc văn bản
 */
export function cleanUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  return rawUrl.trim().replace(/[),.;:!?\]]+$/, '');
}

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
    if (match[1]) urls.add(cleanUrl(match[1]));
  }

  // 2. VietQR specific pattern (img.vietqr.io) - loại trừ ngoặc đơn và ngoặc vuông markdown
  const vietQrRegex = /https:\/\/img\.vietqr\.io\/image\/[^\s"'<>)\]]+/gi;
  while ((match = vietQrRegex.exec(input)) !== null) {
    urls.add(cleanUrl(match[0]));
  }

  // 3. Direct image URLs ending with common image extensions
  const directImgRegex = /https?:\/\/[^\s"'<>)\]]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s"'<>)\]]*)?/gi;
  while ((match = directImgRegex.exec(input)) !== null) {
    urls.add(cleanUrl(match[0]));
  }

  return Array.from(urls);
}

/**
 * Xóa bỏ phần nội dung có chứa link ảnh đã được trích xuất (link markdown ![alt](url), link raw VietQR, 
 * và các dòng nhãn thừa như "- **Mã QR thanh toán:**") để chỉ gửi thông tin còn lại một cách ngắn gọn, súc tích.
 */
export function cleanTextAfterMediaExtraction(input: string, mediaUrls?: string[]): string {
  if (!input) return '';
  let cleaned = input;

  // 1. Loại bỏ cú pháp markdown ảnh: ![alt](url)
  cleaned = cleaned.replace(/!\[.*?\]\([^\s)]+\)/gi, '');

  // 2. Loại bỏ link ảnh trực tiếp
  const urlsToRemove = mediaUrls && mediaUrls.length > 0 ? mediaUrls : extractImageUrls(input);
  for (const rawUrl of urlsToRemove) {
    const url = cleanUrl(rawUrl);
    cleaned = cleaned.split(url).join('');
  }

  // 3. Loại bỏ các dòng tiêu đề/nhãn chỉ dùng để giới thiệu ảnh vừa bị xóa
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    // Khớp các dòng như "- **Mã QR thanh toán:**", "**Ảnh mã QR:**", "Mã QR:", "- Link ảnh:"
    const isImageLabel = /^(?:[-*+•]\s*)?(?:\*\*)?(?:ảnh\s+)?(?:mã\s+)?(?:qr(?:\s+code)?|hình\s+ảnh|vietqr)(?:\s+thanh\s+toán)?(?:\s*[:*]+)*\s*$/i.test(trimmed);
    if (isImageLabel) {
      return false;
    }
    // Khớp các dòng chỉ còn lại dấu gạch đầu dòng hoặc dấu sao/hai chấm trơ trọi
    if (/^(?:[-*+•]\s*)?(?:[*:\s]*)\s*$/.test(trimmed)) {
      return false;
    }
    return true;
  });

  cleaned = filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}
