/** 粘贴图片：先读为 data URL，再降采样压缩为 JPEG（≤1600px），原始图更小则保留原样。 */
export function compressImage(dataUrl: string, maxWidth = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.fillStyle = '#fff'; // JPEG 无透明通道
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const jpeg = canvas.toDataURL('image/jpeg', quality);
        resolve(jpeg.length < dataUrl.length ? jpeg : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('图片解析失败'));
    img.src = dataUrl;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}
