/**
 * 压缩到最长边 1024 再转 dataURL。
 * 手机原图动辄 10MB,直传会超请求上限,也白费识别的 token。
 * 电脑端和手机上传页共用。
 */
/** 后端 readBody 上限 8MB;base64 比原始字节大约 33%,留出余量。 */
const MAX_DATA_URL_BYTES = 6_000_000;

export function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      // 逐步降边长和质量,直到体积达标。之前只压一次不校验,
      // 高分辨率原图压完仍可能顶到上限,后端就报 413/500。
      let maxEdge = 1024;
      let quality = 0.85;
      let out = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        out = canvas.toDataURL("image/jpeg", quality);
        if (out.length <= MAX_DATA_URL_BYTES) break;
        maxEdge = Math.round(maxEdge * 0.75);
        quality -= 0.15;
      }

      URL.revokeObjectURL(objectUrl);
      if (out.length > MAX_DATA_URL_BYTES) {
        reject(new Error("图片太大,压缩后仍超出上限,请换一张"));
        return;
      }
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("无法读取图片"));
    };
    img.src = objectUrl;
  });
}
