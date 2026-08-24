import UIKit

/// Shrinks a photo to a data URL the recognition endpoint will accept.
/// A phone original is easily 10MB; sending it whole would blow the request
/// limit and waste recognition tokens for no extra accuracy.
enum ImageEncoding {
    /// The server's body limit is 8MB and base64 adds about a third, so this
    /// leaves room for the JSON around it.
    private static let maxBytes = 6_000_000

    struct TooLarge: LocalizedError {
        var errorDescription: String? { "图片太大,压缩后仍超出上限,请换一张" }
    }

    /// Steps the edge length and quality down until the payload fits. Encoding
    /// once without checking can still exceed the limit for a high-resolution
    /// original, which the server then rejects.
    static func dataURL(from image: UIImage) throws -> String {
        var maxEdge: CGFloat = 1024
        var quality: CGFloat = 0.85

        for _ in 0..<5 {
            guard let data = resized(image, maxEdge: maxEdge).jpegData(compressionQuality: quality) else {
                break
            }
            if data.count <= maxBytes {
                return "data:image/jpeg;base64,\(data.base64EncodedString())"
            }
            maxEdge *= 0.75
            quality -= 0.15
        }
        throw TooLarge()
    }

    private static func resized(_ image: UIImage, maxEdge: CGFloat) -> UIImage {
        let longest = max(image.size.width, image.size.height)
        let scale = min(1, maxEdge / longest)
        guard scale < 1 else { return image }
        let target = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: target, format: {
            let format = UIGraphicsImageRendererFormat.default()
            format.scale = 1
            return format
        }())
        return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
    }
}
