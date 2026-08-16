// src/utils/resizeImage.js
// Downscales an image File to a data URL via a canvas, keeping it small
// enough to store inline (e.g. as a Firestore field) instead of needing a
// separate file-storage service. Shared by BrandingSettings.jsx (school
// logo) and EditLearnerModal.jsx (learner ID photo).

export function resizeImageToCanvas(file, maxWidth = 200, maxHeight = 200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = readerEvent.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export default resizeImageToCanvas;
